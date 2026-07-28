---
tags: [qa]
---

# Deute tècnic i troballes obertes

> Únic registre de coses conegudes i **no resoltes**. Substitueix `CONCERNS.md`,
> `PINYES_REFACTOR_REVIEW.md`, `PINYES_REFACTOR_TRACKING.md` i `audit/AUDIT_TRACKING.md`
> (esborrats el 25/07/2026; recuperables al git history).
>
> Regla: si un ítem es resol, s'esborra d'aquí. Res de columnes "✅ Resolt" —
> per a això ja hi ha el git log.

**Verificat contra el codi:** 25 de juliol de 2026

---

## Backend — correcció i fiabilitat

| # | Ítem | On | Impacte |
|---|------|-----|---------|
| B1 | `checkEventLock` retorna silenciosament si la instància o el seu segment no existeixen: el lock d'event no es comprova i la petició continua fins que un altre `findOne` llença 404 | `node-assignment.service.ts:1242` (`if (!instance?.segment) return`) | Es pot saltar el bloqueig d'assignacions d'events passats amb instàncies òrfenes |
| B2 | `catch {}` nu a `bulkImport`: qualsevol error (timeout, `QueryFailedError`) es reporta com a "conflicte" genèric amb HTTP 200 | `node-assignment.service.ts:1015` | Errors d'infraestructura silenciats; el client creu que són conflictes legítims |
| B3 | `getHistory` i `getEventAssignmentSummary` hidraten tots els `InstanceNode` (geometria inclosa) només per comptar-los | `node-assignment.service.ts:666` i `:777` | N×60 files per petició; substituïble per `loadRelationCountAndMap` |
| B4 | `bulkImport` repeteix els checks de conflicte que `assign()` ja fa internament | `node-assignment.service.ts` (bucle de bulkImport) | 3 queries redundants per assignació |
| B5 | Els emails d'invitació no s'envien: el servei només logueja el token | `user.service.ts:182` | L'alta d'usuaris requereix passar el token a mà |

## Sync del legacy

| # | Ítem | Impacte |
|---|------|---------|
| S1 | Les assistències es carreguen seqüencialment (1 petició XLSX per event, ~89 events) | Sync lenta; acceptable perquè és manual. Paral·lelitzar amb `Promise.allSettled` en lots |
| S2 | N+1 al `EventSyncStrategy`: 2 peticions HTTP per event (llista + detall) | ~178 peticions seqüencials; el legacy podria aplicar rate limiting |
| S3 | No hi ha flag de "editat manualment": un re-sync pot sobreescriure estats editats a mà | Descartat a P4.2 per simplicitat; reconsiderar si el legacy conviu molt de temps |
| S4 | `attendanceSummary` es recalcula sincrònicament a cada CRUD d'assistència | Acceptable ara; vigilar si creix el volum |

## Seguretat i compliment

| # | Ítem | Acció |
|---|------|-------|
| SEC1 | `SETUP_TOKEN` ha de quedar sense valor en producció un cop creat el primer usuari | Decisió humana, no automatitzable: verificar-ho a cada desplegament ([[DEPLOY_PRE]]) |
| SEC2 | `CORS_ORIGINS` no ha de contenir `localhost` en producció | Verificar a cada desplegament |
| SEC3 | Camps sensibles de `persons` (`email`, `phone`, `birthDate`) sense encriptar en repòs | RGPD. Decisió pendent: columnes encriptades vs. encriptació de disc |
| SEC4 | Multi-tenant no implementat | Quan s'implemente caldrà `collaId` al JWT i als guards de tots els mòduls |

## Frontend

| # | Ítem | On | Notes |
|---|------|-----|-------|
| F1 | El workspace de Pinyes no és usable per sota de `sm` (639px): hi ha un guard que mostra "encara no optimitzat per a mòbil" a Pinyes, Troncs i Nodes extra | `pinyes-tab`, `troncs-tab`, `nodes-tab` | Decisió conscient: a 393px el canvas quedava en 73px reals |
| F2 | Falta pinch/wheel zoom al canvas | `figure-canvas.component.ts` | Requisit previ de F1; ajornat com a feature |
| F3 | Falta pan del llenç en mode assignació | `figure-canvas.component.ts` | Mateix subsistema de gestos que F2; abordar-los junts |
| F4 | `figure-canvas.component.ts` fa **2.707 línies** | idem | Una extracció (`KonvaStageService` + renderers per mode) es va fer i **es va revertir el 12/06/2026 perquè no es va connectar mai**. No repetir-la sense connectar-la de debò |
| F5 | Les interfícies `Create*Payload` / `Update*Payload` del dashboard no viuen a `libs/shared` | `features/*/models/` | Els models del frontend van derivant respecte dels DTOs de l'API |
| F6 | `composition-editor.component.html` té 2 `aside` amb `class="w-70"` (línies 50 i 112). `w-70` **no existeix** a l'escala d'espaiat de Tailwind: no genera CSS i l'aside no té amplada reservada — el mateix bug que va trencar la pestanya Distribució en mòbil | `composition-editor.component.html:50,112` | Solució ja aplicada a `distribucio-tab`: `w-[280px]` + `flex-col sm:flex-row` |

## Tests

| # | Ítem |
|---|------|
| T1 | Cobertura E2E mínima: només els `example.spec.ts` d'scaffold i la suite d'auditoria ([[AUDIT_SUITE]]). Falten fluxos reals (login, alta de persona, assignació) |
| T2 | L'offline de la PWA no s'ha verificat en un desplegament real (el service worker només s'activa en build de producció); el test actual és tou |
| T3 | Cap troballa d'auditoria s'ha validat amb un usuari **MEMBER** real: tot s'ha provat amb ADMIN |
| T4 | `apps/dashboard-e2e/src/audit/audit-core.ts` exporta `MIN_TAP_TARGET` i `collectMetrics`, però `responsive-audit.spec.ts` en manté còpies locals idèntiques | 

## Neteja menor

| # | Ítem |
|---|------|
| N1 | ~15 símbols exportats que només s'usen dins del seu propi fitxer (`FIGURE_PALETTE`, `TRONC_*_PX`, `ALL_COLUMNS`, `HelpItem`, `ColumnType`…). Detectables amb `pnpm run lint:dead`; treure'ls l'`export` és cosmètic |
| N2 | `.cursor/plans/` conté ~42 plans antics **no versionats** (el directori està a `.gitignore`). Esborrables del disc quan es vulga |
| N3 | Els reports de Playwright (`apps/dashboard-e2e/playwright-report-*`) s'acumulen al working tree; no estan versionats |
