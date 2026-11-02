import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

// One site, two apps: everything under /admin is the admin panel, everything else is the shop.
const ShopApp = lazy(() => import('./shop/App'));
const AdminApp = lazy(() => import('./admin/App'));
const isAdmin = window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin/');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={null}>{isAdmin ? <AdminApp /> : <ShopApp />}</Suspense>
  </StrictMode>,
);
