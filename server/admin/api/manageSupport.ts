import { z } from 'zod';
import { createEndpoint } from '../../core/endpoint.js';
import { db } from '../../core/db.js';

const contact = z.object({ id: z.string().optional(), label: z.string(), channel: z.enum(['Telegram', 'WhatsApp', 'Discord', 'Email']), handle: z.string().min(1), sortOrder: z.number() });

export default createEndpoint({
  description: 'Lists, saves or removes the support contacts shown on the shop support page',
  inputSchema: z.object({ action: z.enum(['list', 'save', 'delete']), contact: contact.optional(), id: z.string().optional() }),
  outputSchema: z.object({ contacts: z.array(contact.extend({ id: z.string() })) }),
  execute: async ({ input }) => {
    if (input.action === 'save' && input.contact) {
      const { id, ...record } = input.contact;
      if (id) await db.supportContacts.update({ id, record });
      else await db.supportContacts.create({ record });
    }
    if (input.action === 'delete' && input.id) await db.supportContacts.delete({ id: input.id });
    const { records } = await db.supportContacts.findAll({ sort: [{ field: 'sortOrder', direction: 'asc' }], limit: 200 });
    return {
      contacts: records.map((c) => ({
        id: c.id, label: c.label ?? '', channel: (c.channel ?? 'Email') as 'Telegram' | 'WhatsApp' | 'Discord' | 'Email', handle: c.handle ?? '', sortOrder: c.sortOrder ?? 0,
      })),
    };
  },
});
