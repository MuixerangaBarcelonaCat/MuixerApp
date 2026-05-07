# Cleanup NeonDB

> Guia per eliminar completament el projecte NeonDB un cop Docker local funciona correctament.

**⚠️ Irreversible. Fer backup primer.**

---

## Prerequisits (verificar TOTS abans de continuar)

- [ ] `npm run docker:up` arrenca PostgreSQL sense errors
- [ ] `nx serve api` connecta a Docker local correctament
- [ ] `nx run api:seed-seasons` ha importat les temporades
- [ ] Sync des del legacy funciona (persones i events)
- [ ] Login al dashboard funciona
- [ ] `npm run ci:local` — tots els tests passen

---

## Pas 1: Backup de NeonDB (per seguretat)

```bash
# Exportar les dades actuals de NeonDB
pg_dump "postgresql://neondb_owner:<password>@ep-curly-art-anjnrcwb-pooler.c-6.us-east-1.aws.neon.tech/neondb" \
  --no-owner --no-acl --clean --if-exists \
  -f neon-backup-$(date +%Y%m%d).sql

# Guardar en un lloc segur
```

---

## Pas 2: Eliminar el projecte NeonDB

1. Accedir a [https://console.neon.tech](https://console.neon.tech)
2. Seleccionar el projecte `muixerapp-db` (o equivalent)
3. Anar a **Settings** → **Delete project**
4. Confirmar la eliminació

---

## Pas 3: Netejar credencials de NeonDB

Un cop eliminat el projecte NeonDB:

1. Eliminar el MCP `user-muixerapp-db-neon-mcp` de Cursor Settings → MCP
2. Eliminar el MCP `plugin-neon-postgres-neon` si no s'usa per a res més
3. Verificar que `.env` **no conté** cap URL de NeonDB (ja fet en P4.4)

---

## Pas 4: Actualitzar integracions a Cursor (opcional)

Els MCPs de NeonDB ja no seran necessaris. Cursor els desactivarà automàticament si el projecte NeonDB no existeix.

---

## Estat actual de les dades

| Taula | Registres | Estratègia |
|-------|-----------|------------|
| `users` | 1 | Recrear via `SETUP_TOKEN` endpoint |
| `persons` | 267 | Re-sincronitzar des del legacy |
| `positions` | 12 | Re-sincronitzar des del legacy |
| `seasons` | 2 | **Importar via `nx run api:seed-seasons`** |
| `events` | 90 | Re-sincronitzar des del legacy |
| `attendances` | 17.965 | Re-sincronitzar des del legacy |
| `refresh_tokens` | 177 | Descartables (s'auto-generen al login) |
| `person_positions` | 341 | Re-sincronitzar des del legacy |

**Les úniques dades NO recuperables via sync:** les 2 temporades → preservades a `data/seeds/seasons.json`.

---

**Data de creació:** 7 de maig de 2026
