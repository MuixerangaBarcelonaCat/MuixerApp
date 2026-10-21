# S10: guió de la demo i preguntes freqüents

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preparar la demo (setmana del 26 d'octubre de 2026) i, després, recollir el que en isca per a omplir el manual.

**Fitxers:**
- `docs/internal/demo-dashboard-guio.md`: guió per a qui presenta.
- `docs/manual/20-preguntes-frequents.md`: preguntes freqüents per als tècnics.

**Depèn de:** S01-S09. El guió es pot escriure abans que estiguen totes acabades, però el **Task 3** necessita les pàgines fetes.

**Spec:** `docs/superpowers/specs/2026-10-21-manual-us-dashboard-design.md` · **Pla arrel:** `00-general.md`

## Constants de la sessió

- 1 h 30 min de videotrucada amb la pantalla del Dashboard compartida.
- Unes 10 persones: programadors i tècnics de pinyes, de troncs i de xicalla, tots junts.
- Fil conductor: el manual. Cada bloc obri primer la pàgina del manual a Configuració → Manual (10 segons) i després fa la tasca en directe a la pantalla real. Així queda clar on tornar a buscar-ho.
- La demo segueix el flux real de treball, no l'ordre del menú.

---

### Task 1: Escriure el guió `docs/internal/demo-dashboard-guio.md`

El guió porta frontmatter `tags: [qa]` i peu `*Veïns: [[00-benvinguda]] · [[PINYES_MODULE]] · [[ad-hoc-nodes-user-guide]]*` (regla de `docs/`). Té quatre parts.

- [ ] **Step 1: Preparació (D-3 a D-0)**

  - [ ] **Entorn:** decidir on es fa la demo en directe.
    - Recomanat: l'entorn de preproducció (`docs/DEPLOY_PRE.md`), amb les dades sincronitzades fa poc.
    - Si s'ha de fer a producció: crear un event «Assaig de demo» amb data passada i esborrar-lo en acabar. Un event de producció apareix a l'agenda dels membres a la PWA.
  - [ ] **Desplegament:** el visor Configuració → Manual (pla arrel, Task 2) ha d'estar desplegat on es farà la demo. Si no arriba a temps, es pot ensenyar el manual des de la rama local (`pnpm run dev:up`).
  - [ ] **Dades preparades** a l'entorn triat:
    - una plantilla que tinga pinya, rengles i tronc amb estructura;
    - un event anterior amb assignacions, que és el que s'importarà;
    - el mateix event o un altre amb, com a mínim, dos segments.
  - [ ] **Assaig en sec de 30 min** del recorregut sencer, cronometrat.
  - [ ] **Pantalla compartida:**
    - zoom del navegador al 125 %;
    - tema clar;
    - sense marcadors ni notificacions;
    - una sola pestanya del Dashboard i una altra de la PWA en mida de mòbil (eines de desenvolupador, 390×844).
  - [ ] **Persona que apunta:** triar qui apunta els dubtes i els trucs durant la trucada en un document compartit. Són els «coneixements compartits» que alimenten el Task 3.

- [ ] **Step 2: Agenda (90 min)**

  | Temps | Bloc | Pàgines | Què es fa en directe | Qui ha de mirar |
  |---|---|---|---|---|
  | 0:00-0:05 | Benvinguda | 00 | Objectiu de la sessió. On és el manual (Configuració → Manual). Com està organitzat: una pàgina per pantalla, amb blocs per a pinyes i per a troncs/xicalla. Qui apunta els dubtes. | tothom |
  | 0:05-0:15 | La base | 02, 03, 04 (06 breu) | Per què les dades venen de l'app antiga i la «Sincronització global». Buscar una persona i veure'n el detall. Etiquetes i l'assistent «Etiqueta persones». Com influeixen les etiquetes a l'hora d'assignar. | tothom |
  | 0:15-0:25 | Events | 07 | Crear «Assaig de demo». El detall: «Resum», «Assistència» (els estats canvien segons la fase), «Notes», «Imprimeix» i «Confirmació». | tothom |
  | 0:25-0:40 | Plantilles | 08, 09, 10 | Llista i editor (3 min). Pinya i rengles (6 min). Tronc i «Estructura del tronc» (6 min). Missatge clau: si una figura ja té gent assignada en un event, els canvis a la plantilla no la modifiquen. | 08 tothom · 09 pinyes · 10 troncs/xicalla |
  | 0:40-0:50 | Esquelet de l'event | 11 | «Segment nou», «+ Figura», publicar. El commutador Pinyes/Troncs. Llegir les insígnies «x/y pinyes» per veure si hi ha prou gent. Cordons i mode de figura. | tothom; pinyes, cordons |
  | 0:50-1:05 | Assignació | 12, 13, 14 | Primer troncs: «Importa tronc», panell de persones, alçades. Després pinyes: «Importa pinya», comptadors «lliures / elegibles». Conflictes: on es veuen i com es resolen. | 12 troncs/xicalla · 13 pinyes · 14 tothom |
  | 1:05-1:15 | Distribució i projecció | 15, 16 | Col·locar les figures, «Optimitza distribució», «Previsualitza» i «Projecta». | tothom |
  | 1:15-1:20 | Participació | 17 | Llegir «Càrrega: mín · mitjana · màx», filtres per troncs/pinyes/xicalla. | tothom |
  | 1:20-1:25 | L'app dels membres | 19 (18 si queda temps) | Què veu un membre i què veu un tècnic. «Passa llista». | tothom |
  | 1:25-1:30 | Tancament | 20 | Preguntes. Recordar on és el manual i com fer arribar dubtes nous. | tothom |

  Marge: si el bloc d'assignació s'allarga, es retalla Comunicació (18) i es fa «Participació» en 3 min.

- [ ] **Step 3: Guió per bloc.** Per a cada fila de l'agenda, copia de la secció «Notes per a la demo» del pla S0x corresponent:
  - els clics exactes;
  - les dades que es fan servir;
  - les preguntes probables amb la resposta curta.

  No n'inventes: si una nota no existeix, deixa el bloc amb els clics de la pàgina del manual.

- [ ] **Step 4: Després de la demo.** Llista de comprovació:
  - esborrar «Assaig de demo» (si es va fer a producció);
  - passar les notes de la persona que apuntava al Task 3;
  - enviar el missatge de seguiment (Step 5).

- [ ] **Step 5: Missatge de seguiment per als tècnics** (dins del guió, a punt per a copiar):

  > Gràcies per vindre a la demo del Dashboard. Tot el que vam veure és al Dashboard, a **Configuració → Manual**: hi ha una pàgina per cada pantalla, amb una part per a pinyes i una altra per a troncs i xicalla. Si vos encalleu en alguna pantalla, obriu el manual i busqueu-la pel nom. Si alguna cosa no s'entén o hi falta, feu-nos-ho saber i l'afegirem.

- [ ] **Step 6: Commit**

```bash
git add docs/internal/demo-dashboard-guio.md docs/MAP.md
git commit -m "docs: add dashboard demo script"
```

Afig també a la taula «Guies d'ús» de `docs/MAP.md` la fila `| [[demo-dashboard-guio]] | Guió de la demo del Dashboard per als tècnics (internal/) |`. Només eixa fila: les files de `docs/demo/` sense commitejar continuen fora del commit (mateix procediment que el Task 4 del pla arrel).

---

### Task 2: Pàgina `20-preguntes-frequents.md` inicial

- [ ] **Step 1:** Crea la pàgina amb:
  - `<!-- rutes: -->` buit;
  - títol «Preguntes freqüents»;
  - una frase que explique que la pàgina creix amb els dubtes que van eixint.

  Cada pregunta segueix el format:

  ```markdown
  ### <La pregunta, tal com la faria un tècnic>
  <Resposta en 1-3 frases.> Més detall: [<pàgina>](NN-pagina.md).
  ```

  Agrupa les preguntes per bloc del flux, amb els mateixos grups que `MANUAL_PAGES`.

- [ ] **Step 2:** Omple-la amb les «preguntes probables» de les notes per a la demo de S01-S09 que ja tinguen resposta clara.
- [ ] **Step 3:** Revisa-la a `/config/manual/20-preguntes-frequents` i passa la checklist de llengua del pla arrel.
- [ ] **Step 4:** Commit: `docs(manual): add FAQ page`.

---

### Task 3: Després de la demo, bolcar els coneixements compartits

- [ ] **Step 1:** Classifica cada nota del document compartit en un d'estos tipus:
  - **pregunta** → va a `20-preguntes-frequents.md`;
  - **explicació que falta o confon** → s'edita la pàgina de la pantalla;
  - **manera de fer d'un tècnic que val la pena compartir** → «Trucs» dins del bloc del perfil corresponent;
  - **error o proposta de millora de l'app** → fila a `docs/DEBT.md` o issue, no al manual.
- [ ] **Step 2:** Aplica els canvis. Si un canvi afecta una captura, torna-la a generar amb `SHOTS=<prefix> pnpm run docs:manual-shots`.
- [ ] **Step 3:** Commit: `docs(manual): incorporate demo feedback`.
- [ ] **Step 4:** Amb la confirmació de l'usuari, esborra `docs/demo/` i les seues files de `docs/MAP.md`. Ara es deixa de banda, i el criteri del projecte és esborrar, no arxivar.
