import { ReactNode, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth, loginWithRedirect } from '@/lib/auth';
import { Toaster } from '@/ui-kit/ui/sonner';
import { CartProvider, useCart } from './lib/cart';
import { useStorefront } from './lib/store';
import Header from './components/Header';
import ThemeColors from './components/ThemeColors';
import Shop from './pages/Shop';
import ProductPage from './pages/ProductPage';
import CartPage from './pages/CartPage';
import Checkout from './pages/Checkout';
import Orders from './pages/Orders';
import OrderDetail from './pages/OrderDetail';
import Account from './pages/Account';
import Support from './pages/Support';
import Policy, { POLICIES } from './pages/Policy';
import Login from './pages/Login';

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });

function CartStockSync() {
  const { data } = useStorefront();
  const { syncStock } = useCart();
  useEffect(() => {
    if (data) syncStock(Object.fromEntries(data.products.map((product) => [product.id, product.stock])));
  }, [data, syncStock]);
  return null;
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  useEffect(() => { if (!isLoading && !user) loginWithRedirect(); }, [isLoading, user]);
  if (isLoading || !user) return <div className="py-32 text-center text-muted-foreground">Loading…</div>;
  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <CartProvider>
        <CartStockSync />
        <BrowserRouter>
          <div className="min-h-screen flex flex-col">
            <ThemeColors />
            <Header />
            <main className="flex-1">
              <Routes>
                <Route path="/" element={<Shop />} />
                <Route path="/product/:id" element={<ProductPage />} />
                <Route path="/cart" element={<CartPage />} />
                <Route path="/checkout" element={<RequireAuth><Checkout /></RequireAuth>} />
                <Route path="/orders" element={<RequireAuth><Orders /></RequireAuth>} />
                <Route path="/account" element={<RequireAuth><Account /></RequireAuth>} />
                <Route path="/support" element={<Support />} />
                <Route path="/login" element={<Login />} />
                <Route path="/policies/:slug" element={<Policy />} />
                <Route path="/orders/:id" element={<RequireAuth><OrderDetail /></RequireAuth>} />
              </Routes>
            </main>
            <footer className="border-t py-8 text-center text-xs text-muted-foreground px-4 space-y-3">
              <nav className="flex flex-wrap justify-center gap-x-5 gap-y-2">
                {POLICIES.map((p) => <Link key={p.slug} to={`/policies/${p.slug}`} className="hover:text-foreground">{p.title}</Link>)}
                <Link to="/support" className="hover:text-foreground">Support</Link>
              </nav>
              <p>
              © {new Date().getFullYear()} PinLabs · All products are sold strictly for laboratory research use. Not for human consumption.</p>
            </footer>
          </div>
          <Toaster />
        </BrowserRouter>
      </CartProvider>
    </QueryClientProvider>
  );
}
