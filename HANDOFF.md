# Handoff — Importació per àmbit (pinya/tronc/figura) amb previsualització (branca `feat/improve-import-figura`)

## Objectiu

Permetre importar assignacions d'una figura anterior per àmbit — només Pinya, només Tronc, o la Figura sencera — en lloc de sempre tot, més una previsualització visual de cada àmbit abans d'importar. Motivació: tècnics de pinya i de tronc són persones diferents, cadascuna treballa en la seua part.

## Estat actual

- **Implementació completa i comitejada**, via subagent-driven-development (8 tasques en 2 fases + 1 fix de revisió final + 1 fix de bug reportat per l'usuari després).
- Spec: `docs/superpowers/specs/2026-09-01-import-scope-and-preview-design.md`
- Pla: `docs/superpowers/plans/2026-09-01-import-scope-and-preview.md`
- Commits (de `31f9088` a `bd90a25`, 12 commits): enum `ImportScope` + `zonesForScope` a `@muixer/shared`, filtre de zona a `bulkImport()` (API), `segmentId`/`zone` afegits a `getHistory()`, `BulkImportPayload.scope`, 3 accions al modal d'importació (Pinya/Tronc/Figura), `PinyaProjectionComponent` amb input `scope` (amaga panell de tronc per PINYA), `ImportPreviewModalComponent` nou (overlay de previsualització), test de regressió per ad-hoc+scope, i un **fix post-hoc**: la previsualització de Tronc no passava `[assignments]` a `<app-tronc-view>` (mostrava posicions, no qui hi estava assignat) — corregit al commit `bd90a25`.
- `pnpm run ci:local` verd (lint+test+build, 7 projectes) després de cada fita important, inclòs després del fix final.
- Tots els tests automàtics passen: API 154/154, dashboard 1509 passed/2 skipped, pinyes-render inclòs.
- **Encara NO s'ha triat cap opció de `finishing-a-development-branch`** (merge local / push+PR / deixar com està) — es va oferir el menú just abans de rebre el report del bug de Tronc; queda pendent tornar a preguntar-ho un cop confirmat que el fix funciona.

## Regles de negoci clau (per si cal tocar codi de nou)

- Àmbit `PINYA` = zona `PINYA` només. Àmbit `TRONC` = `TRONC` + `BASE`. Àmbit `ALL` (Figura) = tot, comportament original i valor per defecte si `scope` s'omet (retrocompatible).
- **Nodes ad-hoc mai es filtren per àmbit** — sempre es cloen tots, independentment de l'scope triat (decisió explícita de l'usuari durant el brainstorming, sobreescrivint un esborrany anterior). Cobert per test de regressió (`bdebb24`).
- Cap desplegable a la UI — sempre 3 files/botons explícits: Pinya, Tronc, Figura.
- `pinyes-tab` manté un sol punt d'entrada; el botó ara diu "Importa figura" (abans "Importa pinya").
- Previsualització de Tronc renderitza `TroncViewComponent` directament (mai a través de `PinyaProjectionComponent`, perquè els panells de tronc s'ancoren a la geometria del canvas de pinya, absent quan l'àmbit és Tronc).

## Què ha funcionat

- **Subagent-driven-development** amb model Sonnet per als implementadors i reviewers de tasca, Opus/Sonnet per a la revisió final — 8 tasques, totes aprovades amb com a molt 1 ronda de fix (Task 7: faltava test del branching TRONC vs PINYA/ALL, corregit en una ronda).
- La revisió final de branca sencera (`git merge-base main HEAD`) no s'ha d'usar a cegues quan la branca ja portava treball previ no relacionat — calia acotar el rang a `31f9088..HEAD` (els 9 commits del pla) en lloc dels ~589 commits que iria fins `main`.
- Quan un usuari reporta un error 400 `uuid is expected` amb `undefined` a la URL i comptadors a 0 al modal després d'una implementació de backend, **sospitar primer del servidor dev no reiniciat** (Nx no sempre recarrega en calent canvis a les libs `@muixer/shared`/`@muixer/pinyes-render` dins un `nx serve` ja en marxa) abans de buscar un bug al codi — en este cas era exactament això.
- `nx test <proj> --testFile=<path>` funciona bé quan l'invoca un subagent (Bash normal), però des d'esta sessió principal l'ordre `--testFile` dona `'testFile' is not found in schema` — cal córrer `pnpm exec nx test dashboard` sencer (o investigar per què el subagent sí que ho aconseguia, potser una versió diferent del `project.json` d'executor `@angular/build:unit-test` no suporta eixe flag directament i el subagent l'invocava diferent).

## Què NO ha funcionat / cal vigilar

- Dos intents de revisió final amb model **Opus** van fer *stall* (600s sense progrés) llegint el mateix fitxer de diff de 65KB — no sembla relacionat amb la mida, probablement un problema puntual d'infraestructura d'eixe moment. Es va resoldre reintentant amb **Sonnet**, donant instruccions de llegir el diff amb `git diff` incrementalment fitxer a fitxer en lloc d'un sol fitxer gran — va funcionar bé i sense stalls.
- `nx` no està al PATH en bash no interactiu d'esta sessió — cal `pnpm exec nx` (no `npx nx` ni `nx` a soles).

## Pròxims passos

1. **Confirmar amb l'usuari que el fix de `bd90a25` (assignments al preview de Tronc) resol el problema reportat** — reiniciar `nx serve dashboard` / refrescar navegador i tornar a provar la previsualització de Tronc.
2. Si tot va bé, tornar a oferir el menú de `superpowers:finishing-a-development-branch` (merge local a `main` / push+PR / deixar com està) i executar l'opció triada.
3. Llista de proves manuals ja donada a l'usuari en esta conversa (botó "Importa figura", 3 files amb comptadors, previsualització per àmbit, importació per àmbit amb i sense nodes ad-hoc, conflictes no sobreescrits) — repassar-la sencera si encara no s'ha fet punt per punt.
4. Nota pendent no confirmada: l'usuari va esmentar un document de funcionalitat addicional a implementar **després** d'esta primera part (`docs/superpowers/specs/2026-09-01-import-pinya-preview-design.md` — aquest fitxer ja no existeix, va quedar absorbit dins l'spec actual `2026-09-01-import-scope-and-preview-design.md` durant el brainstorming). Si l'usuari torna a parlar d'una "segona part", no cal buscar cap document separat — ja està tot dins l'spec actual.
5. Fitxer no relacionat `scripts/migrate-pre-to-dev.sh` apareix com untracked a `git status` — no es va tocar en esta sessió, probablement treball previ de l'usuari; no tocar sense preguntar.
