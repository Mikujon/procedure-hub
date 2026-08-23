"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function LoginForm({ azureAdEnabled }: { azureAdEnabled: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tenantSlug, setTenantSlug] = useState("demo");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await signIn("credentials", { email, password, tenantSlug, redirect: false });
    setLoading(false);
    if (res?.error) {
      setError("Credenziali non valide.");
      return;
    }
    router.push("/dashboard");
  }

  return (
    <Card className="w-full max-w-sm p-8 opacity-0 animate-rise">
      <div className="mb-6 text-center opacity-0 animate-rise" style={{ animationDelay: "80ms" }}>
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-sm border-2 border-primary font-display text-sm font-bold text-primary">
          PH
        </div>
        <h1 className="font-display text-xl font-semibold">Procedure Hub</h1>
        <p className="mt-1 text-sm text-muted-foreground">Accedi al repository documentale della tua azienda</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 opacity-0 animate-rise" style={{ animationDelay: "150ms" }}>
        <div className="space-y-1.5">
          <Label htmlFor="tenantSlug" className="text-xs text-muted-foreground">Organizzazione</Label>
          <Input id="tenantSlug" value={tenantSlug} onChange={(e) => setTenantSlug(e.target.value)} placeholder="acme" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-xs text-muted-foreground">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nome@azienda.com"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-xs text-muted-foreground">Password</Label>
          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Accesso in corso…" : "Accedi"}
        </Button>
      </form>

      {azureAdEnabled ? (
        <>
          <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            oppure
            <div className="h-px flex-1 bg-border" />
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => signIn("azure-ad", { callbackUrl: "/dashboard" })}
          >
            Accedi con Microsoft
          </Button>
        </>
      ) : (
        <p className="mt-4 text-center text-xs text-muted-foreground">
          L&apos;accesso con Microsoft Entra ID sarà disponibile a breve.
        </p>
      )}
    </Card>
  );
}
