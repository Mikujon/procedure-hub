import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSlackOAuthConfigured } from "@/lib/integrations/slack-oauth";
import { SlackConnectionCard } from "@/components/settings/slack-connection-card";
import { SlackOAuthStatusToast } from "@/components/settings/slack-oauth-status-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/**
 * Personal notification settings — distinct from /admin/settings (tenant-
 * wide config, admin-only). Every user lands here to link their own Slack
 * identity (CLAUDE.md roadmap: OAuth Slack App). Google Chat has no
 * self-service equivalent: GoogleChatUserIdentity is populated by an admin
 * via Workspace directory lookup (domain-wide delegation), not per-user
 * consent — shown read-only below, see lib/integrations/gchat.ts.
 */
export default async function NotificationSettingsPage({
  searchParams,
}: {
  searchParams: { slack?: string; reason?: string };
}) {
  const session = await getServerSession(authOptions);
  const userId = (session!.user as any).id as string;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { slackIdentity: true, gchatIdentity: true },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <SlackOAuthStatusToast status={searchParams.slack} reason={searchParams.reason} />

      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Notifiche</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Collega i tuoi account per ricevere promemoria e richieste di approvazione fuori dall&apos;app.
        </p>
      </div>

      <SlackConnectionCard
        connected={Boolean(user?.slackIdentity)}
        teamId={user?.slackIdentity?.slackTeamId}
        configured={isSlackOAuthConfigured()}
      />

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-sm">Google Chat</CardTitle>
            <CardDescription>Gestito dall&apos;amministratore tramite la directory Google Workspace.</CardDescription>
          </div>
          {user?.gchatIdentity && <Badge variant="secondary">Collegato</Badge>}
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {user?.gchatIdentity
              ? "Il tuo account Google Workspace è collegato — riceverai le notifiche configurate come DM."
              : "Non ancora collegato. Contatta l'amministratore se ti aspetti notifiche via Google Chat."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
