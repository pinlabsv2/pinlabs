import { z } from 'zod';
import { createEndpoint, AppError } from '../../core/endpoint.js';
import { db } from '../../core/db.js';

const optionalEmail = z.string().trim().max(320).refine((value) => !value || z.string().email().safeParse(value).success, 'Enter a valid email address');
const optionalHex = z.string().trim().refine((value) => !value || /^#[0-9a-fA-F]{6}$/.test(value), 'Use a six-digit hex color');
const optionalHttpsUrl = z.string().trim().max(2000).refine((value) => !value || /^https:\/\//i.test(value), 'URL must start with https://');
const wallet = (pattern: RegExp, label: string) => z.string().trim().max(200).refine((value) => !value || pattern.test(value), `${label} address looks invalid`);

const paymentSchema = z.object({
  btcAddress: wallet(/^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/, 'BTC'),
  ethAddress: wallet(/^0x[a-fA-F0-9]{40}$/, 'ETH'),
  solAddress: wallet(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, 'SOL'),
  ltcAddress: wallet(/^(ltc1|[LM3])[a-zA-HJ-NP-Z0-9]{25,62}$/, 'LTC'),
  tronAddress: wallet(/^T[1-9A-HJ-NP-Za-km-z]{33}$/, 'TRON'),
  testMode: z.boolean(),
  etherscanApiKey: z.string().trim().max(500),
  tronGridApiKey: z.string().trim().max(500),
  solanaRpcUrl: optionalHttpsUrl,
});
const emailSchema = z.object({ adminEmail: optionalEmail });
const policiesSchema = z.object({
  termsOfService: z.string().max(100_000),
  privacyPolicy: z.string().max(100_000),
  shippingPolicy: z.string().max(100_000),
  refundPolicy: z.string().max(100_000),
});
const brandSchema = z.object({
  seasonalTheme: z.enum(['default','summer','winter','fall','spring','halloween','black-friday','christmas','new-year','valentines','easter']).default('default'),
  minimumAge: z.union([z.literal(18), z.literal(21)]).default(18),
  storeName: z.string().trim().min(1).max(120),
  primaryColor: optionalHex,
  accentColor: optionalHex,
});
const promotionsSchema = z.object({
  promoActive: z.boolean(),
  promoTitle: z.string().trim().max(200),
  promoSubtitle: z.string().trim().max(500),
  promoCode: z.string().trim().max(100).transform((value) => value.toUpperCase()),
});

const inputSchema = z.discriminatedUnion('section', [
  z.object({ section: z.literal('payment'), settings: paymentSchema.optional() }),
  z.object({ section: z.literal('email'), settings: emailSchema.optional() }),
  z.object({ section: z.literal('policies'), settings: policiesSchema.optional() }),
  z.object({ section: z.literal('brand'), settings: brandSchema.optional() }),
  z.object({ section: z.literal('promotions'), settings: promotionsSchema.optional() }),
]);

type Section = z.infer<typeof inputSchema>['section'];

const defaults = {
  payment: {
    btcAddress: '', ethAddress: '', solAddress: '', ltcAddress: '', tronAddress: '', testMode: false,
    etherscanApiKey: '', tronGridApiKey: '', solanaRpcUrl: '',
  },
  email: { adminEmail: '' },
  policies: { termsOfService: '', privacyPolicy: '', shippingPolicy: '', refundPolicy: '' },
  brand: { seasonalTheme: 'default', minimumAge: 18, storeName: 'PinLabs', primaryColor: '', accentColor: '' },
  promotions: { promoActive: false, promoTitle: '', promoSubtitle: '', promoCode: '' },
} as const;

function sectionValue(section: Section, row: Record<string, unknown> | undefined) {
  const fallback = defaults[section];
  return Object.fromEntries(Object.entries(fallback).map(([key, value]) => [key, row?.[key] ?? value]));
}

function publicAuditValue(section: Section, value: Record<string, unknown>) {
  if (section === 'payment') return { changedFields: Object.keys(value) };
  return value;
}

export default createEndpoint({
  description: 'Reads or updates one owned section of store settings',
  inputSchema,
  execute: async ({ input, context }) => {
    if (input.section === 'policies' && input.settings && Object.values(input.settings).some((value) => value.includes('[COMPLETE:'))) throw new AppError({ code: 'BAD_REQUEST', message: 'Incomplete policy template', userFacingMessage: 'Complete every marked policy detail before publishing.' });
    if (input.settings) {
      await db.transaction(async (tx) => {
        let { rows } = await tx.query(`SELECT * FROM "StoreSettings" ORDER BY "createdAt" LIMIT 1 FOR UPDATE`);
        let current = rows[0];
        if (!current) {
          const id = crypto.randomUUID();
          ({ rows } = await tx.query(
            `INSERT INTO "StoreSettings" ("id", "storeName") VALUES ($1, 'PinLabs') RETURNING *`,
            [id],
          ));
          current = rows[0];
        }

        const patch = input.settings as Record<string, unknown>;
        const entries = Object.entries(patch);
        if (!entries.length) throw new AppError({ code: 'BAD_REQUEST', message: 'Empty settings patch', userFacingMessage: 'No settings were provided.' });
        const assignments = entries.map(([key], index) => `"${key}" = $${index + 2}`).join(', ');
        const { rows: updated } = await tx.query(
          `UPDATE "StoreSettings" SET ${assignments}, "updatedAt" = now() WHERE "id" = $1 RETURNING *`,
          [current.id, ...entries.map(([, value]) => value || (typeof value === 'string' ? null : value))],
        );
        const before = sectionValue(input.section, current);
        const after = sectionValue(input.section, updated[0]);
        await tx.query(
          `INSERT INTO "AuditEvents" (
            "id", "actorType", "actorId", "action", "entityType", "entityId", "requestId", "beforeJson", "afterJson", "metadataJson"
          ) VALUES ($1, 'admin', $2, 'settings.update', 'StoreSettings', $3, $4, $5::jsonb, $6::jsonb, $7::jsonb)`,
          [
            crypto.randomUUID(), context.user.id, current.id, context.request.requestId ?? null,
            JSON.stringify(publicAuditValue(input.section, before)),
            JSON.stringify(publicAuditValue(input.section, after)),
            JSON.stringify({ section: input.section }),
          ],
        );
      });
    }

    const { records } = await db.storeSettings.findAll({ limit: 1 });
    const row = records[0] as unknown as Record<string, unknown> | undefined;
    switch (input.section) {
      case 'payment': return { section: 'payment' as const, settings: paymentSchema.parse(sectionValue('payment', row)) };
      case 'email': return { section: 'email' as const, settings: emailSchema.parse(sectionValue('email', row)) };
      case 'policies': return { section: 'policies' as const, settings: policiesSchema.parse(sectionValue('policies', row)) };
      case 'brand': return { section: 'brand' as const, settings: brandSchema.parse(sectionValue('brand', row)) };
      case 'promotions': return { section: 'promotions' as const, settings: promotionsSchema.parse(sectionValue('promotions', row)) };
    }
  },
});
