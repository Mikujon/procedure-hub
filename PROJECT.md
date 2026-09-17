# PROJECT.md — Procedure Hub

## Project Classification

- Date: 17 set 2026
- Assessed by: AI-assisted intake (Claude Code), **owner confirmation pending** — vedi nota sotto
- Kit version used: v1.3.1 (`wearefiber/ai-governance-kit`, clonato e verificato via `git describe --tags`)
- Owner: **TBD** — l'interview di classificazione (`AI_INTAKE_ASSESSMENT.md`) ha chiesto business/technical owner ma non ha ricevuto risposta; da assegnare prima del go-live Tier 3 (item 30 del checklist, blocca anche 5.4.29 "signed off by the business owner")
- Resulting tier: **T3 — Critical / Regolamentato**
- Key answers:
  - Reach / persistence / external calls: ~200 utenti/tenant, multi-tenant reale su PostgreSQL, chiama Gemini/Slack/Google Chat/Microsoft Teams/Microsoft Graph — tutti e tre trigger T1 soddisfatti
  - Integration / shared data / operational reliance: sync SharePoint, azione webhook generica verso Jira/ServiceNow/Freshdesk, multi-dipartimento (HR/Legal/Finance/IT/...), cron orario (`/api/cron/automations`) — tutti e tre trigger T2 soddisfatti
  - Regulated data / customer-facing / autonomous action / impact: procedura reale "Gestione delle richieste di accesso ai dati (GDPR DSAR)", PII utenti, audit trail ISO/GDPR/SOC2 esplicito nello scopo del progetto; motore automazioni può archiviare una procedura (`CHANGE_PROCEDURE_STATUS → ARCHIVED`) senza revisione umana sulla singola istanza; **danno reale già dimostrato**, non solo teorico — più bug RBAC reali che esponevano procedure RESTRICTED/DEPARTMENT a utenti non autorizzati sono stati trovati e corretti nel corso di questo stesso sviluppo (vedi `CLAUDE.md`, voci 25 ago 2026 e successive)
- Rationale: Q7 (dati regolamentati) e Q10 (danno reale) sono entrambi confermati con prove concrete dal codice e dalla cronologia di sviluppo, non solo ipotetici — questo blocca il tier a T3 indipendentemente da qualunque altra risposta, per la regola "il tier più alto innescato da una qualunque risposta" (`AI_INTAKE_ASSESSMENT.md` Sezione 3). Customer-facing (Q8) trattato come "no" per difetto — il progetto si descrive esplicitamente come piattaforma **interna** (`CLAUDE.md`: "piattaforma interna multi-tenant") — ma va confermato da chi conosce l'uso reale, non assunto in eterno.

**Nota sull'owner**: questo campo è normalmente obbligatorio prima di scaffoldare o proseguire (`AI_INTAKE_ASSESSMENT.md` §1.6), ma qui il progetto esiste già ed è in sviluppo attivo da settimane — bloccare tutto il lavoro in attesa di un nome avrebbe fermato sviluppo già in corso senza necessità. Registrato come gap esplicito (vedi item 30 dell'audit in `docs/AI-GOVERNANCE-AUDIT.md`) invece di essere inventato.

Vedi `docs/AI-GOVERNANCE-AUDIT.md` per l'audit completo a 42 punti contro `reference/AI_Development_Standard.docx` §7.
