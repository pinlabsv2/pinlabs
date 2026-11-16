import type { QueryRunner } from '../pg.js';
import { renderTemplate, type TemplateSource, type TemplateValues } from './render.js';

export type EnqueueTemplateInput = {
  templateKey: string;
  recipient: string;
  values: TemplateValues;
  purpose: string;
  kind: 'transactional' | 'internal' | 'marketing';
  idempotencyKey: string;
  orderId?: string;
  campaignId?: string;
  campaignRecipientId?: string;
  dueAt?: string;
  headers?: Record<string, string>;
  source?: TemplateSource;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function senderAddress(value: string) {
  const bracketed = value.match(/<\s*([^<>\s]+@[^<>\s]+)\s*>\s*$/);
  const address = (bracketed?.[1] ?? value).trim().toLowerCase();
  return emailPattern.test(address) ? address : '';
}

export async function enqueueTemplate(tx: QueryRunner, input: EnqueueTemplateInput) {
  const recipient = input.recipient.trim().toLowerCase();
  if (!emailPattern.test(recipient)) return undefined;
  const { rows: templates } = await tx.query(
    `SELECT * FROM "EmailTemplates" WHERE "templateKey" = $1 AND "enabled" IS TRUE LIMIT 1`,
    [input.templateKey],
  );
  const template = templates[0];
  if (!template) return undefined;
  const { rows: settingsRows } = await tx.query(`SELECT * FROM "StoreSettings" ORDER BY "createdAt" LIMIT 1`);
  const settings = settingsRows[0] ?? {};
  const brandName = String(settings.storeName || 'PinLabs').trim() || 'PinLabs';
  const fromAddress = senderAddress(process.env.EMAIL_FROM || '') || 'no-reply@localhost';
  const configuredReplyTo = senderAddress(process.env.EMAIL_REPLY_TO || '');
  const adminReplyTo = senderAddress(String(settings.adminEmail || ''));
  const rendered = renderTemplate(input.source ?? {
    templateKey: String(template.templateKey),
    mode: template.mode === 'advanced_html' ? 'advanced_html' : 'structured',
    subject: String(template.subject || ''),
    preheader: String(template.preheader || ''),
    heading: String(template.heading || ''),
    bodyText: String(template.bodyText || ''),
    ctaLabel: String(template.ctaLabel || ''),
    ctaUrlTemplate: String(template.ctaUrlTemplate || ''),
    advancedHtml: String(template.advancedHtml || ''),
    advancedText: String(template.advancedText || ''),
  }, { ...input.values, 'brand.name': brandName }, {
    name: brandName,
    primary: typeof settings.primaryColor === 'string' ? settings.primaryColor : undefined,
    accent: typeof settings.accentColor === 'string' ? settings.accentColor : undefined,
  });
  const id = crypto.randomUUID();
  const { rows } = await tx.query(
    `INSERT INTO "EmailOutbox" (
      "id","recipient","templateKey","templateVersion","payloadJson","kind","purpose","idempotencyKey","state",
      "subjectSnapshot","htmlSnapshot","textSnapshot","fromNameSnapshot","fromAddressSnapshot","replyToSnapshot","headersJson",
      "orderId","campaignId","campaignRecipientId","attemptCount","maxAttempts","nextAttemptAt"
    ) VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,'queued',$9,$10,$11,$12,$13,$14,$15::jsonb,$16,$17,$18,0,6,$19)
    ON CONFLICT ("idempotencyKey") DO NOTHING RETURNING "id"`,
    [
      id, recipient, input.templateKey, Number(template.version || 1), JSON.stringify(input.values), input.kind, input.purpose,
      input.idempotencyKey, rendered.subject, rendered.html, rendered.text, brandName, fromAddress, configuredReplyTo || adminReplyTo || null,
      JSON.stringify(input.headers ?? {}), input.orderId ?? null, input.campaignId ?? null, input.campaignRecipientId ?? null,
      input.dueAt ?? new Date().toISOString(),
    ],
  );
  return rows[0]?.id as string | undefined;
}

export async function cancelOrderEmails(tx: QueryRunner, orderId: string, purposes: string[], reason: string) {
  if (!purposes.length) return 0;
  const { rows } = await tx.query(
    `UPDATE "EmailOutbox" SET "state" = 'cancelled', "cancelReason" = $3, "cancelledAt" = now(), "updatedAt" = now()
     WHERE "orderId" = $1 AND "purpose" = ANY($2::text[]) AND "state" IN ('queued','retry','uncertain') RETURNING "id"`,
    [orderId, purposes, reason],
  );
  return rows.length;
}
