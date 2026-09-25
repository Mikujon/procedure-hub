"use client";

import * as React from "react";
import {
  LayoutDashboard,
  Library,
  CheckCircle2,
  Star,
  ShieldCheck,
  ScrollText,
  LogOut,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import { useBootstrap } from "@/lib/hooks";
import { DynamicIcon } from "@/components/shared/dynamic-icon";
import { UserAvatar } from "@/components/shared/user-avatar";
import { ROLE_LABELS } from "@/lib/domain";
import type { ViewKey } from "@/lib/types";

interface NavItem {
  key: ViewKey;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

export function Sidebar() {
  const { view, setView, setDepartmentFilter, departmentFilter } = useAppStore();
  const { data } = useBootstrap();

  const stats = data?.stats;
  const items: NavItem[] = [
    { key: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
    { key: "library", label: "Library", icon: <Library className="h-4 w-4" /> },
    {
      key: "approvals",
      label: "Approvals",
      icon: <CheckCircle2 className="h-4 w-4" />,
      badge: stats?.pendingReviews ?? 0,
    },
    { key: "favorites", label: "Favorites", icon: <Star className="h-4 w-4" /> },
    { key: "admin", label: "Admin", icon: <ShieldCheck className="h-4 w-4" /> },
  ];

  const user = data?.user;
  const departments = data?.departments ?? [];

  return (
    <aside className="flex h-full w-full flex-col bg-sidebar text-sidebar-foreground">
      {/* Brand */}
      <div className="flex h-16 items-center gap-2.5 px-4 border-b border-sidebar-border shrink-0">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-[var(--shadow-soft)]">
          <ScrollText className="h-5 w-5" strokeWidth={2.2} />
        </div>
        <div className="min-w-0">
          <p className="font-display text-[15px] font-medium leading-none tracking-tight">
            Procedure Hub
          </p>
          <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            Operational Workspace
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-3">
        <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          Workspace
        </p>
        <ul className="space-y-0.5">
          {items.map((item) => {
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
                    <span
                      aria-hidden
                      className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-full bg-primary"
                    />
                  )}
                  <span className={cn(active ? "text-primary" : "text-muted-foreground group-hover:text-sidebar-foreground")}>
                    {item.icon}
                  </span>
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.badge ? (
                    <span
                      className={cn(
                        "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
                        active
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>

        {/* Departments */}
        <p className="px-2 pt-5 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          Departments
        </p>
        <ul className="space-y-0.5">
          {departments.map((d: any) => {
            const active = view === "library" && departmentFilter === d.id;
            return (
              <li key={d.id}>
                <button
                  onClick={() => {
                    setDepartmentFilter(d.id);
                    setView("library");
                  }}
                  className="group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground transition-colors"
                >
                  <DynamicIcon
                    name={d.icon}
                    className="h-4 w-4 shrink-0"
                    style={{ color: d.color }}
                  />
                  <span className="flex-1 text-left truncate">{d.name}</span>
                  <span className="text-[11px] tabular-nums text-muted-foreground/70">
                    {d.procedureCount}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User card */}
      {user && (
        <div className="border-t border-sidebar-border p-2.5 shrink-0">
          <div className="flex items-center gap-2.5 rounded-lg p-2">
            <UserAvatar name={user.name} color={user.avatarColor} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-sidebar-foreground truncate leading-tight">
                {user.name}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">
                {ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] ?? user.role}
              </p>
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
