# Preocupacions i Deute Tècnic — MuixerApp

> Generat automàticament per la skill `acquire-codebase-knowledge` el 23/04/2026.
> Actualitzat manualment el 24/04/2026: resolució completa de tots els ítems accionables.

---

## 1. Riscos Principals (Prioritats)

| Severitat | Preocupació | Evidència | Impacte | Estat | Acció |
|-----------|-------------|-----------|---------|-------|-------|
| **Alta** | **Zero tests de les estratègies de sync** | Cap `.spec.ts` a `modules/sync/strategies/` | Un bug en la lògica de merge pot corrompre dades | ✅ **Resolt** (24/04) | 3 spec files creats: `person-sync`, `event-sync`, `attendance-sync` |
| **Alta** | **Temporades hardcoded** al `EventSyncStrategy` | `event-sync.strategy.ts` — constants `2025`, `2026` | Les temporades futures no es creen automàticament | ✅ **Resolt** (24/04) | `loadOrCreateSeasons()` llegeix temporades de la DB; bootstrapeja defaults si és buit. Tests actualitzats. |
| **Alta** | **Cap CI/CD configurat** | Scan: "No CI/CD pipelines detected" | Qualsevol push pot trencar la build sense validació | ✅ **Resolt** (24/04) | `.github/workflows/ci.yml` creat: lint + test + build (affected per PRs, all per push) |
| **Mitja** | **`ToastService` mai cridat des de features** | Grep: zero usos de `ToastService` a `features/` | Errors i operacions exitoses silenciosos | ✅ **Resolt** (24/04) | Integrat a `event-detail` (6 handlers) i `person-detail` (toggle provisional). |
| **Mitja** | **Flag `manuallyOverridden` no implementada** | `SYNC_ARCHITECTURE.md §7` + `PROJECT_ROADMAP.md §P4.2` | Re-sync pot sobreescriure estats editats manualment | ⏸ **Diferit** | Descartat a P4.2 per simplificar; reconsiderar a P5+ si és necessari |
| **Mitja** | **Seed command (`seed.command.ts`) és un stub** | `database/seeds/seed.command.ts:35` — `TODO: Implement full import logic` | Impossible repoblar DB sense sync manual | ✅ **Resolt** (24/04) | `seed.command.ts`, `seed.module.ts` eliminats. Target `seed` eliminat de `project.json`. La sync manual cobreix el cas d'ús. |
| **Baixa** | **Cap coverage threshold enforced** | `jest.config.ts` — camp `coverageThreshold` absent | La cobertura pot degradar-se sense alerta | ✅ **Resolt** (24/04) | `coverageThreshold` afegit a `jest.config.ts` (API) i `vitest.config.ts` (dashboard). CI usa `--configuration=ci`. |

---

## 2. Deute Tècnic

| Ítem | Per què existeix | On | Risc si s'ignora | Estat | Correcció |
|------|-----------------|-----|------------------|-------|-----------|
| **Scaffold Nx no netejat** | `libs/shared/src/lib/shared.ts` + `shared.spec.ts` creats automàticament per Nx | `libs/shared/src/lib/` | Confusió per als nous developers | ✅ **Resolt** (24/04) | Fitxers eliminats |
| **`SetupTechnicalDto` òrfena** | DTO creat durant el disseny i mai usat | `apps/api/src/modules/auth/dto/` | Confusió sobre si s'usa | ✅ **Resolt** (24/04) | Fitxer eliminat |
| **`LegacyApiClient` injectat però no usat al `SyncController`** | Residu de refactorització | `sync.controller.ts` | Avís de linter potencial | ✅ **Resolt** (24/04) | Paràmetre eliminat del constructor |
| **Bug de parsing `colles`** | El legacy usa ` i ` com a separador | `event-sync.strategy.ts` | `metadata.colles` incorrecte per actuacions | ✅ **Resolt** (24/04) | Regex `.split(/ i \|,/)` a línia 238 |
| **`UpdatePositionDto` usa `@nestjs/mapped-types`** | No usava `@nestjs/swagger` `PartialType` | `position/dto/update-position.dto.ts` | Camps heretats no apareixien al Swagger | ✅ **Resolt** (24/04) | Ja usa `@nestjs/swagger` PartialType |
| **`form-field` component sense consumidors** | Creat durant P4.3, mai usat | `shared/components/forms/form-field/` | Codi mort, confusió | ✅ **Resolt** (24/04) | Eliminat |
| **`confirm-dialog` component sense consumidors** | Creat durant P4.3, mai usat | `shared/components/feedback/confirm-dialog/` | Codi mort, confusió | ✅ **Resolt** (24/04) | Eliminat |
| **GDPR: camps sensibles no encriptats en repòs** | No implementat | `persons.email`, `persons.phone`, `persons.birthDate` | Incompliment RGPD si hi ha bretxa | ⏸ **Diferit P6+** | Encriptació en repòs (decisió: columnes encriptades vs. disc Neon) |
| **Multi-tenant no implementat** | Decisió ajornada | Model de dades sencer | Quan s'implementi, caldrà `collaId` a JWT i guards | ⏸ **Diferit P7+** | Dissenyar amb antelació per a P7+ |

---

## 3. Preocupacions de Seguretat

| Risc | Categoria OWASP | Evidència | Mitigació actual | Estat | Buit / Acció |
|------|----------------|-----------|-----------------|-------|--------------|
| **SETUP_TOKEN no eliminat** | A07 — Autenticació fallida | `.env.example` inclou `SETUP_TOKEN` | Documentació: "eliminar en producció" | ⚠️ **Pendent** | Afegir al checklist de deploy; no automatitzar (és una decisió humana) |
| **Refresh tokens a la DB** | A02 — Failures criptogràfics | `refresh_tokens` taula | SHA-256 hash, rotació, detecció reutilització | ✅ **Resolt** (24/04) | `@Cron(EVERY_DAY_AT_3AM)` a `TokenService.cleanupExpiredTokens()` elimina tokens >30 dies |
| **Credencials del legacy** | A02 — Failures criptogràfics | `LEGACY_API_USERNAME/PASSWORD` | Variables d'entorn, no hardcoded | ✅ **Acceptable** | HTTPS assumit; acceptable durant migració activa |
| **`forbidNonWhitelisted: true`** | A03 — Injecció | `main.ts` ValidationPipe | Actiu a tots els endpoints | ✅ **OK** | — |
| **CORS via array `CORS_ORIGINS`** | A05 — Misconfiguration | `main.ts` + `.env.example` | Configurable per entorn | ⚠️ **Pendent** | Afegir al checklist de deploy: verificar que `localhost` no estigui en producció |
| **Dades sensibles de persones** | A02 — RGPD | `persons.email`, `phone`, `birthDate` | Cap encriptació en repòs | ⏸ **Diferit P6+** | Encriptació en repòs pendent |

---

## 4. Preocupacions de Rendiment i Escalabilitat

| Preocupació | Evidència | Símptoma actual | Risc d'escala | Estat | Millora |
|-------------|-----------|----------------|---------------|-------|---------|
| **Sync carrega totes les assistències seqüencialment** | `attendance-sync.strategy.ts` — loop per cada event | Sync lenta (~89 events × 1 req XLSX) | Creix lineal amb el nombre d'events | ⏸ **Diferit** | Paral·lelitzar (Promise.allSettled batch 5) — acceptable per sync manual; documentat |
| **N+1 potencial al `EventSyncStrategy`** | 2 peticions HTTP per event (llista + detall) | 74+15 events = 178 peticions sequencials | Creix amb els events | ⏸ **Diferit** | Acceptable per sync manual; el legacy pot afegir rate limiting |
| **`attendanceSummary` recalculat a cada CRUD** | `event.service.ts` — `recalculateSummary()` | Còmput sincrò per cada canvi | Pot ser lent amb moltes assistències simultànies | ⏸ **Diferit** | Acceptable per ara; considerar eventual consistency si creix |
| **`refresh_tokens` creix indefinidament** | `token.service.ts` — no hi ha cleanup automàtic | Taula pot créixer molt | Degrada els lookups per `userId` | ✅ **Resolt** (24/04) | `cleanupExpiredTokens()` cron diari a les 03:00 |

---

## 5. Àrees d'Alta Rotació (Fràgils)

> Font: historial git dels últims 90 dies

| Àrea | Per qué és fràgil | Senyals de rotació | Estratègia de canvi segur |
|------|------------------|-------------------|--------------------------|
| `person-list.component.html` / `.ts` | 8 commits en 90 dies; filtres, provisional, columnes | 8 commits | Tests del component abans de canviar; revisar signal dependencies |
| `event-list.component.html` / `.ts` | 8 commits; refactored a P4.3 | 8 commits | Idem |
| `event-detail.component.ts` / `.html` | 7 commits; CRUD assistència, modals nous | 7 commits | Tests d'integració del flux d'assistència |
| `docs/PROJECT_ROADMAP.md` | 7 commits; document viu, actualitzat a cada fase | 7 commits | Procés, no codi |
| `app.html` / `app.routes.ts` / `app.config.ts` | 5 commits; modificats a cada fase | 5 commits | Canvis mínims; preferir afegir lazy routes |
| `apps/dashboard/src/app/shared/components/layout/sidebar/` | 5 commits — **sidebar eliminada a P4.3** | Residu de git history | No restaurar; tots els nous layouts usen `tab-nav` |

---

## 6. Codi Mort Identificat

| Arxiu | Element mort | Estat | Acció |
|-------|-------------|-------|-------|
| `libs/shared/src/lib/shared.ts` | Funció `shared()` — scaffold Nx | ✅ **Resolt** | Eliminat |
| `libs/shared/src/lib/shared.spec.ts` | Test del scaffold | ✅ **Resolt** | Eliminat |
| `apps/api/src/modules/auth/dto/setup-technical.dto.ts` | DTO òrfà | ✅ **Resolt** | Eliminat |
| `sync.controller.ts` (línia ~24) | `LegacyApiClient` injectat però no usat | ✅ **Resolt** | Paràmetre eliminat |
| `shared/components/data/stat-card/` | Component sense consumidors | ✅ **Resolt** | No existeix al codi (mai creat o ja eliminat) |
| `shared/components/forms/form-field/` | Component sense consumidors | 🔵 **En curs** | Eliminar — Fase 2 |
| `shared/components/feedback/confirm-dialog/` | Component sense consumidors | 🔵 **En curs** | Eliminar — Fase 2 |
| `shared/components/feedback/skeleton-rows/` | `data-table` usa skeleton inline | ✅ **Resolt** | No existeix al codi (inline DaisyUI skeleton) |
| `shared/components/feedback/skeleton-cards/` | Cap consumidor | ✅ **Resolt** | No existeix al codi |
| `apps/api/src/modules/database/seeds/seed.command.ts` | TODO stub mai implementat | ✅ **Resolt** | Eliminat (24/04) |

---

## 7. Preguntes Obertes `[DECISION PRESA]`

1. **[RESOLT]** S'ha d'eliminar `SETUP_TOKEN` del `.env`? → Sí, eliminar manualment un cop creat el primer user. Documentat al `VALIDATION_CHECKLIST.md`.

2. **[PENDENT]** Es vol implementar un job periòdic per netejar refresh tokens? → Sí, `@Cron('0 3 * * *')` diari a `TokenService`. Implementat a Fase 6.

3. **[PENDENT]** Els components `stat-card`, `form-field` i `confirm-dialog` es planegen usar a P5? → `stat-card` ja no existeix. `form-field` i `confirm-dialog` s'eliminen ara; es recrearan si P5 ho requereix.

4. **[PENDENT]** Quan s'eliminarà la dependència del legacy APPsistència? → Pendent de decisió. Afecta la prioritat del CRUD de temporades (substitució de les constants hardcoded és urgent).

5. **[PENDENT]** Cal una cobertura mínima de tests? → Sí. Threshold mínim: 70% statements/functions/lines, 60% branches. Implementat a Fase 4.

---

## 8. Estat de Resolució (Resum)

> Última revisió: 24/04/2026

| Fase | Ítems | Estat |
|------|-------|-------|
| CI/CD | Alta prioritat resolta | ✅ Resolt |
| Scaffold / codi mort bàsic | Deute tècnic resolt | ✅ Resolt |
| Tests sync strategies | Alta prioritat resolta | ✅ Resolt |
| Parsing `colles` / PartialType | Bugs resolts | ✅ Resolt |
| Codi mort restant (form-field, confirm-dialog, seed) | — | ✅ Resolt (24/04) |
| Temporades dinàmiques | — | ✅ Resolt (24/04) |
| Coverage threshold | — | ✅ Resolt (24/04) |
| ToastService integració | — | ✅ Resolt (24/04) |
| Refresh token cleanup | — | ✅ Resolt (24/04) |
| GDPR encriptació | Diferit | ⏸ P6+ |
| Multi-tenant | Diferit | ⏸ P7+ |

---

## 9. Evidència

- `.github/workflows/ci.yml` — CI creat amb lint + test + build
- `apps/api/src/modules/sync/strategies/*.spec.ts` — tests de les 3 estratègies
- `apps/api/src/modules/sync/strategies/event-sync.strategy.ts:238` — fix parsing `colles`
- `apps/api/src/modules/position/dto/update-position.dto.ts` — `@nestjs/swagger` PartialType
- `apps/api/src/modules/sync/sync.controller.ts:19-24` — constructor sense `LegacyApiClient`
- `apps/dashboard/src/app/shared/components/feedback/toast/toast.service.ts` — servei existent
- `docs/SYNC_ARCHITECTURE.md §4-6` — ítems pendents de desconnexió del legacy
- `docs/PROJECT_ROADMAP.md` — decisions sobre `manuallyOverridden`, multi-tenant, GDPR
