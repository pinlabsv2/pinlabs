import { z } from 'zod';
import { createEndpoint } from '../../core/endpoint';
import { db } from '../../core/db';

const settingsSchema = z.object({
  storeName: z.string(), solAddress: z.string(), ltcAddress: z.string(),
  btcAddress: z.string(), ethAddress: z.string(), tronAddress: z.string(), testMode: z.boolean(),
  shippingFee: z.number().min(0), freeShippingOver: z.number().min(0).nullable(),
  promoActive: z.boolean(), promoTitle: z.string(), promoSubtitle: z.string(), promoCode: z.string(), adminEmail: z.string(),
  termsOfService: z.string(), privacyPolicy: z.string(), shippingPolicy: z.string(), refundPolicy: z.string(),
  primaryColor: z.string(), accentColor: z.string(), etherscanApiKey: z.string(), tronGridApiKey: z.string(), solanaRpcUrl: z.string(),
});

export default createEndpoint({
  description: 'Reads or saves store settings (wallets, shipping, promo banner)',
  inputSchema: z.object({ settings: settingsSchema.optional() }),
  outputSchema: z.object({ settings: settingsSchema }),
  execute: async ({ input }) => {
    let { records } = await db.storeSettings.findAll({ limit: 1 });
    let s = records[0];
    if (input.settings) {
      const record = { ...input.settings, promoCode: input.settings.promoCode.trim().toUpperCase(), adminEmail: input.settings.adminEmail || null, solanaRpcUrl: input.settings.solanaRpcUrl.trim() || null, primaryColor: input.settings.primaryColor || null, accentColor: input.settings.accentColor || null };
      if (s) await db.storeSettings.update({ id: s.id, record });
      else await db.storeSettings.create({ record });
      ({ records } = await db.storeSettings.findAll({ limit: 1 }));
      s = records[0];
    }
    return {
      settings: {
        storeName: s?.storeName ?? 'PinLabs', solAddress: s?.solAddress ?? '', ltcAddress: s?.ltcAddress ?? '',
        btcAddress: s?.btcAddress ?? '', ethAddress: s?.ethAddress ?? '', tronAddress: s?.tronAddress ?? '', testMode: !!s?.testMode,
        shippingFee: s?.shippingFee ?? 0, freeShippingOver: s?.freeShippingOver ?? null,
        promoActive: !!s?.promoActive, promoTitle: s?.promoTitle ?? '', promoSubtitle: s?.promoSubtitle ?? '',
        promoCode: s?.promoCode ?? '', adminEmail: s?.adminEmail ?? '',
        termsOfService: s?.termsOfService ?? '', privacyPolicy: s?.privacyPolicy ?? '', shippingPolicy: s?.shippingPolicy ?? '', refundPolicy: s?.refundPolicy ?? '',
        primaryColor: s?.primaryColor ?? '', accentColor: s?.accentColor ?? '', etherscanApiKey: s?.etherscanApiKey ?? '', tronGridApiKey: s?.tronGridApiKey ?? '', solanaRpcUrl: s?.solanaRpcUrl ?? '',
      },
    };
  },
});
