import type { QueryRunner, Queryable } from '../pg.js';

type Migration = {
  version: string;
  up: (tx: QueryRunner) => Promise<void>;
};

async function runAll(tx: QueryRunner, statements: string[]) {
  if (statements.length) await tx.query(statements.join(';\n'));
}

const constraints: Migration = {
  version: '001-normalized-domain-constraints',
  up: async (tx) => {
    await runAll(tx, [
      `ALTER TABLE "OrderItems" ADD CONSTRAINT order_items_order_fk FOREIGN KEY ("orderId") REFERENCES "Orders"("id") ON DELETE CASCADE`,
      `ALTER TABLE "PaymentAttempts" ADD CONSTRAINT payment_attempts_order_fk FOREIGN KEY ("orderId") REFERENCES "Orders"("id") ON DELETE CASCADE`,
      `ALTER TABLE "OrderItemAllocations" ADD CONSTRAINT allocations_item_fk FOREIGN KEY ("orderItemId") REFERENCES "OrderItems"("id") ON DELETE CASCADE`,
      `ALTER TABLE "Shipments" ADD CONSTRAINT shipments_order_fk FOREIGN KEY ("orderId") REFERENCES "Orders"("id") ON DELETE CASCADE`,
      `ALTER TABLE "ShipmentItems" ADD CONSTRAINT shipment_items_shipment_fk FOREIGN KEY ("shipmentId") REFERENCES "Shipments"("id") ON DELETE CASCADE`,
      `ALTER TABLE "ShipmentItems" ADD CONSTRAINT shipment_items_order_item_fk FOREIGN KEY ("orderItemId") REFERENCES "OrderItems"("id") ON DELETE CASCADE`,
      `ALTER TABLE "ShipmentItems" ADD CONSTRAINT shipment_items_allocation_fk FOREIGN KEY ("allocationId") REFERENCES "OrderItemAllocations"("id") ON DELETE CASCADE`,
      `ALTER TABLE "ShipmentEvents" ADD CONSTRAINT shipment_events_shipment_fk FOREIGN KEY ("shipmentId") REFERENCES "Shipments"("id") ON DELETE CASCADE`,
      `ALTER TABLE "ShipmentIncidents" ADD CONSTRAINT shipment_incidents_shipment_fk FOREIGN KEY ("shipmentId") REFERENCES "Shipments"("id") ON DELETE CASCADE`,
      `ALTER TABLE "RefundRequests" ADD CONSTRAINT refund_requests_order_fk FOREIGN KEY ("orderId") REFERENCES "Orders"("id") ON DELETE CASCADE`,
      `ALTER TABLE "RefundPayouts" ADD CONSTRAINT refund_payouts_request_fk FOREIGN KEY ("refundRequestId") REFERENCES "RefundRequests"("id") ON DELETE CASCADE`,
      `ALTER TABLE "CampaignRecipients" ADD CONSTRAINT campaign_recipients_campaign_fk FOREIGN KEY ("campaignId") REFERENCES "Campaigns"("id") ON DELETE CASCADE`,
      `ALTER TABLE "OrderNotes" ADD CONSTRAINT order_notes_order_fk FOREIGN KEY ("orderId") REFERENCES "Orders"("id") ON DELETE CASCADE`,
      `ALTER TABLE "ProductReviews" ADD CONSTRAINT product_reviews_item_fk FOREIGN KEY ("orderItemId") REFERENCES "OrderItems"("id") ON DELETE RESTRICT`,
      `ALTER TABLE "ReviewPhotos" ADD CONSTRAINT review_photos_review_fk FOREIGN KEY ("reviewId") REFERENCES "ProductReviews"("id") ON DELETE SET NULL`,
      `ALTER TABLE "ReviewModerationActions" ADD CONSTRAINT review_actions_review_fk FOREIGN KEY ("reviewId") REFERENCES "ProductReviews"("id") ON DELETE CASCADE`,
      `ALTER TABLE "Products" ADD CONSTRAINT products_inventory_config_check CHECK (
        ("supplierUnitsPerSellableUnit" IS NULL OR "supplierUnitsPerSellableUnit" > 0)
        AND ("supplierUnitsPerPack" IS NULL OR "supplierUnitsPerPack" > 0)
        AND ("leadTimeDays" IS NULL OR "leadTimeDays" >= 0)
        AND ("safetyStockDays" IS NULL OR "safetyStockDays" >= 0)
        AND ("preorderCapSellableUnits" IS NULL OR "preorderCapSellableUnits" >= 0)
      )`,
      `ALTER TABLE "OrderItems" ADD CONSTRAINT order_items_values_check CHECK (
        "lineNumber" >= 0 AND "quantity" > 0 AND "unitPriceCents" >= 0
        AND "lineSubtotalCents" >= 0 AND COALESCE("discountCents", 0) >= 0
        AND COALESCE("shippingCents", 0) >= 0
      )`,
      `ALTER TABLE "PaymentAttempts" ADD CONSTRAINT payment_attempts_price_check CHECK ("priceAmountCents" IS NULL OR "priceAmountCents" >= 0)`,
      `ALTER TABLE "InventoryBalances" ADD CONSTRAINT inventory_balances_nonnegative_check CHECK (
        "onHandSupplierUnits" >= 0 AND "reservedSupplierUnits" >= 0
        AND "inboundSupplierUnits" >= 0 AND "reservedSupplierUnits" <= "onHandSupplierUnits"
      )`,
      `ALTER TABLE "InboundStock" ADD CONSTRAINT inbound_stock_values_check CHECK (
        "supplierUnits" > 0 AND COALESCE("supplierPackCount", 0) >= 0
        AND COALESCE("receivedSupplierUnits", 0) >= 0
        AND COALESCE("receivedSupplierUnits", 0) <= "supplierUnits"
      )`,
      `ALTER TABLE "OrderItemAllocations" ADD CONSTRAINT allocations_values_check CHECK (
        "quantitySellableUnits" > 0 AND "supplierUnits" > 0
      )`,
      `ALTER TABLE "ShipmentItems" ADD CONSTRAINT shipment_items_quantity_check CHECK ("quantity" > 0)`,
      `ALTER TABLE "RefundRequests" ADD CONSTRAINT refund_request_amount_check CHECK ("requestedUsdCents" IS NULL OR "requestedUsdCents" >= 0)`,
      `ALTER TABLE "RefundPayouts" ADD CONSTRAINT refund_payout_amount_check CHECK ("usdAmountCents" IS NULL OR "usdAmountCents" >= 0)`,
      `ALTER TABLE "EmailOutbox" ADD CONSTRAINT email_outbox_attempt_check CHECK (COALESCE("attemptCount", 0) >= 0)`,
      `ALTER TABLE "ForecastSettings" ADD CONSTRAINT forecast_settings_values_check CHECK (
        "lookbackDays" > 0 AND "targetCoverageDays" >= 0 AND "restockHorizonDays" >= 0
        AND COALESCE("defaultLeadTimeDays", 0) >= 0 AND COALESCE("defaultSafetyStockDays", 0) >= 0
      )`,
      `ALTER TABLE "ProductReviews" ADD CONSTRAINT product_reviews_rating_check CHECK ("rating" BETWEEN 1 AND 5)`,
      `ALTER TABLE "ReviewPhotos" ADD CONSTRAINT review_photos_metadata_check CHECK (
        ("byteSize" IS NULL OR "byteSize" >= 0) AND ("width" IS NULL OR "width" > 0)
        AND ("height" IS NULL OR "height" > 0)
      )`,
      `ALTER TABLE "RateLimitBuckets" ADD CONSTRAINT rate_limit_count_check CHECK ("count" >= 0)`,
      `CREATE UNIQUE INDEX orders_customer_checkout_idx ON "Orders" ("customer", "checkoutIdempotencyKey") WHERE "checkoutIdempotencyKey" IS NOT NULL`,
      `CREATE UNIQUE INDEX order_items_order_line_idx ON "OrderItems" ("orderId", "lineNumber")`,
      `CREATE INDEX order_items_product_idx ON "OrderItems" ("productId")`,
      `CREATE UNIQUE INDEX payment_attempts_provider_order_idx ON "PaymentAttempts" ("providerOrderId")`,
      `CREATE UNIQUE INDEX payment_attempts_provider_payment_idx ON "PaymentAttempts" ("provider", "providerPaymentId") WHERE "providerPaymentId" IS NOT NULL`,
      `CREATE INDEX payment_attempts_state_expiry_idx ON "PaymentAttempts" ("state", "expiresAt")`,
      `CREATE UNIQUE INDEX provider_webhook_events_identity_idx ON "ProviderWebhookEvents" ("provider", "eventId")`,
      `CREATE INDEX provider_webhook_events_processing_idx ON "ProviderWebhookEvents" ("processingStatus", "receivedAt")`,
      `CREATE UNIQUE INDEX inventory_balances_product_idx ON "InventoryBalances" ("productId")`,
      `CREATE INDEX inventory_ledger_product_created_idx ON "InventoryLedger" ("productId", "createdAt")`,
      `CREATE UNIQUE INDEX inventory_ledger_source_idx ON "InventoryLedger" ("productId", "reason", "relatedEntityType", "relatedEntityId") WHERE "relatedEntityId" IS NOT NULL`,
      `CREATE INDEX inbound_stock_product_state_idx ON "InboundStock" ("productId", "state", "expectedAt")`,
      `CREATE INDEX allocations_item_state_idx ON "OrderItemAllocations" ("orderItemId", "state")`,
      `CREATE INDEX allocations_promise_state_idx ON "OrderItemAllocations" ("promisedShipAt", "state")`,
      `CREATE INDEX shipments_order_state_idx ON "Shipments" ("orderId", "status")`,
      `CREATE UNIQUE INDEX shipments_tracking_identity_idx ON "Shipments" ("trackingProvider", "trackingNumber") WHERE "trackingNumber" IS NOT NULL`,
      `CREATE UNIQUE INDEX shipment_items_allocation_idx ON "ShipmentItems" ("shipmentId", "allocationId")`,
      `CREATE UNIQUE INDEX shipment_events_provider_idx ON "ShipmentEvents" ("shipmentId", "provider", "providerEventId") WHERE "providerEventId" IS NOT NULL`,
      `CREATE UNIQUE INDEX shipment_events_digest_idx ON "ShipmentEvents" ("shipmentId", "eventDigest")`,
      `CREATE UNIQUE INDEX shipment_incidents_open_lost_idx ON "ShipmentIncidents" ("shipmentId", "type") WHERE "state" IN ('open', 'refund_requested')`,
      `CREATE INDEX refund_requests_order_state_idx ON "RefundRequests" ("orderId", "state")`,
      `CREATE UNIQUE INDEX refund_requests_active_incident_idx ON "RefundRequests" ("shipmentIncidentId") WHERE "shipmentIncidentId" IS NOT NULL AND "state" NOT IN ('rejected', 'cancelled', 'succeeded')`,
      `CREATE UNIQUE INDEX refund_payout_external_idx ON "RefundPayouts" ("uniqueExternalId")`,
      `CREATE UNIQUE INDEX refund_payout_provider_idx ON "RefundPayouts" ("provider", "providerPayoutId") WHERE "providerPayoutId" IS NOT NULL`,
      `CREATE UNIQUE INDEX email_templates_key_idx ON "EmailTemplates" ("templateKey")`,
      `CREATE UNIQUE INDEX email_outbox_idempotency_idx ON "EmailOutbox" ("idempotencyKey")`,
      `CREATE INDEX email_outbox_work_idx ON "EmailOutbox" ("state", "nextAttemptAt", "leaseExpiresAt")`,
      `CREATE UNIQUE INDEX email_events_provider_idx ON "EmailEvents" ("provider", "providerEventId")`,
      `CREATE UNIQUE INDEX marketing_contacts_email_idx ON "MarketingContacts" (lower("email"))`,
      `CREATE INDEX marketing_contacts_state_idx ON "MarketingContacts" ("state")`,
      `CREATE INDEX campaigns_state_schedule_idx ON "Campaigns" ("state", "scheduledAt")`,
      `CREATE UNIQUE INDEX campaign_recipients_email_idx ON "CampaignRecipients" ("campaignId", lower("email"))`,
      `CREATE INDEX audit_events_entity_idx ON "AuditEvents" ("entityType", "entityId", "createdAt")`,
      `CREATE UNIQUE INDEX product_reviews_order_item_idx ON "ProductReviews" ("orderItemId")`,
      `CREATE INDEX product_reviews_public_idx ON "ProductReviews" ("productId", "state", "publishedAt")`,
      `CREATE INDEX product_reviews_customer_idx ON "ProductReviews" ("customerId", "createdAt")`,
      `CREATE INDEX review_photos_cleanup_idx ON "ReviewPhotos" ("state", "deleteAfter")`,
      `CREATE INDEX review_actions_review_idx ON "ReviewModerationActions" ("reviewId", "createdAt")`,
      `CREATE UNIQUE INDEX rate_limit_bucket_idx ON "RateLimitBuckets" ("bucketKey", "windowStartedAt")`,
      `CREATE INDEX rate_limit_expiry_idx ON "RateLimitBuckets" ("expiresAt")`,
    ]);
  },
};

const backfill: Migration = {
  version: '002-normalized-domain-backfill',
  up: async (tx) => {
    const { rows: orders } = await tx.query(`SELECT * FROM "Orders" ORDER BY "createdAt"`);
    for (const order of orders) {
      const subtotalCents = Math.round(Number(order.subtotal ?? 0) * 100);
      const discountCents = Math.round(Number(order.discount ?? 0) * 100);
      const shippingCents = Math.round(Number(order.shipping ?? 0) * 100);
      const totalCents = Math.round(Number(order.total ?? 0) * 100);
      const commercialState = order.status === 'Cancelled'
        ? 'cancelled'
        : ['Delivered', 'Refunded'].includes(String(order.status ?? '')) ? 'closed' : 'open';
      await tx.query(
        `UPDATE "Orders" SET
          "subtotalCents" = COALESCE("subtotalCents", $2),
          "discountCents" = COALESCE("discountCents", $3),
          "shippingCents" = COALESCE("shippingCents", $4),
          "totalCents" = COALESCE("totalCents", $5),
          "currency" = COALESCE("currency", 'USD'),
          "commercialState" = COALESCE("commercialState", $6),
          "migrationVersion" = COALESCE("migrationVersion", 1)
        WHERE "id" = $1`,
        [order.id, subtotalCents, discountCents, shippingCents, totalCents, commercialState],
      );

      let items: unknown[] = [];
      try {
        const parsed = JSON.parse(String(order.itemsJson ?? '[]'));
        if (Array.isArray(parsed)) items = parsed;
      } catch {
        items = [];
      }
      for (let lineNumber = 0; lineNumber < items.length; lineNumber++) {
        const value = items[lineNumber];
        if (!value || typeof value !== 'object') continue;
        const item = value as Record<string, unknown>;
        const quantity = Math.trunc(Number(item.quantity));
        const unitPriceCents = Math.round(Number(item.price ?? 0) * 100);
        if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPriceCents) || unitPriceCents < 0) continue;
        await tx.query(
          `INSERT INTO "OrderItems" (
            "id", "orderId", "lineNumber", "productId", "productName", "productSize",
            "unitPriceCents", "quantity", "lineSubtotalCents", "discountCents", "shippingCents"
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,0,0)
          ON CONFLICT ("orderId", "lineNumber") DO NOTHING`,
          [
            `legacy:${order.id}:${lineNumber}`,
            order.id,
            lineNumber,
            typeof item.productId === 'string' ? item.productId : null,
            String(item.name ?? 'Legacy item'),
            typeof item.size === 'string' ? item.size : null,
            unitPriceCents,
            quantity,
            unitPriceCents * quantity,
          ],
        );
      }

      const paymentState = ['Awaiting Payment'].includes(String(order.status ?? ''))
        ? 'waiting'
        : ['Expired', 'Cancelled'].includes(String(order.status ?? '')) ? 'expired' : 'finished';
      await tx.query(
        `INSERT INTO "PaymentAttempts" (
          "id", "orderId", "provider", "providerOrderId", "state", "priceAmountCents",
          "priceCurrency", "payAmount", "payCurrency", "payAddress", "expiresAt", "finishedAt",
          "creationStartedAt", "providerResponseJson"
        ) VALUES ($1,$2,'legacy',$3,$4,$5,'USD',$6,$7,$8,$9,$10,$11,$12::jsonb)
        ON CONFLICT ("providerOrderId") DO NOTHING`,
        [
          `legacy:${order.id}`,
          order.id,
          `legacy:${order.id}`,
          paymentState,
          totalCents,
          order.cryptoAmount == null ? null : String(order.cryptoAmount),
          order.payCurrency ?? null,
          order.payAddress ?? null,
          order.paymentExpiresAt ?? null,
          paymentState === 'finished' ? order.paidAt ?? order.updatedAt ?? order.createdAt : null,
          order.placedAt ?? order.createdAt ?? new Date().toISOString(),
          JSON.stringify({ legacy: true, transactionHash: order.transactionHash ?? null }),
        ],
      );
    }

    await tx.query(`UPDATE "Products" SET
      "sellableUnitLabel" = COALESCE("sellableUnitLabel", 'unit'),
      "supplierUnitLabel" = COALESCE("supplierUnitLabel", 'unit'),
      "supplierUnitsPerSellableUnit" = COALESCE("supplierUnitsPerSellableUnit", 1),
      "supplierPackLabel" = COALESCE("supplierPackLabel", 'pack'),
      "supplierUnitsPerPack" = COALESCE("supplierUnitsPerPack", 1),
      "leadTimeDays" = COALESCE("leadTimeDays", 0),
      "safetyStockDays" = COALESCE("safetyStockDays", 0),
      "preorderEnabled" = COALESCE("preorderEnabled", false),
      "preorderCapSellableUnits" = COALESCE("preorderCapSellableUnits", 0),
      "inventoryTracked" = COALESCE("inventoryTracked", "stock" IS NOT NULL)`);

    const { rows: products } = await tx.query(`SELECT * FROM "Products" WHERE "stock" IS NOT NULL`);
    for (const product of products) {
      const conversion = Math.max(1, Math.trunc(Number(product.supplierUnitsPerSellableUnit ?? 1)));
      const onHand = Math.max(0, Math.floor(Number(product.stock ?? 0))) * conversion;
      const balanceId = `inventory:${product.id}`;
      const { rows: inserted } = await tx.query(
        `INSERT INTO "InventoryBalances" (
          "id", "productId", "onHandSupplierUnits", "reservedSupplierUnits", "inboundSupplierUnits", "version"
        ) VALUES ($1,$2,$3,0,0,1)
        ON CONFLICT ("productId") DO NOTHING
        RETURNING "id"`,
        [balanceId, product.id, onHand],
      );
      if (inserted[0]) {
        await tx.query(
          `INSERT INTO "InventoryLedger" (
            "id", "productId", "deltaSupplierUnits", "balanceAfterSupplierUnits", "reason",
            "relatedEntityType", "relatedEntityId", "actorType", "note"
          ) VALUES ($1,$2,$3,$3,'opening_balance','migration',$4,'system',$5)
          ON CONFLICT DO NOTHING`,
          [crypto.randomUUID(), product.id, onHand, '002-normalized-domain-backfill', 'Opening balance from legacy Products.stock'],
        );
      }
    }

    const { rows: forecast } = await tx.query(`SELECT "id" FROM "ForecastSettings" LIMIT 1`);
    if (!forecast[0]) {
      await tx.query(
        `INSERT INTO "ForecastSettings" (
          "id", "lookbackDays", "targetCoverageDays", "restockHorizonDays",
          "defaultLeadTimeDays", "defaultSafetyStockDays"
        ) VALUES ($1,90,30,30,0,7)`,
        [crypto.randomUUID()],
      );
    }
  },
};

const catalogShipping: Migration = {
  version: '003-catalog-variants-shipping-dividers',
  up: async (tx) => {
    await runAll(tx, [
      `CREATE TABLE IF NOT EXISTS "ShippingOptions" (
        "id" text PRIMARY KEY, "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "name" text, "price" double precision
      )`,
      `CREATE TABLE IF NOT EXISTS "ProductVariants" (
        "id" text PRIMARY KEY, "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "productId" text, "name" text, "price" double precision, "salePrice" double precision, "stock" integer,
        "shippingOptionId" text, "active" boolean, "sortOrder" integer
      )`,
      `CREATE TABLE IF NOT EXISTS "SubcategoryDividers" (
        "id" text PRIMARY KEY, "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "categoryId" text, "name" text, "sortOrder" integer
      )`,
      `ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS "hasVariants" boolean`,
      `ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS "shippingScope" text`,
      `ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS "shippingOptionId" text`,
      `ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS "subcategoryDividerId" text`,
      `ALTER TABLE "Orders" ADD COLUMN IF NOT EXISTS "shippingBreakdownJson" jsonb`,
      `ALTER TABLE "OrderItems" ADD COLUMN IF NOT EXISTS "variantId" text`,
      `ALTER TABLE "OrderItems" ADD COLUMN IF NOT EXISTS "variantName" text`,
      `ALTER TABLE "OrderItems" ADD COLUMN IF NOT EXISTS "shippingOptionId" text`,
      `ALTER TABLE "OrderItems" ADD COLUMN IF NOT EXISTS "shippingOptionName" text`,
      `ALTER TABLE "OrderItems" ADD COLUMN IF NOT EXISTS "shippingOptionPriceCents" bigint`,
      `UPDATE "Products" SET "hasVariants" = false WHERE "hasVariants" IS NULL`,
      `UPDATE "Products" SET "shippingScope" = 'product' WHERE "shippingScope" IS NULL`,
      `ALTER TABLE "Products" ALTER COLUMN "hasVariants" SET DEFAULT false`,
      `ALTER TABLE "Products" ALTER COLUMN "shippingScope" SET DEFAULT 'product'`,
      `ALTER TABLE "ProductVariants" ALTER COLUMN "active" SET DEFAULT true`,
      `ALTER TABLE "ProductVariants" ALTER COLUMN "sortOrder" SET DEFAULT 0`,
      `ALTER TABLE "SubcategoryDividers" ALTER COLUMN "sortOrder" SET DEFAULT 0`,
      `ALTER TABLE "ProductVariants" ADD CONSTRAINT product_variants_product_fk FOREIGN KEY ("productId") REFERENCES "Products"("id") ON DELETE CASCADE`,
      `ALTER TABLE "ProductVariants" ADD CONSTRAINT product_variants_shipping_fk FOREIGN KEY ("shippingOptionId") REFERENCES "ShippingOptions"("id") ON DELETE RESTRICT`,
      `ALTER TABLE "SubcategoryDividers" ADD CONSTRAINT subcategory_dividers_category_fk FOREIGN KEY ("categoryId") REFERENCES "Categories"("id") ON DELETE RESTRICT`,
      `ALTER TABLE "Products" ADD CONSTRAINT products_shipping_option_fk FOREIGN KEY ("shippingOptionId") REFERENCES "ShippingOptions"("id") ON DELETE RESTRICT`,
      `ALTER TABLE "Products" ADD CONSTRAINT products_subcategory_divider_fk FOREIGN KEY ("subcategoryDividerId") REFERENCES "SubcategoryDividers"("id") ON DELETE SET NULL`,
      `ALTER TABLE "Products" ADD CONSTRAINT products_shipping_scope_check CHECK ("shippingScope" IN ('product', 'variant'))`,
      `ALTER TABLE "ShippingOptions" ADD CONSTRAINT shipping_options_values_check CHECK ("name" IS NOT NULL AND length(trim("name")) > 0 AND "price" IS NOT NULL AND "price" >= 0)`,
      `ALTER TABLE "ProductVariants" ADD CONSTRAINT product_variants_values_check CHECK (
        "productId" IS NOT NULL AND "name" IS NOT NULL AND length(trim("name")) > 0
        AND "price" IS NOT NULL AND "price" >= 0
        AND ("salePrice" IS NULL OR ("salePrice" >= 0 AND "salePrice" < "price"))
        AND ("stock" IS NULL OR "stock" >= 0) AND COALESCE("sortOrder", 0) >= 0
      )`,
      `ALTER TABLE "SubcategoryDividers" ADD CONSTRAINT subcategory_dividers_values_check CHECK (
        "categoryId" IS NOT NULL AND "name" IS NOT NULL AND length(trim("name")) > 0 AND COALESCE("sortOrder", 0) >= 0
      )`,
      `ALTER TABLE "OrderItems" ADD CONSTRAINT order_items_shipping_snapshot_check CHECK (
        "shippingOptionPriceCents" IS NULL OR "shippingOptionPriceCents" >= 0
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS shipping_options_name_idx ON "ShippingOptions" (lower("name"))`,
      `CREATE INDEX IF NOT EXISTS product_variants_product_order_idx ON "ProductVariants" ("productId", "sortOrder", "createdAt")`,
      `CREATE INDEX IF NOT EXISTS product_variants_shipping_idx ON "ProductVariants" ("shippingOptionId")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS subcategory_dividers_category_name_idx ON "SubcategoryDividers" ("categoryId", lower("name"))`,
      `CREATE INDEX IF NOT EXISTS subcategory_dividers_category_order_idx ON "SubcategoryDividers" ("categoryId", "sortOrder", "createdAt")`,
      `CREATE INDEX IF NOT EXISTS products_shipping_option_idx ON "Products" ("shippingOptionId")`,
      `CREATE INDEX IF NOT EXISTS products_subcategory_divider_idx ON "Products" ("subcategoryDividerId")`,
      `CREATE INDEX IF NOT EXISTS order_items_variant_idx ON "OrderItems" ("variantId")`,
      `CREATE INDEX IF NOT EXISTS order_items_shipping_option_idx ON "OrderItems" ("shippingOptionId")`,
    ]);
  },
};

const emailMarketing: Migration = {
  version: '004-email-marketing-outbox',
  up: async (tx) => {
    await runAll(tx, [
      `CREATE TABLE IF NOT EXISTS "EmailTemplates" ("id" text PRIMARY KEY, "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now())`,
      `CREATE TABLE IF NOT EXISTS "EmailOutbox" ("id" text PRIMARY KEY, "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now())`,
      `CREATE TABLE IF NOT EXISTS "EmailEvents" ("id" text PRIMARY KEY, "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now())`,
      `CREATE TABLE IF NOT EXISTS "MarketingContacts" ("id" text PRIMARY KEY, "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now())`,
      `CREATE TABLE IF NOT EXISTS "Campaigns" ("id" text PRIMARY KEY, "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now())`,
      `CREATE TABLE IF NOT EXISTS "CampaignRecipients" ("id" text PRIMARY KEY, "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now())`,

      `ALTER TABLE "EmailTemplates" ADD COLUMN IF NOT EXISTS "templateKey" text`,
      `ALTER TABLE "EmailTemplates" ADD COLUMN IF NOT EXISTS "name" text`,
      `ALTER TABLE "EmailTemplates" ADD COLUMN IF NOT EXISTS "kind" text`,
      `ALTER TABLE "EmailTemplates" ADD COLUMN IF NOT EXISTS "mode" text`,
      `ALTER TABLE "EmailTemplates" ADD COLUMN IF NOT EXISTS "subject" text`,
      `ALTER TABLE "EmailTemplates" ADD COLUMN IF NOT EXISTS "preheader" text`,
      `ALTER TABLE "EmailTemplates" ADD COLUMN IF NOT EXISTS "heading" text`,
      `ALTER TABLE "EmailTemplates" ADD COLUMN IF NOT EXISTS "bodyText" text`,
      `ALTER TABLE "EmailTemplates" ADD COLUMN IF NOT EXISTS "ctaLabel" text`,
      `ALTER TABLE "EmailTemplates" ADD COLUMN IF NOT EXISTS "ctaUrlTemplate" text`,
      `ALTER TABLE "EmailTemplates" ADD COLUMN IF NOT EXISTS "advancedHtml" text`,
      `ALTER TABLE "EmailTemplates" ADD COLUMN IF NOT EXISTS "advancedText" text`,
      `ALTER TABLE "EmailTemplates" ADD COLUMN IF NOT EXISTS "html" text`,
      `ALTER TABLE "EmailTemplates" ADD COLUMN IF NOT EXISTS "text" text`,
      `ALTER TABLE "EmailTemplates" ADD COLUMN IF NOT EXISTS "variablesJson" jsonb`,
      `ALTER TABLE "EmailTemplates" ADD COLUMN IF NOT EXISTS "allowedVariablesJson" jsonb`,
      `ALTER TABLE "EmailTemplates" ADD COLUMN IF NOT EXISTS "version" integer`,
      `ALTER TABLE "EmailTemplates" ADD COLUMN IF NOT EXISTS "enabled" boolean`,
      `ALTER TABLE "EmailTemplates" ADD COLUMN IF NOT EXISTS "updatedBy" text`,

      `ALTER TABLE "EmailOutbox" ADD COLUMN IF NOT EXISTS "recipient" text`,
      `ALTER TABLE "EmailOutbox" ADD COLUMN IF NOT EXISTS "templateKey" text`,
      `ALTER TABLE "EmailOutbox" ADD COLUMN IF NOT EXISTS "templateVersion" integer`,
      `ALTER TABLE "EmailOutbox" ADD COLUMN IF NOT EXISTS "payloadJson" jsonb`,
      `ALTER TABLE "EmailOutbox" ADD COLUMN IF NOT EXISTS "kind" text`,
      `ALTER TABLE "EmailOutbox" ADD COLUMN IF NOT EXISTS "purpose" text`,
      `ALTER TABLE "EmailOutbox" ADD COLUMN IF NOT EXISTS "idempotencyKey" text`,
      `ALTER TABLE "EmailOutbox" ADD COLUMN IF NOT EXISTS "state" text`,
      `ALTER TABLE "EmailOutbox" ADD COLUMN IF NOT EXISTS "subjectSnapshot" text`,
      `ALTER TABLE "EmailOutbox" ADD COLUMN IF NOT EXISTS "htmlSnapshot" text`,
      `ALTER TABLE "EmailOutbox" ADD COLUMN IF NOT EXISTS "textSnapshot" text`,
      `ALTER TABLE "EmailOutbox" ADD COLUMN IF NOT EXISTS "fromNameSnapshot" text`,
      `ALTER TABLE "EmailOutbox" ADD COLUMN IF NOT EXISTS "fromAddressSnapshot" text`,
      `ALTER TABLE "EmailOutbox" ADD COLUMN IF NOT EXISTS "replyToSnapshot" text`,
      `ALTER TABLE "EmailOutbox" ADD COLUMN IF NOT EXISTS "headersJson" jsonb`,
      `ALTER TABLE "EmailOutbox" ADD COLUMN IF NOT EXISTS "orderId" text`,
      `ALTER TABLE "EmailOutbox" ADD COLUMN IF NOT EXISTS "campaignId" text`,
      `ALTER TABLE "EmailOutbox" ADD COLUMN IF NOT EXISTS "campaignRecipientId" text`,
      `ALTER TABLE "EmailOutbox" ADD COLUMN IF NOT EXISTS "leaseOwner" text`,
      `ALTER TABLE "EmailOutbox" ADD COLUMN IF NOT EXISTS "leaseExpiresAt" timestamptz`,
      `ALTER TABLE "EmailOutbox" ADD COLUMN IF NOT EXISTS "attemptCount" integer`,
      `ALTER TABLE "EmailOutbox" ADD COLUMN IF NOT EXISTS "maxAttempts" integer`,
      `ALTER TABLE "EmailOutbox" ADD COLUMN IF NOT EXISTS "nextAttemptAt" timestamptz`,
      `ALTER TABLE "EmailOutbox" ADD COLUMN IF NOT EXISTS "lastAttemptAt" timestamptz`,
      `ALTER TABLE "EmailOutbox" ADD COLUMN IF NOT EXISTS "providerMessageId" text`,
      `ALTER TABLE "EmailOutbox" ADD COLUMN IF NOT EXISTS "providerResponseJson" jsonb`,
      `ALTER TABLE "EmailOutbox" ADD COLUMN IF NOT EXISTS "error" text`,
      `ALTER TABLE "EmailOutbox" ADD COLUMN IF NOT EXISTS "cancelReason" text`,
      `ALTER TABLE "EmailOutbox" ADD COLUMN IF NOT EXISTS "cancelledAt" timestamptz`,
      `ALTER TABLE "EmailOutbox" ADD COLUMN IF NOT EXISTS "failedAt" timestamptz`,
      `ALTER TABLE "EmailOutbox" ADD COLUMN IF NOT EXISTS "sentAt" timestamptz`,
      `ALTER TABLE "EmailOutbox" ADD COLUMN IF NOT EXISTS "deliveredAt" timestamptz`,

      `ALTER TABLE "EmailEvents" ADD COLUMN IF NOT EXISTS "provider" text`,
      `ALTER TABLE "EmailEvents" ADD COLUMN IF NOT EXISTS "providerEventId" text`,
      `ALTER TABLE "EmailEvents" ADD COLUMN IF NOT EXISTS "outboxId" text`,
      `ALTER TABLE "EmailEvents" ADD COLUMN IF NOT EXISTS "providerMessageId" text`,
      `ALTER TABLE "EmailEvents" ADD COLUMN IF NOT EXISTS "campaignId" text`,
      `ALTER TABLE "EmailEvents" ADD COLUMN IF NOT EXISTS "email" text`,
      `ALTER TABLE "EmailEvents" ADD COLUMN IF NOT EXISTS "eventType" text`,
      `ALTER TABLE "EmailEvents" ADD COLUMN IF NOT EXISTS "eventCategory" text`,
      `ALTER TABLE "EmailEvents" ADD COLUMN IF NOT EXISTS "eventAt" timestamptz`,
      `ALTER TABLE "EmailEvents" ADD COLUMN IF NOT EXISTS "rawDigest" text`,
      `ALTER TABLE "EmailEvents" ADD COLUMN IF NOT EXISTS "processedAt" timestamptz`,
      `ALTER TABLE "EmailEvents" ADD COLUMN IF NOT EXISTS "processingError" text`,
      `ALTER TABLE "EmailEvents" ADD COLUMN IF NOT EXISTS "metadataJson" jsonb`,

      `ALTER TABLE "MarketingContacts" ADD COLUMN IF NOT EXISTS "email" text`,
      `ALTER TABLE "MarketingContacts" ADD COLUMN IF NOT EXISTS "userId" text`,
      `ALTER TABLE "MarketingContacts" ADD COLUMN IF NOT EXISTS "state" text`,
      `ALTER TABLE "MarketingContacts" ADD COLUMN IF NOT EXISTS "consentSource" text`,
      `ALTER TABLE "MarketingContacts" ADD COLUMN IF NOT EXISTS "consentAt" timestamptz`,
      `ALTER TABLE "MarketingContacts" ADD COLUMN IF NOT EXISTS "lastEligibleAt" timestamptz`,
      `ALTER TABLE "MarketingContacts" ADD COLUMN IF NOT EXISTS "unsubscribedAt" timestamptz`,
      `ALTER TABLE "MarketingContacts" ADD COLUMN IF NOT EXISTS "unsubscribeReason" text`,
      `ALTER TABLE "MarketingContacts" ADD COLUMN IF NOT EXISTS "suppressedAt" timestamptz`,
      `ALTER TABLE "MarketingContacts" ADD COLUMN IF NOT EXISTS "suppressionReason" text`,
      `ALTER TABLE "MarketingContacts" ADD COLUMN IF NOT EXISTS "providerContactId" text`,
      `ALTER TABLE "MarketingContacts" ADD COLUMN IF NOT EXISTS "syncState" text`,
      `ALTER TABLE "MarketingContacts" ADD COLUMN IF NOT EXISTS "metadataJson" jsonb`,

      `ALTER TABLE "Campaigns" ADD COLUMN IF NOT EXISTS "name" text`,
      `ALTER TABLE "Campaigns" ADD COLUMN IF NOT EXISTS "subject" text`,
      `ALTER TABLE "Campaigns" ADD COLUMN IF NOT EXISTS "mode" text`,
      `ALTER TABLE "Campaigns" ADD COLUMN IF NOT EXISTS "preheader" text`,
      `ALTER TABLE "Campaigns" ADD COLUMN IF NOT EXISTS "heading" text`,
      `ALTER TABLE "Campaigns" ADD COLUMN IF NOT EXISTS "bodyText" text`,
      `ALTER TABLE "Campaigns" ADD COLUMN IF NOT EXISTS "ctaLabel" text`,
      `ALTER TABLE "Campaigns" ADD COLUMN IF NOT EXISTS "ctaUrl" text`,
      `ALTER TABLE "Campaigns" ADD COLUMN IF NOT EXISTS "advancedHtml" text`,
      `ALTER TABLE "Campaigns" ADD COLUMN IF NOT EXISTS "advancedText" text`,
      `ALTER TABLE "Campaigns" ADD COLUMN IF NOT EXISTS "html" text`,
      `ALTER TABLE "Campaigns" ADD COLUMN IF NOT EXISTS "text" text`,
      `ALTER TABLE "Campaigns" ADD COLUMN IF NOT EXISTS "revision" integer`,
      `ALTER TABLE "Campaigns" ADD COLUMN IF NOT EXISTS "audienceType" text`,
      `ALTER TABLE "Campaigns" ADD COLUMN IF NOT EXISTS "templateSnapshotJson" jsonb`,
      `ALTER TABLE "Campaigns" ADD COLUMN IF NOT EXISTS "audienceDefinitionJson" jsonb`,
      `ALTER TABLE "Campaigns" ADD COLUMN IF NOT EXISTS "recipientCount" integer`,
      `ALTER TABLE "Campaigns" ADD COLUMN IF NOT EXISTS "eligibleRecipientCount" integer`,
      `ALTER TABLE "Campaigns" ADD COLUMN IF NOT EXISTS "scheduledAt" timestamptz`,
      `ALTER TABLE "Campaigns" ADD COLUMN IF NOT EXISTS "state" text`,
      `ALTER TABLE "Campaigns" ADD COLUMN IF NOT EXISTS "testSentAt" timestamptz`,
      `ALTER TABLE "Campaigns" ADD COLUMN IF NOT EXISTS "testRecipient" text`,
      `ALTER TABLE "Campaigns" ADD COLUMN IF NOT EXISTS "testOutboxId" text`,
      `ALTER TABLE "Campaigns" ADD COLUMN IF NOT EXISTS "testRevision" integer`,
      `ALTER TABLE "Campaigns" ADD COLUMN IF NOT EXISTS "confirmationNonceHash" text`,
      `ALTER TABLE "Campaigns" ADD COLUMN IF NOT EXISTS "confirmationExpiresAt" timestamptz`,
      `ALTER TABLE "Campaigns" ADD COLUMN IF NOT EXISTS "confirmedBy" text`,
      `ALTER TABLE "Campaigns" ADD COLUMN IF NOT EXISTS "confirmedAt" timestamptz`,
      `ALTER TABLE "Campaigns" ADD COLUMN IF NOT EXISTS "queuedAt" timestamptz`,
      `ALTER TABLE "Campaigns" ADD COLUMN IF NOT EXISTS "completedAt" timestamptz`,
      `ALTER TABLE "Campaigns" ADD COLUMN IF NOT EXISTS "failedCount" integer`,
      `ALTER TABLE "Campaigns" ADD COLUMN IF NOT EXISTS "suppressedCount" integer`,
      `ALTER TABLE "Campaigns" ADD COLUMN IF NOT EXISTS "resendBroadcastId" text`,
      `ALTER TABLE "Campaigns" ADD COLUMN IF NOT EXISTS "providerSegmentId" text`,
      `ALTER TABLE "Campaigns" ADD COLUMN IF NOT EXISTS "approvedBy" text`,
      `ALTER TABLE "Campaigns" ADD COLUMN IF NOT EXISTS "approvedAt" timestamptz`,
      `ALTER TABLE "Campaigns" ADD COLUMN IF NOT EXISTS "sentAt" timestamptz`,

      `ALTER TABLE "CampaignRecipients" ADD COLUMN IF NOT EXISTS "campaignId" text`,
      `ALTER TABLE "CampaignRecipients" ADD COLUMN IF NOT EXISTS "contactId" text`,
      `ALTER TABLE "CampaignRecipients" ADD COLUMN IF NOT EXISTS "customerId" text`,
      `ALTER TABLE "CampaignRecipients" ADD COLUMN IF NOT EXISTS "email" text`,
      `ALTER TABLE "CampaignRecipients" ADD COLUMN IF NOT EXISTS "roleSnapshot" text`,
      `ALTER TABLE "CampaignRecipients" ADD COLUMN IF NOT EXISTS "eligibilitySnapshotJson" jsonb`,
      `ALTER TABLE "CampaignRecipients" ADD COLUMN IF NOT EXISTS "templateSnapshotJson" jsonb`,
      `ALTER TABLE "CampaignRecipients" ADD COLUMN IF NOT EXISTS "state" text`,
      `ALTER TABLE "CampaignRecipients" ADD COLUMN IF NOT EXISTS "outboxId" text`,
      `ALTER TABLE "CampaignRecipients" ADD COLUMN IF NOT EXISTS "providerMessageId" text`,
      `ALTER TABLE "CampaignRecipients" ADD COLUMN IF NOT EXISTS "suppressionReason" text`,
      `ALTER TABLE "CampaignRecipients" ADD COLUMN IF NOT EXISTS "queuedAt" timestamptz`,
      `ALTER TABLE "CampaignRecipients" ADD COLUMN IF NOT EXISTS "sentAt" timestamptz`,
      `ALTER TABLE "CampaignRecipients" ADD COLUMN IF NOT EXISTS "suppressedAt" timestamptz`,
      `ALTER TABLE "CampaignRecipients" ADD COLUMN IF NOT EXISTS "failedAt" timestamptz`,

      `UPDATE "EmailTemplates" SET "mode" = COALESCE("mode", 'structured'), "kind" = COALESCE("kind", 'transactional'),
        "version" = COALESCE("version", 1), "enabled" = COALESCE("enabled", true),
        "variablesJson" = COALESCE("variablesJson", '[]'::jsonb), "allowedVariablesJson" = COALESCE("allowedVariablesJson", "variablesJson", '[]'::jsonb)`,
      `UPDATE "EmailOutbox" SET "state" = COALESCE("state", 'queued'), "attemptCount" = COALESCE("attemptCount", 0),
        "maxAttempts" = COALESCE("maxAttempts", 6), "nextAttemptAt" = COALESCE("nextAttemptAt", now())`,
      `UPDATE "MarketingContacts" SET "state" = COALESCE("state", 'eligible'),
        "consentSource" = COALESCE("consentSource", 'legacy_account_backfill'), "consentAt" = COALESCE("consentAt", "createdAt"),
        "lastEligibleAt" = CASE WHEN COALESCE("state", 'eligible') = 'eligible' THEN COALESCE("lastEligibleAt", now()) ELSE "lastEligibleAt" END`,
      `UPDATE "Campaigns" SET "mode" = COALESCE("mode", 'structured'), "revision" = COALESCE("revision", 1),
        "audienceType" = COALESCE("audienceType", 'all_accounts'), "state" = COALESCE("state", 'draft'),
        "recipientCount" = COALESCE("recipientCount", 0), "eligibleRecipientCount" = COALESCE("eligibleRecipientCount", 0),
        "failedCount" = COALESCE("failedCount", 0), "suppressedCount" = COALESCE("suppressedCount", 0)`,
      `UPDATE "CampaignRecipients" SET "state" = COALESCE("state", 'pending')`,

      `ALTER TABLE "EmailTemplates" ALTER COLUMN "mode" SET DEFAULT 'structured'`,
      `ALTER TABLE "EmailTemplates" ALTER COLUMN "version" SET DEFAULT 1`,
      `ALTER TABLE "EmailTemplates" ALTER COLUMN "enabled" SET DEFAULT true`,
      `ALTER TABLE "EmailOutbox" ALTER COLUMN "state" SET DEFAULT 'queued'`,
      `ALTER TABLE "EmailOutbox" ALTER COLUMN "attemptCount" SET DEFAULT 0`,
      `ALTER TABLE "EmailOutbox" ALTER COLUMN "maxAttempts" SET DEFAULT 6`,
      `ALTER TABLE "EmailOutbox" ALTER COLUMN "nextAttemptAt" SET DEFAULT now()`,
      `ALTER TABLE "MarketingContacts" ALTER COLUMN "state" SET DEFAULT 'eligible'`,
      `ALTER TABLE "Campaigns" ALTER COLUMN "mode" SET DEFAULT 'structured'`,
      `ALTER TABLE "Campaigns" ALTER COLUMN "revision" SET DEFAULT 1`,
      `ALTER TABLE "Campaigns" ALTER COLUMN "state" SET DEFAULT 'draft'`,
      `ALTER TABLE "CampaignRecipients" ALTER COLUMN "state" SET DEFAULT 'pending'`,

      `ALTER TABLE "EmailTemplates" ADD CONSTRAINT email_templates_mode_check CHECK ("mode" IN ('structured', 'advanced_html'))`,
      `ALTER TABLE "EmailTemplates" ADD CONSTRAINT email_templates_kind_check CHECK ("kind" IN ('transactional', 'marketing', 'internal'))`,
      `ALTER TABLE "EmailTemplates" ADD CONSTRAINT email_templates_version_check CHECK (COALESCE("version", 1) >= 1)`,
      `ALTER TABLE "EmailOutbox" ADD CONSTRAINT email_outbox_delivery_values_check CHECK (
        COALESCE("attemptCount", 0) >= 0 AND COALESCE("maxAttempts", 1) > 0
        AND "state" IN ('queued', 'leased', 'retry', 'uncertain', 'sent', 'delivered', 'suppressed', 'cancelled', 'failed')
      )`,
      `ALTER TABLE "MarketingContacts" ADD CONSTRAINT marketing_contacts_state_check CHECK (
        "state" IN ('eligible', 'unsubscribed', 'bounced', 'complained', 'suppressed')
      )`,
      `ALTER TABLE "Campaigns" ADD CONSTRAINT campaigns_values_check CHECK (
        "mode" IN ('structured', 'advanced_html') AND "audienceType" IN ('all_accounts', 'customer_accounts')
        AND COALESCE("revision", 1) >= 1 AND COALESCE("recipientCount", 0) >= 0
        AND COALESCE("eligibleRecipientCount", 0) >= 0 AND COALESCE("failedCount", 0) >= 0 AND COALESCE("suppressedCount", 0) >= 0
      )`,
      `ALTER TABLE "EmailOutbox" ADD CONSTRAINT email_outbox_order_fk FOREIGN KEY ("orderId") REFERENCES "Orders"("id") ON DELETE SET NULL`,
      `ALTER TABLE "EmailOutbox" ADD CONSTRAINT email_outbox_campaign_fk FOREIGN KEY ("campaignId") REFERENCES "Campaigns"("id") ON DELETE SET NULL`,
      `ALTER TABLE "EmailOutbox" ADD CONSTRAINT email_outbox_campaign_recipient_fk FOREIGN KEY ("campaignRecipientId") REFERENCES "CampaignRecipients"("id") ON DELETE SET NULL`,
      `ALTER TABLE "EmailEvents" ADD CONSTRAINT email_events_outbox_fk FOREIGN KEY ("outboxId") REFERENCES "EmailOutbox"("id") ON DELETE SET NULL`,
      `ALTER TABLE "MarketingContacts" ADD CONSTRAINT marketing_contacts_user_fk FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE SET NULL`,
      `ALTER TABLE "CampaignRecipients" ADD CONSTRAINT campaign_recipients_contact_fk FOREIGN KEY ("contactId") REFERENCES "MarketingContacts"("id") ON DELETE SET NULL`,
      `ALTER TABLE "CampaignRecipients" ADD CONSTRAINT campaign_recipients_customer_fk FOREIGN KEY ("customerId") REFERENCES "Users"("id") ON DELETE SET NULL`,

      `CREATE UNIQUE INDEX IF NOT EXISTS email_templates_key_idx ON "EmailTemplates" ("templateKey")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS email_outbox_idempotency_idx ON "EmailOutbox" ("idempotencyKey")`,
      `CREATE INDEX IF NOT EXISTS email_outbox_work_idx ON "EmailOutbox" ("state", "nextAttemptAt", "leaseExpiresAt")`,
      `CREATE INDEX IF NOT EXISTS email_outbox_order_purpose_idx ON "EmailOutbox" ("orderId", "purpose")`,
      `CREATE INDEX IF NOT EXISTS email_outbox_campaign_state_idx ON "EmailOutbox" ("campaignId", "state")`,
      `CREATE INDEX IF NOT EXISTS email_outbox_provider_message_idx ON "EmailOutbox" ("providerMessageId")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS email_events_provider_idx ON "EmailEvents" ("provider", "providerEventId")`,
      `CREATE INDEX IF NOT EXISTS email_events_provider_message_idx ON "EmailEvents" ("providerMessageId")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS marketing_contacts_email_idx ON "MarketingContacts" (lower("email"))`,
      `CREATE INDEX IF NOT EXISTS marketing_contacts_state_idx ON "MarketingContacts" ("state")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS marketing_contacts_user_idx ON "MarketingContacts" ("userId") WHERE "userId" IS NOT NULL`,
      `CREATE INDEX IF NOT EXISTS campaigns_state_schedule_idx ON "Campaigns" ("state", "scheduledAt")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS campaign_recipients_email_idx ON "CampaignRecipients" ("campaignId", lower("email"))`,
      `CREATE INDEX IF NOT EXISTS campaign_recipients_state_idx ON "CampaignRecipients" ("campaignId", "state")`,
    ]);

    const templates = [
      ['order_placed', 'Order placed', 'transactional', 'Order {{order.number}} placed', 'we received your order', 'order placed', 'Thanks {{customer.firstName}}. Your order {{order.number}} is awaiting payment of {{order.cryptoAmount}} {{order.payCurrency}}.', 'View order', '{{order.url}}', ['customer.firstName', 'order.number', 'order.cryptoAmount', 'order.payCurrency', 'order.url']],
      ['payment_due', 'Payment due', 'transactional', 'Payment due for {{order.number}}', 'your payment window is closing', 'payment due soon', 'Payment for {{order.number}} is due at {{order.paymentExpiresAt}}.', 'Complete payment', '{{order.url}}', ['order.number', 'order.paymentExpiresAt', 'order.url']],
      ['payment_received', 'Payment received', 'transactional', 'Payment received for {{order.number}}', 'payment confirmed', 'payment received', 'We received your payment and are preparing order {{order.number}}.', 'View order', '{{order.url}}', ['order.number', 'order.url']],
      ['order_shipped', 'Order shipped', 'transactional', 'Order {{order.number}} shipped', 'your parcel is on the way', 'order shipped', 'Your order has shipped. Tracking number: {{order.trackingNumber}}.', 'Track order', '{{order.url}}', ['order.number', 'order.trackingNumber', 'order.url']],
      ['shipping_update', 'Shipping update', 'transactional', 'Shipping update for {{order.number}}', 'your delivery status changed', 'shipping update', 'Your order status is now {{order.status}}.', 'Track order', '{{order.url}}', ['order.number', 'order.status', 'order.url']],
      ['order_refunded', 'Order refunded', 'transactional', 'Order {{order.number}} refunded', 'your refund was approved', 'order refunded', 'Order {{order.number}} has been refunded.', 'View order', '{{order.url}}', ['order.number', 'order.url']],
      ['order_cancelled', 'Order cancelled', 'transactional', 'Order {{order.number}} cancelled', 'your order was cancelled', 'order cancelled', 'Order {{order.number}} has been cancelled.', 'View order', '{{order.url}}', ['order.number', 'order.url']],
      ['order_expired', 'Order expired', 'transactional', 'Order {{order.number}} expired', 'the payment window ended', 'order expired', 'The payment window for order {{order.number}} has expired.', 'View order', '{{order.url}}', ['order.number', 'order.url']],
      ['admin_order_placed', 'Admin order alert', 'internal', 'New order {{order.number}}', 'a new order was placed', 'new order', '{{customer.name}} placed order {{order.number}} for {{order.total}}.', 'Open order', '{{order.adminUrl}}', ['customer.name', 'order.number', 'order.total', 'order.adminUrl']],
      ['admin_payment_received', 'Admin payment alert', 'internal', 'Payment received: {{order.number}}', 'an order was paid', 'payment received', 'Payment was received for order {{order.number}}.', 'Open order', '{{order.adminUrl}}', ['order.number', 'order.adminUrl']],
      ['campaign_announcement', 'Campaign announcement', 'marketing', '{{campaign.subject}}', '', '{{campaign.heading}}', '{{campaign.body}}', '{{campaign.ctaLabel}}', '{{campaign.ctaUrl}}', ['campaign.subject', 'campaign.heading', 'campaign.body', 'campaign.ctaLabel', 'campaign.ctaUrl', 'campaign.unsubscribeUrl']],
    ] as const;
    for (const [templateKey, name, kind, subject, preheader, heading, bodyText, ctaLabel, ctaUrlTemplate, variables] of templates) {
      await tx.query(
        `INSERT INTO "EmailTemplates" (
          "id", "templateKey", "name", "kind", "mode", "subject", "preheader", "heading", "bodyText",
          "ctaLabel", "ctaUrlTemplate", "variablesJson", "allowedVariablesJson", "version", "enabled"
        ) VALUES ($1,$2,$3,$4,'structured',$5,$6,$7,$8,$9,$10,$11::jsonb,$11::jsonb,1,true)
        ON CONFLICT ("templateKey") DO NOTHING`,
        [crypto.randomUUID(), templateKey, name, kind, subject, preheader, heading, bodyText, ctaLabel, ctaUrlTemplate, JSON.stringify(variables)],
      );
    }

    const { rows: users } = await tx.query(`SELECT "id", lower("email") AS "email", "createdAt" FROM "Users" WHERE "email" IS NOT NULL AND trim("email") <> ''`);
    for (const user of users) {
      await tx.query(
        `INSERT INTO "MarketingContacts" (
          "id", "email", "userId", "state", "consentSource", "consentAt", "lastEligibleAt"
        ) VALUES ($1,$2,$3,'eligible','legacy_account_backfill',$4,now())
        ON CONFLICT DO NOTHING`,
        [crypto.randomUUID(), user.email, user.id, user.createdAt ?? new Date().toISOString()],
      );
    }
  },
};

const migrations: Migration[] = [constraints, backfill, catalogShipping, emailMarketing];

export async function runMigrations(db: Queryable) {
  await db.query(`CREATE TABLE IF NOT EXISTS "SchemaMigrations" (
    "version" text PRIMARY KEY,
    "appliedAt" timestamptz NOT NULL DEFAULT now()
  )`);
  const { rows } = await db.query(`SELECT "version" FROM "SchemaMigrations"`);
  const applied = new Set(rows.map((row) => String(row.version)));
  for (const migration of migrations) {
    if (applied.has(migration.version)) continue;
    await db.transaction(async (tx) => {
      const { rows: claimed } = await tx.query(
        `INSERT INTO "SchemaMigrations" ("version") VALUES ($1)
         ON CONFLICT ("version") DO NOTHING RETURNING "version"`,
        [migration.version],
      );
      if (!claimed[0]) return;
      await migration.up(tx);
    });
  }
}
