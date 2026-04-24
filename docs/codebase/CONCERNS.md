# Preocupacions i Deute Tècnic — MuixerApp

> Generat automàticament per la skill `acquire-codebase-knowledge` el 23/04/2026.  
> Evidència: exploració del codi font, scan.py, historial git (90 dies).

---

## 1. Riscos Principals (Prioritats)

| Severitat | Preocupació | Evidència | Impacte | Acció suggericada |
|-----------|-------------|-----------|---------|-------------------|
| **Alta** | **Zero tests de les estratègies de sync** | Cap `.spec.ts` a `modules/sync/strategies/` | Un bug en la lògica de merge (CREATE vs UPDATE) pot corrompre dades en producció | Afegir tests unitaris amb mock de `LegacyApiClient` |
| **Alta** | **Temporades hardcoded** al `EventSyncStrategy` | `event-sync.strategy.ts` — constants `2025`, `2026` | Les temporades futures no es creen automàticament sense modificar el codi | Implementar CRUD de temporades (pendent des de P3) |
| **Alta** | **Cap CI/CD configurat** | Scan: "No CI/CD pipelines detected" | Qualsevol push pot trencar la build sense validació automàtica | Afegir GitHub Actions o GitLab CI amb `nx run-many -t test,build,lint` |
| **Mitja** | **`ToastService` mai cridat des de features** | Grep: zero usos de `ToastService` a `features/` | Errors i operacions exitoses silenciosos per a l'usuari | Integrar `ToastService` a les operacions CRUD (P5+) |
| **Mitja** | **Flag `manuallyOverridden` no implementada** | `SYNC_ARCHITECTURE.md §7` + `PROJECT_ROADMAP.md §P4.2` | Una re-sync pot sobreescriure estats d'assistència editats manualment | Implementar flag a l'entitat `Attendance` + respectar-la al sync |
| **Mitja** | **Seed command (`seed.command.ts`) és un stub** | `database/seeds/seed.command.ts:35` — `TODO: Implement full import logic` | Impossible repoblar la base de dades en dev sense la sync manual completa | Implementar o eliminar |
| **Baixa** | **Cap coverage threshold enforced** | `jest.config.ts` — camp `coverageThreshold` absent | La cobertura pot degradar-se sense alerta | Afegir threshold mínim (ex: 70% statements) |

---

## 2. Deute Tècnic

| Ítem | Per què existeix | On | Risc si s'ignora | Correcció suggericada |
|------|-----------------|-----|------------------|-----------------------|
| **Scaffold Nx no netejat** | `libs/shared/src/lib/shared.ts` + `shared.spec.ts` creats automàticament per Nx | `libs/shared/src/lib/` | Confusió per als nous developers | Eliminar ambdós fitxers |
| **`SetupTechnicalDto` òrfena** | DTO creat durant el disseny i mai usat | `apps/api/src/modules/auth/dto/setup-technical.dto.ts` | Confusió sobre si s'usa | Eliminar el fitxer |
| **`LegacyApiClient` injectat però no usat al `SyncController`** | Probablement un residu de refactorització | `sync.controller.ts` línia ~24 | Avís de linter potencial | Eliminar el paràmetre del constructor |
| **Bug de parsing `colles`** | El legacy usa ` i ` com a separador, però el codi divideix per `,` | `event-sync.strategy.ts` | `metadata.colles` per actuacions és incorrecte | Dividir per ` i ` a més de `,` |
| **`UpdatePositionDto` usa `@nestjs/mapped-types`** | No usa `@nestjs/swagger` `PartialType` | `position/dto/update-position.dto.ts` | Camps heretats no apareixen al Swagger | Canviar import a `@nestjs/swagger` |
| **GDPR: camps sensibles no encriptats en repòs** | No implementat | `persons.email`, `persons.phone`, `persons.birthDate` | Incompliment RGPD si hi ha bretxa de dades | Encriptació en repòs (P6+) |
| **Multi-tenant no implementat** | Decisió ajornada | Model de dades sencer | Quan s'implementi multi-tenant, caldrà afegir `collaId` a JWT i guards | Dissenyar amb antelació per a P7+ |

---

## 3. Preocupacions de Seguretat

| Risc | Categoria OWASP | Evidència | Mitigació actual | Buit |
|------|----------------|-----------|-----------------|------|
| **SETUP_TOKEN no eliminat** | A07 — Autenticació fallida | `.env.example` inclou `SETUP_TOKEN` | Documentació: "eliminar en producció" | Cap validació automàtica que detecti que existeix en producció |
| **Refresh tokens a la DB** | A02 — Failures criptogràfics | `refresh_tokens` taula | SHA-256 hash (no guardat en clar), rotació, detecció de reutilització | Cap expiració automàtica de tokens olds a la DB (acumulació) |
| **Credencials del legacy** | A02 — Failures criptogràfics | `LEGACY_API_USERNAME/PASSWORD` | Variables d'entorn, no hardcoded | Les credencials es transmeten en clar al legacy PHP (HTTPS assumit) |
| **`forbidNonWhitelisted: true`** | A03 — Injecció | `main.ts` ValidationPipe | Actiu a tots els endpoints | — |
| **CORS via array `CORS_ORIGINS`** | A05 — Misconfiguration | `main.ts` + `.env.example` | Configurable per entorn | Cal assegurar que en producció no s'inclou `localhost` |
| **Dades sensibles de persones** | A02 — RGPD | `persons.email`, `phone`, `birthDate` | Cap encriptació en repòs | Encriptació pendent (P6+) |

---

## 4. Preocupacions de Rendiment i Escalabilitat

| Preocupació | Evidència | Símptoma actual | Risc d'escala | Millora suggericada |
|-------------|-----------|----------------|---------------|---------------------|
| **Sync carrega totes les assistències seqüencialment** | `attendance-sync.strategy.ts` — loop per cada event | Sync lenta (~89 events × 1 req XLSX) | Creix lineal amb el nombre d'events | Paral·lelitzar peticions XLSX (Promise.allSettled amb batch de 5) |
| **N+1 potencial al `EventSyncStrategy`** | 2 peticions HTTP per event (llista + detall) | 74+15 events = 178 peticions sequencials | Creix amb els events; el legacy pot afegir rate limiting | Acceptable per a sync manual; documentar limitació |
| **`attendanceSummary` recalculat a cada operació CRUD** | `event.service.ts` — `recalculateSummary()` | Còmput sincrò per cada canvi d'assistència | Amb moltes assistències simultànies, pot ser lent | Acceptable per ara; considerar eventual consistency si creix |
| **`refresh_tokens` creix indefinidament** | `token.service.ts` — no hi ha cleanup automàtic | Taula pot créixer molt amb sessions llargues | Degrada els lookups per `userId` | Afegir job periòdic per eliminar tokens expirats/revocats antics |

---

## 5. Àrees d'Alta Rotació (Fragils)

> Font: historial git dels últims 90 dies (`scan.py` HIGH-CHURN)

| Àrea | Per qué és fràgil | Senyals de rotació | Estratègia de canvi segur |
|------|------------------|-------------------|--------------------------|
| `person-list.component.html` / `.ts` | 8 commits en 90 dies; moltes features afegides (filtres, provisional, columnes) | 8 commits | Tests del component abans de canviar; revisar signal dependencies |
| `event-list.component.html` / `.ts` | 8 commits; refactored a P4.3 | 8 commits | Idem |
| `event-detail.component.ts` / `.html` | 7 commits; CRUD assistència, modals nous | 7 commits | Tests d'integració del flux d'assistència |
| `docs/PROJECT_ROADMAP.md` | 7 commits; document viu, actualitzat a cada fase | 7 commits | Procés, no codi |
| `app.html` / `app.routes.ts` / `app.config.ts` | 5 commits; modificats a cada fase per afegir features | 5 commits | Canvis mínims; preferir afegir lazy routes que modificar les existents |
| `apps/dashboard/src/app/shared/components/layout/sidebar/` | 5 commits — **sidebar eliminada a P4.3** però apareix al historial git | Residu de git history | No restaurar; tots els nous layouts usen `tab-nav` |

---

## 6. Codi Mort Identificat

> Alguns d'aquests ítems es corregiran al Phase 4 del pla de documentació.

| Arxiu | Element mort | Acció |
|-------|-------------|-------|
| `libs/shared/src/lib/shared.ts` | Funció `shared()` — scaffold Nx, mai exportada ni usada | Eliminar |
| `libs/shared/src/lib/shared.spec.ts` | Test del scaffold — mai útil | Eliminar |
| `apps/api/src/modules/auth/dto/setup-technical.dto.ts` | DTO òrfà — cap importador | Eliminar |
| `sync.controller.ts` (línia ~24) | `LegacyApiClient` injectat però no usat al controller | Eliminar paràmetre |
| `shared/components/data/stat-card/` | Component sense consumidors | Eliminar o documentar per P5 |
| `shared/components/forms/form-field/` | Component sense consumidors | Eliminar o reservar per P5 |
| `shared/components/feedback/confirm-dialog/` | Component sense consumidors | Eliminar |
| `shared/components/feedback/skeleton-rows/` | `data-table` usa skeleton inline | Eliminar |
| `shared/components/feedback/skeleton-cards/` | Cap consumidor | Eliminar |

---

## 7. Preguntes Obertes `[ASK USER]`

1. **[ASK USER]** S'ha d'eliminar `SETUP_TOKEN` del `.env` de l'entorn de producció? Hi ha mecanismes de seguretat per evitar que quedi activat accidentalment?

2. **[ASK USER]** Es vol implementar un job periòdic per netejar refresh tokens expirats/revocats de la base de dades? Quin interval seria acceptable?

3. **[ASK USER]** Els components `stat-card`, `form-field` i `confirm-dialog` es planegen usar a P5 (Pinyes) o es poden eliminar ara?

4. **[ASK USER]** Quan s'eliminarà la dependència del legacy APPsistència? Quin és el criteri de "tall" oficial? Això afecta la prioritat del CRUD de temporades.

5. **[ASK USER]** Cal una cobertura mínima de tests per acceptar PRs? Quin percentatge és acceptable per a l'equip?

---

## 8. Evidència

- `scan.py` — HIGH-CHURN FILES i TODO/FIXME
- `apps/api/src/modules/database/seeds/seed.command.ts:35` — TODO stub
- `apps/dashboard/src/app/shared/components/feedback/` — components sense consumidors (grep verificat)
- `docs/SYNC_ARCHITECTURE.md §4-6` — ítems pendents de desconnexió del legacy
- `docs/PROJECT_ROADMAP.md` — decisions sobre `manuallyOverridden`, multi-tenant, GDPR
