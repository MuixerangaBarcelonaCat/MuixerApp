# Assistent d'etiquetatge de persones — disseny

## Objectiu

Que l'equip tècnic puga etiquetar persones ràpidament sense eixir de `/config/tags`: un modal
que recorre persones d'una en una, amb les etiquetes a un clic, i una banda que fa visible
quantes persones queden pendents.

Fora d'abast (cicles propis): avisos de pendents a `/home` (inclosa l'alçada d'espatlles que
falta) i neteja de persones que només han passat per un assaig.

## Comportament

### Banda de pendents
A `/config/tags`, sobre la taula: «N persones pendents d'etiquetar» amb un botó que obri el
modal en mode *Pendents*. Si N = 0, no es mostra (o es mostra un estat neutre). El recompte és
`meta.total` de `GET /persons?isActive=true&tagRuleOk=false&limit=1`.

«Pendent» = persona activa que **no compleix la regla mínima** d'etiquetatge
(`docs/TAGS.md` §4). Una persona només amb «Persones Noves» és pendent fins que té tronc.

### Modal
- Dos modes, commutables dins del modal:
  - **Pendents**: actives amb `tagRuleOk=false`, ordenades per nom.
  - **Tothom**: totes les actives, ordenades per nom (repàs d'inici de temporada/trimestre).
- **Cercador** (nom, àlies, cognoms) per saltar a una persona; reutilitza el paràmetre `search`.
- Fitxa de la persona: nom complet, àlies, indicador de xicalla, alçada d'espatlles i notes
  (amb emoji). No es mostren gènere, edat, data d'ingrés ni telèfon (reservats a Admin).
- Enllaç «Veure detall» que obri `/persons/:id` en pestanya nova (`target="_blank"`,
  `rel="noopener"`).
- Etiquetes com a xips agrupats per categoria (PINYA / TRONC / XICALLA / ALTRES), amb el color
  de l'etiqueta. Un clic activa/desactiva.
- Navegació «Anterior» / «Següent» i indicador de posició («3 de 17»).
- **Desa immediat**: cada clic crida `POST /tags/:id/persons` o
  `DELETE /tags/:id/persons/:personId`. Si falla, es desfà el xip i es mostra un toast d'error.
  No hi ha botó «Desa».

### Cua en viu (mode Pendents)
En etiquetar una persona fins que compleix la regla, **continua visible** fins que l'usuari
prem «Següent» (així pot afegir més d'una etiqueta). En avançar, les persones que ja compleixen
la regla se'n lleven de la cua. «Anterior» només és fiable al mode *Tothom*, on la llista no
canvia. Al mode *Pendents*, «Anterior» torna a l'últim element que encara siga a la cua.

Quan la cua queda buida: estat buit amb missatge i opció de passar a *Tothom*.

## Arquitectura

**Cap canvi de backend.** `GET /persons` ja retorna `positions`, `tagCompliance`,
`shoulderHeight`, `notes`, `notesEmoji`, `isXicalla`, i admet `isActive`, `tagRuleOk`, `search`,
`sortBy`. Els endpoints d'assignació ja existeixen i són `TECHNICAL`/`ADMIN`.

Frontend (`apps/dashboard/src/app/features/config/components/`):
- `tagging-wizard-modal/` — component standalone + OnPush + Signals, basat en `lib-modal`.
  Estat: llista de persones carregada, índex actual, mode, terme de cerca.
- `tags-list` — afegeix la banda de pendents i obri el modal.
- Càrrega: pàgines de 100 (límit de l'API) fins a esgotar `meta.total`.
- Recompute local de compliment amb `evaluateTagCompliance` de `@muixer/shared` (mateixa regla
  que el servidor) en canviar les etiquetes d'una persona; no es torna a consultar el servidor
  per a la cua.
- Serveis existents: `PersonService.getAll`, `TagService.assignPersons/unassignPerson`,
  `TagService.getAll` (catàleg d'etiquetes).

UI amb components de `@muixer/ui` (modal, button, badge, input, empty-state, toast) i tokens
del sistema de disseny; text de la UI en català.

## Gestió d'errors
- Fallada en assignar/treure: es reverteix el xip i toast d'error; la resta continua funcionant.
- Fallada en carregar la llista: estat d'error al modal amb reintent.
- Persona eliminada o desactivada mentre el modal és obert: l'error 404 de l'assignació es
  tracta com a fallada normal.

## Proves
- Unitàries (Vitest) del modal: mode Pendents lleva en avançar les persones que ja compleixen;
  mode Tothom manté la llista; revertir el xip si l'API falla; cerca; enllaç de detall.
- `tags-list`: la banda mostra el recompte i obri el modal.
- Sense proves de backend noves (no es toca).

## Decisions
- Per persona (no per etiqueta); desa immediat; pendents = no compleix la regla mínima;
  cua en viu amb la persona actual retinguda fins a «Següent».
