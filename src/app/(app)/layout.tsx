import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditWorkspace } from "@/lib/permissions";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const userId = (session.user as any).id as string;
  const tenantId = (session.user as any).tenantId as string;
  const globalRole = (session.user as any).globalRole as string;

  const [departments, canEdit] = await Promise.all([
    prisma.department.findMany({
      where: { tenantId },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, slug: true, icon: true },
    }),
    canEditWorkspace({ id: userId, tenantId, globalRole: globalRole as any }),
  ]);

  return (
    <div className="flex h-screen">
      <Sidebar departments={departments} isAdmin={globalRole === "ADMIN"} canEditWorkspace={canEdit} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar isAdmin={globalRole === "ADMIN"} />
        <main className="flex-1 overflow-y-auto bg-background px-8 py-6">{children}</main>
      </div>
    </div>
  );
}
