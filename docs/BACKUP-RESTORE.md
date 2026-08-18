# Backup & restore

*Scritto il 18 ago 2026 dopo aver eseguito e verificato un ciclo reale di
backup/restore in locale (Fase 3 dell'audit, "backup testato").*

## Procedura verificata

```bash
# 1. Backup (formato custom pg_dump, compresso, adatto a pg_restore)
docker exec procedure-hub-postgres-1 pg_dump -U postgres -d procedure_hub -F c -f /tmp/backup.dump
docker cp procedure-hub-postgres-1:/tmp/backup.dump ./backup.dump

# 2. Restore — SEMPRE in un database separato per verificare prima di
#    sovrascrivere qualunque cosa. Non fare pg_restore direttamente su
#    procedure_hub senza aver prima verificato il dump altrove.
docker cp ./backup.dump procedure-hub-postgres-1:/tmp/backup.dump
docker exec procedure-hub-postgres-1 psql -U postgres -c "CREATE DATABASE restore_check;"
docker exec procedure-hub-postgres-1 pg_restore -U postgres -d restore_check /tmp/backup.dump
```

## Cosa è stato verificato il 18 ago 2026

Backup preso dal database locale (165 procedure, 5 utenti, 24 righe di
audit log), ripristinato in un database separato (`restore_test`, non
quello in uso), poi controllato che:

- I conteggi righe combaciassero esattamente su `procedures`, `users`,
  `audit_logs`.
- Il contenuto di una procedura specifica (`LEG-PRO-001`, GDPR DSAR) fosse
  identico — non solo il conteggio, il dato vero.
- L'integrità referenziale fosse intatta: zero `Procedure.currentVersionId`
  orfani dopo il restore (nessun collegamento rotto verso
  `procedure_versions`).

Database temporaneo poi eliminato — questo era un test, non un backup da
conservare.

## Cosa NON è coperto da questo test

- **Allegati**: gli allegati vivono su storage S3-compatibile
  (`lib/storage.ts`), non nel database — un backup completo del sistema
  deve includere anche un backup/versionamento del bucket, non solo
  `pg_dump`. Non testato qui.
- **Indice di ricerca**: MeiliSearch ha il proprio storage
  (`meili_data`), separato da Postgres. In caso di disaster recovery, va
  ricostruito con `scripts/reindex.ts` dopo il restore del database — più
  semplice che fare backup/restore di MeiliSearch stesso.
- **Automazione**: questo è stato un test manuale, una tantum. Per la
  produzione serve un backup schedulato (cron/servizio gestito dal
  provider di hosting scelto) con retention definita — non ancora deciso
  in questo audit, dipende da dove verrà effettivamente ospitato
  l'ambiente di produzione.
- **Restore su un ambiente diverso da quello di backup** (es. disaster
  recovery su un server nuovo): testato solo il restore sullo stesso
  container Postgres da cui è stato preso il backup.
