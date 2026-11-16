import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import type { GetStorefrontOutputType } from '@/lib/api';

type StoreProduct = GetStorefrontOutputType['products'][0];
type ShippingOption = StoreProduct['shippingOption'];

export type CartLine = {
  productId: string;
  variantId: string | null;
  productName: string;
  variantName: string;
  name: string;
  price: number;
  size: string;
  imageUrl: string;
  stock: number | null;
  shippingOption: ShippingOption;
  quantity: number;
  available: boolean;
  unavailableReason: string;
};

export type CartIdentity = Pick<CartLine, 'productId' | 'variantId'>;
export type CartDraft = Omit<CartLine, 'quantity' | 'available' | 'unavailableReason'>;

type CartCtx = {
  lines: CartLine[];
  add: (line: CartDraft, quantity?: number) => void;
  setQty: (identity: CartIdentity, quantity: number) => void;
  remove: (identity: CartIdentity) => void;
  clear: () => void;
  syncCatalog: (products: StoreProduct[]) => void;
  count: number;
  subtotal: number;
};

type PersistedCart = { version: 2; lines: CartLine[] };
type LegacyLine = { productId?: string; name?: string; price?: number; size?: string; imageUrl?: string; stock?: number | null; quantity?: number };

const Ctx = createContext<CartCtx | null>(null);
const KEY = 'pinlabs-cart-v2';
const LEGACY_KEY = 'pinlabs-cart';

export const cartLineKey = ({ productId, variantId }: CartIdentity) => `${productId}\u0000${variantId ?? ''}`;
const sameIdentity = (left: CartIdentity, right: CartIdentity) => left.productId === right.productId && left.variantId === right.variantId;

function loadCart(): CartLine[] {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as PersistedCart;
      return parsed?.version === 2 && Array.isArray(parsed.lines) ? parsed.lines : [];
    }
    const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) ?? '[]') as LegacyLine[];
    if (!Array.isArray(legacy)) return [];
    return legacy.flatMap((line) => typeof line.productId === 'string' ? [{
      productId: line.productId,
      variantId: null,
      productName: String(line.name ?? ''),
      variantName: '',
      name: String(line.name ?? ''),
      price: Number(line.price ?? 0),
      size: String(line.size ?? ''),
      imageUrl: String(line.imageUrl ?? ''),
      stock: typeof line.stock === 'number' ? line.stock : null,
      shippingOption: null,
      quantity: Math.max(1, Math.floor(Number(line.quantity ?? 1))),
      available: false,
      unavailableReason: 'Checking current availability',
    }] : []);
  } catch {
    return [];
  }
}

function resolveLine(line: CartLine, products: StoreProduct[]): CartLine {
  const product = products.find((item) => item.id === line.productId);
  if (!product) return { ...line, available: false, unavailableReason: 'This product is no longer available' };

  if (line.variantId) {
    if (!product.hasVariants) return { ...line, available: false, unavailableReason: 'This product no longer uses variants' };
    const variant = product.variants.find((item) => item.id === line.variantId);
    if (!variant) return { ...line, available: false, unavailableReason: 'This variant is no longer available' };
    const stock = variant.stock;
    const available = variant.purchasable && !!variant.shippingOption && (stock == null || stock > 0);
    return {
      ...line,
      productName: product.name,
      variantName: variant.name,
      name: `${product.name} — ${variant.name}`,
      price: variant.salePrice ?? variant.price,
      size: variant.name,
      imageUrl: product.imageUrl,
      stock,
      shippingOption: variant.shippingOption,
      quantity: typeof stock === 'number' && stock > 0 ? Math.min(line.quantity, Math.floor(stock)) : line.quantity,
      available,
      unavailableReason: available ? '' : variant.unavailableReason || 'This variant is unavailable',
    };
  }

  if (product.hasVariants) return { ...line, available: false, unavailableReason: 'Choose a variant again for this product' };
  const stock = product.stock;
  const available = product.purchasable && !!product.shippingOption && (stock == null || stock > 0);
  return {
    ...line,
    productName: product.name,
    variantName: '',
    name: product.name,
    price: product.salePrice ?? product.price,
    size: product.size,
    imageUrl: product.imageUrl,
    stock,
    shippingOption: product.shippingOption,
    quantity: typeof stock === 'number' && stock > 0 ? Math.min(line.quantity, Math.floor(stock)) : line.quantity,
    available,
    unavailableReason: available ? '' : product.unavailableReason || 'This product is unavailable',
  };
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(loadCart);
  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify({ version: 2, lines } satisfies PersistedCart));
  }, [lines]);

  const add: CartCtx['add'] = (line, quantity = 1) => setLines((current) => {
    const max = typeof line.stock === 'number' ? Math.max(0, Math.floor(line.stock)) : Infinity;
    if (max === 0 || !line.shippingOption) return current;
    const existing = current.find((item) => sameIdentity(item, line));
    const nextQuantity = Math.min(max, Math.max(1, (existing?.quantity ?? 0) + quantity));
    const next: CartLine = { ...line, quantity: nextQuantity, available: true, unavailableReason: '' };
    return existing
      ? current.map((item) => sameIdentity(item, line) ? next : item)
      : [...current, next];
  });
  const setQty: CartCtx['setQty'] = (identity, quantity) => setLines((current) => current.map((line) => {
    if (!sameIdentity(line, identity)) return line;
    const max = typeof line.stock === 'number' && line.stock > 0 ? Math.floor(line.stock) : Infinity;
    return { ...line, quantity: Math.min(max, Math.max(1, Math.floor(quantity))) };
  }));
  const remove: CartCtx['remove'] = (identity) => setLines((current) => current.filter((line) => !sameIdentity(line, identity)));
  const clear = () => setLines([]);
  const syncCatalog = useCallback((products: StoreProduct[]) => {
    setLines((current) => {
      const next = current.map((line) => resolveLine(line, products));
      return JSON.stringify(next) === JSON.stringify(current) ? current : next;
    });
  }, []);
  const count = lines.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = Math.round(lines.reduce((sum, line) => sum + line.price * line.quantity, 0) * 100) / 100;

  return <Ctx.Provider value={{ lines, add, setQty, remove, clear, syncCatalog, count, subtotal }}>{children}</Ctx.Provider>;
}

export function useCart() {
  const cart = useContext(Ctx);
  if (!cart) throw new Error('useCart outside provider');
  return cart;
}
