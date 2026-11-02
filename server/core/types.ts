// Record types for every table (read shape + write shape).
/** An attachment as returned when reading a record. */
export type Attachment = {
  /** Original filename as uploaded. */
  filename: string;
  /** Display name — may differ from `filename`. */
  originalName: string;
  /** File size in bytes. */
  size: number;
  mimeType: string;
  /** Publicly accessible URL. */
  url: string;
  /** ISO timestamp of the upload. */
  uploadedAt: string;
  metadata?: Record<string, unknown>;
};

/** What you may write to an attachments field: a URL, a URL with a name, or an attachment you read earlier. */
export type AttachmentInput =
  | string
  | { url: string; filename?: string }
  | Attachment;

/** A record in the "Products" table, as it is read back. */
export type ProductsRecordType = {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  /** Primary field. "Name" */
  name?: string;
  description?: string;
  /** "Price". Value is a raw number; display as currency with symbol "$", 2 decimal places, format: local (e.g. 1,000,000.50) */
  price?: number;
  size?: string;
  purity?: string;
  category?: string;
  imageUrl?: string;
  /** "Stock". 0 decimal places, format: local (e.g. 1,000,000.50) */
  stock?: number;
  active?: boolean;
  featured?: boolean;
  /** "Sale Price". Value is a raw number; display as currency with symbol "$", 2 decimal places, format: local (e.g. 1,000,000.50) */
  salePrice?: number;
  coaUrl?: string;
  showCoa?: boolean;
  inventoryTracked?: boolean;
  sellableUnitLabel?: string;
  supplierUnitLabel?: string;
  supplierUnitsPerSellableUnit?: number;
  supplierPackLabel?: string;
  supplierUnitsPerPack?: number;
  leadTimeDays?: number;
  safetyStockDays?: number;
  preorderEnabled?: boolean;
  preorderCapSellableUnits?: number;
  preorderExpectedShipAt?: string;
};

/** What you may write when creating or updating a record in the "Products" table. */
export type ProductsRecordInput = {
  name: string | null;
  description: string | null;
  price: string | number | null;
  size: string | null;
  purity: string | null;
  category: string | null;
  imageUrl: string | null;
  stock: string | number | null;
  active: string | boolean | null;
  featured: string | boolean | null;
  salePrice: string | number | null;
  coaUrl: string | null;
  showCoa: string | boolean | null;
  inventoryTracked: string | boolean | null;
  sellableUnitLabel: string | null;
  supplierUnitLabel: string | null;
  supplierUnitsPerSellableUnit: string | number | null;
  supplierPackLabel: string | null;
  supplierUnitsPerPack: string | number | null;
  leadTimeDays: string | number | null;
  safetyStockDays: string | number | null;
  preorderEnabled: string | boolean | null;
  preorderCapSellableUnits: string | number | null;
  preorderExpectedShipAt: string | Date | null;
};

/** A record in the "Discount Codes" table, as it is read back. */
export type DiscountCodesRecordType = {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  /** Primary field. "Code" */
  code?: string;
  discountType?: "Percent" | "Fixed" | string;
  /** "Amount". 2 decimal places, format: local (e.g. 1,000,000.50) */
  amount?: number;
  /** "Minimum Order". Value is a raw number; display as currency with symbol "$", 2 decimal places, format: local (e.g. 1,000,000.50) */
  minimumOrder?: number;
  /** "Usage Limit". 0 decimal places, format: local (e.g. 1,000,000.50) */
  usageLimit?: number;
  /** "Times Used". 0 decimal places, format: local (e.g. 1,000,000.50) */
  timesUsed?: number;
  /** "Expires At". Date+time field (ISO 8601 timestamp), null when unset, date: "local" format, time: 12h */
  expiresAt?: string;
  active?: boolean;
  note?: string;
};

/** What you may write when creating or updating a record in the "Discount Codes" table. */
export type DiscountCodesRecordInput = {
  code: string | null;
  discountType: "Percent" | "Fixed" | string | null;
  amount: string | number | null;
  minimumOrder: string | number | null;
  usageLimit: string | number | null;
  timesUsed: string | number | null;
  expiresAt: string | Date | null;
  active: string | boolean | null;
  note: string | null;
};

/** A record in the "Store Settings" table, as it is read back. */
export type StoreSettingsRecordType = {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  /** Primary field. "Store Name" */
  storeName?: string;
  solAddress?: string;
  ltcAddress?: string;
  /** "Shipping Fee". Value is a raw number; display as currency with symbol "$", 2 decimal places, format: local (e.g. 1,000,000.50) */
  shippingFee?: number;
  /** "Free Shipping Over". Value is a raw number; display as currency with symbol "$", 2 decimal places, format: local (e.g. 1,000,000.50) */
  freeShippingOver?: number;
  promoActive?: boolean;
  promoTitle?: string;
  promoSubtitle?: string;
  promoCode?: string;
  adminEmail?: string;
  btcAddress?: string;
  ethAddress?: string;
  tronAddress?: string;
  testMode?: boolean;
  termsOfService?: string;
  privacyPolicy?: string;
  shippingPolicy?: string;
  refundPolicy?: string;
  primaryColor?: string;
  accentColor?: string;
  etherscanApiKey?: string;
  tronGridApiKey?: string;
  solanaRpcUrl?: string;
};

/** What you may write when creating or updating a record in the "Store Settings" table. */
export type StoreSettingsRecordInput = {
  storeName: string | null;
  solAddress: string | null;
  ltcAddress: string | null;
  shippingFee: string | number | null;
  freeShippingOver: string | number | null;
  promoActive: string | boolean | null;
  promoTitle: string | null;
  promoSubtitle: string | null;
  promoCode: string | null;
  adminEmail: string | null;
  btcAddress: string | null;
  ethAddress: string | null;
  tronAddress: string | null;
  testMode: string | boolean | null;
  termsOfService: string | null;
  privacyPolicy: string | null;
  shippingPolicy: string | null;
  refundPolicy: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  etherscanApiKey: string | null;
  tronGridApiKey: string | null;
  solanaRpcUrl: string | null;
};

/** A record in the "Orders" table, as it is read back. */
export type OrdersRecordType = {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  /** Primary field. "Order Number" */
  orderNumber?: string;
  customer?: string | string[];
  customerEmail?: string;
  customerName?: string;
  shippingAddress?: string;
  itemsJson?: string;
  /** "Subtotal". Value is a raw number; display as currency with symbol "$", 2 decimal places, format: local (e.g. 1,000,000.50) */
  subtotal?: number;
  /** "Discount". Value is a raw number; display as currency with symbol "$", 2 decimal places, format: local (e.g. 1,000,000.50) */
  discount?: number;
  /** "Shipping". Value is a raw number; display as currency with symbol "$", 2 decimal places, format: local (e.g. 1,000,000.50) */
  shipping?: number;
  /** "Total". Value is a raw number; display as currency with symbol "$", 2 decimal places, format: local (e.g. 1,000,000.50) */
  total?: number;
  discountCode?: string;
  discountCodeId?: string;
  payCurrency?: "SOL" | "LTC" | "BTC" | "ETH" | "USDT-ERC20" | "USDC" | "USDT-TRC20" | "TRX" | "TEST" | string;
  /** "Crypto Amount". 8 decimal places, format: local (e.g. 1,000,000.50) */
  cryptoAmount?: number;
  payAddress?: string;
  transactionHash?: string;
  /** "Payment Expires At". Date+time field (ISO 8601 timestamp), null when unset, date: "local" format, time: 12h */
  paymentExpiresAt?: string;
  /** "Paid At". Date+time field (ISO 8601 timestamp), null when unset, date: "local" format, time: 12h */
  paidAt?: string;
  status?: "Awaiting Payment" | "Paid" | "Processing" | "Shipped" | "In Transit" | "Out for Delivery" | "Delivered" | "Exception" | "Expired" | "Cancelled" | "Refunded" | string;
  trackingNumber?: string;
  carrier?: string;
  trackingStatus?: string;
  trackingEventsJson?: string;
  /** "Last Tracking Check". Date+time field (ISO 8601 timestamp), null when unset, date: "local" format, time: 12h */
  lastTrackingCheck?: string;
  /** Read-only. "Placed At". Auto-set when record was created (ISO 8601) */
  placedAt?: string;
  country?: string;
  city?: string;
  postalCode?: string;
  streetAddress?: string;
  commercialState?: string;
  currency?: string;
  subtotalCents?: number;
  discountCents?: number;
  shippingCents?: number;
  totalCents?: number;
  checkoutIdempotencyKey?: string;
  cancelledAt?: string;
  closedAt?: string;
  migrationVersion?: number;
};

/** What you may write when creating or updating a record in the "Orders" table. */
export type OrdersRecordInput = {
  orderNumber: string | null;
  customer: string | string[] | null;
  customerEmail: string | null;
  customerName: string | null;
  shippingAddress: string | null;
  itemsJson: string | null;
  subtotal: string | number | null;
  discount: string | number | null;
  shipping: string | number | null;
  total: string | number | null;
  discountCode: string | null;
  discountCodeId: string | null;
  payCurrency: "SOL" | "LTC" | "BTC" | "ETH" | "USDT-ERC20" | "USDC" | "USDT-TRC20" | "TRX" | "TEST" | string | null;
  cryptoAmount: string | number | null;
  payAddress: string | null;
  transactionHash: string | null;
  paymentExpiresAt: string | Date | null;
  paidAt: string | Date | null;
  status: "Awaiting Payment" | "Paid" | "Processing" | "Shipped" | "In Transit" | "Out for Delivery" | "Delivered" | "Exception" | "Expired" | "Cancelled" | "Refunded" | string | null;
  trackingNumber: string | null;
  carrier: string | null;
  trackingStatus: string | null;
  trackingEventsJson: string | null;
  lastTrackingCheck: string | Date | null;
  country: string | null;
  city: string | null;
  postalCode: string | null;
  streetAddress: string | null;
  commercialState: string | null;
  currency: string | null;
  subtotalCents: string | number | null;
  discountCents: string | number | null;
  shippingCents: string | number | null;
  totalCents: string | number | null;
  checkoutIdempotencyKey: string | null;
  cancelledAt: string | Date | null;
  closedAt: string | Date | null;
  migrationVersion: string | number | null;
};

/** A record in the "Categories" table, as it is read back. */
export type CategoriesRecordType = {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  /** Primary field. "Name" */
  name?: string;
  /** "Sort Order". 0 decimal places, format: local (e.g. 1,000,000.50) */
  sortOrder?: number;
};

/** What you may write when creating or updating a record in the "Categories" table. */
export type CategoriesRecordInput = {
  name: string | null;
  sortOrder: string | number | null;
};

/** A record in the "Support Contacts" table, as it is read back. */
export type SupportContactsRecordType = {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  /** Primary field. "Label" */
  label?: string;
  channel?: "Telegram" | "WhatsApp" | "Discord" | "Email" | string;
  handle?: string;
  /** "Sort Order". 0 decimal places, format: local (e.g. 1,000,000.50) */
  sortOrder?: number;
};

/** What you may write when creating or updating a record in the "Support Contacts" table. */
export type SupportContactsRecordInput = {
  label: string | null;
  channel: "Telegram" | "WhatsApp" | "Discord" | "Email" | string | null;
  handle: string | null;
  sortOrder: string | number | null;
};

/** A record in the "Customer Profiles" table, as it is read back. */
export type CustomerProfilesRecordType = {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  /** Primary field. "Full Name" */
  fullName?: string;
  user?: string | string[];
  country?: string;
  streetAddress?: string;
  postalCode?: string;
  city?: string;
  reviewDisplayName?: string;
};

/** What you may write when creating or updating a record in the "Customer Profiles" table. */
export type CustomerProfilesRecordInput = {
  fullName: string | null;
  user: string | string[] | null;
  country: string | null;
  streetAddress: string | null;
  postalCode: string | null;
  city: string | null;
  reviewDisplayName: string | null;
};

export type UsersRecordType = { id: string; email?: string; passwordHash?: string; firstName?: string; lastName?: string; role?: 'admin' | 'customer' | string; createdAt?: string };
export type UsersRecordInput = { email: string | null; passwordHash: string | null; firstName: string | null; lastName: string | null; role: string | null };
export type FilesRecordType = { id: string; filename?: string; mimeType?: string; dataBase64?: string };
export type FilesRecordInput = { filename: string | null; mimeType: string | null; dataBase64: string | null };

type BaseRecord = { id: string; createdAt?: string; updatedAt?: string };
type RecordInput<T extends BaseRecord> = Partial<{ [K in Exclude<keyof T, keyof BaseRecord>]: T[K] | null }>;
export type JsonValue = Record<string, unknown> | unknown[];
export type IntegerValue = number | string;

export type OrderItemsRecordType = BaseRecord & {
  orderId?: string; lineNumber?: number; productId?: string; productName?: string; productSize?: string;
  unitPriceCents?: IntegerValue; quantity?: number; lineSubtotalCents?: IntegerValue; discountCents?: IntegerValue; shippingCents?: IntegerValue;
};
export type OrderItemsRecordInput = RecordInput<OrderItemsRecordType>;

export type PaymentAttemptsRecordType = BaseRecord & {
  orderId?: string; provider?: string; providerOrderId?: string; providerPaymentId?: string; checkoutIdempotencyKey?: string; state?: string;
  priceAmountCents?: IntegerValue; priceCurrency?: string; payAmount?: string; payCurrency?: string; network?: string; payAddress?: string;
  payinExtraId?: string; purchaseId?: string; actuallyPaid?: string; outcomeAmount?: string; outcomeCurrency?: string; expiresAt?: string;
  finishedAt?: string; lastEventAt?: string; lastReconciledAt?: string; creationStartedAt?: string; creationError?: string;
  providerResponseJson?: JsonValue;
};
export type PaymentAttemptsRecordInput = RecordInput<PaymentAttemptsRecordType>;

export type ProviderWebhookEventsRecordType = BaseRecord & {
  provider?: string; eventId?: string; eventType?: string; signatureValid?: boolean; rawBodyDigest?: string; payloadJson?: JsonValue;
  receivedAt?: string; processedAt?: string; processingStatus?: string; error?: string;
};
export type ProviderWebhookEventsRecordInput = RecordInput<ProviderWebhookEventsRecordType>;

export type InventoryBalancesRecordType = BaseRecord & {
  productId?: string; onHandSupplierUnits?: number; reservedSupplierUnits?: number; inboundSupplierUnits?: number; version?: number;
};
export type InventoryBalancesRecordInput = RecordInput<InventoryBalancesRecordType>;

export type InventoryLedgerRecordType = BaseRecord & {
  productId?: string; deltaSupplierUnits?: number; balanceAfterSupplierUnits?: number; reason?: string; relatedEntityType?: string;
  relatedEntityId?: string; actorType?: string; actorId?: string; note?: string;
};
export type InventoryLedgerRecordInput = RecordInput<InventoryLedgerRecordType>;

export type InboundStockRecordType = BaseRecord & {
  productId?: string; supplierUnits?: number; supplierPackCount?: number; expectedAt?: string; state?: string; receivedSupplierUnits?: number; note?: string;
};
export type InboundStockRecordInput = RecordInput<InboundStockRecordType>;

export type OrderItemAllocationsRecordType = BaseRecord & {
  orderItemId?: string; kind?: string; quantitySellableUnits?: number; supplierUnits?: number; state?: string; reservedUntil?: string;
  committedAt?: string; releasedAt?: string; readyAt?: string; shippedAt?: string; promisedShipAt?: string; promiseSourceProductDate?: string;
  overdueAt?: string; customerOverdueNotifiedAt?: string; adminOverdueNotifiedAt?: string; cancellationExceptionGrantedAt?: string;
  cancellationExceptionGrantedBy?: string; cancellationExceptionReason?: string;
};
export type OrderItemAllocationsRecordInput = RecordInput<OrderItemAllocationsRecordType>;

export type ShipmentsRecordType = BaseRecord & {
  orderId?: string; status?: string; trackingNumber?: string; carrierCode?: string; carrierName?: string; trackingProvider?: string;
  registeredAt?: string; shippedAt?: string; deliveredAt?: string; lastCheckedAt?: string; providerStatus?: string; providerSubstatus?: string;
  postageCostCents?: IntegerValue;
};
export type ShipmentsRecordInput = RecordInput<ShipmentsRecordType>;

export type ShipmentItemsRecordType = BaseRecord & { shipmentId?: string; orderItemId?: string; allocationId?: string; quantity?: number };
export type ShipmentItemsRecordInput = RecordInput<ShipmentItemsRecordType>;

export type ShipmentEventsRecordType = BaseRecord & {
  shipmentId?: string; provider?: string; providerEventId?: string; eventDigest?: string; status?: string; substatus?: string;
  description?: string; location?: string; occurredAt?: string; metadataJson?: JsonValue;
};
export type ShipmentEventsRecordInput = RecordInput<ShipmentEventsRecordType>;

export type ShipmentIncidentsRecordType = BaseRecord & {
  shipmentId?: string; type?: string; source?: string; state?: string; detectedAt?: string; shipmentEventId?: string;
  resolution?: string; resolutionMetadataJson?: JsonValue;
};
export type ShipmentIncidentsRecordInput = RecordInput<ShipmentIncidentsRecordType>;

export type RefundRequestsRecordType = BaseRecord & {
  orderId?: string; shipmentIncidentId?: string; allocationId?: string; customerId?: string; reason?: string; currency?: string; network?: string;
  address?: string; memo?: string; addressValidationJson?: JsonValue; state?: string; requestedUsdCents?: IntegerValue; approvedBy?: string;
  approvedAt?: string; rejectedReason?: string; quotedAt?: string;
};
export type RefundRequestsRecordInput = RecordInput<RefundRequestsRecordType>;

export type RefundPayoutsRecordType = BaseRecord & {
  refundRequestId?: string; attemptGeneration?: number; provider?: string; uniqueExternalId?: string; providerPayoutId?: string;
  usdAmountCents?: IntegerValue; exchangeRate?: string; grossCryptoAmount?: string; providerFeeAmount?: string; networkFeeAmount?: string;
  recipientAmount?: string; currency?: string; network?: string; address?: string; memo?: string; state?: string; providerResponseJson?: JsonValue;
  lastReconciledAt?: string; succeededAt?: string;
};
export type RefundPayoutsRecordInput = RecordInput<RefundPayoutsRecordType>;

export type EmailTemplatesRecordType = BaseRecord & {
  templateKey?: string; name?: string; kind?: string; subject?: string; html?: string; text?: string; variablesJson?: JsonValue;
  version?: number; enabled?: boolean; updatedBy?: string;
};
export type EmailTemplatesRecordInput = RecordInput<EmailTemplatesRecordType>;

export type EmailOutboxRecordType = BaseRecord & {
  recipient?: string; templateKey?: string; templateVersion?: number; payloadJson?: JsonValue; kind?: string; idempotencyKey?: string;
  state?: string; leaseOwner?: string; leaseExpiresAt?: string; attemptCount?: number; nextAttemptAt?: string; providerMessageId?: string;
  campaignId?: string; error?: string; sentAt?: string; deliveredAt?: string;
};
export type EmailOutboxRecordInput = RecordInput<EmailOutboxRecordType>;

export type EmailEventsRecordType = BaseRecord & {
  provider?: string; providerEventId?: string; outboxId?: string; providerMessageId?: string; campaignId?: string; eventType?: string;
  eventAt?: string; metadataJson?: JsonValue;
};
export type EmailEventsRecordInput = RecordInput<EmailEventsRecordType>;

export type MarketingContactsRecordType = BaseRecord & {
  email?: string; userId?: string; state?: string; consentSource?: string; consentAt?: string; unsubscribedAt?: string;
  unsubscribeReason?: string; providerContactId?: string; syncState?: string;
};
export type MarketingContactsRecordInput = RecordInput<MarketingContactsRecordType>;

export type CustomerSegmentsRecordType = BaseRecord & { name?: string; definitionJson?: JsonValue; active?: boolean };
export type CustomerSegmentsRecordInput = RecordInput<CustomerSegmentsRecordType>;

export type CampaignsRecordType = BaseRecord & {
  name?: string; subject?: string; html?: string; text?: string; templateSnapshotJson?: JsonValue; audienceDefinitionJson?: JsonValue;
  scheduledAt?: string; state?: string; resendBroadcastId?: string; providerSegmentId?: string; approvedBy?: string; approvedAt?: string; sentAt?: string;
};
export type CampaignsRecordInput = RecordInput<CampaignsRecordType>;

export type CampaignRecipientsRecordType = BaseRecord & {
  campaignId?: string; contactId?: string; customerId?: string; email?: string; eligibilitySnapshotJson?: JsonValue; state?: string;
  providerMessageId?: string;
};
export type CampaignRecipientsRecordInput = RecordInput<CampaignRecipientsRecordType>;

export type OrderNotesRecordType = BaseRecord & { orderId?: string; adminId?: string; body?: string };
export type OrderNotesRecordInput = RecordInput<OrderNotesRecordType>;

export type AuditEventsRecordType = BaseRecord & {
  actorType?: string; actorId?: string; action?: string; entityType?: string; entityId?: string; requestId?: string;
  beforeJson?: JsonValue; afterJson?: JsonValue; metadataJson?: JsonValue;
};
export type AuditEventsRecordInput = RecordInput<AuditEventsRecordType>;

export type ForecastSettingsRecordType = BaseRecord & {
  lookbackDays?: number; targetCoverageDays?: number; restockHorizonDays?: number; defaultLeadTimeDays?: number;
  defaultSafetyStockDays?: number; updatedBy?: string;
};
export type ForecastSettingsRecordInput = RecordInput<ForecastSettingsRecordType>;

export type ProductReviewsRecordType = BaseRecord & {
  productId?: string; orderItemId?: string; customerId?: string; rating?: number; title?: string; body?: string;
  publicDisplayNameSnapshot?: string; state?: string; publishedAt?: string; editedAt?: string; deletedAt?: string; moderatedAt?: string;
};
export type ProductReviewsRecordInput = RecordInput<ProductReviewsRecordType>;

export type ReviewPhotosRecordType = BaseRecord & {
  reviewId?: string; ownerCustomerId?: string; orderItemId?: string; storageProvider?: string; stagingObjectKey?: string; finalObjectKey?: string;
  mimeType?: string; byteSize?: number; width?: number; height?: number; checksum?: string; state?: string; rejectionReason?: string;
  attachedAt?: string; deleteAfter?: string; storageDeletedAt?: string;
};
export type ReviewPhotosRecordInput = RecordInput<ReviewPhotosRecordType>;

export type ReviewModerationActionsRecordType = BaseRecord & {
  reviewId?: string; action?: string; reason?: string; adminId?: string; priorState?: string; newState?: string;
};
export type ReviewModerationActionsRecordInput = RecordInput<ReviewModerationActionsRecordType>;

export type RateLimitBucketsRecordType = BaseRecord & { bucketKey?: string; windowStartedAt?: string; count?: number; expiresAt?: string };
export type RateLimitBucketsRecordInput = RecordInput<RateLimitBucketsRecordType>;
