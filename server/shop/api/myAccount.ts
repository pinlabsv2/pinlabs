import { z } from 'zod';
import { createEndpoint } from '../../core/endpoint.js';
import { db } from '../../core/db.js';

const profile = z.object({
  firstName: z.string(), lastName: z.string(),
  address: z.object({ street: z.string(), city: z.string(), postalCode: z.string(), country: z.string() }),
});

export default createEndpoint({
  description: "Reads or saves the signed-in customer's account settings (name and default shipping address)",
  authenticated: true,
  inputSchema: z.object({ save: profile.optional(), marketingEmails: z.boolean().optional() }),
  outputSchema: z.object({ profile: profile, email: z.string(), marketingEmails: z.boolean() }),
  execute: async ({ input, context }) => {
    const uid = context.user.id;
    let first = context.user.firstName ?? '';
    let last = context.user.lastName ?? '';
    if (input.save) {
      const { firstName, lastName, address: a } = input.save;
      first = firstName.trim(); last = lastName.trim();
      await db.auth.updateUserProfile(uid, { firstName: first, lastName: last });
      await db.customerProfiles.bulkCreate({
        records: [{ user: uid, fullName: `${first} ${last}`.trim(), country: a.country, streetAddress: a.street.trim(), postalCode: a.postalCode.trim(), city: a.city.trim() }],
        matchOn: ['user'],
      });
    }
    const email = context.user.email.trim().toLowerCase();
    if (input.marketingEmails !== undefined) {
      await db.transaction(async (tx) => {
        const existing = await tx.query(`SELECT "id", "state" FROM "MarketingContacts" WHERE lower("email") = $1 LIMIT 1 FOR UPDATE`, [email]);
        if (existing.rows[0] && ['eligible', 'unsubscribed'].includes(String(existing.rows[0].state))) {
          await tx.query(
            `UPDATE "MarketingContacts" SET "state" = $2, "unsubscribedAt" = CASE WHEN $2 = 'unsubscribed' THEN now() ELSE NULL END,
              "unsubscribeReason" = CASE WHEN $2 = 'unsubscribed' THEN 'account_preference' ELSE NULL END,
              "suppressedAt" = NULL, "suppressionReason" = NULL, "lastEligibleAt" = CASE WHEN $2 = 'eligible' THEN now() ELSE "lastEligibleAt" END,
              "updatedAt" = now() WHERE "id" = $1`,
            [existing.rows[0].id, input.marketingEmails ? 'eligible' : 'unsubscribed'],
          );
        } else if (!existing.rows[0]) {
          await tx.query(
            `INSERT INTO "MarketingContacts" ("id","email","userId","state","consentSource","consentAt","lastEligibleAt","unsubscribedAt","unsubscribeReason")
             VALUES ($1,$2,$3,$4,'account_preference',now(),CASE WHEN $4 = 'eligible' THEN now() ELSE NULL END,CASE WHEN $4 = 'unsubscribed' THEN now() ELSE NULL END,CASE WHEN $4 = 'unsubscribed' THEN 'account_preference' ELSE NULL END)`,
            [crypto.randomUUID(), email, uid, input.marketingEmails ? 'eligible' : 'unsubscribed'],
          );
        }
      });
    }
    let { records: contacts } = await db.marketingContacts.findAll({ filters: { email }, limit: 1 });
    if (!contacts[0]) {
      await db.marketingContacts.create({ record: { email, userId: uid, state: 'eligible', consentSource: 'account_backfill', consentAt: new Date().toISOString(), lastEligibleAt: new Date().toISOString() } });
      ({ records: contacts } = await db.marketingContacts.findAll({ filters: { email }, limit: 1 }));
    }
    const { records } = await db.customerProfiles.findAll({ filters: { user: uid }, limit: 1 });
    const p = records[0];
    return {
      email: context.user.email,
      marketingEmails: contacts[0]?.state === 'eligible',
      profile: {
        firstName: first, lastName: last,
        address: { street: p?.streetAddress ?? '', city: p?.city ?? '', postalCode: p?.postalCode ?? '', country: p?.country ?? '' },
      },
    };
  },
});
