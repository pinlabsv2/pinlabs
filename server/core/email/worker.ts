import { db } from '../db.js';
import type { EmailProvider } from '../providers/types.js';
import { ProviderError } from '../providers/types.js';
import { createProviderBundle } from '../providers/index.js';

type OutboxRow = Record<string, unknown>;

function jsonObject(value: unknown): Record<string, string> {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
  } catch {
    return {};
  }
}

async function leaseBatch(limit: number, workerId: string, outboxId?: string) {
  return db.transaction(async (tx) => {
    const { rows } = await tx.query(
      `SELECT * FROM "EmailOutbox"
       WHERE "state" IN ('queued','retry','uncertain') AND COALESCE("nextAttemptAt", now()) <= now()
         AND ("leaseExpiresAt" IS NULL OR "leaseExpiresAt" < now()) AND ($2::text IS NULL OR "id" = $2)
       ORDER BY COALESCE("nextAttemptAt", "createdAt"), "createdAt", "id"
       LIMIT $1 FOR UPDATE SKIP LOCKED`,
      [limit, outboxId ?? null],
    );
    const leased: OutboxRow[] = [];
    for (const row of rows) {
      const updated = await tx.query(
        `UPDATE "EmailOutbox" SET "state" = 'leased', "leaseOwner" = $2, "leaseExpiresAt" = now() + interval '45 seconds',
          "attemptCount" = COALESCE("attemptCount", 0) + 1, "lastAttemptAt" = now(), "updatedAt" = now()
         WHERE "id" = $1 AND "state" IN ('queued','retry','uncertain') RETURNING *`,
        [row.id, workerId],
      );
      if (updated.rows[0]) leased.push(updated.rows[0]);
    }
    return leased;
  });
}

async function suppressReason(row: OutboxRow) {
  if (row.purpose === 'payment_due') {
    const order = await db.orders.findOne({ id: String(row.orderId || '') });
    if (!order || order.status !== 'Awaiting Payment' || order.paidAt || !order.paymentExpiresAt || Date.now() >= new Date(order.paymentExpiresAt).getTime()) return 'payment_not_due';
  }
  if (row.kind === 'marketing') {
    const { records } = await db.marketingContacts.findAll({ filters: { email: String(row.recipient || '').toLowerCase() }, limit: 1 });
    if (!records[0] || records[0].state !== 'eligible') return 'marketing_suppressed';
  }
  return '';
}

async function markSuppressed(row: OutboxRow, reason: string) {
  await db.sql({ query: `UPDATE "EmailOutbox" SET "state" = 'suppressed', "cancelReason" = $2, "leaseOwner" = NULL, "leaseExpiresAt" = NULL, "updatedAt" = now() WHERE "id" = $1 AND "state" = 'leased'`, params: [row.id, reason] });
  if (row.campaignRecipientId) await db.sql({ query: `UPDATE "CampaignRecipients" SET "state" = 'suppressed', "suppressionReason" = $2, "suppressedAt" = now(), "updatedAt" = now() WHERE "id" = $1`, params: [row.campaignRecipientId, reason] });
}

async function markSent(row: OutboxRow, providerMessageId: string, raw: Record<string, unknown>) {
  await db.sql({ query: `UPDATE "EmailOutbox" SET "state" = 'sent', "providerMessageId" = $2, "providerResponseJson" = $3::jsonb, "sentAt" = now(), "leaseOwner" = NULL, "leaseExpiresAt" = NULL, "error" = NULL, "updatedAt" = now() WHERE "id" = $1 AND "state" = 'leased'`, params: [row.id, providerMessageId, JSON.stringify(raw)] });
  if (row.campaignRecipientId) await db.sql({ query: `UPDATE "CampaignRecipients" SET "state" = 'sent', "providerMessageId" = $2, "sentAt" = now(), "updatedAt" = now() WHERE "id" = $1`, params: [row.campaignRecipientId, providerMessageId] });
}

async function markFailed(row: OutboxRow, error: unknown) {
  const attempts = Number(row.attemptCount || 1);
  const maxAttempts = Number(row.maxAttempts || 6);
  const retryable = error instanceof ProviderError && error.retryable;
  const ambiguous = error instanceof ProviderError && ['timeout', 'network_error'].includes(error.code);
  const terminal = !retryable || attempts >= maxAttempts;
  const state = terminal ? 'failed' : ambiguous ? 'uncertain' : 'retry';
  const delaySeconds = Math.min(3600, 30 * 2 ** Math.max(0, attempts - 1)) + Math.floor(Math.random() * 15);
  const message = error instanceof Error ? error.message.slice(0, 500) : 'Email provider failed';
  await db.sql({
    query: `UPDATE "EmailOutbox" SET "state" = $2, "error" = $3, "failedAt" = CASE WHEN $2 = 'failed' THEN now() ELSE NULL END,
      "nextAttemptAt" = CASE WHEN $2 = 'failed' THEN "nextAttemptAt" ELSE now() + ($4 * interval '1 second') END,
      "leaseOwner" = NULL, "leaseExpiresAt" = NULL, "updatedAt" = now() WHERE "id" = $1 AND "state" = 'leased'`,
    params: [row.id, state, message, delaySeconds],
  });
  if (terminal && row.campaignRecipientId) await db.sql({ query: `UPDATE "CampaignRecipients" SET "state" = 'failed', "failedAt" = now(), "updatedAt" = now() WHERE "id" = $1`, params: [row.campaignRecipientId] });
}

async function refreshCampaign(campaignId: string) {
  const { rows } = await db.sql({
    query: `SELECT "state", count(*)::int AS n FROM "CampaignRecipients" WHERE "campaignId" = $1 GROUP BY "state"`,
    params: [campaignId],
  });
  const counts = Object.fromEntries(rows.map((row) => [String(row.state), Number(row.n)]));
  const pending = Number(counts.pending ?? 0) + Number(counts.queued ?? 0);
  await db.sql({
    query: `UPDATE "Campaigns" SET "failedCount" = $2, "suppressedCount" = $3,
      "state" = CASE WHEN $4 = 0 AND "state" = 'queued' THEN 'completed' ELSE "state" END,
      "completedAt" = CASE WHEN $4 = 0 AND "state" = 'queued' THEN now() ELSE "completedAt" END,
      "updatedAt" = now() WHERE "id" = $1`,
    params: [campaignId, Number(counts.failed ?? 0), Number(counts.suppressed ?? 0), pending],
  });
}

export async function runEmailMaintenance(options: { limit?: number; provider?: EmailProvider; outboxId?: string } = {}) {
  const provider = options.provider ?? createProviderBundle().email;
  const workerId = crypto.randomUUID();
  const rows = await leaseBatch(Math.min(Math.max(options.limit ?? 20, 1), 50), workerId, options.outboxId);
  const result = { leased: rows.length, sent: 0, suppressed: 0, retried: 0, failed: 0 };
  for (const row of rows) {
    const suppression = await suppressReason(row);
    if (suppression) {
      await markSuppressed(row, suppression);
      result.suppressed++;
      if (row.campaignId && row.campaignRecipientId) await refreshCampaign(String(row.campaignId));
      continue;
    }
    try {
      const fromName = String(row.fromNameSnapshot || '').replace(/[\r\n<>]/g, '').trim();
      const fromAddress = String(row.fromAddressSnapshot || '').trim();
      const response = await provider.sendEmail({
        from: fromName ? `${fromName} <${fromAddress}>` : fromAddress,
        to: [String(row.recipient || '')],
        subject: String(row.subjectSnapshot || ''),
        html: String(row.htmlSnapshot || ''),
        text: String(row.textSnapshot || ''),
        replyTo: row.replyToSnapshot ? String(row.replyToSnapshot) : undefined,
        headers: jsonObject(row.headersJson),
      }, String(row.idempotencyKey || row.id));
      await markSent(row, response.providerMessageId, response.raw);
      result.sent++;
    } catch (error) {
      await markFailed(row, error);
      const refreshed = await db.emailOutbox.findOne({ id: String(row.id) });
      if (refreshed?.state === 'failed') result.failed++; else result.retried++;
    }
    if (row.campaignId && row.campaignRecipientId) await refreshCampaign(String(row.campaignId));
  }
  return result;
}
