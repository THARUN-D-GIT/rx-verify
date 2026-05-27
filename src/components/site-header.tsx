import { Link, useNavigate } from "@tanstack/react-router";
import { Pill, LogOut, LayoutDashboard, ShieldCheck, Search, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export function SiteHeader() {
  const { user, isAdmin, isPharmacy, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-hero text-primary-foreground shadow-card">
            <Pill className="h-5 w-5" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-base font-semibold tracking-tight">MediVerify</span>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Trust your medicine</span>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <Button asChild variant="ghost" size="sm">
            <Link to="/search"><Search className="mr-2 h-4 w-4" />Search</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/verify"><QrCode className="mr-2 h-4 w-4" />Verify</Link>
          </Button>
          {isPharmacy && (
            <Button asChild variant="ghost" size="sm">
              <Link to="/pharmacy"><LayoutDashboard className="mr-2 h-4 w-4" />Pharmacy</Link>
            </Button>
          )}
          {isAdmin && (
            <Button asChild variant="ghost" size="sm">
              <Link to="/admin"><ShieldCheck className="mr-2 h-4 w-4" />Admin</Link>
            </Button>
          )}
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <Button variant="outline" size="sm" onClick={async () => { await signOut(); navigate({ to: "/" }); }}>
              <LogOut className="mr-2 h-4 w-4" />Sign out
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm"><Link to="/login">Sign in</Link></Button>
              <Button asChild size="sm"><Link to="/login">Get started</Link></Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
