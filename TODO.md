# TODO

This file tracks the deferred commerce expansion. The current storefront and admin flows still use the existing payment, order, inventory, tracking, and notification behavior unless explicitly marked complete below.

## Completed and retained

- [x] Default catalog order is featured products first, then all-time paid units sold, then name and ID as stable tie-breakers.
- [x] Explicit A–Z and price sorting remain available in the catalog.
- [x] Atomic stock and discount reservation during checkout.
- [x] Atomic payment claims, duplicate transaction-hash prevention, and payment/expiry race protection.
- [x] Stock and discount restoration when an unpaid order expires.
- [x] Admin order-transition guards and safer 17TRACK webhook authentication.
- [x] Additive schema migration runner and normalized-domain table foundations.
- [x] Raw webhook request bytes and normalized headers are available to endpoints.
- [x] Provider interfaces and local fake adapters exist for payments, payouts, email, tracking, and file storage.

## Important current limitations

- The NOWPayments, Resend, Vercel Blob, normalized inventory, preorder, shipment, refund, campaign, and review foundations are not wired into live business flows.
- Checkout still uses the existing proprietary blockchain quote and payment-detection implementation.
- Refund status changes do not transfer funds.
- Notification helpers still log rather than deliver email.
- Orders still use legacy `itemsJson`, product stock, and one tracking number as their active source of truth.
- The additional normalized tables must not be presented as completed features until all write paths, backfills, reconciliation, and UI are implemented and tested.
- Local fake providers must remain the default until real credentials are deliberately configured.

## Priority 1 — payments and durable jobs

- [ ] Verify the native NOWPayments adapter against the current official API contract.
- [ ] Replace proprietary payment creation with NOWPayments direct payments.
- [ ] Add a browser-generated checkout idempotency key and persist one payment attempt per checkout attempt.
- [ ] Store crypto amounts as exact decimal strings rather than JavaScript floats.
- [ ] Add a signed NOWPayments IPN endpoint with HMAC-SHA512 verification, event persistence, deduplication, and monotonic state transitions.
- [ ] Allow fulfillment only after a validated NOWPayments `finished` state.
- [ ] Reconcile uncertain payment creation and late payments without creating duplicate addresses.
- [ ] Remove blockchain scanning from order reads and admin order lists after provider reconciliation is live.
- [ ] Add a bounded maintenance endpoint and Vercel Cron for payment reconciliation, expiry, tracking, payouts, and email delivery.
- [ ] Consolidate duplicate shop/admin crypto, tracking, notification, and order-shaping helpers.
- [ ] Replace the remote QR image service with a local QR package.

Required production configuration:

- `NOWPAYMENTS_API_KEY`
- `NOWPAYMENTS_IPN_SECRET`
- NOWPayments payout credentials and approved payout/2FA procedures
- `PUBLIC_APP_URL`
- `CRON_SECRET`

NOWPayments refunds are merchant-funded payouts, not reversals or shipping insurance. Before launch, perform a separately approved low-value production payment and payout smoke test; do not automate real-money tests.

## Priority 2 — normalized inventory, preorders, and fulfillment

- [ ] Make normalized `OrderItems` the write/read source of truth while retaining a temporary legacy projection.
- [ ] Complete and audit legacy order, payment, inventory, and tracking backfills; surface malformed rows in an admin health view.
- [ ] Make integer supplier units and the append-only inventory ledger the stock source of truth.
- [ ] Add product settings for supplier conversion, supplier pack size, lead time, safety days, preorder enablement/cap, and expected ship date.
- [ ] Allocate physical stock first and preorder capacity second without allowing negative balances.
- [ ] Snapshot immutable promised ship dates for preorder allocations.
- [ ] Add inbound-stock receiving and FIFO promotion of paid preorder allocations.
- [ ] Support multiple item-level shipments per order without charging the customer a second shipping fee.
- [ ] Consume inventory only when the corresponding allocation ships.
- [ ] Allow delayed-preorder cancellation requests only after the promised date, with an explicit admin exception path.
- [ ] Update product, cart, checkout, order, invoice, email, and admin views for mixed physical/preorder fulfillment.

## Priority 3 — tracking incidents and real refunds

- [ ] Move 17TRACK registration and refresh to normalized shipments and background jobs.
- [ ] Dedupe shipment events and map only documented loss states to `lost`.
- [ ] Open one shipment incident for a verified loss; do not return shipped/lost goods to inventory.
- [ ] Add customer refund destination collection with currency, network, address, and memo/tag validation.
- [ ] Check order ownership, incident/overdue-preorder eligibility, already-shipped quantities, and duplicate requests server-side.
- [ ] Add an admin quote-preview and explicit approval step.
- [ ] Calculate the original eligible USD liability at approval time and snapshot conversion rate, fee, destination, and actor.
- [ ] Submit a durable NOWPayments payout only after the approval transaction commits.
- [ ] Reconcile the same payout after timeouts; never blindly create a replacement payout.
- [ ] Mark a refund complete and email the customer only after provider-confirmed payout success.
- [ ] Keep partial line refunds distinct from full-order refunds.

## Priority 4 — transactional email and campaigns

- [ ] Verify the native Resend API implementation against the current official contract.
- [ ] Seed editable transactional templates for order, payment, split shipment, delivery/loss, preorder, refund, and review events.
- [ ] Escape template variables and sanitize admin-authored HTML.
- [ ] Insert permanent-idempotency email outbox rows in the same transaction as each business event.
- [ ] Add leased, bounded retries and explicit uncertain-send handling.
- [ ] Optionally add signed Resend delivery-event webhooks later if delivery, bounce, and complaint tracking is needed.
- [ ] Add template editing, variable documentation, fixture preview, version history, audit history, and restricted test sends.
- [ ] Add marketing contacts, signed unsubscribe links, RFC 8058 one-click unsubscribe, and immediate local suppression.
- [ ] Treat bounce/complaint suppression globally while allowing necessary transactional email after marketing opt-out.
- [ ] Add customer segments and campaigns with frozen audiences, suppression rechecks, preview, approval, scheduling, cancellation, and results.
- [ ] Use Resend Broadcasts or bounded batches; never loop an entire audience in one serverless invocation.

Required production configuration:

- `RESEND_API_KEY`
- `EMAIL_FROM`
- optional `EMAIL_REPLY_TO`

## Priority 5 — forecasting and admin expansion

- [ ] Add an inventory/restock endpoint using recency-weighted paid-unit velocity, including zero-sales days.
- [ ] Calculate lead time + selected coverage + safety days, subtract available/inbound stock, add preorder backlog, and round to supplier packs.
- [ ] Show every input, velocity, days of cover, reorder-by date, recommended packs/units, and audited overrides.
- [ ] Add inbound purchase planning and receiving actions.
- [ ] Add **Operations** for split shipments, tracking, incidents, refunds, notes, and audit history.
- [ ] Add **Customers** with paginated search and order/payment/refund/review/marketing history.
- [ ] Add **Inventory** with balances, ledger, adjustments, inbound stock, low-stock alerts, and preorder backlog.
- [ ] Add **Restock** with configurable forecast horizons and transparent recommendations.
- [ ] Add **Analytics** for gross/net sales, refunds, best sellers, fulfillment time, losses, preorder performance, inventory cover, campaigns, and ratings.
- [ ] Add **Campaigns**, **Email Templates**, **Reviews**, and **Migration/Provider Health** sections.
- [ ] Add immutable audit events for sensitive admin and provider transitions.
- [ ] Remove provider secrets and legacy wallet/API-key fields from browser-visible settings.

## Priority 6 — verified product reviews

- [ ] Add paginated public review and aggregate endpoints.
- [ ] Require a signed-in customer, validated finished payment, ownership of the order line, and full delivery of that line.
- [ ] Enforce one review per delivered order line; deletion must not free the entitlement.
- [ ] Add 1–5 stars, title/body validation, and a customer-selected 2–40 character public display name snapshotted on creation.
- [ ] Add customer create, edit, and soft-delete flows.
- [ ] Add up to five review photos through authenticated Vercel Blob quarantine uploads.
- [ ] Verify upload ownership, MIME signature, size, dimensions, count, and canonical storage metadata; strip EXIF/re-encode before publication.
- [ ] Never trust client-supplied Blob URLs or expose email, legal name, order ID, payment, or address data.
- [ ] Add admin report/hide/restore/remove actions with mandatory reasons and append-only moderation history.
- [ ] Include only published reviews in public aggregates.
- [ ] Add submission, upload, edit, report, and moderation rate limits.

Required production configuration:

- `BLOB_READ_WRITE_TOKEN`

## Testing and release gates

- [ ] Add Vitest unit tests for provider signatures, transition rules, idempotency, inventory math, forecasting, refund validation/proration, email dedupe, suppression, review eligibility, and catalog tie-breaks.
- [ ] Add isolated temporary-PGlite integration tests for migrations/backfills, auth/ownership, checkout races, signed/replayed webhooks, late payments, inventory/preorder/shipments, loss/refund/payout, outbox/campaigns, and reviews.
- [ ] Add Playwright fake-provider E2E for a mixed in-stock/preorder order, finished payment, split shipping, DHL loss, approved payout, refund email, campaign unsubscribe, restock recommendation, and review moderation.
- [ ] Keep all default tests deterministic: no real funds, customer email, tracking registration, or production Blob writes.
- [ ] Add opt-in provider contract tests using only sandbox/synthetic recipients and controlled staging files.
- [ ] Run `npm run typecheck` and `npm run build` before every release.
- [ ] Manually verify desktop/mobile storefront and admin flows with clean browser console, network, and server logs.

## Maintenance

- [ ] Upgrade Zod after verifying compatibility; the current pinned version has an audit advisory.
- [ ] Code-split the admin/storefront bundles to remove the current Vite chunk-size warning.
- [ ] Add provider health, webhook freshness, maintenance-run, outbox backlog, and uncertain-state monitoring.
- [ ] Document recovery procedures for uncertain payments, payouts, emails, failed backfills, and unavailable providers.
