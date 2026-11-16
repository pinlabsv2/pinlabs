export const TEMPLATE_VARIABLES = {
  order_placed: ['brand.name', 'customer.firstName', 'customer.name', 'order.number', 'order.cryptoAmount', 'order.payCurrency', 'order.total', 'order.url'],
  payment_due: ['brand.name', 'customer.firstName', 'customer.name', 'order.number', 'order.paymentExpiresAt', 'order.url'],
  payment_received: ['brand.name', 'customer.firstName', 'customer.name', 'order.number', 'order.url'],
  order_shipped: ['brand.name', 'customer.firstName', 'customer.name', 'order.number', 'order.trackingNumber', 'order.url'],
  shipping_update: ['brand.name', 'customer.firstName', 'customer.name', 'order.number', 'order.status', 'order.trackingNumber', 'order.url'],
  order_refunded: ['brand.name', 'customer.firstName', 'customer.name', 'order.number', 'order.url'],
  order_cancelled: ['brand.name', 'customer.firstName', 'customer.name', 'order.number', 'order.url'],
  order_expired: ['brand.name', 'customer.firstName', 'customer.name', 'order.number', 'order.url'],
  admin_order_placed: ['brand.name', 'customer.name', 'customer.email', 'order.number', 'order.total', 'order.adminUrl'],
  admin_payment_received: ['brand.name', 'customer.name', 'customer.email', 'order.number', 'order.total', 'order.adminUrl'],
  campaign_announcement: ['brand.name', 'customer.firstName', 'customer.name', 'campaign.subject', 'campaign.heading', 'campaign.body', 'campaign.ctaLabel', 'campaign.ctaUrl', 'campaign.unsubscribeUrl'],
} as const;

export type TemplateKey = keyof typeof TEMPLATE_VARIABLES;

export function isTemplateKey(value: string): value is TemplateKey {
  return Object.prototype.hasOwnProperty.call(TEMPLATE_VARIABLES, value);
}

export function allowedVariables(templateKey: string): readonly string[] {
  return isTemplateKey(templateKey) ? TEMPLATE_VARIABLES[templateKey] : [];
}
