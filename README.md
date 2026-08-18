# Procedure Hub

Piattaforma interna multi-tenant di **Procedure Management** — repository
centralizzato della documentazione aziendale (procedure, policy, work
instruction, SOP, template, FAQ), ispirata a Notion ma su misura per i
processi di compliance, approvazione e audit trail richiesti da un'azienda
strutturata su più dipartimenti.

Costruita per ~200 utenti, con notifiche verso Slack e Google Chat.

👉 Prima di modificare o estendere il progetto, leggi **`docs/ARCHITECTURE.md`**
— spiega le scelte fatte e cosa manca ancora.

## Funzionalità incluse in questo scaffold

- Multi-tenant (isolamento dati per azienda, subdomain-based)
- Dashboard con ricerca globale, recenti, preferiti, annunci, scadenze
- Struttura per dipartimenti (HR, Operations, IT, Legal & Compliance, Finance, WFM, ecc.)
- Gerarchia Dipartimento → Processo → Procedura → Work Instruction
- Editor ricco stile Notion (testo, immagini, tabelle, checklist, video)
- Versioning completo con storico e changelog
- Workflow di approvazione: Draft → Review → Compliance Approval → Management Approval → Published → Archived
- Ruoli e permessi (globali + per dipartimento)
- Ricerca full-text con filtri (MeiliSearch)
- Notifiche in-app + Slack + Google Chat
- Audit trail completo
- Read & Acknowledge con storico conferme
- Dashboard amministrativa con KPI
- Tag, categorie, template

## Requisiti

- Node.js ≥ 18.18
- Docker (per Postgres + MeiliSearch in locale) oppure istanze già disponibili
- npm

## Avvio rapido

```bash
# 1. Installa le dipendenze
npm install

# 2. Copia le variabili d'ambiente e compila DATABASE_URL / NEXTAUTH_SECRET
cp .env.example .env
openssl rand -base64 32   # usa l'output per NEXTAUTH_SECRET

# 3. Avvia Postgres e MeiliSearch in locale
docker compose up -d

# 4. Applica lo schema e popola dati demo
npm run db:migrate
npm run db:seed

# 5. Avvia il server di sviluppo
npm run dev
```

Apri `http://localhost:3000?tenant=demo` e accedi con una delle utenze
create dal seed (vedi output di `npm run db:seed` per email e password).

## Struttura del progetto

```
src/
  app/
    (auth)/login/          pagina di accesso
    (app)/                 area autenticata (sidebar + topbar)
      dashboard/
      departments/[slug]/
      procedures/[id]/     dettaglio + edit
      admin/                dashboard KPI
    api/                    route handler (procedures, workflow, ack, search, admin, notifiche)
  components/
    editor/                 editor Tiptap
    procedures/              status stamp, workflow panel, ack button
    layout/                  sidebar, topbar, ricerca globale
  lib/
    permissions/            RBAC centralizzato
    workflow/                motore di approvazione
    integrations/            notify dispatcher + adapter Slack/Google Chat
    tenant.ts                risoluzione tenant corrente
    auth.ts                  configurazione NextAuth
    search.ts                client MeiliSearch
prisma/
  schema.prisma             modello dati completo
  seed.ts                   dati demo
docs/
  ARCHITECTURE.md           scelte architetturali e roadmap
  DESIGN.md                 direzione visiva
```

## Continuare lo sviluppo con Claude Code

Questo repository è pensato per essere scaricato e ripreso con Claude Code.
Punti di partenza consigliati, in ordine:

1. Upload allegati reale verso object storage
2. Sync automatico dell'indice di ricerca alla pubblicazione
3. Cron per i reminder di revisione periodica
4. OAuth Slack/Google Chat per notifiche DM personalizzate (oggi funziona la modalità webhook)
5. Attivazione SSO Microsoft Entra ID (provider già presente, va solo configurato)

Dettagli completi in `docs/ARCHITECTURE.md`.
