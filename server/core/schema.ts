import type { Queryable } from './pg.js';
import { runMigrations } from './migrations/index.js';
import seed from './seed.js';

type Col = 'text' | 'double precision' | 'boolean' | 'timestamptz' | 'integer' | 'bigint' | 'numeric' | 'jsonb';

export const TABLES: Record<string, Record<string, Col>> = {
  Products: {
    name: 'text', description: 'text', price: 'double precision', size: 'text', purity: 'text', category: 'text', imageUrl: 'text',
    stock: 'double precision', active: 'boolean', featured: 'boolean', salePrice: 'double precision', coaUrl: 'text', showCoa: 'boolean',
    hasVariants: 'boolean', shippingScope: 'text', shippingOptionId: 'text', subcategoryDividerId: 'text',
    inventoryTracked: 'boolean', sellableUnitLabel: 'text', supplierUnitLabel: 'text', supplierUnitsPerSellableUnit: 'integer',
    supplierPackLabel: 'text', supplierUnitsPerPack: 'integer', leadTimeDays: 'integer', safetyStockDays: 'integer',
    preorderEnabled: 'boolean', preorderCapSellableUnits: 'integer', preorderExpectedShipAt: 'timestamptz',
  },
  ShippingOptions: { name: 'text', price: 'double precision' },
  ProductVariants: {
    preorderEnabled: 'boolean', preorderExpectedShipAt: 'timestamptz',
    productId: 'text', name: 'text', price: 'double precision', salePrice: 'double precision', stock: 'integer',
    shippingOptionId: 'text', active: 'boolean', sortOrder: 'integer',
  },
  SubcategoryDividers: { categoryId: 'text', name: 'text', sortOrder: 'integer' },
  DiscountCodes: {
    code: 'text', discountType: 'text', amount: 'double precision', minimumOrder: 'double precision', usageLimit: 'double precision',
    timesUsed: 'double precision', expiresAt: 'timestamptz', active: 'boolean', note: 'text',
  },
  StoreSettings: {
    storeName: 'text', solAddress: 'text', ltcAddress: 'text', shippingFee: 'double precision', freeShippingOver: 'double precision',
    promoActive: 'boolean', promoTitle: 'text', promoSubtitle: 'text', promoCode: 'text', adminEmail: 'text', btcAddress: 'text',
    ethAddress: 'text', tronAddress: 'text', testMode: 'boolean', termsOfService: 'text', privacyPolicy: 'text', shippingPolicy: 'text',
    refundPolicy: 'text', themeIntensity: 'text', themeMotion: 'boolean', themeHeadline: 'text', themeSubtitle: 'text', themeAnnouncement: 'text', themeStartsAt: 'text', themeEndsAt: 'text', themeCountdownAt: 'text', seasonalTheme: 'text', minimumAge: 'integer', primaryColor: 'text', accentColor: 'text', etherscanApiKey: 'text', tronGridApiKey: 'text', solanaRpcUrl: 'text',
  },
  Orders: {
    researchAcceptedAt: 'timestamptz', acceptedMinimumAge: 'integer',
    orderNumber: 'text', customer: 'text', customerEmail: 'text', customerName: 'text', shippingAddress: 'text', itemsJson: 'text',
    subtotal: 'double precision', discount: 'double precision', shipping: 'double precision', total: 'double precision', discountCode: 'text',
    discountCodeId: 'text', payCurrency: 'text', cryptoAmount: 'double precision', payAddress: 'text', transactionHash: 'text',
    paymentExpiresAt: 'timestamptz', paidAt: 'timestamptz', status: 'text', trackingNumber: 'text', carrier: 'text', trackingStatus: 'text',
    trackingEventsJson: 'text', lastTrackingCheck: 'timestamptz', placedAt: 'timestamptz', country: 'text', city: 'text', postalCode: 'text',
    streetAddress: 'text', commercialState: 'text', currency: 'text', subtotalCents: 'bigint', discountCents: 'bigint', shippingCents: 'bigint',
    totalCents: 'bigint', checkoutIdempotencyKey: 'text', cancelledAt: 'timestamptz', closedAt: 'timestamptz', migrationVersion: 'integer',
    shippingBreakdownJson: 'jsonb',
  },
  Categories: { name: 'text', sortOrder: 'double precision' },
  SupportContacts: { label: 'text', channel: 'text', handle: 'text', sortOrder: 'double precision' },
  CustomerProfiles: {
    fullName: 'text', user: 'text', country: 'text', streetAddress: 'text', postalCode: 'text', city: 'text', reviewDisplayName: 'text',
  },
  Users: { email: 'text', passwordHash: 'text', firstName: 'text', lastName: 'text', role: 'text' },
  Files: { filename: 'text', mimeType: 'text', dataBase64: 'text' },
  OrderItems: {
    preorderEnabled: 'boolean', preorderExpectedShipAt: 'timestamptz',
    orderId: 'text', lineNumber: 'integer', productId: 'text', productName: 'text', productSize: 'text', variantId: 'text', variantName: 'text',
    shippingOptionId: 'text', shippingOptionName: 'text', shippingOptionPriceCents: 'bigint', unitPriceCents: 'bigint',
    quantity: 'integer', lineSubtotalCents: 'bigint', discountCents: 'bigint', shippingCents: 'bigint',
  },
  PaymentAttempts: {
    orderId: 'text', provider: 'text', providerOrderId: 'text', providerPaymentId: 'text', checkoutIdempotencyKey: 'text', state: 'text',
    priceAmountCents: 'bigint', priceCurrency: 'text', payAmount: 'text', payCurrency: 'text', network: 'text', payAddress: 'text',
    payinExtraId: 'text', purchaseId: 'text', actuallyPaid: 'text', outcomeAmount: 'text', outcomeCurrency: 'text', expiresAt: 'timestamptz',
    finishedAt: 'timestamptz', lastEventAt: 'timestamptz', lastReconciledAt: 'timestamptz', creationStartedAt: 'timestamptz',
    creationError: 'text', providerResponseJson: 'jsonb',
  },
  ProviderWebhookEvents: {
    provider: 'text', eventId: 'text', eventType: 'text', signatureValid: 'boolean', rawBodyDigest: 'text', payloadJson: 'jsonb',
    receivedAt: 'timestamptz', processedAt: 'timestamptz', processingStatus: 'text', error: 'text',
  },
  InventoryBalances: {
    productId: 'text', onHandSupplierUnits: 'integer', reservedSupplierUnits: 'integer', inboundSupplierUnits: 'integer', version: 'integer',
  },
  InventoryLedger: {
    productId: 'text', deltaSupplierUnits: 'integer', balanceAfterSupplierUnits: 'integer', reason: 'text', relatedEntityType: 'text',
    relatedEntityId: 'text', actorType: 'text', actorId: 'text', note: 'text',
  },
  InboundStock: {
    productId: 'text', supplierUnits: 'integer', supplierPackCount: 'integer', expectedAt: 'timestamptz', state: 'text',
    receivedSupplierUnits: 'integer', note: 'text',
  },
  OrderItemAllocations: {
    orderItemId: 'text', kind: 'text', quantitySellableUnits: 'integer', supplierUnits: 'integer', state: 'text', reservedUntil: 'timestamptz',
    committedAt: 'timestamptz', releasedAt: 'timestamptz', readyAt: 'timestamptz', shippedAt: 'timestamptz', promisedShipAt: 'timestamptz',
    promiseSourceProductDate: 'timestamptz', overdueAt: 'timestamptz', customerOverdueNotifiedAt: 'timestamptz', adminOverdueNotifiedAt: 'timestamptz',
    cancellationExceptionGrantedAt: 'timestamptz', cancellationExceptionGrantedBy: 'text', cancellationExceptionReason: 'text',
  },
  Shipments: {
    orderId: 'text', status: 'text', trackingNumber: 'text', carrierCode: 'text', carrierName: 'text', trackingProvider: 'text',
    registeredAt: 'timestamptz', shippedAt: 'timestamptz', deliveredAt: 'timestamptz', lastCheckedAt: 'timestamptz', providerStatus: 'text',
    providerSubstatus: 'text', postageCostCents: 'bigint',
  },
  ShipmentItems: { shipmentId: 'text', orderItemId: 'text', allocationId: 'text', quantity: 'integer' },
  ShipmentEvents: {
    shipmentId: 'text', provider: 'text', providerEventId: 'text', eventDigest: 'text', status: 'text', substatus: 'text', description: 'text',
    location: 'text', occurredAt: 'timestamptz', metadataJson: 'jsonb',
  },
  ShipmentIncidents: {
    shipmentId: 'text', type: 'text', source: 'text', state: 'text', detectedAt: 'timestamptz', shipmentEventId: 'text', resolution: 'text',
    resolutionMetadataJson: 'jsonb',
  },
  RefundRequests: {
    orderId: 'text', shipmentIncidentId: 'text', allocationId: 'text', customerId: 'text', reason: 'text', currency: 'text', network: 'text',
    address: 'text', memo: 'text', addressValidationJson: 'jsonb', state: 'text', requestedUsdCents: 'bigint', approvedBy: 'text',
    approvedAt: 'timestamptz', rejectedReason: 'text', quotedAt: 'timestamptz',
  },
  RefundPayouts: {
    refundRequestId: 'text', attemptGeneration: 'integer', provider: 'text', uniqueExternalId: 'text', providerPayoutId: 'text',
    usdAmountCents: 'bigint', exchangeRate: 'text', grossCryptoAmount: 'text', providerFeeAmount: 'text', networkFeeAmount: 'text',
    recipientAmount: 'text', currency: 'text', network: 'text', address: 'text', memo: 'text', state: 'text', providerResponseJson: 'jsonb',
    lastReconciledAt: 'timestamptz', succeededAt: 'timestamptz',
  },
  EmailTemplates: {
    templateKey: 'text', name: 'text', kind: 'text', mode: 'text', subject: 'text', preheader: 'text', heading: 'text', bodyText: 'text',
    ctaLabel: 'text', ctaUrlTemplate: 'text', advancedHtml: 'text', advancedText: 'text', html: 'text', text: 'text',
    variablesJson: 'jsonb', allowedVariablesJson: 'jsonb', version: 'integer', enabled: 'boolean', updatedBy: 'text',
  },
  EmailOutbox: {
    recipient: 'text', templateKey: 'text', templateVersion: 'integer', payloadJson: 'jsonb', kind: 'text', purpose: 'text',
    idempotencyKey: 'text', state: 'text', subjectSnapshot: 'text', htmlSnapshot: 'text', textSnapshot: 'text',
    fromNameSnapshot: 'text', fromAddressSnapshot: 'text', replyToSnapshot: 'text', headersJson: 'jsonb', orderId: 'text',
    campaignId: 'text', campaignRecipientId: 'text', leaseOwner: 'text', leaseExpiresAt: 'timestamptz', attemptCount: 'integer',
    maxAttempts: 'integer', nextAttemptAt: 'timestamptz', lastAttemptAt: 'timestamptz', providerMessageId: 'text',
    providerResponseJson: 'jsonb', error: 'text', cancelReason: 'text', cancelledAt: 'timestamptz', failedAt: 'timestamptz',
    sentAt: 'timestamptz', deliveredAt: 'timestamptz',
  },
  EmailEvents: {
    provider: 'text', providerEventId: 'text', outboxId: 'text', providerMessageId: 'text', campaignId: 'text', email: 'text',
    eventType: 'text', eventCategory: 'text', eventAt: 'timestamptz', rawDigest: 'text', processedAt: 'timestamptz',
    processingError: 'text', metadataJson: 'jsonb',
  },
  MarketingContacts: {
    email: 'text', userId: 'text', state: 'text', consentSource: 'text', consentAt: 'timestamptz', lastEligibleAt: 'timestamptz',
    unsubscribedAt: 'timestamptz', unsubscribeReason: 'text', suppressedAt: 'timestamptz', suppressionReason: 'text',
    providerContactId: 'text', syncState: 'text', metadataJson: 'jsonb',
  },
  CustomerSegments: { name: 'text', definitionJson: 'jsonb', active: 'boolean' },
  Campaigns: {
    name: 'text', subject: 'text', mode: 'text', preheader: 'text', heading: 'text', bodyText: 'text', ctaLabel: 'text', ctaUrl: 'text',
    advancedHtml: 'text', advancedText: 'text', html: 'text', text: 'text', revision: 'integer', audienceType: 'text',
    templateSnapshotJson: 'jsonb', audienceDefinitionJson: 'jsonb', recipientCount: 'integer', eligibleRecipientCount: 'integer',
    scheduledAt: 'timestamptz', state: 'text', testSentAt: 'timestamptz', testRecipient: 'text', testOutboxId: 'text',
    testRevision: 'integer', confirmationNonceHash: 'text', confirmationExpiresAt: 'timestamptz', confirmedBy: 'text',
    confirmedAt: 'timestamptz', queuedAt: 'timestamptz', completedAt: 'timestamptz', failedCount: 'integer',
    suppressedCount: 'integer', resendBroadcastId: 'text', providerSegmentId: 'text', approvedBy: 'text', approvedAt: 'timestamptz', sentAt: 'timestamptz',
  },
  CampaignRecipients: {
    campaignId: 'text', contactId: 'text', customerId: 'text', email: 'text', roleSnapshot: 'text', eligibilitySnapshotJson: 'jsonb',
    templateSnapshotJson: 'jsonb', state: 'text', outboxId: 'text', providerMessageId: 'text', suppressionReason: 'text',
    queuedAt: 'timestamptz', sentAt: 'timestamptz', suppressedAt: 'timestamptz', failedAt: 'timestamptz',
  },
  OrderNotes: { orderId: 'text', adminId: 'text', body: 'text' },
  AuditEvents: {
    actorType: 'text', actorId: 'text', action: 'text', entityType: 'text', entityId: 'text', requestId: 'text',
    beforeJson: 'jsonb', afterJson: 'jsonb', metadataJson: 'jsonb',
  },
  ForecastSettings: {
    lookbackDays: 'integer', targetCoverageDays: 'integer', restockHorizonDays: 'integer', defaultLeadTimeDays: 'integer',
    defaultSafetyStockDays: 'integer', updatedBy: 'text',
  },
  ProductReviews: {
    productId: 'text', orderItemId: 'text', customerId: 'text', rating: 'integer', title: 'text', body: 'text',
    publicDisplayNameSnapshot: 'text', state: 'text', publishedAt: 'timestamptz', editedAt: 'timestamptz', deletedAt: 'timestamptz',
    moderatedAt: 'timestamptz',
  },
  ReviewPhotos: {
    reviewId: 'text', ownerCustomerId: 'text', orderItemId: 'text', storageProvider: 'text', stagingObjectKey: 'text', finalObjectKey: 'text',
    mimeType: 'text', byteSize: 'integer', width: 'integer', height: 'integer', checksum: 'text', state: 'text', rejectionReason: 'text',
    attachedAt: 'timestamptz', deleteAfter: 'timestamptz', storageDeletedAt: 'timestamptz',
  },
  ReviewModerationActions: {
    reviewId: 'text', action: 'text', reason: 'text', adminId: 'text', priorState: 'text', newState: 'text',
  },
  RateLimitBuckets: { bucketKey: 'text', windowStartedAt: 'timestamptz', count: 'integer', expiresAt: 'timestamptz' },
};

export const AUTO_NOW: Record<string, string[]> = { Orders: ['placedAt'] };

const BASE_SCHEMA_VERSION = '000-base-schema-v1';

export async function migrate(db: Queryable) {
  await db.query(`CREATE TABLE IF NOT EXISTS "SchemaMigrations" (
    "version" text PRIMARY KEY,
    "appliedAt" timestamptz NOT NULL DEFAULT now()
  )`);
  const { rows: baseRows } = await db.query(
    `SELECT "version" FROM "SchemaMigrations" WHERE "version" = $1`,
    [BASE_SCHEMA_VERSION],
  );

  if (!baseRows[0]) {
    await db.transaction(async (tx) => {
      const { rows: claimed } = await tx.query(
        `INSERT INTO "SchemaMigrations" ("version") VALUES ($1)
         ON CONFLICT ("version") DO NOTHING RETURNING "version"`,
        [BASE_SCHEMA_VERSION],
      );
      if (!claimed[0]) return;

      const ddl: string[] = [];
      for (const [table, cols] of Object.entries(TABLES)) {
        ddl.push(`CREATE TABLE IF NOT EXISTS "${table}" ("id" text PRIMARY KEY, "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now())`);
        for (const [column, type] of Object.entries(cols)) {
          ddl.push(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${column}" ${type}${AUTO_NOW[table]?.includes(column) ? ' DEFAULT now()' : ''}`);
        }
      }
      ddl.push(
        `CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON "Users" (lower("email"))`,
        `CREATE INDEX IF NOT EXISTS orders_customer_idx ON "Orders" ("customer")`,
        `CREATE INDEX IF NOT EXISTS orders_tracking_idx ON "Orders" ("trackingNumber")`,
      );
      await tx.query(ddl.join(';\n'));

      const { rows } = await tx.query(`SELECT count(*)::int AS n FROM "StoreSettings"`);
      if (Number(rows[0]?.n) === 0) {
        for (const [table, records] of Object.entries(seed)) {
          for (const record of records) {
            const keys = Object.keys(record).filter((key) => key in TABLES[table]);
            await tx.query(
              `INSERT INTO "${table}" ("id", ${keys.map((key) => `"${key}"`).join(', ')}) VALUES ($1, ${keys.map((_, index) => `$${index + 2}`).join(', ')})`,
              [crypto.randomUUID(), ...keys.map((key) => record[key])],
            );
          }
        }
      }
    });
  }

  await runMigrations(db);
}
