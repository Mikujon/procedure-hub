import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AdminDashboard } from "@/components/admin/admin-dashboard";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  const globalRole = (session?.user as any)?.globalRole as string | undefined;

  // Matches /api/admin/kpi's own check exactly (ADMIN or COMPLIANCE_OFFICER) —
  // this page used to have no server-side gate at all, so a signed-in
  // non-admin landing here directly got a client-side crash instead of a
  // redirect: the KPI fetch came back {error: "Forbidden"} and the page
  // read .upcomingReviews.length off of it. Added after that crash surfaced.
  if (!session?.user || (globalRole !== "ADMIN" && globalRole !== "COMPLIANCE_OFFICER")) {
    redirect("/dashboard");
  }

  return <AdminDashboard />;
}
