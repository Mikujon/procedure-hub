"use client";

import * as React from "react";
import { signIn } from "next-auth/react";
import { motion } from "framer-motion";
import {
  ScrollText,
  Mail,
  Lock,
  Loader2,
  ArrowRight,
  Building2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

const DEMO_ACCOUNTS = [
  { label: "Atelier Corp · HR Owner", email: "elena.marchetti@procedurehub.io", tenant: "Atelier Corp", color: "#be185d" },
  { label: "Atelier Corp · Admin", email: "marco.rossi@procedurehub.io", tenant: "Atelier Corp", color: "#0d9488" },
  { label: "Northwind · Warehouse Mgr", email: "nora.lindqvist@northwind.io", tenant: "Northwind Logistics", color: "#0891b2" },
  { label: "Northwind · Fleet Lead", email: "tomas.berg@northwind.io", tenant: "Northwind Logistics", color: "#ea580c" },
];
const PASSWORD = "password123";

export function LoginView() {
  const [email, setEmail] = React.useState(DEMO_ACCOUNTS[0].email);
  const [password, setPassword] = React.useState(PASSWORD);
  const [loading, setLoading] = React.useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    // redirect: true lets NextAuth own the full flow — it sets the session
    // cookie server-side and redirects back to "/", where useSession() picks
    // up the authenticated state cleanly. The manual redirect:false +
    // window.location.replace combo was causing a login-loop (useSession
    // didn't see the new cookie on the first render and bounced back to /).
    try {
      await signIn("credentials", {
        email,
        password,
        redirect: true,
        callbackUrl: "/",
      });
    } catch (err) {
      setLoading(false);
      toast.error("Sign in failed", { description: "Check your email and password." });
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      {/* ambient backdrop */}
      <div className="absolute inset-0 bg-grid opacity-40" aria-hidden />
      <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-primary/10 blur-3xl" aria-hidden />
      <div className="absolute -right-24 -bottom-24 h-96 w-96 rounded-full bg-primary/10 blur-3xl" aria-hidden />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative grid w-full max-w-4xl overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-lift)] lg:grid-cols-2"
      >
        {/* Left — brand / pitch */}
        <div className="relative hidden flex-col justify-between bg-gradient-to-br from-primary/10 via-card to-card p-8 lg:flex">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-[var(--shadow-soft)]">
              <ScrollText className="h-5 w-5" strokeWidth={2.2} />
            </div>
            <div>
              <p className="font-display text-lg font-medium leading-none">Procedure Hub</p>
              <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                Operational Workspace
              </p>
            </div>
          </div>

          <div className="space-y-5">
            <h2 className="font-display text-3xl font-medium leading-tight tracking-tight text-balance">
              The operational registry for your organization&apos;s procedures.
            </h2>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <Feature icon={<ShieldCheck className="h-4 w-4" />} text="Approval workflows with full audit trail" />
              <Feature icon={<Sparkles className="h-4 w-4" />} text="Read & Acknowledge with signed evidence" />
              <Feature icon={<Building2 className="h-4 w-4" />} text="Tenant isolation — every org sees only its own data" />
            </ul>
          </div>

          <p className="text-[11px] text-muted-foreground/70">
            ISO 27001 · GDPR · SOC 2 aligned
          </p>
        </div>

        {/* Right — form */}
        <div className="p-8 sm:p-10">
          <div className="mb-6 flex items-center gap-2.5 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ScrollText className="h-5 w-5" />
            </div>
            <p className="font-display text-base font-medium">Procedure Hub</p>
          </div>

          <h1 className="font-display text-2xl font-medium tracking-tight">Sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Welcome back. Enter your credentials to continue.
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-medium text-foreground">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
                  placeholder="you@company.io"
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-medium text-foreground">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:shadow-[var(--shadow-soft)] hover:brightness-105 disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Sign in
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Demo accounts */}
          <div className="mt-7 border-t border-border pt-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Demo accounts · password{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground">
                {PASSWORD}
              </code>
            </p>
            <div className="mt-3 grid gap-1.5">
              {DEMO_ACCOUNTS.map((a) => (
                <button
                  key={a.email}
                  type="button"
                  onClick={() => {
                    setEmail(a.email);
                    setPassword(PASSWORD);
                  }}
                  className="group flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2 text-left text-sm transition-colors hover:border-primary/40 hover:bg-muted/40"
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: a.color }}
                  />
                  <span className="min-w-0 flex-1 truncate">{a.label}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{a.tenant}</span>
                  {email === a.email && (
                    <span className="text-[10px] font-semibold text-primary">SELECTED</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function Feature({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <li className="flex items-center gap-3">
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
        {icon}
      </span>
      <span className="text-foreground/80">{text}</span>
    </li>
  );
}
