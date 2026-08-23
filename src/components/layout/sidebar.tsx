"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FolderTree, ChevronRight, Star, Bell, ShieldCheck, Settings, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageTree } from "./page-tree";
import { DepartmentTree } from "./department-tree";

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
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());
  const [revealTarget, setRevealTarget] = useState<{ departmentId: string; procedureId: string } | null>(null);

  function toggleDept(id: string) {
    setExpandedDepts((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // "Always know where you are" (like GitHub/VS Code auto-expanding the
  // file explorer to the open file): whenever the route lands on a
  // procedure or department that wasn't reached by clicking this tree
  // itself (search, breadcrumb, a notification, a direct link), open the
  // right branch automatically instead of leaving the sidebar wherever the
  // user last left it. Additive only — never collapses a department the
  // user expanded by hand.
  useEffect(() => {
    const procMatch = pathname.match(/^\/procedures\/([^/]+)/);
    if (procMatch) {
      const procedureId = procMatch[1];
      fetch(`/api/procedures/${procedureId}/location`)
        .then((r) => (r.ok ? r.json() : null))
        .then((loc) => {
          if (!loc) return;
          setExpandedDepts((s) => new Set(s).add(loc.departmentId));
          setRevealTarget({ departmentId: loc.departmentId, procedureId });
        })
        .catch(() => {});
      return;
    }
    const deptMatch = pathname.match(/^\/departments\/([^/]+)/);
    if (deptMatch) {
      const dept = departments.find((d) => d.slug === deptMatch[1]);
      if (dept) setExpandedDepts((s) => new Set(s).add(dept.id));
    }
  }, [pathname, departments]);

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
            {departments.map((dept) => {
              const isOpen = expandedDepts.has(dept.id);
              const active = pathname === `/departments/${dept.slug}`;
              return (
                <div key={dept.id}>
                  <div
                    className={cn(
                      "group flex items-center gap-1 rounded-sm pr-1 text-sm transition-colors",
                      active ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <button
                      onClick={() => toggleDept(dept.id)}
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-border/60"
                      title="Espandi"
                    >
                      <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-90")} />
                    </button>
                    <Link href={`/departments/${dept.slug}`} className="flex min-w-0 flex-1 items-center gap-2.5 py-1.5">
                      <FolderTree className="h-4 w-4 shrink-0" />
                      <span className="truncate">{dept.name}</span>
                    </Link>
                  </div>
                  {/* Mounted only once expanded — mount-on-demand is the lazy-load, no fetch for a department the user never opens. */}
                  {isOpen && (
                    <DepartmentTree
                      departmentId={dept.id}
                      variant="sidebar"
                      baseDepth={1}
                      revealProcedureId={revealTarget?.departmentId === dept.id ? revealTarget.procedureId : undefined}
                    />
                  )}
                </div>
              );
            })}
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
