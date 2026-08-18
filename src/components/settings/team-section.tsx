"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, UserPlus } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { CreateUserDialog } from "@/components/settings/create-user-dialog";

interface TeamUser {
  id: string;
  name: string;
  email: string;
  globalRole: string;
  isActive: boolean;
}

interface Department {
  id: string;
  name: string;
}

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Amministratore",
  COMPLIANCE_OFFICER: "Compliance Officer",
  USER: "Utente",
};

/** Client half of the Team card in /admin/settings — read-only list plus the "Nuovo utente" entry point. */
export function TeamSection({ users, departments }: { users: TeamUser[]; departments: Department[] }) {
  const router = useRouter();
  const [showDialog, setShowDialog] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between border-b border-border px-5 py-1">
        <p className="text-xs text-muted-foreground">{users.length} membri</p>
        <button
          onClick={() => setShowDialog(true)}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/10"
        >
          <UserPlus className="h-3.5 w-3.5" /> Nuovo utente
        </button>
      </div>
      <table className="w-full text-sm">
        <tbody className="divide-y divide-border">
          {users.map((u) => (
            <tr key={u.id}>
              <td className="px-5 py-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary/10 text-primary">{u.name?.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{u.name}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </div>
                </div>
              </td>
              <td className="px-5 py-3 text-right">
                <Badge variant="secondary" className="rounded-full">
                  {u.globalRole === "ADMIN" && <ShieldCheck className="h-3 w-3" />}
                  {ROLE_LABEL[u.globalRole] ?? u.globalRole}
                </Badge>
              </td>
              <td className="px-5 py-3 text-right">
                <span className={`text-xs ${u.isActive ? "text-[hsl(var(--stamp-green))]" : "text-muted-foreground"}`}>
                  {u.isActive ? "Attivo" : "Disattivato"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showDialog && (
        <CreateUserDialog
          departments={departments}
          onClose={() => setShowDialog(false)}
          onCreated={() => router.refresh()}
        />
      )}
    </>
  );
}
