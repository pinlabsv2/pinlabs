import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';

export type CartLine = { productId: string; name: string; price: number; size: string; imageUrl: string; stock?: number | null; quantity: number };

type CartCtx = {
  lines: CartLine[];
  add: (l: Omit<CartLine, 'quantity'>, qty?: number) => void;
  setQty: (id: string, qty: number) => void;
  remove: (id: string) => void;
  clear: () => void;
  syncStock: (stocks: Record<string, number | null>) => void;
  count: number;
  subtotal: number;
};

const Ctx = createContext<CartCtx | null>(null);
const KEY = 'pinlabs-cart';

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(() => {
    try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { return []; }
  });
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(lines)); }, [lines]);

  const add: CartCtx['add'] = (l, qty = 1) =>
    setLines((prev) => {
      const max = typeof l.stock === 'number' ? Math.max(0, Math.floor(l.stock)) : Infinity;
      if (max === 0) return prev;
      const ex = prev.find((p) => p.productId === l.productId);
      if (ex) return prev.map((p) => (p.productId === l.productId ? { ...p, ...l, quantity: Math.min(max, p.quantity + qty) } : p));
      return [...prev, { ...l, quantity: Math.min(max, Math.max(1, qty)) }];
    });
  const setQty = (id: string, qty: number) =>
    setLines((prev) => prev.map((p) => {
      if (p.productId !== id) return p;
      const max = typeof p.stock === 'number' ? Math.max(1, Math.floor(p.stock)) : Infinity;
      return { ...p, quantity: Math.min(max, Math.max(1, qty)) };
    }));
  const remove = (id: string) => setLines((prev) => prev.filter((p) => p.productId !== id));
  const clear = () => setLines([]);
  const syncStock = useCallback((stocks: Record<string, number | null>) => {
    setLines((prev) => {
      let changed = false;
      const next = prev.map((line) => {
        const stock = Object.prototype.hasOwnProperty.call(stocks, line.productId) ? stocks[line.productId] : 0;
        const quantity = typeof stock === 'number' && stock > 0 ? Math.min(line.quantity, Math.floor(stock)) : line.quantity;
        if (line.stock === stock && line.quantity === quantity) return line;
        changed = true;
        return { ...line, stock, quantity };
      });
      return changed ? next : prev;
    });
  }, []);
  const count = lines.reduce((a, l) => a + l.quantity, 0);
  const subtotal = Math.round(lines.reduce((a, l) => a + l.price * l.quantity, 0) * 100) / 100;

  return <Ctx.Provider value={{ lines, add, setQty, remove, clear, syncStock, count, subtotal }}>{children}</Ctx.Provider>;
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useCart outside provider');
  return c;
}
