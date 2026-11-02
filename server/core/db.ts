/**
 * Small typed data-access layer. Mirrors the API the endpoints were written against:
 *   db.<table>.findAll / findOne / create / update / delete / bulkCreate,  db.sql({ query, params }),  db.auth.updateUserProfile
 */
import { getDb } from './pg.js';
import { TABLES } from './schema.js';
export * from './types.js';
import type * as T from './types.js';

type Op = { contains?: unknown; not?: unknown; in?: unknown[]; notIn?: unknown[]; lt?: unknown; lte?: unknown; gt?: unknown; gte?: unknown };
type FindAll<R> = { filters?: Partial<Record<keyof R | string, unknown | Op>>; sort?: { field: string; direction?: 'asc' | 'desc' }[]; limit?: number; offset?: number; fields?: string[] };

function toRecord<R>(row: any): R {
  const out: any = {};
  for (const [k, v] of Object.entries(row)) {
    if (v === null || v === undefined) continue;
    out[k] = v instanceof Date ? v.toISOString() : typeof v === 'bigint' ? Number(v) : v;
  }
  return out;
}

function normValue(v: unknown) {
  if (Array.isArray(v)) return v[0] ?? null; // user/linked fields hold a single id
  if (v === undefined) return null;
  return v;
}

function where(table: string, filters: Record<string, unknown> | undefined, params: unknown[]) {
  const parts: string[] = [];
  const cols = TABLES[table];
  for (const [field, raw] of Object.entries(filters ?? {})) {
    if (raw === undefined) throw new Error(`Filter "${field}" is undefined`);
    if (field !== 'id' && field !== 'createdAt' && !(field in cols)) throw new Error(`Unknown field ${table}.${field}`);
    const col = `"${field}"`;
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    if (raw === null) { parts.push(`${col} IS NULL`); continue; }
    if (typeof raw === 'object' && !Array.isArray(raw) && !(raw instanceof Date)) {
      const o = raw as Op;
      if ('contains' in o) parts.push(`${col}::text ILIKE ${p(`%${o.contains}%`)}`);
      if ('not' in o) parts.push(o.not === null ? `${col} IS NOT NULL` : `${col} IS DISTINCT FROM ${p(o.not)}`);
      if ('in' in o) parts.push(o.in!.length ? `${col} = ANY(${p(o.in)})` : 'FALSE');
      if ('notIn' in o && o.notIn!.length) parts.push(`(${col} IS NULL OR NOT (${col} = ANY(${p(o.notIn)})))`);
      if ('lt' in o) parts.push(`${col} < ${p(o.lt)}`);
      if ('lte' in o) parts.push(`${col} <= ${p(o.lte)}`);
      if ('gt' in o) parts.push(`${col} > ${p(o.gt)}`);
      if ('gte' in o) parts.push(`${col} >= ${p(o.gte)}`);
      continue;
    }
    parts.push(`${col} = ${p(normValue(raw))}`);
  }
  return parts.length ? `WHERE ${parts.join(' AND ')}` : '';
}

function table<R extends { id: string }, I>(name: string) {
  const cols = TABLES[name];
  const pick = (rec: Partial<I>) => Object.entries(rec as any).filter(([k, v]) => k in cols && v !== undefined);
  const api = {
    async findAll(opts: FindAll<R> = {}): Promise<{ records: R[]; hasMore: boolean }> {
      const db = await getDb();
      const params: unknown[] = [];
      const w = where(name, opts.filters as any, params);
      const sort = (opts.sort ?? []).filter((s) => s.field === 'id' || s.field === 'createdAt' || s.field in cols)
        .map((s) => `"${s.field}" ${s.direction === 'desc' ? 'DESC' : 'ASC'} NULLS LAST`);
      const limit = Math.min(opts.limit ?? 500, 2000);
      const { rows } = await db.query(
        `SELECT * FROM "${name}" ${w} ORDER BY ${[...sort, '"createdAt" ASC'].join(', ')} LIMIT ${limit + 1} OFFSET ${Number(opts.offset ?? 0)}`, params);
      return { records: rows.slice(0, limit).map((r) => toRecord<R>(r)), hasMore: rows.length > limit };
    },
    async findOne(opts: { id?: string; filters?: FindAll<R>['filters'] }): Promise<R | undefined> {
      const filters = { ...(opts.filters ?? {}), ...(opts.id ? { id: opts.id } : {}) };
      return (await api.findAll({ filters: filters as any, limit: 1 })).records[0];
    },
    async create({ record }: { record: Partial<I> }): Promise<R> {
      const db = await getDb();
      const entries = pick(record);
      const id = crypto.randomUUID();
      const { rows } = await db.query(
        `INSERT INTO "${name}" ("id"${entries.map(([k]) => `, "${k}"`).join('')}) VALUES ($1${entries.map((_, i) => `, $${i + 2}`).join('')}) RETURNING *`,
        [id, ...entries.map(([, v]) => normValue(v))]);
      return toRecord<R>(rows[0]);
    },
    async update({ id, record }: { id: string; record: Partial<I> }): Promise<{ id: string; fields: Partial<R> }> {
      if (!id) throw new Error('Update requires id');
      const db = await getDb();
      const entries = pick(record);
      const { rows } = await db.query(
        `UPDATE "${name}" SET "updatedAt" = now()${entries.map(([k], i) => `, "${k}" = $${i + 2}`).join('')} WHERE "id" = $1 RETURNING *`,
        [id, ...entries.map(([, v]) => normValue(v))]);
      if (!rows[0]) throw new Error(`${name} ${id} not found`);
      return { id, fields: toRecord<Partial<R>>(rows[0]) };
    },
    async delete({ id }: { id: string }) {
      const db = await getDb();
      await db.query(`DELETE FROM "${name}" WHERE "id" = $1`, [id]);
      return { success: true as const, id };
    },
    /** Inserts records; with matchOn, updates rows matching on those fields instead (upsert). */
    async bulkCreate({ records, matchOn }: { records: Partial<I>[]; matchOn?: string[] }): Promise<{ success: boolean; records: R[] }> {
      const out: R[] = [];
      for (const record of records) {
        if (matchOn?.length) {
          const filters = Object.fromEntries(matchOn.map((k) => [k, normValue((record as any)[k])]));
          const existing = await api.findOne({ filters: filters as any });
          if (existing) {
            const { fields } = await api.update({ id: existing.id, record });
            out.push({ ...existing, ...fields } as R);
            continue;
          }
        }
        out.push(await api.create({ record }));
      }
      return { success: true, records: out };
    },
  };
  return api;
}

export const db = {
  products: table<T.ProductsRecordType, T.ProductsRecordInput>('Products'),
  discountCodes: table<T.DiscountCodesRecordType, T.DiscountCodesRecordInput>('DiscountCodes'),
  storeSettings: table<T.StoreSettingsRecordType, T.StoreSettingsRecordInput>('StoreSettings'),
  orders: table<T.OrdersRecordType, T.OrdersRecordInput>('Orders'),
  categories: table<T.CategoriesRecordType, T.CategoriesRecordInput>('Categories'),
  supportContacts: table<T.SupportContactsRecordType, T.SupportContactsRecordInput>('SupportContacts'),
  customerProfiles: table<T.CustomerProfilesRecordType, T.CustomerProfilesRecordInput>('CustomerProfiles'),
  users: table<T.UsersRecordType, T.UsersRecordInput>('Users'),
  files: table<T.FilesRecordType, T.FilesRecordInput>('Files'),
  orderItems: table<T.OrderItemsRecordType, T.OrderItemsRecordInput>('OrderItems'),
  paymentAttempts: table<T.PaymentAttemptsRecordType, T.PaymentAttemptsRecordInput>('PaymentAttempts'),
  providerWebhookEvents: table<T.ProviderWebhookEventsRecordType, T.ProviderWebhookEventsRecordInput>('ProviderWebhookEvents'),
  inventoryBalances: table<T.InventoryBalancesRecordType, T.InventoryBalancesRecordInput>('InventoryBalances'),
  inventoryLedger: table<T.InventoryLedgerRecordType, T.InventoryLedgerRecordInput>('InventoryLedger'),
  inboundStock: table<T.InboundStockRecordType, T.InboundStockRecordInput>('InboundStock'),
  orderItemAllocations: table<T.OrderItemAllocationsRecordType, T.OrderItemAllocationsRecordInput>('OrderItemAllocations'),
  shipments: table<T.ShipmentsRecordType, T.ShipmentsRecordInput>('Shipments'),
  shipmentItems: table<T.ShipmentItemsRecordType, T.ShipmentItemsRecordInput>('ShipmentItems'),
  shipmentEvents: table<T.ShipmentEventsRecordType, T.ShipmentEventsRecordInput>('ShipmentEvents'),
  shipmentIncidents: table<T.ShipmentIncidentsRecordType, T.ShipmentIncidentsRecordInput>('ShipmentIncidents'),
  refundRequests: table<T.RefundRequestsRecordType, T.RefundRequestsRecordInput>('RefundRequests'),
  refundPayouts: table<T.RefundPayoutsRecordType, T.RefundPayoutsRecordInput>('RefundPayouts'),
  emailTemplates: table<T.EmailTemplatesRecordType, T.EmailTemplatesRecordInput>('EmailTemplates'),
  emailOutbox: table<T.EmailOutboxRecordType, T.EmailOutboxRecordInput>('EmailOutbox'),
  emailEvents: table<T.EmailEventsRecordType, T.EmailEventsRecordInput>('EmailEvents'),
  marketingContacts: table<T.MarketingContactsRecordType, T.MarketingContactsRecordInput>('MarketingContacts'),
  customerSegments: table<T.CustomerSegmentsRecordType, T.CustomerSegmentsRecordInput>('CustomerSegments'),
  campaigns: table<T.CampaignsRecordType, T.CampaignsRecordInput>('Campaigns'),
  campaignRecipients: table<T.CampaignRecipientsRecordType, T.CampaignRecipientsRecordInput>('CampaignRecipients'),
  orderNotes: table<T.OrderNotesRecordType, T.OrderNotesRecordInput>('OrderNotes'),
  auditEvents: table<T.AuditEventsRecordType, T.AuditEventsRecordInput>('AuditEvents'),
  forecastSettings: table<T.ForecastSettingsRecordType, T.ForecastSettingsRecordInput>('ForecastSettings'),
  productReviews: table<T.ProductReviewsRecordType, T.ProductReviewsRecordInput>('ProductReviews'),
  reviewPhotos: table<T.ReviewPhotosRecordType, T.ReviewPhotosRecordInput>('ReviewPhotos'),
  reviewModerationActions: table<T.ReviewModerationActionsRecordType, T.ReviewModerationActionsRecordInput>('ReviewModerationActions'),
  rateLimitBuckets: table<T.RateLimitBucketsRecordType, T.RateLimitBucketsRecordInput>('RateLimitBuckets'),
  /** Raw SQL. Use $1, $2… params for user input. */
  async sql({ query, params }: { query: string; params?: unknown[] }) {
    const d = await getDb();
    const { rows } = await d.query(query, params ?? []);
    return { rows: rows as Record<string, unknown>[], rowCount: rows.length };
  },
  async transaction<T>(callback: (tx: { query: (query: string, params?: unknown[]) => Promise<{ rows: any[] }> }) => Promise<T>) {
    const d = await getDb();
    return d.transaction(callback);
  },
  auth: {
    async updateUserProfile(userId: string, p: { firstName?: string; lastName?: string }) {
      await db.users.update({ id: userId, record: { firstName: p.firstName, lastName: p.lastName } as any });
    },
  },
};
