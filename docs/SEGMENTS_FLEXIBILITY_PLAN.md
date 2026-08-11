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
| 4 | Resolució interactiva al taller | ✅ Fet (Playwright confirmat en viu) | 2026-08-11 | a968629b |
| 5 | El canvi de règim (release coordinada) | ✅ Fet (Playwright confirmat en viu) | 2026-08-11 | — |
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
- **Duplicats per a proves de conflicte:** fins que la migració de la Fase 5
  (`1783800000000-DropNodeAssignmentDuplicateUniques`) s'executi contra la BBDD de dev
  (`nx run api:migration-run`), les 3 uniques originals segueixen actives i els duplicats només es
  poden sembrar **dins del test** (unitari/integració amb la constraint dropada dins la transacció,
  patró `event-participation.integration.spec.ts:303`) — mai contra la BBDD de dev. Un cop la migració
  corre, un duplicat es pot crear via API/UI normal (eixe és el propòsit de la fase).
- **Playwright:** viu a `apps/dashboard-e2e/src/segments-flexibility/fase-N.spec.ts`, corre contra
  `nx serve api`+`dashboard` reals (sense mocks). Assercions sense `if (await x.count())` — patró que
  fa passar un test en silenci si l'element no hi és (bug trobat a `fase-3.spec.ts`). Només `chromium`
  té els binaris instal·lats localment.
- **Si un escenari necessita dades que no existeixen** (segment, figura, persones, usuari...): aturar-se
  i preguntar a l'usuari qui ho crea — mai improvisar-ho amb un atajo.

---

## Notes operatives obertes (no cobertes pel disseny)

- **Playwright de la Fase 5 escrit i confirmat en viu (`fase-5.spec.ts`).** Migració
  `1783800000000-DropNodeAssignmentDuplicateUniques` executada contra la BBDD de dev (via
  `migrationsRun` automàtic de `nx serve api`). L'escenari real: alliberar un node de tronc
  (clic + Backspace a la cerca buida, `person-panel.component.ts:472`), reassignar-hi una
  persona ja col·locada per obrir el diàleg D8 (`already-assigned-dialog`), "Assignar
  igualment" → banner de conflicte → panell → "Treu esta" → reassignar l'ocupant original per
  deixar el segment de referència exactament com estava (verificat contra la BBDD:
  55 `node_assignments` abans i després). El test és idempotent — es pot re-córrer sense
  sembrar brossa a l'entorn de dev. Credencials `E2E_EMAIL`/`E2E_PASSWORD` desades a la memòria
  d'agent, no al repo.
- **Bug de seguretat trobat durant la implementació, corregit dins la mateixa fase:**
  `resolveSegmentMoveConflicts` no tenia cap branca per `KEEP_BOTH` — com `KEEP_TARGET`/`KEEP_MOVED`
  eren els únics valors reals fins ara, el seu `else` esborrava sempre el costat destí. Com el DTO ja
  validava `KEEP_BOTH` com a membre vàlid de l'enum (des de la Fase 4), l'API es podia induir a un
  esborrat no intencionat si algú l'enviava manualment abans que `move()` el fera servir de veritat.
  Afegida una branca explícita no-op abans d'activar `KEEP_BOTH` a `move()`.
- **Decisió presa en implementar, no al disseny: `assign()`/`swap()` no incorporen un camp `conflicts`
  a la resposta.** El disseny (§7 Fase 5) ho suggeria, però el taller ja té un mecanisme reactiu
  (`SegmentWorkspaceStateService.reloadConflicts()`, cridat per `refreshInstance()`) que recarrega
  `ws.conflicts()` des de `getSegmentConflicts` — abans de la Fase 5 mai s'invocava fora del primer
  assignament perquè els duplicats eren impossibles. S'ha afegit la crida a `reloadConflicts()` després
  de tot assign/swap/unassign/cross-swap ja snapshotat (abans només ho feia el camí de primer
  assignament), que és el fix real per a "el banner no s'actualitza en crear un duplicat". Afegir a
  sobre un camp `conflicts` a la resposta d'`assign`/`swap` hauria sigut una segona font de la mateixa
  dada (contra D13) sense cap consumidor. **`move()` sí retorna `conflicts`/`impact`**, perquè
  `segment-manager` (la vista de llista de segments) no té este mecanisme reactiu — és una pàgina
  diferent del taller.
- **El modal de resolució de conflicte de moviment (`segment-manager.component.html`, Fase 4) s'ha
  retirat, no adaptat.** Depenia per complet del 409 que `move()` llançava per obrir-se abans de moure;
  en desaparèixer el 409 (D3: KEEP_BOTH sempre reeixeix), no quedava cap forma de disparar-lo. En lloc
  de rediscenyar-lo com a acció de neteja posterior al moviment (que hauria calgut un endpoint nou, fora
  d'abast), es mostra un toast d'avís (`toast.warning`) quan `result.conflicts?.length`, remetent el
  tècnic al panell de conflictes del taller (Fase 4) — la mateixa eina, no una duplicada.
- **`TroncChangeImpact` a `move()` ✅ (Fase 5), a `unassign()` encara no.** `move()` ara el retorna
  (D11, reaprofitant `computeTroncChangeImpact`, fet públic a `NodeAssignmentService` per a l'ús des de
  `FigureInstanceService`). `SegmentWorkspaceStateService.computeFreedPinyaNodeIds` (Fase 4, còpia
  client de la mateixa regla) es manté fins que `unassign()` també el retorni — no s'ha ampliat l'abast
  d'esta fase per cobrir-ho.
- **`targetTabForZone` sense `areaForZone()`:** `segment-assignment-render.util.ts:24-30` encara llista
  zones a mà — desviació deliberada del pas 6 de la Fase 0 (necessita BASE→null, que `areaForZone` no
  expressa). No bloqueja cap fase; deixar-ho així.
- **Dos riscos menors, sense fase assignada:** el fallback `'Sense plantilla'` de `figureName` quan
  `classifySegmentConflicts` es crida des de `getEventAssignmentSummary()` (inofensiu mentre eixe camí
  només exposi comptadors; trencaria si una fase futura hi exposa `placements`); i `cordon =
  renglaPosition` vs `ringLevel` sense confirmar formalment.

---

*Veïns: [[SEGMENTS_FLEXIBILITY]] · [[PINYES_MODULE]] · [[DATA_MODEL]] · [[ROADMAP]]*
