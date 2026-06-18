import Link from "next/link";
import { CircleDot, Database } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { dashboardNavItems } from "@/lib/navigation";
import { getServerConfig } from "@/server/config";

export function AppShell({ children }: { children: React.ReactNode }) {
  const config = getServerConfig();

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r bg-card/95 px-4 py-5 shadow-sm backdrop-blur lg:flex lg:flex-col">
        <Link href="/overview" className="flex items-center gap-3 px-2">
          <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <CircleDot aria-hidden="true" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">Lore Web</span>
            <span className="text-xs text-muted-foreground">Management dashboard</span>
          </div>
        </Link>

        <nav aria-label="Dashboard" className="mt-8 flex flex-col gap-1">
          {dashboardNavItems.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground"
              >
                <Icon aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto rounded-lg border bg-background p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">Target</span>
            <Badge variant="outline">{config.grpcTls}</Badge>
          </div>
          <p className="mt-2 truncate text-sm font-medium">{config.grpcTarget}</p>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
          <div className="flex min-h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 flex-col">
              <span className="text-xs font-medium uppercase text-muted-foreground">
                Lore server
              </span>
              <span className="truncate text-sm font-semibold">{config.grpcTarget}</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{config.authMode}</Badge>
              <Button asChild variant="outline" size="sm">
                <Link href="/repositories">
                  <Database aria-hidden="true" />
                  Repositories
                </Link>
              </Button>
            </div>
          </div>
          <nav
            aria-label="Mobile dashboard"
            className="flex gap-1 overflow-x-auto border-t px-4 py-2 sm:px-6 lg:hidden"
          >
            {dashboardNavItems.map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                >
                  <Icon aria-hidden="true" className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
