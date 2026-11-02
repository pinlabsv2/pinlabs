# PinLabs: crypto-paid research peptide store

This is a single full-stack web app made of two parts:

- **Storefront** at `/`: catalog, cart, checkout paid in crypto, order tracking, account, policies and support.
- **Admin panel** at `/admin`: dashboard, orders, products, categories, discount codes, support contacts, settings and policies.

It is built with **React 18 + Vite + Tailwind (shadcn/ui)** on the frontend. The backend is **TypeScript RPC endpoints** that run as **one Vercel serverless function**, plus **Postgres**. When no `DATABASE_URL` is set, it uses an embedded Postgres (PGlite) stored on disk, so local dev needs zero setup. It has no third-party platform dependencies.

---

## 1. Quick start (local)

```bash
npm install
cp .env.example .env      # optional locally: everything has dev defaults
npm run dev               # http://localhost:3000
```

1. Open http://localhost:3000/login and **create an account**. **The first account ever created becomes the admin.**
2. Go to http://localhost:3000/admin.
3. The database lives in `./.data/pglite`. Delete that folder to reset. On first boot it is seeded from `server/core/seed.json`, which holds the products, categories, discount codes, settings and policy texts.

`npm run build` builds the frontend to `dist/`. `npm run typecheck` runs `tsc`.

## 2. Deploy to Vercel

1. Push to GitHub and import the repo in Vercel. The framework is auto-detected as Vite, and `vercel.json` is already set up.
2. Create a Postgres database, for example Vercel Storage → Neon, Supabase or Railway.
3. Set these environment variables:

| Var | Required | Notes |
|---|---|---|
| `DATABASE_URL` | **yes on Vercel** | Postgres URL, e.g. `postgres://…?sslmode=require`. Tables are created automatically on first request. |
| `AUTH_SECRET` | **yes in prod** | Long random string (`openssl rand -hex 32`). Signs session cookies. |
| `ADMIN_EMAILS` | no | Comma-separated emails that always get admin. |
| `TRACK17_API_KEY` | for tracking | 17TRACK API key. |

4. Deploy. Register at `https://your-domain/login`. The first account is the admin, or add your email to `ADMIN_EMAILS`.
5. Optional: in 17TRACK, set the webhook URL to `https://your-domain/api/track17Webhook` for push updates. Tracking also refreshes on read without it.

Embedded PGlite is **not** used on Vercel, because the serverless filesystem is ephemeral. If `DATABASE_URL` is missing there, the API throws a clear error.

---

## 3. Project layout

```
api/[name].ts            Vercel function: POST /api/<endpoint>, GET /api/file?id=…
server/
  handler.ts             Framework-agnostic dispatcher (auth, admin check, zod validation, errors)
  registry.ts            Map of endpoint name → module (+ adminOnly flag). ADD NEW ENDPOINTS HERE.
  core/
    pg.ts                DB connection (pg if DATABASE_URL, else PGlite on disk)
    schema.ts            Table/column definitions + auto-migration + first-boot seed
    seed.json            Initial catalog/settings
    db.ts                Typed data layer: db.<table>.findAll/findOne/create/update/delete/bulkCreate, db.sql()
    types.ts             Record types for every table
    endpoint.ts          createEndpoint(), AppError, Context type
    auth.ts              bcrypt passwords, JWT (jose) session cookie, admin detection
    api/                 authLogin, authRegister, authLogout, authMe, uploadFile
  shop/api/              Storefront endpoints
  shop/lib/server/       crypto.ts (prices + on-chain payment detection), tracking.ts (17TRACK), store.ts, orderShape.ts, notify.ts
  admin/api/             Admin endpoints (all admin-only via registry)
  admin/lib/server/      Same helpers, admin copy (crypto, tracking, notify, orderShape)
src/
  main.tsx               Picks AdminApp for /admin/*, else ShopApp
  lib/api.ts             Typed client, one function per endpoint, plus <Name>InputType / <Name>OutputType
  lib/auth.tsx           useAuth(), login(), register(), logout(), loginWithRedirect()
  lib/upload.ts          useUpload(): base64 upload to DB-backed file store
  shop/                  Storefront (App.tsx, pages/, components/, lib/cart.tsx, lib/store.ts)
  admin/                 Admin panel (App.tsx uses BrowserRouter basename="/admin")
  ui-kit/                shadcn/ui primitives, cn() util, Markdown renderer
vite.config.ts           Includes a dev middleware that serves /api/* through server/handler.ts
vercel.json              SPA rewrites (everything except /api → index.html)
```

`server/shop/lib/server` and `server/admin/lib/server` contain near-duplicate helpers, because these were originally two apps. If you change payment or tracking logic, change **both**, or consolidate them into one shared module.

---

## 4. How the backend works

### Endpoints (RPC)
Every endpoint is a file that default-exports `createEndpoint({...})`:

```ts
export default createEndpoint({
  description: 'Places an order',
  authenticated: true,                 // requires login → context.user is set
  inputSchema: z.object({ ... }),      // validated by the dispatcher (400 on failure)
  execute: async ({ input, context }) => { ...; return { id } },
});
```

- It is called from the browser as `import { createOrder } from '@/lib/api'` → `POST /api/createOrder` with a JSON body.
- Input and output types are inferred automatically from the endpoint file. `CreateOrderInputType` and `CreateOrderOutputType` are exported from `src/lib/api.ts`.
- **To add an endpoint:**
  1. Create the file.
  2. Add it to `server/registry.ts`, setting `adminOnly: true` for admin features.
  3. Add a caller line to `src/lib/api.ts`.
- Throw `new AppError({ code: 'BAD_REQUEST' | 'NOT_FOUND' | …, message, userFacingMessage })`. The browser receives `{ message: userFacingMessage }` with the matching HTTP status.
- Admin-only endpoints are enforced in `handler.ts`: 401 if not signed in, 403 if the user isn't an admin.

### Database layer (`server/core/db.ts`)
```ts
db.orders.findAll({ filters: { customer: userId, status: { in: ['Shipped'] } }, sort: [{ field: 'placedAt', direction: 'desc' }], limit: 50 })
db.orders.findOne({ id })            // → record | undefined
db.orders.create({ record: {...} })  // → record
db.orders.update({ id, record: {...} })
db.orders.delete({ id })
db.customerProfiles.bulkCreate({ records: [...], matchOn: ['user'] })  // upsert
db.sql({ query: 'SELECT … FROM "Orders" WHERE "status" = $1', params: ['Shipped'] })
```

- The available filter operators are equality, `null`, `contains`, `not`, `in`, `notIn`, `lt`, `lte`, `gt` and `gte`.
- Records come back with `null` columns omitted. Timestamps are ISO strings.
- Table and column names are **quoted camelCase/PascalCase** (`"Orders"."placedAt"`), so raw SQL must double-quote identifiers.
- **Schema changes:** add the column to `TABLES` in `server/core/schema.ts` and the field to `server/core/types.ts`. Migration is additive and automatic (`ADD COLUMN IF NOT EXISTS`) on the next cold start. There is no migration for renames or drops; do those manually in SQL.

### Tables
| Table | Purpose / key fields |
|---|---|
| `Users` | email (unique, lower-cased), passwordHash (bcrypt), firstName, lastName, role (`admin`/`customer`) |
| `Products` | name, description, price, salePrice, size, purity, category, imageUrl, stock, active, featured, coaUrl, showCoa |
| `Categories` | name, sortOrder |
| `DiscountCodes` | code, discountType (`Percent`/`Fixed`), amount, minimumOrder, usageLimit, timesUsed, expiresAt, active, note |
| `StoreSettings` | **single row**: storeName, wallet addresses (btc/eth/sol/ltc/tron), shippingFee, freeShippingOver, promo banner (promoActive/Title/Subtitle/Code), testMode, policies (termsOfService/privacyPolicy/shippingPolicy/refundPolicy, markdown), primaryColor/accentColor, etherscanApiKey, tronGridApiKey, solanaRpcUrl |
| `Orders` | orderNumber, customer (Users.id), customerEmail/Name, address (streetAddress/city/postalCode/country + shippingAddress text), itemsJson, subtotal/discount/shipping/total, discountCode, payCurrency, cryptoAmount, payAddress, transactionHash, paymentExpiresAt, paidAt, status, trackingNumber, carrier, trackingStatus, trackingEventsJson, lastTrackingCheck, placedAt |
| `CustomerProfiles` | user (Users.id), fullName, default address |
| `SupportContacts` | label, channel (Telegram/WhatsApp/Discord/Email/…), handle, sortOrder |
| `Files` | uploaded images/PDFs stored base64, served at `/api/file?id=` |

### Auth
- Email and password. bcrypt hashes are stored in `Users`. The session is a JWT (HS256, `AUTH_SECRET`) in the httpOnly cookie `pl_session`, valid for 30 days.
- The **first registered account** becomes `admin`. Emails listed in `ADMIN_EMAILS` are always admin. To promote someone else, run `UPDATE "Users" SET "role"='admin' WHERE "email"='…'`.
- Frontend: `useAuth()` → `{ user, isLoading }`. `/login` handles both sign-in and sign-up and accepts `?redirect=`. Shop routes `/checkout`, `/orders`, `/orders/:id` and `/account` require login. `/admin/*` requires an admin.
- There is no password reset or email verification yet. These would be good next steps and need an email provider.

---

## 5. Business flows

**Order lifecycle:** `Awaiting Payment → Processing → Shipped → In Transit → Out for Delivery → Delivered`. Side states are `Exception`, `Expired`, `Cancelled` and `Refunded`. The legacy status `Paid` is treated the same as Processing.

1. **Checkout** (`server/shop/api/createOrder.ts`)
   - Validates stock and active products.
   - Applies a discount through `evaluateCode` in `shop/lib/server/store.ts`, then shipping (free above `freeShippingOver`).
   - Picks the store wallet for the chosen coin.
   - Converts USD to crypto with `getUsdPrice`, using Coinbase → Kraken → Binance → CoinGecko as fallbacks with a 60 s cache.
   - `uniqueCryptoAmount` adds a random tail to the last decimals, so **each order's amount is unique**. That amount is how payments are matched.
   - Saves the order, decrements stock and sets a payment window (`paymentExpiresAt`).
   - The currency `TEST` (only when `StoreSettings.testMode` is true) marks the order as paid instantly. Keep test mode **off** in production.
2. **Payment detection** (`checkOrderPayment` in `crypto.ts`)
   - Queries the chain for incoming transfers to the wallet with the exact amount after the order time: public BTC/LTC explorers, Etherscan (ETH/USDT-ERC20/USDC, needs `etherscanApiKey`), TronGrid (TRX/USDT-TRC20) and Solana RPC.
   - On a match it calls `markPaid`, which sets status `Processing`, `paidAt` and `transactionHash`.
   - It is triggered by the order page polling every 30 s (`getMyOrder` with `checkPayment: true`) and by the admin orders list (`listOrders` checks up to 10 pending orders).
   - Customers have **no** manual "check now" button, which prevents abuse.
3. **Payment UI** (`src/shop/components/PaymentPanel.tsx` and `PaymentQr.tsx`): a QR code with an "amount URI" or "address only" toggle, a countdown, and copyable amount and address. QR images come from `api.qrserver.com`; swap in the `qrcode` npm package to self-host.
4. **Shipping** (`*/lib/server/tracking.ts`)
   - The admin clicks "Mark shipped" and enters a tracking number. It is registered with 17TRACK (`https://api.17track.net/track/v2.2`, header `17token`).
   - Status refreshes when an order is read and was last checked more than 10 minutes ago. The webhook also pushes updates.
   - 17TRACK statuses map to order statuses, and **all orders sharing the tracking number** are updated.
   - `Delivered`, `Cancelled` and `Refunded` are locked.
5. **Notifications** (`notify.ts`): they currently only `console.log`. Plug in an email provider such as Resend or SMTP there.
6. **Invoices** (`admin/api/generateInvoice.ts`): returns invoice HTML. The admin UI opens it in a new tab and calls `print()`, so the user saves it as a PDF from the browser. Swap in Puppeteer or a PDF API if server-side PDFs are needed.
7. **Theme:** the admin can set optional `primaryColor` and `accentColor`. `src/shop/components/ThemeColors.tsx` overrides the CSS variables at runtime and removes them when they are unset.
8. **Uploads:** admin image and COA uploads are stored in the `Files` table, limited to about 4 MB because of Vercel's request body limit. For larger files, switch `uploadFile` to Vercel Blob or S3 and store the returned URL instead.

---

## 6. Design system
- Light "paper and ink" look: background `#FBFAF6`, ink `#131311`, **zero border radius**, no shadows.
- Fonts are DM Sans (body), IBM Plex Mono (specs and numbers) and Instrument Serif (lead titles).
- Headings are lowercase.
- The tokens are in `src/index.css` as HSL triples; Tailwind maps them in `tailwind.config.ts`.
- `promo` = ink on paper. Use semantic classes (`bg-primary`, `text-foreground`, `border-border`), not raw colors.

## 7. Conventions for AI agents
- Never trust ids from the browser for ownership. Shop endpoints scope by `context.user.id` (for example, `Orders.customer`).
- Money is USD, stored as float. Crypto decimals per coin are in `META` in `crypto.ts`.
- Keep endpoints small and add them to the registry. Use `db.sql` for aggregates; `getDashboard.ts` is an example.
- The frontend uses React Query (`useQuery(['key'], () => endpoint({...}))`) and `sonner` toasts.
- Imports: `@/` resolves to `src/`. Server code uses relative imports only, so Vercel bundles it without path aliases.
- Before shipping changes, run `npm run typecheck` and `npm run build`.
