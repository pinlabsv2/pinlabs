import { Link, NavLink } from 'react-router-dom';
import { FlaskConical, ShoppingBag, User, LogOut, Package, Settings, LifeBuoy, LayoutDashboard } from 'lucide-react';
import { useAuth, loginWithRedirect, logout } from '@/lib/auth';
import { Button } from '@/ui-kit/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/ui-kit/ui/dropdown-menu';
import { useCart } from '../lib/cart';
import PromoBanner from './PromoBanner';

export default function Header() {
  const { user } = useAuth();
  const { count } = useCart();
  return (
    <header className="sticky top-0 z-40 bg-background/85 backdrop-blur border-b">
      <PromoBanner />
      <div className="container mx-auto px-4 h-16 flex items-center gap-6">
        <Link to="/" className="flex items-center gap-2 font-bold text-lg tracking-tight">
          <span className="grid place-items-center size-8 rounded-lg bg-primary text-primary-foreground">
            <FlaskConical className="size-4" />
          </span>
          pinlabs
        </Link>
        <nav className="hidden sm:flex gap-5 text-sm text-muted-foreground">
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'text-foreground font-medium' : 'hover:text-foreground')}>Shop</NavLink>
          <NavLink to="/support" className={({ isActive }) => (isActive ? 'text-foreground font-medium' : 'hover:text-foreground')}>Support</NavLink>
          {user && <NavLink to="/orders" className={({ isActive }) => (isActive ? 'text-foreground font-medium' : 'hover:text-foreground')}>My orders</NavLink>}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2"><User className="size-4" /><span className="hidden sm:inline max-w-32 truncate">{user.firstName || user.email}</span></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild><Link to="/orders"><Package className="size-4 mr-2" />My orders</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link to="/account"><Settings className="size-4 mr-2" />Account settings</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link to="/support"><LifeBuoy className="size-4 mr-2" />Support</Link></DropdownMenuItem>
                {user.role === 'admin' && <DropdownMenuItem asChild><a href="/admin"><LayoutDashboard className="size-4 mr-2" />Admin panel</a></DropdownMenuItem>}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => logout()}><LogOut className="size-4 mr-2" />Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => loginWithRedirect()}>Sign in</Button>
          )}
          <Button asChild size="sm" className="gap-2 relative">
            <Link to="/cart"><ShoppingBag className="size-4" />Cart
              {count > 0 && <span className="ml-1 rounded-full bg-primary-foreground text-primary text-xs px-1.5 font-mono">{count}</span>}
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
