import { db } from '../../../core/db';

export async function getSettings() {
  const { records } = await db.storeSettings.findAll({ limit: 1 });
  return records[0];
}

/** Returns discount in USD for a code, or throws with a customer-friendly message. */
export async function evaluateCode(code: string, subtotal: number) {
  const { records } = await db.discountCodes.findAll({
    filters: { code: code.trim().toUpperCase(), active: true },
    limit: 1,
  });
  const dc = records[0];
  if (!dc) throw new Error('That code is not valid.');
  if (dc.expiresAt && new Date(dc.expiresAt).getTime() < Date.now()) throw new Error('That code has expired.');
  if (dc.usageLimit && (dc.timesUsed ?? 0) >= dc.usageLimit) throw new Error('That code has been fully used.');
  if (dc.minimumOrder && subtotal < dc.minimumOrder) throw new Error(`Minimum order for this code is $${dc.minimumOrder.toFixed(2)}.`);
  const amt = dc.amount ?? 0;
  const discount = dc.discountType === 'Fixed' ? Math.min(amt, subtotal) : Math.min(subtotal, Math.round(subtotal * Math.min(amt, 100)) / 100);
  return { record: dc, discount: Math.round(discount * 100) / 100, label: dc.discountType === 'Fixed' ? `$${amt} off` : `${amt}% off` };
}
