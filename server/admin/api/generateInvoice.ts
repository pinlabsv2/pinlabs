import { z } from 'zod';
import { createEndpoint } from '../../core/endpoint.js';
import { db } from '../../core/db.js';
import { toOrder } from '../lib/server/orderShape.js';

export default createEndpoint({
  description: 'Generates a PDF invoice for an order',
  inputSchema: z.object({ id: z.string() }),
  outputSchema: z.object({ html: z.string(), filename: z.string() }),
  async execute({ input }) {
    const rec = await db.orders.findOne({ id: input.id });
    if (!rec) throw new Error('Order not found');
    const o = toOrder(rec);
    const { records } = await db.storeSettings.findAll({ limit: 1 });
    const store = records[0]?.storeName ?? 'PinLabs';
    const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const n = (v: unknown) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
    const money = (v: unknown) => `$${n(v).toFixed(2)}`;
    const rows = o.items.map((i) => `<tr><td>${esc(i.name)}</td><td class="num">${n(i.quantity)}</td><td class="num">${money(i.price)}</td><td class="num">${money(n(i.price) * n(i.quantity))}</td></tr>`).join('');

    const html = `<!doctype html><html><head><meta charset="utf-8" /><style>
      @page { size: a4; margin: 16mm; }
      body { font-family: 'JetBrains Mono', 'SFMono-Regular', Menlo, Consolas, monospace; color: #1a1412; font-size: 9.5pt; background: #fffaf8; }
      .top { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 14px; margin-bottom: 22px; border-bottom: 1px solid #f1ddd6; }
      .brand { font-size: 20pt; font-weight: 700; color: #1a1412; letter-spacing: -0.03em; }
      .brand:before { content: '> '; color: #F5664B; }
      h1 { margin: 0; font-size: 13pt; text-align: right; color: #F5664B; text-transform: uppercase; letter-spacing: .08em; } .muted { color: #8a7a74; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 22px; }
      .grid > div { border: 1px solid #f1ddd6; border-radius: 8px; padding: 12px; background: #fff; }
      .label { text-transform: uppercase; font-size: 7.5pt; letter-spacing: .12em; color: #F5664B; margin-bottom: 6px; }
      table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
      th { text-align: left; font-size: 7.5pt; text-transform: uppercase; letter-spacing: .1em; color: #8a7a74; border-bottom: 1.5px solid #1a1412; padding: 8px 8px 8px 0; }
      td { padding: 9px 8px 9px 0; border-bottom: 1px dashed #f1ddd6; } .num { text-align: right; }
      .totals { width: 280px; margin-left: auto; margin-top: 14px; } .totals td { border: none; padding: 4px 0; }
      .grand td { border-top: 1.5px solid #1a1412; font-weight: 700; font-size: 12pt; padding-top: 8px; } .grand td.num { color: #F5664B; }
      .pay { margin-top: 26px; padding: 12px 14px; background: #fff1ec; border-left: 3px solid #F5664B; border-radius: 4px; font-size: 8.5pt; word-break: break-all; }
      .foot { margin-top: 30px; font-size: 7.5pt; color: #a8958e; border-top: 1px solid #f1ddd6; padding-top: 10px; }
    </style></head><body>
      <div class="top"><div class="brand">${esc(store)}</div>
        <div><h1>Invoice ${esc(o.orderNumber)}</h1><div class="muted" style="text-align:right">${o.createdAt ? new Date(o.createdAt).toLocaleDateString('en-US', { dateStyle: 'long' }) : ''}</div></div></div>
      <div class="grid">
        <div><div class="label">Bill & ship to</div><b>${esc(o.customerName)}</b><br/>${esc(o.customerEmail)}<br/><span style="white-space:pre-line">${esc(o.shippingAddress)}</span></div>
        <div><div class="label">Status</div><b>${esc(o.status)}</b>${o.trackingNumber ? `<br/><span class="muted">Tracking:</span> ${esc(o.trackingNumber)}` : ''}</div>
      </div>
      <table><thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Unit</th><th class="num">Amount</th></tr></thead><tbody>${rows}</tbody></table>
      <table class="totals">
        <tr><td>Subtotal</td><td class="num">${money(o.subtotal)}</td></tr>
        ${o.discount > 0 ? `<tr><td>Discount ${esc(o.discountCode)}</td><td class="num">−${money(o.discount)}</td></tr>` : ''}
        <tr><td>Shipping</td><td class="num">${o.shipping ? money(o.shipping) : 'Free'}</td></tr>
        <tr class="grand"><td>Total</td><td class="num">${money(o.total)}</td></tr>
      </table>
      <div class="pay"><b>Payment:</b> ${n(o.cryptoAmount)} ${esc(o.payCurrency)} ${o.paidAt ? `— received ${new Date(o.paidAt).toLocaleDateString()}` : '— not yet received'}
        ${o.transactionHash ? `<br/><span class="muted">Tx:</span> ${esc(o.transactionHash)}` : ''}</div>
      <div class="foot">All products are sold strictly for laboratory research use only. Not for human or veterinary use.</div>
    </body></html>`;

    // Returned as HTML; the admin UI opens it in a new tab and triggers the browser's Print → Save as PDF.
    return { html, filename: `invoice-${o.orderNumber}.pdf` };
  },
});
