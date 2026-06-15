import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Target, LogOut } from "lucide-react";

interface AppHeaderProps {
  userEmail?: string;
}

export function AppHeader({ userEmail }: AppHeaderProps) {
  return (
    <header className="border-b bg-white no-print">
      <div className="container mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
          <Target className="h-5 w-5 text-primary" />
          <span>Scout</span>
        </Link>
        <nav className="flex items-center gap-4">
          <Link
            href="/opponents"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Opponents
          </Link>
          {userEmail && (
            <span className="text-xs text-muted-foreground hidden sm:inline">
              {userEmail}
            </span>
          )}
          <form action="/api/auth/signout" method="POST">
            <Button variant="ghost" size="sm" type="submit">
              <LogOut className="h-4 w-4" />
            </Button>
          </form>
        </nav>
      </div>
    </header>
  );
}
