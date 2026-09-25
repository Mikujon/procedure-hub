"use client";

import * as React from "react";
import {
  Search,
  Bell,
  Sun,
  Moon,
  Monitor,
  Menu,
  ChevronLeft,
  Command,
} from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import { useBootstrap, useNotifications, useMarkNotificationRead } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatRelative } from "@/lib/domain";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Building2 } from "lucide-react";

const VIEW_TITLES: Record<string, string> = {
  dashboard: "Dashboard",
  library: "Procedure Library",
  procedure: "Procedure",
  approvals: "Approvals Queue",
  admin: "Admin Console",
  favorites: "Favorites",
};

export function Topbar() {
  const { view, setCommandOpen, setMobileNavOpen, goHome } = useAppStore();
  const { data: notifData } = useNotifications();
  const { data: boot } = useBootstrap();
  const tenant = boot?.tenant;
  const unread = (notifData ?? []).filter((n: any) => !n.read).length;

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden -ml-2"
        onClick={() => setMobileNavOpen(true)}
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <div className="flex items-center gap-2 min-w-0">
        {view === "procedure" && (
          <Button
            variant="ghost"
            size="icon"
            className="-ml-2 hidden sm:inline-flex"
            onClick={goHome}
            aria-label="Back"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        )}
        <h1 className="font-display text-lg font-medium tracking-tight truncate">
          {VIEW_TITLES[view] ?? "Procedure Hub"}
        </h1>

        {tenant && (
          <span className="hidden md:inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
            <Building2 className="h-3 w-3" />
            {tenant.name}
          </span>
        )}
      </div>

      <div className="flex-1" />

      {/* Search trigger */}
      <button
        onClick={() => setCommandOpen(true)}
        className="group hidden md:flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-sm text-foreground/60 transition-colors hover:border-primary/40 hover:bg-muted/70 hover:text-foreground w-56 lg:w-72"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Search procedures…</span>
        <kbd className="inline-flex h-5 items-center gap-0.5 rounded border border-border bg-background px-1 text-[10px] font-medium text-muted-foreground">
          <Command className="h-3 w-3" />K
        </kbd>
      </button>
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={() => setCommandOpen(true)}
        aria-label="Search"
      >
        <Search className="h-5 w-5" />
      </Button>

      <NotificationsButton unread={unread} />

      <ThemeToggle />
    </header>
  );
}

function NotificationsButton({ unread }: { unread: number }) {
  const { data } = useNotifications();
  const markRead = useMarkNotificationRead();
  const { openProcedure, setNotificationsOpen } = useAppStore();
  const notifications = data ?? [];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Notifications"
        >
          <Bell className="h-[18px] w-[18px]" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground ring-2 ring-background">
              {unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[360px] p-0"
        sideOffset={8}
      >
        <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
          <p className="text-sm font-semibold">Notifications</p>
          {unread > 0 && (
            <span className="text-[11px] text-muted-foreground">{unread} unread</span>
          )}
        </div>
        <ScrollArea className="max-h-[360px]">
          <div className="divide-y divide-border">
            {notifications.length === 0 && (
              <div className="py-10 text-center text-sm text-muted-foreground">
                You&apos;re all caught up.
              </div>
            )}
            {notifications.map((n: any) => (
              <button
                key={n.id}
                onClick={() => {
                  if (!n.read) markRead.mutate(n.id);
                  if (n.procedureId) openProcedure(n.procedureId);
                }}
                className={cn(
                  "flex w-full flex-col gap-1 px-3 py-2.5 text-left transition-colors hover:bg-muted/50",
                  !n.read && "bg-primary/[0.03]"
                )}
              >
                <div className="flex items-start gap-2">
                  {!n.read && (
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground leading-snug">
                      {n.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                      {n.body}
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground/70">
                      {formatRelative(n.createdAt)}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const current = mounted ? theme : "system";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Toggle theme"
        >
          {current === "dark" ? (
            <Moon className="h-[18px] w-[18px]" />
          ) : current === "light" ? (
            <Sun className="h-[18px] w-[18px]" />
          ) : (
            <Monitor className="h-[18px] w-[18px]" />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        {(["light", "dark", "system"] as const).map((t) => (
          <DropdownMenuItem
            key={t}
            onClick={() => setTheme(t)}
            className="flex items-center gap-2 capitalize"
          >
            {t === "light" && <Sun className="h-4 w-4" />}
            {t === "dark" && <Moon className="h-4 w-4" />}
            {t === "system" && <Monitor className="h-4 w-4" />}
            {t}
            {current === t && <span className="ml-auto text-primary">●</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

