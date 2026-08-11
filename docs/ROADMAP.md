---
tags: [qa]
---

# Roadmap i estat

> Estat de les fases del projecte. Un sol document: on som i què queda.
> L'historial detallat de cada fase viu al **git log** (`git log --oneline`) i a les PR de GitHub.
> Deute tècnic i troballes obertes → [[DEBT]].

**Última actualització:** 11 d'agost de 2026

---

## Estat de les fases

| Fase | Contingut | Estat |
|------|-----------|-------|
| P0–P3.1 | Scaffold, Persones, Sync del legacy, Temporades (CRUD), Events + Assistència | ✅ |
| P4.1–P4.4 | Auth (JWT), Dashboard Events, Design Refactor (DaisyUI), Docker multi-entorn | ✅ |
| P5.1–P5.2 | Pinyes: Templates + editor Konva, Composicions | ✅ |
| P5.3–P5.5 | Segments + Instàncies, Assignació de persones, Snapshot lazy | ✅ |
| P5.6–P5.9 | Troncs (CSS Grid), ordre de bases, Projecció | ✅ |
| P5.10–P5.13 | Posicions/Lock/Historials, Rengles, Nodes ad-hoc, retirada de `FigureFamily` | ✅ |
| Refactors | Unified Segment Workspace, presets unificats, distribució de segments, cordons oberts | ✅ |
| PWA | App de membres: login, agenda, confirmació d'assistència | ✅ |
| Delegació | Assistència en nom d'altres (`person-delegate`) | ✅ |
| Auditoria a11y/responsive | Card mode, tap targets ≥24px, guards de mòbil, localització de dates | ✅ |
| P5.3.1 | Revisió UX de segments. Fet: `event-detail` en pestanyes (Resum / Pinyes / Assistència / Participació) amb `?tab=`. Queda el preview de canvas inline | ⚪ Parcial |
| Participació | Matriu persona × segment per event (`?tab=participacio`), cercable per persona i pel que fa | ✅ |
| Flexibilitat de segments | Permetre una persona dues vegades al mateix segment, amb avís en lloc de bloqueig. Fases 0–6 implementades (motor de conflictes, taller, canvi de règim, equilibri de participació event-wide). Queda la Fase 7 (seguiments) → [[SEGMENTS_FLEXIBILITY]] | 🟢 Gairebé |
| Compliment LOPDGDD/RGPD | Consentiment click-wrap (Dashboard+PWA), clàusula de transparència, textos legals editables a BBDD, audit log. Verificat E2E. Dret a l'oblit ajornat ([[DEBT]] SEC5); pendent RAT (L1) i revisió legal dels textos (L2) → [[GDPR_COMPLIANCE]] | ✅ |
| P6.2 | Push notifications a la PWA (FCM) | ⚪ Pendent |
| P7 | Informes d'assistència i estadístiques | ⚪ Pendent |
| P8+ | Export PDF de pinyes, multi-tenant, auditoria/versionat | ⚪ Pendent |

**Simplificacions de model ja aplicades:** eliminades `FigureFamily` i `ReferenceElement`;
`hasPinya` → `FigureMode`; `sourceVariantOrder` i el sistema de variants retirats.

---

## Següent increment

1. **Gestos del canvas** — pinch/wheel zoom i pan en mode assignació. Són el requisit previ per fer
   utilitzable el workspace de Pinyes en tauleta i mòbil (ara hi ha un guard que mostra "no optimitzat"
   per sota de `sm`). Vegeu [[DEBT]] §Frontend.
2. **P5.3.1** — revisió d'UX dels segments dins `event-detail`.
3. **Cobertura E2E** — avui només hi ha els `example.spec.ts` d'scaffold més la suite d'auditoria
   ([[AUDIT_SUITE]]). Falten fluxos reals: login, alta de persona, assignació.

---

## Decisions estructurals preses

| Decisió | Motiu |
|---------|-------|
| Konva amb API imperativa (no `ng2-konva`) | `ng2-konva` és incompatible amb Angular 20+ |
| Access token en memòria + refresh en cookie httpOnly | Evita XSS sobre el token persistit |
| Migracions TypeORM amb `synchronize: false` | Control explícit de l'esquema; no hi ha seed |
| Snapshot lazy d'instàncies | Les figures d'events passats no canvien si s'edita el template |
| Zero CSS propi (només tokens DaisyUI) | Consistència visual i tema generat per colla |
| Sense NgRx (només signals) | L'estat és local per pantalla; NgRx seria sobredimensionat |
| Multi-tenant ajornat | Caldrà `collaId` al JWT i als guards; es dissenya per a P8+ |
