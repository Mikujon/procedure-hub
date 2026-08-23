"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function ChangePasswordForm({ mustChange }: { mustChange: boolean }) {
  const { update } = useSession();
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("Le due password non coincidono.");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/me/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Impossibile cambiare la password.");
      return;
    }
    await update({ mustChangePassword: false });
    router.push("/dashboard");
  }

  return (
    <Card className="w-full max-w-sm p-8 opacity-0 animate-rise">
      <div className="mb-6 text-center opacity-0 animate-rise" style={{ animationDelay: "80ms" }}>
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-sm border-2 border-primary font-display text-sm font-bold text-primary">
          PH
        </div>
        <h1 className="font-display text-xl font-semibold">
          {mustChange ? "Imposta la tua password" : "Cambia password"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mustChange
            ? "Il tuo account è stato creato con una password temporanea: scegline una nuova per continuare."
            : "Aggiorna la password del tuo account."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 opacity-0 animate-rise" style={{ animationDelay: "150ms" }}>
        <div className="space-y-1.5">
          <Label htmlFor="currentPassword" className="text-xs text-muted-foreground">
            {mustChange ? "Password temporanea" : "Password attuale"}
          </Label>
          <Input
            id="currentPassword"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="newPassword" className="text-xs text-muted-foreground">
            Nuova password
          </Label>
          <Input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword" className="text-xs text-muted-foreground">
            Conferma nuova password
          </Label>
          <Input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Salvataggio…" : "Salva nuova password"}
        </Button>
      </form>
    </Card>
  );
}
