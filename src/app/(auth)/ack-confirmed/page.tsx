import Link from "next/link";
import { Card } from "@/components/ui/card";

const REASON_LABEL: Record<string, string> = {
  missing_token: "Link non valido: manca il token di conferma.",
  invalid_token: "Questo link di conferma non è valido o è scaduto.",
  not_found: "La procedura collegata a questo link non esiste più.",
  rate_limited: "Troppi tentativi in poco tempo. Riprova tra qualche minuto.",
};

/**
 * Public, unauthenticated landing page for the Read & Acknowledge quick-
 * confirm link (Fase 4) — reached by clicking "Conferma lettura" in Slack/
 * Google Chat/email. No session required: the signed token already did the
 * authorizing before redirecting here (see /api/acknowledgments/quick-confirm).
 */
export default function AckConfirmedPage({
  searchParams,
}: {
  searchParams: { status?: string; title?: string; reason?: string };
}) {
  const ok = searchParams.status === "ok";

  return (
    <Card className="w-full max-w-sm p-8 text-center">
      <div
        className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full text-2xl ${
          ok ? "bg-stamp-green/10 text-stamp-green" : "bg-destructive/10 text-destructive"
        }`}
      >
        {ok ? "✓" : "✕"}
      </div>
      {ok ? (
        <>
          <h1 className="font-display text-lg font-semibold">Lettura confermata</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Grazie — hai confermato di aver letto {searchParams.title ? <strong>&quot;{searchParams.title}&quot;</strong> : "la procedura"}.
          </p>
        </>
      ) : (
        <>
          <h1 className="font-display text-lg font-semibold">Non è stato possibile confermare</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {REASON_LABEL[searchParams.reason ?? ""] ?? "Si è verificato un errore imprevisto."}
          </p>
        </>
      )}
      <Link href="/dashboard" className="mt-5 inline-block text-sm text-primary hover:underline">
        Apri Procedure Hub
      </Link>
    </Card>
  );
}
