import { z } from 'zod';
import { createEndpoint } from '../../core/endpoint.js';
import { db } from '../../core/db.js';
import { verifyUnsubscribeToken } from '../../core/email/unsubscribe.js';

export default createEndpoint({
  description: 'Opts a marketing contact out of announcement emails',
  methods: ['GET', 'POST'],
  inputSchema: z.object({ token: z.string().max(2_000).optional() }),
  outputSchema: z.object({ success: z.literal(true) }),
  execute: async ({ input, context }) => {
    const contactId = verifyUnsubscribeToken(input.token ?? context.request.query.token ?? '');
    if (!contactId) return { success: true as const };
    await db.transaction(async (tx) => {
      const { rows } = await tx.query(`SELECT * FROM "MarketingContacts" WHERE "id" = $1 FOR UPDATE`, [contactId]);
      const contact = rows[0];
      if (!contact) return;
      await tx.query(
        `UPDATE "MarketingContacts" SET "state" = 'unsubscribed', "unsubscribedAt" = COALESCE("unsubscribedAt", now()),
          "unsubscribeReason" = COALESCE("unsubscribeReason", 'one_click'), "updatedAt" = now()
         WHERE "id" = $1 AND "state" IN ('eligible','unsubscribed')`,
        [contactId],
      );
      await tx.query(
        `UPDATE "EmailOutbox" SET "state" = 'suppressed', "cancelReason" = 'unsubscribed', "cancelledAt" = now(), "updatedAt" = now()
         WHERE lower("recipient") = lower($1) AND "kind" = 'marketing' AND "state" IN ('queued','retry','uncertain')`,
        [contact.email],
      );
      await tx.query(
        `UPDATE "CampaignRecipients" SET "state" = 'suppressed', "suppressionReason" = 'unsubscribed', "suppressedAt" = now(), "updatedAt" = now()
         WHERE lower("email") = lower($1) AND "state" IN ('pending','queued')`,
        [contact.email],
      );
    });
    return { success: true as const };
  },
});
