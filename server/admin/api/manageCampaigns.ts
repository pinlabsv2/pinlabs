import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { AppError, createEndpoint } from '../../core/endpoint.js';
import { db } from '../../core/db.js';
import { isAdminEmail } from '../../core/auth.js';
import type { QueryRunner } from '../../core/pg.js';
import { enqueueTemplate } from '../../core/email/enqueue.js';
import { renderTemplate, sanitizeAdvancedHtml, type TemplateSource } from '../../core/email/render.js';
import { createUnsubscribeToken } from '../../core/email/unsubscribe.js';
import { runEmailMaintenance } from '../../core/email/worker.js';

const campaignSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(160),
  subject: z.string().trim().min(1).max(300),
  mode: z.enum(['structured', 'advanced_html']),
  preheader: z.string().max(500),
  heading: z.string().max(300),
  bodyText: z.string().max(50_000),
  ctaLabel: z.string().max(120),
  ctaUrl: z.string().max(2_000),
  advancedHtml: z.string().max(100_000),
  advancedText: z.string().max(50_000),
  audienceType: z.enum(['all_accounts', 'customer_accounts']),
});

const inputSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('list') }),
  z.object({ action: z.literal('save'), campaign: campaignSchema }),
  z.object({ action: z.literal('count'), id: z.string() }),
  z.object({ action: z.literal('test'), id: z.string(), recipient: z.string().email().max(320) }),
  z.object({ action: z.literal('review'), id: z.string() }),
  z.object({ action: z.literal('confirm'), id: z.string(), revision: z.number().int().positive(), expectedCount: z.number().int().nonnegative(), nonce: z.string().min(20).max(300) }),
  z.object({ action: z.literal('cancel'), id: z.string() }),
]);

const bad = (message: string) => new AppError({ code: 'BAD_REQUEST', message, userFacingMessage: message });
const fixture = {
  'brand.name': 'PinLabs', 'customer.firstName': 'Alex', 'customer.name': 'Alex Researcher',
  'campaign.subject': 'Campaign preview', 'campaign.heading': 'campaign preview', 'campaign.body': 'Campaign preview body',
  'campaign.ctaLabel': 'Learn more', 'campaign.ctaUrl': 'https://example.test', 'campaign.unsubscribeUrl': 'https://example.test/unsubscribe',
};

type CampaignRow = Record<string, any>;
type Recipient = { contactId: string; customerId: string; email: string; role: string; firstName: string; lastName: string };

function siteUrl() {
  const configured = process.env.PUBLIC_APP_URL?.trim().replace(/\/$/, '');
  if (configured && /^https?:\/\//i.test(configured)) return configured;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim().replace(/\/$/, '');
  return vercel ? `https://${vercel}` : 'http://localhost:3000';
}

function source(row: CampaignRow): TemplateSource {
  return {
    templateKey: 'campaign_announcement',
    mode: row.mode === 'advanced_html' ? 'advanced_html' : 'structured',
    subject: String(row.subject || ''), preheader: String(row.preheader || ''), heading: String(row.heading || ''),
    bodyText: String(row.bodyText || ''), ctaLabel: String(row.ctaLabel || ''), ctaUrlTemplate: String(row.ctaUrl || ''),
    advancedHtml: String(row.advancedHtml || ''), advancedText: String(row.advancedText || ''),
  };
}

async function brand(runner: QueryRunner) {
  const { rows } = await runner.query(`SELECT * FROM "StoreSettings" ORDER BY "createdAt" LIMIT 1`);
  return { name: String(rows[0]?.storeName || 'PinLabs'), primary: rows[0]?.primaryColor, accent: rows[0]?.accentColor };
}

async function eligible(runner: QueryRunner, audienceType: string): Promise<Recipient[]> {
  const { rows } = await runner.query(
    `SELECT DISTINCT ON (lower(u."email")) mc."id" AS "contactId", u."id" AS "customerId", lower(u."email") AS "email",
       COALESCE(u."role", 'customer') AS "role", COALESCE(u."firstName", '') AS "firstName", COALESCE(u."lastName", '') AS "lastName"
     FROM "Users" u JOIN "MarketingContacts" mc ON (mc."userId" = u."id" OR lower(mc."email") = lower(u."email"))
     WHERE mc."state" = 'eligible' AND u."email" IS NOT NULL AND trim(u."email") <> ''
       AND ($1 = 'all_accounts' OR COALESCE(u."role", 'customer') = 'customer')
     ORDER BY lower(u."email"), mc."createdAt", mc."id"`,
    [audienceType],
  );
  const recipients = rows as Recipient[];
  return audienceType === 'customer_accounts' ? recipients.filter((recipient) => !isAdminEmail(recipient.email)) : recipients;
}

function publicCampaign(row: CampaignRow, counts: Record<string, number> = {}) {
  const recipientCount = Number(row.recipientCount || 0);
  const finishedCount = (counts.sent ?? 0) + (counts.failed ?? 0) + (counts.suppressed ?? 0);
  const state = row.state === 'queued' && recipientCount > 0 && finishedCount >= recipientCount ? 'completed' : String(row.state || 'draft');
  return {
    id: String(row.id), name: String(row.name || ''), subject: String(row.subject || ''),
    mode: row.mode === 'advanced_html' ? 'advanced_html' as const : 'structured' as const,
    preheader: String(row.preheader || ''), heading: String(row.heading || ''), bodyText: String(row.bodyText || ''),
    ctaLabel: String(row.ctaLabel || ''), ctaUrl: String(row.ctaUrl || ''), advancedHtml: String(row.advancedHtml || ''),
    advancedText: String(row.advancedText || ''), audienceType: row.audienceType === 'all_accounts' ? 'all_accounts' as const : 'customer_accounts' as const,
    revision: Number(row.revision || 1), state, testRevision: row.testRevision == null ? null : Number(row.testRevision),
    testRecipient: String(row.testRecipient || ''), testSentAt: row.testSentAt == null ? null : String(row.testSentAt),
    eligibleRecipientCount: Number(row.eligibleRecipientCount || 0), createdAt: String(row.createdAt || ''), updatedAt: String(row.updatedAt || ''), counts: counts ?? {},
  };
}

async function listCampaigns() {
  const { rows } = await db.sql({ query: `SELECT * FROM "Campaigns" ORDER BY "createdAt" DESC, "id"` });
  const aggregate = await db.sql({ query: `SELECT "campaignId", "state", count(*)::int AS n FROM "CampaignRecipients" GROUP BY "campaignId", "state"` });
  const counts = new Map<string, Record<string, number>>();
  for (const item of aggregate.rows) counts.set(String(item.campaignId), { ...(counts.get(String(item.campaignId)) ?? {}), [String(item.state)]: Number(item.n) });
  return rows.map((row) => publicCampaign(row, counts.get(String(row.id))));
}

function nonceHash(value: string) { return createHash('sha256').update(value).digest('hex'); }
function sameHash(actual: string, expected: string) {
  const a = Buffer.from(actual); const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export default createEndpoint({
  description: 'Creates, tests, reviews, confirms, and cancels promotional campaigns',
  inputSchema,
  execute: async ({ input, context }) => {
    if (input.action === 'list') return { action: 'list' as const, campaigns: await listCampaigns() };

    if (input.action === 'save') {
      const value = { ...input.campaign, advancedHtml: input.campaign.mode === 'advanced_html' ? sanitizeAdvancedHtml(input.campaign.advancedHtml) : input.campaign.advancedHtml };
      renderTemplate(source(value), fixture, await db.transaction((tx) => brand(tx)));
      const id = value.id ?? crypto.randomUUID();
      await db.transaction(async (tx) => {
        const current = value.id ? (await tx.query(`SELECT * FROM "Campaigns" WHERE "id" = $1 FOR UPDATE`, [id])).rows[0] : undefined;
        if (value.id && !current) throw bad('Campaign not found.');
        if (current && current.state !== 'draft') throw bad('Only draft campaigns can be edited.');
        const revision = current ? Number(current.revision || 1) + 1 : 1;
        if (current) {
          await tx.query(
            `UPDATE "Campaigns" SET "name"=$2,"subject"=$3,"mode"=$4,"preheader"=$5,"heading"=$6,"bodyText"=$7,
             "ctaLabel"=$8,"ctaUrl"=$9,"advancedHtml"=$10,"advancedText"=$11,"audienceType"=$12,"revision"=$13,
             "testSentAt"=NULL,"testRecipient"=NULL,"testOutboxId"=NULL,"testRevision"=NULL,"confirmationNonceHash"=NULL,
             "confirmationExpiresAt"=NULL,"eligibleRecipientCount"=0,"updatedAt"=now() WHERE "id"=$1`,
            [id,value.name,value.subject,value.mode,value.preheader,value.heading,value.bodyText,value.ctaLabel,value.ctaUrl,value.advancedHtml,value.advancedText,value.audienceType,revision],
          );
        } else {
          await tx.query(
            `INSERT INTO "Campaigns" ("id","name","subject","mode","preheader","heading","bodyText","ctaLabel","ctaUrl","advancedHtml","advancedText","audienceType","revision","state","recipientCount","eligibleRecipientCount","failedCount","suppressedCount")
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,1,'draft',0,0,0,0)`,
            [id,value.name,value.subject,value.mode,value.preheader,value.heading,value.bodyText,value.ctaLabel,value.ctaUrl,value.advancedHtml,value.advancedText,value.audienceType],
          );
        }
        await tx.query(`INSERT INTO "AuditEvents" ("id","actorType","actorId","action","entityType","entityId","requestId","metadataJson") VALUES ($1,'admin',$2,'campaign.save','Campaign',$3,$4,$5::jsonb)`, [crypto.randomUUID(),context.user.id,id,context.request.requestId ?? null,JSON.stringify({ revision, audienceType:value.audienceType })]);
      });
      return { action: 'save' as const, id, campaigns: await listCampaigns() };
    }

    if (input.action === 'cancel') {
      await db.transaction(async (tx) => {
        const locked = await tx.query(`SELECT * FROM "Campaigns" WHERE "id"=$1 FOR UPDATE`, [input.id]);
        if (!locked.rows[0]) throw bad('Campaign not found.');
        if (!['draft','queued','confirmed'].includes(String(locked.rows[0].state))) throw bad('This campaign cannot be cancelled.');
        await tx.query(`UPDATE "Campaigns" SET "state"='cancelled',"updatedAt"=now() WHERE "id"=$1`, [input.id]);
        await tx.query(`UPDATE "EmailOutbox" SET "state"='cancelled',"cancelReason"='campaign_cancelled',"cancelledAt"=now(),"updatedAt"=now() WHERE "campaignId"=$1 AND "state" IN ('queued','retry','uncertain')`, [input.id]);
        await tx.query(`UPDATE "CampaignRecipients" SET "state"='suppressed',"suppressionReason"='campaign_cancelled',"suppressedAt"=now(),"updatedAt"=now() WHERE "campaignId"=$1 AND "state" IN ('pending','queued')`, [input.id]);
      });
      return { action: 'cancel' as const, campaigns: await listCampaigns() };
    }

    const row = (await db.sql({ query: `SELECT * FROM "Campaigns" WHERE "id"=$1 LIMIT 1`, params: [input.id] })).rows[0] as CampaignRow | undefined;
    if (!row) throw bad('Campaign not found.');
    if (input.action === 'count') return { action: 'count' as const, count: (await db.transaction((tx) => eligible(tx, row.audienceType))).length, revision: Number(row.revision || 1) };

    if (input.action === 'test') {
      if (row.state !== 'draft') throw bad('Only draft campaigns can be tested.');
      const settings = await db.sql({ query: `SELECT "adminEmail" FROM "StoreSettings" ORDER BY "createdAt" LIMIT 1` });
      const allowed = new Set([context.user.email.trim().toLowerCase()]);
      const admin = String(settings.rows[0]?.adminEmail || '').trim().toLowerCase(); if (admin) allowed.add(admin);
      const recipient = input.recipient.trim().toLowerCase();
      if (!allowed.has(recipient)) throw bad('Test email must go to your signed-in email or the configured admin email.');
      const outboxId = await db.transaction(async (tx) => {
        const id = await enqueueTemplate(tx, {
          templateKey:'campaign_announcement',recipient,values:{...fixture,'campaign.subject':row.subject,'campaign.heading':row.heading,'campaign.body':row.bodyText,'campaign.ctaLabel':row.ctaLabel,'campaign.ctaUrl':row.ctaUrl},
          purpose:'campaign_test',kind:'transactional',campaignId:row.id,idempotencyKey:`campaign-test:${row.id}:${row.revision}:${crypto.randomUUID()}`,source:source(row),
        });
        if (!id) throw bad('Campaign template is disabled or the test could not be queued.');
        await tx.query(`UPDATE "EmailOutbox" SET "subjectSnapshot"='[TEST] ' || "subjectSnapshot" WHERE "id"=$1`, [id]);
        return id;
      });
      await runEmailMaintenance({ limit:1, outboxId });
      const sent = await db.emailOutbox.findOne({ id: outboxId });
      if (sent?.state !== 'sent') throw bad(sent?.error || 'The test was not accepted by the provider.');
      await db.sql({ query:`UPDATE "Campaigns" SET "testSentAt"=now(),"testRecipient"=$2,"testOutboxId"=$3,"testRevision"="revision","confirmationNonceHash"=NULL,"confirmationExpiresAt"=NULL,"updatedAt"=now() WHERE "id"=$1 AND "revision"=$4`,params:[row.id,recipient,outboxId,row.revision] });
      return { action:'test' as const, recipient, revision:Number(row.revision), sentAt:sent.sentAt ?? new Date().toISOString() };
    }

    if (input.action === 'review') {
      if (row.state !== 'draft' || Number(row.testRevision) !== Number(row.revision) || !row.testSentAt) throw bad('Send a successful test of this exact revision first.');
      const recipients = await db.transaction((tx) => eligible(tx, row.audienceType));
      if (!recipients.length) throw bad('There are no eligible recipients for this audience.');
      const nonce = randomBytes(24).toString('base64url');
      await db.sql({ query:`UPDATE "Campaigns" SET "confirmationNonceHash"=$2,"confirmationExpiresAt"=now()+interval '10 minutes',"eligibleRecipientCount"=$3,"updatedAt"=now() WHERE "id"=$1 AND "revision"=$4`,params:[row.id,nonceHash(nonce),recipients.length,row.revision] });
      return { action:'review' as const, nonce, revision:Number(row.revision), count:recipients.length, audienceType:row.audienceType as 'all_accounts'|'customer_accounts', subject:String(row.subject), testRecipient:String(row.testRecipient), testSentAt:String(row.testSentAt), expiresAt:new Date(Date.now()+10*60_000).toISOString() };
    }

    const confirmed = await db.transaction(async (tx) => {
      const locked = (await tx.query(`SELECT * FROM "Campaigns" WHERE "id"=$1 FOR UPDATE`, [input.id])).rows[0];
      if (!locked || locked.state !== 'draft') throw bad('Campaign is no longer a draft.');
      if (Number(locked.revision) !== input.revision || Number(locked.testRevision) !== input.revision || !locked.testSentAt) throw bad('Campaign revision or test changed. Review it again.');
      if (!locked.confirmationNonceHash || !sameHash(nonceHash(input.nonce), String(locked.confirmationNonceHash)) || !locked.confirmationExpiresAt || new Date(locked.confirmationExpiresAt).getTime() < Date.now()) throw bad('Confirmation expired. Review the campaign again.');
      const recipients = await eligible(tx, locked.audienceType);
      if (recipients.length !== input.expectedCount || recipients.length !== Number(locked.eligibleRecipientCount)) throw bad('The eligible audience changed. Review the campaign again.');
      const snapshot = { revision:locked.revision,mode:locked.mode,subject:locked.subject,preheader:locked.preheader,heading:locked.heading,bodyText:locked.bodyText,ctaLabel:locked.ctaLabel,ctaUrl:locked.ctaUrl,advancedHtml:locked.advancedHtml,advancedText:locked.advancedText };
      await tx.query(`UPDATE "Campaigns" SET "state"='queued',"recipientCount"=$2,"confirmedBy"=$3,"confirmedAt"=now(),"queuedAt"=now(),"templateSnapshotJson"=$4::jsonb,"audienceDefinitionJson"=$5::jsonb,"confirmationNonceHash"=NULL,"confirmationExpiresAt"=NULL,"updatedAt"=now() WHERE "id"=$1`, [locked.id,recipients.length,context.user.id,JSON.stringify(snapshot),JSON.stringify({ audienceType:locked.audienceType,count:recipients.length })]);
      for (const recipient of recipients) {
        const recipientId = crypto.randomUUID();
        await tx.query(`INSERT INTO "CampaignRecipients" ("id","campaignId","contactId","customerId","email","roleSnapshot","eligibilitySnapshotJson","templateSnapshotJson","state","queuedAt") VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,'pending',now())`, [recipientId,locked.id,recipient.contactId,recipient.customerId,recipient.email,recipient.role,JSON.stringify({ state:'eligible',audienceType:locked.audienceType }),JSON.stringify(snapshot)]);
        const unsubscribeToken = encodeURIComponent(createUnsubscribeToken(recipient.contactId));
        const unsubscribeUrl = `${siteUrl()}/unsubscribe?token=${unsubscribeToken}`;
        const oneClickUrl = `${siteUrl()}/api/unsubscribeMarketing?token=${unsubscribeToken}`;
        const values = {'customer.firstName':recipient.firstName || 'there','customer.name':`${recipient.firstName} ${recipient.lastName}`.trim(),'campaign.subject':locked.subject,'campaign.heading':locked.heading,'campaign.body':locked.bodyText,'campaign.ctaLabel':locked.ctaLabel,'campaign.ctaUrl':locked.ctaUrl,'campaign.unsubscribeUrl':unsubscribeUrl};
        const outboxId = await enqueueTemplate(tx, { templateKey:'campaign_announcement',recipient:recipient.email,values,purpose:'campaign_send',kind:'marketing',campaignId:locked.id,campaignRecipientId:recipientId,idempotencyKey:`campaign:${locked.id}:recipient:${recipient.email}`,source:source(locked),headers:{'List-Unsubscribe':`<${oneClickUrl}>`,'List-Unsubscribe-Post':'List-Unsubscribe=One-Click'} });
        if (!outboxId) throw bad('Campaign announcement template is disabled.');
        await tx.query(`UPDATE "CampaignRecipients" SET "state"='queued',"outboxId"=$2 WHERE "id"=$1`, [recipientId,outboxId]);
      }
      if (recipients.length === 0) await tx.query(`UPDATE "Campaigns" SET "state"='completed',"completedAt"=now(),"updatedAt"=now() WHERE "id"=$1`, [locked.id]);
      await tx.query(`INSERT INTO "AuditEvents" ("id","actorType","actorId","action","entityType","entityId","requestId","metadataJson") VALUES ($1,'admin',$2,'campaign.confirm','Campaign',$3,$4,$5::jsonb)`, [crypto.randomUUID(),context.user.id,locked.id,context.request.requestId ?? null,JSON.stringify({ revision:locked.revision,count:recipients.length,audienceType:locked.audienceType })]);
      return recipients.length;
    });
    return { action:'confirm' as const, queued:confirmed, campaigns:await listCampaigns() };
  },
});
