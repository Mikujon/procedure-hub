import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { syncProcedureToSharePoint } from "@/lib/sharepoint-sync";

const ERROR_BY_STATUS: Record<string, { message: string; httpStatus: number }> = {
  not_found: { message: "Not found", httpStatus: 404 },
  forbidden: { message: "Forbidden", httpStatus: 403 },
  no_content: { message: "La procedura deve essere pubblicata prima di poter essere sincronizzata.", httpStatus: 400 },
  not_configured: {
    message: "Integrazione SharePoint non configurata o disabilitata per questo tenant.",
    httpStatus: 503,
  },
};

/** Manual "Sincronizza su SharePoint" action — see lib/sharepoint-sync.ts for the actual logic; this route is just the session/response glue. */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id as string;
  const tenantId = (session.user as any).tenantId as string;
  const globalRole = (session.user as any).globalRole;

  try {
    const result = await syncProcedureToSharePoint({ id: userId, tenantId, globalRole }, params.id);

    if (result.status !== "ok") {
      const { message, httpStatus } = ERROR_BY_STATUS[result.status];
      return NextResponse.json({ error: message }, { status: httpStatus });
    }

    return NextResponse.json({ webUrl: result.webUrl });
  } catch (err) {
    // syncProcedureToSharePoint deliberately lets a Graph API failure
    // (bad credentials, network error, non-2xx upload response) propagate
    // rather than swallowing it — same "the call IS the action, its
    // failure must be visible" reasoning as executeSendWebhook
    // (lib/automations/actions.ts). Unlike that action, there's no
    // AutomationRun.error to land in here: this is a direct user click, so
    // the route itself is the boundary that turns the exception into a
    // clean response the button's toast can show, instead of an unhandled
    // 500 with no message.
    console.error(`[sharepoint-sync] failed for procedure ${params.id}`, err);
    return NextResponse.json(
      { error: `Sincronizzazione con SharePoint non riuscita: ${err instanceof Error ? err.message : "errore sconosciuto"}` },
      { status: 502 }
    );
  }
}
