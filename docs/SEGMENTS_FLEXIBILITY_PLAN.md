---
tags: [domini]
---

# Flexibilitat de segments — seguiment d'execució

> Complementa [[SEGMENTS_FLEXIBILITY]] (el disseny: D1–D13, taxonomia, riscos, i el pla per fases §7,
> que ja té els "Passos" i el "Fet quan" de cada fase). Aquest document **no repeteix** el disseny —
> només trackeja en quin punt està el sprint i guarda el que el disseny no pot saber per endavant
> (quirks d'entorn, decisions operatives descobertes en implementar).

## Com s'utilitza

1. **Una sessió nova per fase, en mode Plan.** Al començar: llegir [[SEGMENTS_FLEXIBILITY]] §7 (la
   secció de la fase corresponent) — d'ací surt el pla, no d'aquest document.
2. Aprovar el pla → implementar en la **mateixa sessió** (mode Plan no continua sol si es tanca la
   conversa o es canvia d'eina entre aprovació i implementació).
3. Verificar amb proves reals (tests +, si la fase toca UI, Playwright — veure "Entorn" més avall).
4. Actualitzar la taula de seguiment (estat + data + commit) i, només si ha sortit alguna cosa que el
   disseny no anticipava (un quirk d'entorn, una restricció descoberta, un ajornament acordat amb
   l'usuari), afegir-la a "Notes operatives obertes". Si no n'hi ha cap, no s'hi escriu res.
5. Si un escenari falla: no passar de fase. Arreglar-ho o documentar per què es descarta.

---

## Seguiment del sprint

| Fase | Objectiu | Estat | Data | Commit |
|---|---|---|---|---|
| 0 | Fonaments i bugs de col·lapse | ✅ Fet | 2026-08-10 | `cf0952d` |
| 1 | Motor de conflictes (backend additiu) | ✅ Fet | 2026-08-10 | `7175278` |
| 2 | Participació sobre la font canònica | ✅ Fet | 2026-08-10 | `3def7ba` |
| 3 | El taller en mode lectura | ✅ Fet | 2026-08-11 | `9355c26`, `2b96c30` |
| 4 | Resolució interactiva al taller | ✅ Fet (Playwright confirmat en viu) | 2026-08-11 | — |
| 5 | El canvi de règim (release coordinada) | ⬜ Pendent | — | — |
| 6 | Equilibri de participació event-wide | ⬜ Pendent | — | — |
| 7 | Seguiments (specs separats) | ⬜ Sense planificar | — | — |

---

## Entorn de verificació

- API dev: `nx serve api --configuration=no-watch` (el mode watch per defecte entra en bucle de
  reinici en esta màquina) · `http://localhost:3000/api`, Swagger a `/api/docs`.
- Dashboard dev: `nx serve dashboard` · `http://localhost:4200`.
- **Quirk local:** `localhost:5433` pot estar ocupat per un túnel SSH que guanya al bind de Docker; si
  `nx serve api` falla l'autenticació de BBDD tot i que `.env` és correcte, apuntar `DATABASE_URL` a la
  IP de LAN en lloc de `localhost` (no cal tocar `.env` ni el túnel).
- Cas reproduïble de referència: event `29b88c09-a57c-4de6-9ce8-894b91610a99`, segments `Pinets`
  (sortOrder 0) i el de *Remat de Xopera + Piló* (sortOrder 1).
- Auth per a `curl`: `POST /api/auth/login` (usuari `TECHNICAL`/`ADMIN` de dev) → `Bearer` (15 min).
- **Duplicats per a proves de conflicte, mentre les 3 uniques segueixen actives (fins Fase 5):** no es
  poden sembrar via API ni via `INSERT` real sense saltar-se una unique. Es sembren **dins del test**
  (unitari/integració amb la constraint dropada dins la transacció, patró
  `event-participation.integration.spec.ts:303`) — mai contra la BBDD de dev.
- **Playwright:** viu a `apps/dashboard-e2e/src/segments-flexibility/fase-N.spec.ts`, corre contra
  `nx serve api`+`dashboard` reals (sense mocks). Assercions sense `if (await x.count())` — patró que
  fa passar un test en silenci si l'element no hi és (bug trobat a `fase-3.spec.ts`). Només `chromium`
  té els binaris instal·lats localment.
- **Si un escenari necessita dades que no existeixen** (segment, figura, persones, usuari...): aturar-se
  i preguntar a l'usuari qui ho crea — mai improvisar-ho amb un atajo.

---

## Notes operatives obertes (no cobertes pel disseny)

- **`KEEP_BOTH` implementat però encara no es pot enviar**, tot i ser el nou defecte de D3: el modal de
  moure (`segment-manager.component.html`) ja el mostra primer, preseleccionat i **disabled**, amb el
  botó de confirmació bloquejat mentre siga l'opció triada — fixat amb Vitest
  (`segment-manager.component.spec.ts`). `move()` (`figure-instance.service.ts:294-298`) segueix
  re-apuntant assignacions al segment destí i, amb `UQ_node_assignments_segment_person` encara activa,
  enviar-lo seria una violació crua de constraint (500), no un 409. Es podrà activar quan la Fase 5
  elimini la unique.
- **`TroncChangeImpact` a `unassign`/`move`:** desviació acordada a la Fase 3, encara oberta (només
  `assign`/`swap` el retornen). La Fase 4 ha afegit `SegmentWorkspaceStateService.computeFreedPinyaNodeIds`
  com a segona implementació temporal de la mateixa regla del servidor (nodes PINYA sense assignació),
  cridada des de `onUnassign` a les pestanyes Pinyes/Troncs quan el node tocat és TRONC/BASE — a retirar
  quan la Fase 5 completi el contracte del servidor.
- **`targetTabForZone` sense `areaForZone()`:** `segment-assignment-render.util.ts:24-30` encara llista
  zones a mà — desviació deliberada del pas 6 de la Fase 0 (necessita BASE→null, que `areaForZone` no
  expressa). No bloqueja cap fase; deixar-ho així.
- **Dos riscos menors, sense fase assignada:** el fallback `'Sense plantilla'` de `figureName` quan
  `classifySegmentConflicts` es crida des de `getEventAssignmentSummary()` (inofensiu mentre eixe camí
  només exposi comptadors; trencaria si una fase futura hi exposa `placements`); i `cordon =
  renglaPosition` vs `ringLevel` sense confirmar formalment.

---

*Veïns: [[SEGMENTS_FLEXIBILITY]] · [[PINYES_MODULE]] · [[DATA_MODEL]] · [[ROADMAP]]*
