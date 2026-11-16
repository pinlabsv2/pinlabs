import { BrowserRouter, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { CreditCard, FileText, FlaskConical, FolderTree, LayoutDashboard, LifeBuoy, Mail, Package, Palette, ShoppingCart, Tag, Truck } from 'lucide-react';
import { useAuth, loginWithRedirect, logout } from '@/lib/auth';
import { manageSettings } from '@/lib/api';
import { Toaster } from '@/ui-kit/ui/sonner';
import { cn } from '@/ui-kit/lib/utils';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import Products from './pages/Products';
import Categories from './pages/Categories';
import Support from './pages/Support';
import Payment from './pages/Payment';
import Email from './pages/Email';
import Policies from './pages/Policies';
import BrandName from './pages/BrandName';
import Promotions from './pages/Promotions';
import ShippingOptions from './pages/ShippingOptions';

const qc = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } } });
const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/orders', label: 'Orders', icon: ShoppingCart },
  { to: '/products', label: 'Products', icon: Package },
  { to: '/categories', label: 'Categories', icon: FolderTree },
  { to: '/shipping-options', label: 'Shipping Options', icon: Truck },
  { to: '/promotions', label: 'Promotions', icon: Tag },
  { to: '/support', label: 'Support contacts', icon: LifeBuoy },
  { to: '/payment', label: 'Payment', icon: CreditCard },
  { to: '/email', label: 'Email', icon: Mail },
  { to: '/policies', label: 'Policies', icon: FileText },
  { to: '/brand-name', label: 'Brand Name', icon: Palette },
];

function Shell() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const { data: brand } = useQuery({ queryKey: ['settings', 'brand'], queryFn: () => manageSettings({ section: 'brand' }) });
  const storeName = brand?.section === 'brand' ? brand.settings.storeName : 'PinLabs';
  const title = NAV.find((item) => item.to === pathname)?.label ?? 'Dashboard';
  return <div className="min-h-screen flex flex-col md:flex-row">
    <aside className="md:w-60 bg-sidebar text-sidebar-foreground md:min-h-screen flex md:flex-col">
      <div className="hidden md:flex items-center gap-2 px-5 h-16 font-bold"><span className="grid place-items-center size-8 bg-sidebar-primary text-sidebar-primary-foreground"><FlaskConical className="size-4" /></span><span className="truncate">{storeName} admin</span></div>
      <nav className="flex md:flex-col gap-1 p-2 overflow-x-auto flex-1">
        {NAV.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end className={({ isActive }) => cn('flex items-center gap-2.5 px-3 py-2 text-sm whitespace-nowrap transition', isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'opacity-75 hover:opacity-100 hover:bg-sidebar-accent/60')}><Icon className="size-4" />{label}</NavLink>)}
      </nav>
      <div className="hidden md:block px-5 py-4 text-xs space-y-1"><p className="opacity-60 truncate">{user?.email}</p><a href="/" className="block opacity-75 hover:opacity-100">View shop ↗</a><button onClick={() => logout()} className="opacity-75 hover:opacity-100">Sign out</button></div>
    </aside>
    <main className="flex-1 min-w-0 p-4 md:p-8"><h1 className="text-2xl font-bold tracking-tight mb-6">{title}</h1><Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/orders" element={<Orders />} />
      <Route path="/products" element={<Products />} />
      <Route path="/categories" element={<Categories />} />
      <Route path="/shipping-options" element={<ShippingOptions />} />
      <Route path="/promotions" element={<Promotions />} />
      <Route path="/support" element={<Support />} />
      <Route path="/payment" element={<Payment />} />
      <Route path="/email" element={<Email />} />
      <Route path="/policies" element={<Policies />} />
      <Route path="/brand-name" element={<BrandName />} />
      <Route path="/discounts" element={<Navigate replace to="/promotions" />} />
      <Route path="/settings" element={<Navigate replace to="/brand-name" />} />
    </Routes></main>
  </div>;
}

export default function App() {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (!user) { loginWithRedirect({ redirectUrl: window.location.pathname }); return null; }
  if (user.role !== 'admin') return <div className="min-h-screen grid place-items-center p-6 text-center"><div><h1 className="text-2xl font-bold mb-2">Admins only</h1><p className="text-muted-foreground mb-4">You're signed in as {user.email}, which isn't an admin account.</p><a href="/" className="underline">Back to shop</a> · <button className="underline" onClick={() => logout()}>Sign out</button></div></div>;
  return <QueryClientProvider client={qc}><BrowserRouter basename="/admin"><Shell /><Toaster /></BrowserRouter></QueryClientProvider>;
}
