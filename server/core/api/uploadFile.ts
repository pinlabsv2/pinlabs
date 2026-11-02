import { z } from 'zod';
import { createEndpoint } from '../endpoint.js';
import { db } from '../db.js';

/** Stores a file in the database and returns a permanent URL (/api/file?id=…). Keep files small (Vercel bodies max ~4.5 MB). */
export default createEndpoint({
  description: 'Uploads a file (admin only)',
  authenticated: true,
  inputSchema: z.object({ filename: z.string(), mimeType: z.string(), dataBase64: z.string() }),
  execute: async ({ input }) => {
    const f = await db.files.create({ record: { filename: input.filename, mimeType: input.mimeType || 'application/octet-stream', dataBase64: input.dataBase64 } });
    return { url: `/api/file?id=${f.id}` };
  },
});
