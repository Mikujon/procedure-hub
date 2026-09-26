"use client";

import * as React from "react";
import {
  LayoutDashboard,
  BookOpen,
  ShieldCheck,
  Scale,
  Megaphone,
  Eye,
  ScrollText,
  LogOut,
  ChevronRight,
  Settings2,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import { useBootstrap } from "@/lib/hooks";
import { UserAvatar } from "@/components/shared/user-avatar";
import { roleLabel, can } from "@/lib/domain";
import type { ViewKey } from "@/lib/types";

interface NavItem {
  key: ViewKey;
  label: string;
  icon: React.ReactNode;
  roles?: string[]; // if set, only show for these roles
}

export function Sidebar() {
  const { view, setView, openDocument } = useAppStore();
  const { data } = useBootstrap();
  const user = data?.user;
  const role = user?.role ?? "VIEWER";

  const items: NavItem[] = [
    { key: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
    { key: "b7", label: "Le mie procedure", icon: <BookOpen className="h-4 w-4" /> },
    { key: "compliance", label: "Coda Compliance", icon: <ShieldCheck className="h-4 w-4" />, roles: ["COMPLIANCE", "ADMIN"] },
    { key: "hr8", label: "Comunicazioni (HR-8)", icon: <Megaphone className="h-4 w-4" />, roles: ["HR_HEAD", "ADMIN"] },
    { key: "lg2", label: "Policy e versioni (LG-2)", icon: <Scale className="h-4 w-4" />, roles: ["LEGAL_HEAD", "ADMIN"] },
    { key: "lg4", label: "Prese visione (LG-4)", icon: <Eye className="h-4 w-4" />, roles: ["LEGAL_HEAD", "LEGAL_MANAGER", "ADMIN"] },
    { key: "admin", label: "Admin Console", icon: <Settings2 className="h-4 w-4" />, roles: ["ADMIN"] },
  ];

  const visibleItems = items.filter((i) => !i.roles || i.roles.includes(role));

  return (
    <aside className="flex h-full w-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center gap-2.5 px-4 border-b border-sidebar-border shrink-0">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-[var(--shadow-soft)]">
          <ScrollText className="h-5 w-5" strokeWidth={2.2} />
        </div>
        <div className="min-w-0">
          <p className="font-display text-[15px] font-medium leading-none tracking-tight">Procedure Hub</p>
          <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">Knowledge Base</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5 py-3">
        <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          Workspace
        </p>
        <ul className="space-y-0.5">
          {visibleItems.map((item) => {
            const active = view === item.key;
            return (
              <li key={item.key}>
                <button
                  onClick={() => setView(item.key)}
                  className={cn(
                    "group relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                  )}
                >
                  {active && (
                    <span aria-hidden className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-full bg-primary" />
                  )}
                  <span className={cn(active ? "text-primary" : "text-muted-foreground group-hover:text-sidebar-foreground")}>
                    {item.icon}
                  </span>
                  <span className="flex-1 text-left">{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {user && (
        <div className="border-t border-sidebar-border p-2.5 shrink-0">
          <div className="flex items-center gap-2.5 rounded-lg p-2">
            <UserAvatar name={user.name} color={user.avatarColor} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-sidebar-foreground truncate leading-tight">{user.name}</p>
              <p className="text-[11px] text-muted-foreground truncate">{roleLabel(role)}</p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              title="Sign out"
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
