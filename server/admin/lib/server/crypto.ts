import { db } from '../../../core/db.js';
import type { StoreSettingsRecordType } from '../../../core/db.js';
import { claimOrderPayment, releaseOrderReservation } from '../../../core/orderState.js';
import { notifyCustomer } from './notify.js';

export const CURRENCIES = ['BTC', 'ETH', 'SOL', 'LTC', 'USDT-ERC20', 'USDT-TRC20', 'USDC', 'TRX'] as const;
export type PayCurrency = (typeof CURRENCIES)[number];

type Meta = { coingecko?: string; decimals: number; wallet: keyof StoreSettingsRecordType; network: string };
export const META: Record<PayCurrency, Meta> = {
  BTC: { coingecko: 'bitcoin', decimals: 8, wallet: 'btcAddress', network: 'Bitcoin' },
  ETH: { coingecko: 'ethereum', decimals: 6, wallet: 'ethAddress', network: 'Ethereum' },
  SOL: { coingecko: 'solana', decimals: 6, wallet: 'solAddress', network: 'Solana' },
  LTC: { coingecko: 'litecoin', decimals: 8, wallet: 'ltcAddress', network: 'Litecoin' },
  'USDT-ERC20': { decimals: 6, wallet: 'ethAddress', network: 'Ethereum (ERC-20)' },
  USDC: { decimals: 6, wallet: 'ethAddress', network: 'Ethereum (ERC-20)' },
  'USDT-TRC20': { decimals: 6, wallet: 'tronAddress', network: 'Tron (TRC-20)' },
  TRX: { coingecko: 'tron', decimals: 6, wallet: 'tronAddress', network: 'Tron' },
};

const ERC20: Record<string, string> = {
  'USDT-ERC20': '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
};
const TRC20_USDT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';

export function walletFor(settings: StoreSettingsRecordType | undefined, c: PayCurrency): string {
  return String(settings?.[META[c].wallet] ?? '').trim();
}

const priceCache = new Map<string, { price: number; at: number }>();

async function tryPrice(url: string, pick: (j: any) => unknown): Promise<number | null> {
  try {
    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) return null;
    const p = Number(pick(await res.json()));
    return p > 0 ? p : null;
  } catch {
    return null;
  }
}

export async function getUsdPrice(c: PayCurrency): Promise<number> {
  const id = META[c].coingecko;
  if (!id) return 1; // stablecoins
  const cached = priceCache.get(c);
  if (cached && Date.now() - cached.at < 60_000) return cached.price;
  const sym = c; // BTC, ETH, SOL, LTC, TRX
  const sources: [string, (j: any) => unknown][] = [
    [`https://api.coinbase.com/v2/prices/${sym}-USD/spot`, (j) => j?.data?.amount],
    [`https://api.kraken.com/0/public/Ticker?pair=${sym === 'BTC' ? 'XBT' : sym}USD`, (j) => (Object.values(j?.result ?? {})[0] as any)?.c?.[0]],
    [`https://api.binance.com/api/v3/ticker/price?symbol=${sym}USDT`, (j) => j?.price],
    [`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`, (j) => j?.[id]?.usd],
  ];
  for (const [url, pick] of sources) {
    const price = await tryPrice(url, pick);
    if (price) {
      priceCache.set(c, { price, at: Date.now() });
      return price;
    }
  }
  if (cached) return cached.price;
  throw new Error('Could not fetch the current exchange rate. Please try again in a moment.');
}

/** USD → crypto, with a random tail in the last 3 decimals so each order's amount is unique. */
export function uniqueCryptoAmount(usd: number, price: number, c: PayCurrency): number {
  const d = META[c].decimals;
  const step = 10 ** (d - 3);
  const rounded = Math.ceil((usd / price) * step) / step;
  return Number((rounded + (Math.floor(Math.random() * 999) + 1) / 10 ** d).toFixed(d));
}

/** Integer units at the quote's precision, for exact comparison. */
const units = (amount: number, d: number) => Math.round(amount * 10 ** d);
const fromRaw = (raw: string | number, rawDecimals: number, d: number) =>
  Math.round(Number(BigInt(String(raw)) / 10n ** BigInt(Math.max(0, rawDecimals - d))));

async function getJson(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`Lookup failed (${res.status}) ${url}`);
  return (await res.json()) as any;
}

export type ApiCfg = { etherscanApiKey?: string; tronGridApiKey?: string; solanaRpcUrl?: string };

async function solRpc(method: string, params: unknown[], cfg: ApiCfg) {
  const json = await getJson(cfg.solanaRpcUrl || 'https://api.mainnet-beta.solana.com', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

type Finder = (address: string, expected: number, since: number, cfg: ApiCfg) => Promise<string | null>;

const ethApi = (cfg: ApiCfg, q: string) => cfg.etherscanApiKey
  ? `https://api.etherscan.io/v2/api?chainid=1&apikey=${encodeURIComponent(cfg.etherscanApiKey)}&${q}`
  : `https://eth.blockscout.com/api?${q}`;
const tronHeaders = (cfg: ApiCfg): RequestInit | undefined => cfg.tronGridApiKey ? { headers: { 'TRON-PRO-API-KEY': cfg.tronGridApiKey } } : undefined;

const findSol: Finder = async (address, expected, since, cfg) => {
  const sigs: { signature: string; blockTime: number | null; err: unknown }[] =
    await solRpc('getSignaturesForAddress', [address, { limit: 25 }], cfg);
  for (const s of sigs) {
    if (s.err || !s.blockTime || s.blockTime < since) continue;
    const tx = await solRpc('getTransaction', [s.signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }], cfg);
    if (!tx?.meta) continue;
    const idx = (tx.transaction.message.accountKeys as { pubkey: string }[]).findIndex((k) => k.pubkey === address);
    if (idx < 0) continue;
    const delta = Math.round((tx.meta.postBalances[idx] - tx.meta.preBalances[idx]) / 1000); // lamports → 6dp
    if (Math.abs(delta - expected) <= 1) return s.signature;
  }
  return null;
};

const utxoFinder = (host: string): Finder => async (address, expected, since) => {
  const txs = await getJson(`https://${host}/api/address/${address}/txs`);
  for (const tx of txs) {
    if (tx.status.confirmed && tx.status.block_time < since) continue;
    const got = tx.vout.filter((v: any) => v.scriptpubkey_address === address).reduce((a: number, v: any) => a + v.value, 0);
    if (Math.abs(got - expected) <= 1) return tx.txid;
  }
  return null;
};

const findEth: Finder = async (address, expected, since, cfg) => {
  const j = await getJson(ethApi(cfg, `module=account&action=txlist&address=${address}&sort=desc&page=1&offset=50`));
  if (j.status === '0' && typeof j.result === 'string') throw new Error(j.result);
  for (const t of j.result ?? []) {
    if (Number(t.timeStamp) < since || t.isError === '1' || t.to?.toLowerCase() !== address.toLowerCase()) continue;
    if (Math.abs(fromRaw(t.value, 18, 6) - expected) <= 1) return t.hash;
  }
  return null;
};

const erc20Finder = (contract: string): Finder => async (address, expected, since, cfg) => {
  const j = await getJson(ethApi(cfg, `module=account&action=tokentx&contractaddress=${contract}&address=${address}&sort=desc&page=1&offset=50`));
  if (j.status === '0' && typeof j.result === 'string') throw new Error(j.result);
  for (const t of j.result ?? []) {
    if (Number(t.timeStamp) < since || t.to?.toLowerCase() !== address.toLowerCase()) continue;
    if (Math.abs(fromRaw(t.value, Number(t.tokenDecimal ?? 6), 6) - expected) <= 1) return t.hash;
  }
  return null;
};

const findTrc20: Finder = async (address, expected, since, cfg) => {
  const j = await getJson(`https://api.trongrid.io/v1/accounts/${address}/transactions/trc20?only_to=true&limit=50&contract_address=${TRC20_USDT}`, tronHeaders(cfg));
  for (const t of j.data ?? []) {
    if (t.block_timestamp / 1000 < since) continue;
    if (Math.abs(Number(t.value) - expected) <= 1) return t.transaction_id;
  }
  return null;
};

const findTrx: Finder = async (address, expected, since, cfg) => {
  const j = await getJson(`https://api.trongrid.io/v1/accounts/${address}/transactions?only_to=true&limit=50`, tronHeaders(cfg));
  for (const t of j.data ?? []) {
    if (t.block_timestamp / 1000 < since) continue;
    const c = t.raw_data?.contract?.[0];
    if (c?.type !== 'TransferContract') continue;
    if (Math.abs(Number(c.parameter?.value?.amount) - expected) <= 1) return t.txID;
  }
  return null;
};

const FINDERS: Record<PayCurrency, Finder> = {
  BTC: utxoFinder('mempool.space'),
  LTC: utxoFinder('litecoinspace.org'),
  SOL: findSol,
  ETH: findEth,
  'USDT-ERC20': erc20Finder(ERC20['USDT-ERC20']),
  USDC: erc20Finder(ERC20.USDC),
  'USDT-TRC20': findTrc20,
  TRX: findTrx,
};

export async function markPaid(orderId: string, hash: string) {
  const order = await claimOrderPayment(orderId, hash);
  if (!order) return false;
  await notifyCustomer(order, 'payment_received', `Payment received (${hash}). We're preparing your order.`);
  return true;
}

/** Looks on-chain for this order's payment; marks it paid if found. Returns new status. */
export async function checkOrderPayment(orderId: string): Promise<string> {
  const order = await db.orders.findOne({ id: orderId });
  if (!order) throw new Error('Order not found');
  if (order.status !== 'Awaiting Payment') return order.status ?? '';
  const c = order.payCurrency as PayCurrency;
  const finder = FINDERS[c];
  if (!finder) return 'Awaiting Payment';
  const since = Math.floor(new Date(order.placedAt ?? Date.now()).getTime() / 1000) - 120;
  const hash = await finder(order.payAddress!, units(order.cryptoAmount!, META[c].decimals), since, await apiCfg());

  if (hash && await markPaid(orderId, hash)) return 'Processing';
  if (order.paymentExpiresAt && Date.now() > new Date(order.paymentExpiresAt).getTime() + 24 * 3600 * 1000) {
    if (await releaseOrderReservation(orderId, 'Expired')) return 'Expired';
    return (await db.orders.findOne({ id: orderId }))?.status ?? 'Awaiting Payment';
  }
  return 'Awaiting Payment';
}

async function apiCfg(): Promise<ApiCfg> {
  const { records } = await db.storeSettings.findAll({ limit: 1 });
  const s = records[0];
  return { etherscanApiKey: s?.etherscanApiKey || undefined, tronGridApiKey: s?.tronGridApiKey || undefined, solanaRpcUrl: s?.solanaRpcUrl || undefined };
}

/** Checks that each configured wallet's blockchain API answers. */
export async function testWallets(): Promise<{ currency: string; ok: boolean; message: string }[]> {
  const { records } = await db.storeSettings.findAll({ limit: 1 });
  const settings = records[0];
  const cfg = await apiCfg();
  return Promise.all(CURRENCIES.filter((c) => walletFor(settings, c)).map(async (c) => {
    try {
      await FINDERS[c](walletFor(settings, c), -1, Math.floor(Date.now() / 1000) - 3600, cfg);
      return { currency: c, ok: true, message: 'Connected — payments will be detected' };
    } catch (e) {
      return { currency: c, ok: false, message: (e as Error).message.slice(0, 160) };
    }
  }));
}
