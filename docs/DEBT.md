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

**Verificat contra el codi:** 1 d'agost de 2026

---

## Backend — correcció i fiabilitat

| # | Ítem | On | Impacte |
|---|------|-----|---------|
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
| SEC5 | Dret a l'oblit no implementat: falta l'anonimització de `persons` (nom, cognoms, email, telèfon) conservant l'històric de pinyes i assistència de forma anònima, i el filtre de re-importació al `SyncModule` perquè el legacy no ressuscite la persona | RGPD/LOPDGDD. Ajornat conscientment del sprint de compliment. Cal marca `anonymizedAt` a `Person` (no reutilitzar `isActive`, per BUG-9 a `person-sync.strategy.ts:380`). Pla a [[GDPR_COMPLIANCE]] §11 |

## Frontend

| # | Ítem | On | Notes |
|---|------|-----|-------|
| F1 | El workspace de Pinyes no és usable per sota de `sm` (639px): hi ha un guard que mostra "encara no optimitzat per a mòbil" a Pinyes, Troncs i Nodes extra | `pinyes-tab`, `troncs-tab`, `nodes-tab` | Decisió conscient: a 393px el canvas quedava en 73px reals |
| F4 | `figure-canvas.component.ts` fa **2.707 línies** | `figure-canvas.component.ts` | Una extracció (`KonvaStageService` + renderers per mode) es va fer i **es va revertir el 12/06/2026 perquè no es va connectar mai**. No repetir-la sense connectar-la de debò |
| F5 | Les interfícies `Create*Payload` / `Update*Payload` del dashboard no viuen a `libs/shared` | `features/*/models/` | Els models del frontend van derivant respecte dels DTOs de l'API |

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
