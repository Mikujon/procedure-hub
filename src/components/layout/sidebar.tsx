"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FolderTree, Star, Bell, ShieldCheck, Settings, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageTree } from "./page-tree";

interface Department {
  id: string;
  name: string;
  slug: string;
  icon?: string | null;
}

export function Sidebar({
  departments,
  isAdmin,
  canEditWorkspace = false,
}: {
  departments: Department[];
  isAdmin: boolean;
  canEditWorkspace?: boolean;
}) {
  const pathname = usePathname();

  const primaryLinks = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/ask", label: "Chiedi", icon: Sparkles },
    { href: "/favorites", label: "Preferiti", icon: Star },
    { href: "/notifications", label: "Notifiche", icon: Bell },
  ];

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-border bg-muted/40">
      <div className="flex h-16 items-center gap-2.5 px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary font-display text-xs font-bold text-primary-foreground">
          PH
        </div>
        <span className="font-display text-[15px] font-semibold tracking-tight">Procedure Hub</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-0.5">
          {primaryLinks.map((link) => (
            <SidebarLink key={link.href} {...link} active={pathname === link.href} />
          ))}
        </div>

        <PageTree canEdit={canEditWorkspace} />

        <div className="mt-6">
          <p className="px-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Dipartimenti
          </p>
          <div className="mt-2 space-y-0.5">
            {departments.map((dept) => (
              <Link
                key={dept.id}
                href={`/departments/${dept.slug}`}
                className={cn(
                  "flex items-center gap-2.5 rounded-sm px-3 py-2 text-sm transition-colors",
                  pathname === `/departments/${dept.slug}`
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <FolderTree className="h-4 w-4 shrink-0" />
                <span className="truncate">{dept.name}</span>
              </Link>
            ))}
          </div>
        </div>
      </nav>

      {isAdmin && (
        <div className="border-t border-border px-3 py-3">
          <SidebarLink href="/admin" label="Amministrazione" icon={ShieldCheck} active={pathname.startsWith("/admin")} />
          <SidebarLink href="/admin/settings" label="Impostazioni" icon={Settings} active={pathname === "/admin/settings"} />
        </div>
      )}
    </aside>
  );
}

function SidebarLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 rounded-sm px-3 py-2 text-sm transition-colors",
        active ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </Link>
  );
}
