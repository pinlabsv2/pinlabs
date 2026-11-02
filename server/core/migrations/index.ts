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

const migrations: Migration[] = [constraints, backfill];

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
