# Attivazione SSO Microsoft Entra ID

*Scritto il 18 ago 2026 come materiale di supporto per Fase 3 (rollout). Il
codice necessario è stato completato e verificato parzialmente lo stesso
giorno — vedi "Cosa resta da verificare" in fondo prima di usarlo su utenti
reali.*

## Stato prima di oggi

`AzureADProvider` era già registrato in `src/lib/auth.ts`, ma **non
funzionava anche impostando le variabili d'ambiente**: mancava il codice
che risolve a quale tenant Procedure Hub appartiene un login Microsoft, e
che fa match/creazione dell'utente — la sessione sarebbe rimasta senza
`tenantId`, `globalRole` ecc., che è quello da cui dipende praticamente
tutto il resto dell'app. Non c'era nemmeno un bottone "Accedi con
Microsoft" nella pagina di login.

## Cosa è stato aggiunto oggi (codice)

- **`signIn` callback** in `lib/auth.ts`: per un login `azure-ad`, risolve
  il tenant dallo stesso header `x-tenant-slug` che il resto dell'app già
  usa (`middleware.ts`), poi cerca un `User` con quella email in quel
  tenant. Se non esiste, **lo crea automaticamente** con ruolo `USER` base
  (nessun accesso in scrittura finché un admin non assegna un
  dipartimento) e scrive una riga in `AuditLog`. Se esiste, aggiorna
  `ssoProvider`/`ssoSubjectId`/`lastLoginAt`.
- **Bottone "Accedi con Microsoft"** in `/login`, visibile solo se
  `AZURE_AD_CLIENT_ID` è valorizzato (altrimenti resta il messaggio "sarà
  disponibile a breve" come prima).

## Passaggi su Azure Portal (Entra ID admin center)

1. **Registra una nuova app**: Entra ID → App registrations → New
   registration.
   - Supported account types: *Accounts in this organizational directory
     only* (single tenant — è il caso normale per un'azienda che vuole
     solo i propri dipendenti).
   - Redirect URI: piattaforma **Web**,
     `https://<il-tuo-dominio>/api/auth/callback/azure-ad` (produzione) e
     `http://localhost:3000/api/auth/callback/azure-ad` (se si vuole
     testare in locale — ma vedi il limite sotto).
2. **Genera un client secret**: Certificates & secrets → New client
   secret. Il valore è visibile una sola volta al momento della
   creazione: copialo subito.
3. **Raccogli tre valori**: Application (client) ID, Directory (tenant)
   ID, e il client secret appena creato.
4. **Permessi API**: `openid`, `profile`, `email` bastano (sono le
   delegated permission di Microsoft Graph richieste di default dal
   provider Azure AD di NextAuth). Se l'organizzazione ha una policy che
   richiede consenso amministrativo per nuove app, un admin Entra ID deve
   dare "Grant admin consent" prima che gli utenti possano accedere.

## Valorizzare le variabili d'ambiente

```
AZURE_AD_CLIENT_ID="<Application (client) ID>"
AZURE_AD_CLIENT_SECRET="<il client secret creato sopra>"
AZURE_AD_TENANT_ID="<Directory (tenant) ID>"
```

Riavviare l'app. Il bottone "Accedi con Microsoft" compare automaticamente
in `/login` — non serve nessun'altra modifica.

## Limiti noti (da tenere in conto prima del rollout)

- **Un solo tenant Azure AD supportato oggi.** Le tre variabili sono
  globali per il deployment, non per singolo tenant Procedure Hub. Va bene
  per l'uso attuale (un'azienda, un'istanza) — se in futuro Procedure Hub
  viene venduto ad altre aziende, ogni cliente avrà bisogno di credenziali
  proprie, il che richiede spostare questa configurazione su una riga
  `Integration` per tenant invece che su variabili d'ambiente globali.
- **La risoluzione del tenant per il login SSO dipende dall'host della
  richiesta** (lo stesso meccanismo di `middleware.ts` usato ovunque
  nell'app). In produzione, con sottodomini reali (`acme.procedurehub.com`),
  funziona automaticamente perché l'andata e il ritorno da Microsoft
  restano sullo stesso host. **Su `localhost`, il redirect di ritorno da
  Microsoft non porta con sé `?tenant=demo`**, quindi un test locale del
  login SSO fallirà con "tenant non risolto" a prescindere da quanto sia
  corretta la configurazione Azure. Da testare su un dominio/sottodominio
  reale (es. un ambiente di staging), non su localhost.
- **Auto-provisioning attivo di default**: chiunque si autentichi con
  successo contro il tenant Azure AD configurato ottiene un account
  Procedure Hub al primo accesso (ruolo `USER`, nessun dipartimento). Se
  non è il comportamento voluto — ad esempio se si preferisce che ogni
  account passi comunque da una creazione admin esplicita — va disattivato
  esplicitamente nel `signIn` callback prima del rollout.

## Cosa resta da verificare

Non è stato possibile completare un login reale end-to-end in questo audit
(nessuna app Azure AD reale disponibile). Verificato invece:

- Il bottone compare/scompare correttamente in base a
  `AZURE_AD_CLIENT_ID`.
- Cliccandolo, la richiesta **raggiunge davvero gli endpoint Microsoft**:
  usando un client ID fittizio è tornato un errore reale di Azure
  (`AADSTS90112: Application identifier is expected to be a GUID`),
  prova che il collegamento verso Microsoft funziona, non solo che il
  codice compila.
- Il codice compila senza errori di tipo.

**Prima di usarlo su utenti reali**: creare un'App Registration di test,
un utente di test nel tenant Azure AD del cliente, fare un login completo
su un ambiente con hostname reale (non localhost), e verificare che:
1. L'utente venga creato in Procedure Hub con email ed nome corretti.
2. Compaia una riga `CREATE`/`User` in `AuditLog` con `metadata.via:
   "azure-ad-sso"`.
3. Un secondo login dello stesso utente non crei un duplicato (deve
   aggiornare `lastLoginAt`, non creare un nuovo `User`).
