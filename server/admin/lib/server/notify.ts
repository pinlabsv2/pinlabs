type OrderLike = { orderNumber?: string; customerEmail?: string; customerName?: string };

/**
 * Customer notifications. Email isn't connected yet, so messages are logged to the
 * run history. Once an email integration is connected, send them from here.
 */
export async function notifyCustomer(
  order: OrderLike,
  kind: 'order_confirmation' | 'payment_received' | 'shipping_update',
  message: string,
) {
  console.log(`[notify:${kind}] to=${order.customerEmail} order=${order.orderNumber} — ${message}`);
}
