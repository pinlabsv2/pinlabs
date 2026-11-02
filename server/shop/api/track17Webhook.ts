import { z } from 'zod';
import { createEndpoint } from '../../core/endpoint.js';
import { applyTrackInfo } from '../lib/server/tracking.js';

export default createEndpoint({
  description: 'Receives shipment status updates from 17TRACK and refreshes the order',
  webhook: {},
  inputSchema: z.object({
    event: z.string(),
    data: z.object({ number: z.string(), track_info: z.any() }).partial(),
  }),
  outputSchema: z.object({ ok: z.boolean(), moved: z.boolean() }),
  execute: async ({ input }) => {
    if (input.event !== 'TRACKING_UPDATED' || !input.data?.number) return { ok: true, moved: false };
    const moved = await applyTrackInfo(input.data.number, input.data.track_info);
    return { ok: true, moved };
  },
});
