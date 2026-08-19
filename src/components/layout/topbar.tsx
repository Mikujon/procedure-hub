"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { Bell, LogOut, Settings, BellRing, Sun, Moon, Monitor } from "lucide-react";
import { CommandPalette } from "./command-palette";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const THEME_CYCLE = ["light", "dark", "system"] as const;
const THEME_ICON = { light: Sun, dark: Moon, system: Monitor };
const THEME_LABEL = { light: "Chiaro", dark: "Scuro", system: "Sistema" };

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const current = (theme as (typeof THEME_CYCLE)[number]) ?? "system";
  const Icon = THEME_ICON[current];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            const next = THEME_CYCLE[(THEME_CYCLE.indexOf(current) + 1) % THEME_CYCLE.length];
            setTheme(next);
          }}
        >
          {mounted ? <Icon className="h-5 w-5" /> : <span className="h-5 w-5" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>Tema: {THEME_LABEL[current]}</TooltipContent>
    </Tooltip>
  );
}

export function Topbar({ isAdmin = false }: { isAdmin?: boolean }) {
  const { data: session } = useSession();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let active = true;
    const load = () =>
      fetch("/api/notifications")
        .then((r) => r.json())
        .then((d) => active && setUnread(d.unreadCount ?? 0))
        .catch(() => {});
    load();
    const t = setInterval(load, 30000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, []);

  const initials = session?.user?.name?.slice(0, 2).toUpperCase() ?? "??";

  return (
    <header className="flex h-16 items-center justify-between gap-4 border-b border-border bg-background px-6">
      <CommandPalette />

      <div className="flex items-center gap-2">
        <ThemeToggle />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button asChild variant="ghost" size="icon" className="relative">
              <Link href="/notifications">
                <Bell className="h-5 w-5" />
                {unread > 0 && (
                  <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Notifiche</TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2.5 rounded-md p-1 pr-2 transition-colors hover:bg-muted">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground">{initials}</AvatarFallback>
              </Avatar>
              <div className="hidden text-left text-sm leading-tight sm:block">
                <p className="font-medium">{session?.user?.name}</p>
                <p className="text-xs text-muted-foreground">{session?.user?.email}</p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <p className="font-medium">{session?.user?.name}</p>
              <p className="text-xs font-normal text-muted-foreground">{session?.user?.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings/notifications">
                <BellRing className="h-4 w-4" /> Notifiche personali
              </Link>
            </DropdownMenuItem>
            {isAdmin && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/admin/settings">
                    <Settings className="h-4 w-4" /> Impostazioni
                  </Link>
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut()} className="text-destructive focus:text-destructive">
              <LogOut className="h-4 w-4" /> Esci
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
