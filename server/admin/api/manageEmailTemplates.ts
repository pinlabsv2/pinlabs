import { z } from 'zod';
import { AppError, createEndpoint } from '../../core/endpoint.js';
import { db } from '../../core/db.js';
import { enqueueTemplate } from '../../core/email/enqueue.js';
import { allowedVariables, isTemplateKey } from '../../core/email/registry.js';
import { renderTemplate, sanitizeAdvancedHtml } from '../../core/email/render.js';
import { runEmailMaintenance } from '../../core/email/worker.js';

const templateSchema = z.object({
  templateKey: z.string(),
  mode: z.enum(['structured', 'advanced_html']),
  subject: z.string().trim().min(1).max(300),
  preheader: z.string().max(500),
  heading: z.string().max(300),
  bodyText: z.string().max(50_000),
  ctaLabel: z.string().max(120),
  ctaUrlTemplate: z.string().max(2_000),
  advancedHtml: z.string().max(100_000),
  advancedText: z.string().max(50_000),
  enabled: z.boolean(),
});

const inputSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('list') }),
  z.object({ action: z.literal('save'), template: templateSchema }),
  z.object({ action: z.literal('preview'), template: templateSchema }),
  z.object({ action: z.literal('test'), templateKey: z.string(), recipient: z.string().trim().email().max(320) }),
]);

const bad = (message: string) => new AppError({ code: 'BAD_REQUEST', message, userFacingMessage: message });
const fixtureValues = {
  'brand.name': 'PinLabs',
  'customer.firstName': 'Alex',
  'customer.name': 'Alex Researcher',
  'customer.email': 'alex@example.com',
  'order.number': 'PL-DEMO01',
  'order.cryptoAmount': '0.012345',
  'order.payCurrency': 'BTC',
  'order.total': '$125.00',
  'order.url': 'https://example.test/orders/demo',
  'order.adminUrl': 'https://example.test/admin/orders',
  'order.paymentExpiresAt': 'November 15, 2026 at 4:30 PM',
  'order.trackingNumber': 'DEMO123456789',
  'order.status': 'In Transit',
  'campaign.subject': 'A new announcement',
  'campaign.heading': 'something new',
  'campaign.body': 'A preview of your announcement appears here.',
  'campaign.ctaLabel': 'Learn more',
  'campaign.ctaUrl': 'https://example.test',
  'campaign.unsubscribeUrl': 'https://example.test/unsubscribe',
} satisfies Record<string, string>;

type RawTemplate = Record<string, unknown>;

function assertEditableKey(templateKey: string) {
  if (!isTemplateKey(templateKey) || templateKey === 'campaign_announcement') throw bad('That transactional template is not editable here.');
}

function sourceFromInput(template: z.infer<typeof templateSchema>) {
  assertEditableKey(template.templateKey);
  return {
    ...template,
    advancedHtml: template.mode === 'advanced_html' ? sanitizeAdvancedHtml(template.advancedHtml) : template.advancedHtml,
  };
}

function publicTemplate(row: RawTemplate) {
  const templateKey = String(row.templateKey ?? '');
  return {
    templateKey,
    name: String(row.name ?? templateKey),
    kind: String(row.kind ?? 'transactional'),
    mode: row.mode === 'advanced_html' ? 'advanced_html' as const : 'structured' as const,
    subject: String(row.subject ?? ''),
    preheader: String(row.preheader ?? ''),
    heading: String(row.heading ?? ''),
    bodyText: String(row.bodyText ?? ''),
    ctaLabel: String(row.ctaLabel ?? ''),
    ctaUrlTemplate: String(row.ctaUrlTemplate ?? ''),
    advancedHtml: String(row.advancedHtml ?? ''),
    advancedText: String(row.advancedText ?? ''),
    version: Number(row.version ?? 1),
    enabled: row.enabled !== false,
    allowedVariables: [...allowedVariables(templateKey)],
    updatedAt: row.updatedAt == null ? null : String(row.updatedAt),
  };
}

async function brand(tx?: { query: (sql: string, params?: unknown[]) => Promise<{ rows: any[] }> }) {
  const rows = tx
    ? (await tx.query(`SELECT * FROM "StoreSettings" ORDER BY "createdAt" LIMIT 1`)).rows
    : (await db.sql({ query: `SELECT * FROM "StoreSettings" ORDER BY "createdAt" LIMIT 1` })).rows;
  const settings = rows[0] ?? {};
  return {
    name: String(settings.storeName || 'PinLabs'),
    primary: typeof settings.primaryColor === 'string' ? settings.primaryColor : undefined,
    accent: typeof settings.accentColor === 'string' ? settings.accentColor : undefined,
  };
}

async function listTemplates() {
  const { rows } = await db.sql({ query: `SELECT * FROM "EmailTemplates" WHERE COALESCE("kind", 'transactional') <> 'marketing' ORDER BY "name", "templateKey"` });
  return rows.map(publicTemplate);
}

export default createEndpoint({
  description: 'Lists, edits, previews, and tests branded transactional email templates',
  inputSchema,
  execute: async ({ input, context }) => {
    if (input.action === 'list') {
      return {
        action: 'list' as const,
        templates: await listTemplates(),
        providerMode: process.env.EMAIL_PROVIDER_MODE === 'live' ? 'live' as const : 'fake' as const,
        senderConfigured: !!process.env.EMAIL_FROM,
      };
    }

    if (input.action === 'preview') {
      const source = sourceFromInput(input.template);
      const rendered = renderTemplate(source, fixtureValues, await brand());
      return { action: 'preview' as const, preview: rendered };
    }

    if (input.action === 'save') {
      const source = sourceFromInput(input.template);
      renderTemplate(source, fixtureValues, await brand());
      const saved = await db.transaction(async (tx) => {
        const { rows } = await tx.query(`SELECT * FROM "EmailTemplates" WHERE "templateKey" = $1 FOR UPDATE`, [source.templateKey]);
        const current = rows[0];
        if (!current || current.kind === 'marketing') throw bad('Template not found.');
        const nextVersion = Number(current.version ?? 1) + 1;
        const updated = await tx.query(
          `UPDATE "EmailTemplates" SET "mode" = $2, "subject" = $3, "preheader" = $4, "heading" = $5,
            "bodyText" = $6, "ctaLabel" = $7, "ctaUrlTemplate" = $8, "advancedHtml" = $9,
            "advancedText" = $10, "enabled" = $11, "version" = $12, "updatedBy" = $13, "updatedAt" = now()
           WHERE "templateKey" = $1 RETURNING *`,
          [source.templateKey, source.mode, source.subject, source.preheader, source.heading, source.bodyText,
            source.ctaLabel, source.ctaUrlTemplate, source.advancedHtml, source.advancedText, source.enabled,
            nextVersion, context.user.id],
        );
        await tx.query(
          `INSERT INTO "AuditEvents" ("id","actorType","actorId","action","entityType","entityId","requestId","beforeJson","afterJson","metadataJson")
           VALUES ($1,'admin',$2,'email_template.update','EmailTemplate',$3,$4,$5::jsonb,$6::jsonb,$7::jsonb)`,
          [crypto.randomUUID(), context.user.id, String(current.id), context.request.requestId ?? null,
            JSON.stringify({ version: Number(current.version ?? 1), enabled: current.enabled !== false, mode: current.mode ?? 'structured' }),
            JSON.stringify({ version: nextVersion, enabled: source.enabled, mode: source.mode }),
            JSON.stringify({ templateKey: source.templateKey, changedFields: ['mode', 'subject', 'preheader', 'heading', 'bodyText', 'ctaLabel', 'ctaUrlTemplate', 'advancedHtml', 'advancedText', 'enabled'] })],
        );
        return publicTemplate(updated.rows[0]);
      });
      return { action: 'save' as const, template: saved };
    }

    assertEditableKey(input.templateKey);
    const allowed = new Set([context.user.email.trim().toLowerCase()]);
    const { rows: settings } = await db.sql({ query: `SELECT "adminEmail" FROM "StoreSettings" ORDER BY "createdAt" LIMIT 1` });
    const adminEmail = typeof settings[0]?.adminEmail === 'string' ? settings[0].adminEmail.trim().toLowerCase() : '';
    if (adminEmail) allowed.add(adminEmail);
    const recipient = input.recipient.trim().toLowerCase();
    if (!allowed.has(recipient)) throw bad('Test email must go to your signed-in email or the configured admin email.');

    const queued = await db.transaction(async (tx) => {
      const { rows } = await tx.query(`SELECT "version", "enabled" FROM "EmailTemplates" WHERE "templateKey" = $1 FOR UPDATE`, [input.templateKey]);
      if (!rows[0]) throw bad('Template not found.');
      if (rows[0].enabled !== true) throw bad('Enable and save this template before sending a test.');
      const id = await enqueueTemplate(tx, {
        templateKey: input.templateKey,
        recipient,
        values: fixtureValues,
        purpose: 'template_test',
        kind: 'transactional',
        idempotencyKey: `template-test:${input.templateKey}:${rows[0].version}:${crypto.randomUUID()}`,
      });
      if (!id) throw bad('The test email could not be queued.');
      await tx.query(`UPDATE "EmailOutbox" SET "subjectSnapshot" = '[TEST] ' || "subjectSnapshot" WHERE "id" = $1`, [id]);
      return { id, version: Number(rows[0].version ?? 1) };
    });
    await runEmailMaintenance({ limit: 1, outboxId: queued.id });
    const outbox = await db.emailOutbox.findOne({ id: queued.id });
    if (outbox?.state !== 'sent') throw bad(outbox?.error || 'The test email was queued but not accepted by the provider.');
    return { action: 'test' as const, recipient, version: queued.version, sentAt: outbox.sentAt ?? new Date().toISOString() };
  },
});
