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
  inputSchema: z.object({ save: profile.optional() }),
  outputSchema: z.object({ profile: profile, email: z.string() }),
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
    const { records } = await db.customerProfiles.findAll({ filters: { user: uid }, limit: 1 });
    const p = records[0];
    return {
      email: context.user.email,
      profile: {
        firstName: first, lastName: last,
        address: { street: p?.streetAddress ?? '', city: p?.city ?? '', postalCode: p?.postalCode ?? '', country: p?.country ?? '' },
      },
    };
  },
});
