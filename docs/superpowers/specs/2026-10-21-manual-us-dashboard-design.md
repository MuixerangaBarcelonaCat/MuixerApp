# Manual d'ús del Dashboard i demo per als tècnics: disseny

## Per què

La setmana del 26 d'octubre de 2026 hi ha una demo del Dashboard per als tècnics. Fa temps que el
fan servir, però ningú no els l'ha explicat i hi ha moltes coses que no entenen. Un primer intent
(`docs/demo/`, sessió «dashboard-demo-tecnics») va quedar **massa genèric: no explicava les
seccions per separat**. Es deixa apartat sense tocar-lo i es comença de zero.

En lloc de preparar material d'un sol ús, s'aprofita el repàs de totes les pantalles per a escriure
un **manual d'ús viu**:

- és la base per a preparar i conduir la demo;
- queda sempre disponible a **Configuració → Manual**;
- s'actualitza cada vegada que canvia alguna cosa funcional (regla a `CLAUDE.md`).

## Qui el llig i com

- **Tècnics de pinyes, de troncs i de xicalla.** Són poc tècnics. Xicalla fa servir les mateixes
  vistes que troncs.
- Hi ha **dos usos**, i el manual ha de servir per a tots dos:
  1. **Consulta ràpida**: la persona està encallada en una pantalla concreta i vol resoldre-ho en
     aquell moment. Ha de trobar la pàgina d'aquella pantalla pel nom i resoldre-ho sense llegir res més.
  2. **Lectura ordenada**: algú que entra per primera vegada llig el manual de principi a fi i
     entén què fa l'app i en quin ordre es treballa.
- La PWA només s'explica perquè els tècnics entenguen què hi veu un membre i què hi veu un tècnic.
  El manual **no** apareix dins de la PWA.

## Com treballen els tècnics (flux que ordena el manual)

1. **Base comuna (tots):**
   - crear assajos i actuacions;
   - entendre, sense tecnicismes, que les dades encara venen de l'app antiga i que serà així una temporada;
   - gestionar persones, etiquetes i l'assignació d'etiquetes a persones (les etiquetes condicionen
     qui es proposa per a cada lloc de la figura);
   - temporades, usuaris i configuració.
2. **Plantilles:**
   - pinyes crea i revisa la part de pinya (pestanyes Pinya i Rengles);
   - troncs crea i revisa la part de tronc de la mateixa plantilla (pestanya Tronc i estructura del tronc).
3. **Esquelet de l'event (tots):** segments (proves) i figures de cada segment. Pinyes mira quantes
   mans calen en cada segment i si hi ha prou gent apuntada, i ajusta els cordons.
4. **Assignació en dos torns:**
   - primer troncs i xicalla, que tenen prioritat per a triar persones;
   - després pinyes, que omple els nodes de pinya amb la gent que queda;
   - tots dos poden importar assignacions anteriors.
5. **Distribució:** col·locar les figures tal com eixiran a la pantalla i tal com es faran a la plaça.
6. **Revisió:** resoldre els conflictes i mirar la participació de cada membre per a repartir-la.

## Objectius

- Una pàgina per pantalla o grup de pantalles. Cada pàgina té una part comuna i, quan la feina
  canvia, blocs separats per a pinyes i per a troncs/xicalla.
- Captures de pantalla generades automàticament. Refer-les és una sola ordre.
- Manual visible dins del Dashboard, a `/config/manual`.
- Un guió de demo d'1 h 30 min que recorre el manual en l'ordre del flux.
- Una regla a `CLAUDE.md` perquè el manual i les captures s'actualitzen en el mateix PR que el canvi funcional.

## Fora d'abast (v1)

- Enllaços d'ajuda contextual des de cada pantalla cap a la seua pàgina (el botó «?»). Es pot afegir
  més avant: la taula de rutes de cada pàgina (vegeu més avall) ja ho fa possible.
- Manual dins de la PWA o per a membres.
- Cercador dins del manual. La navegació per seccions amb noms de pantalla és suficient.
- Vídeos o GIF.
- Tocar o esborrar `docs/demo/`.
- La pantalla `/design-system`, que és una eina interna.

## Anti-objectius (seria un fracàs encara que funcionara)

- Tornar a fer un text genèric: cada pàgina ha de nomenar els botons i les pestanyes exactes de la pantalla.
- Llenguatge tècnic: res de «endpoint», «snapshot», «instància» ni «node» sense explicar-ho. Es
  parla de figura, lloc, persona, segment i prova.
- Captures que ensenyen dades personals. Normalment el Dashboard mostra àlies, però hi ha camps
  personals al detall de Persona i també en altres llocs (els revisors dels plans S03, S04 i S09 els
  han trobat):
  - columna «Nom complet» de la llista de Persones;
  - columna «Nom» d'Assistència i modal de notes d'assistència;
  - resultats del quiosc de confirmació;
  - fitxa de l'assistent d'etiquetatge;
  - llista d'usuaris;
  - «Dispositius subscrits».

  Tots aquests camps es tapen amb `mask`.
- Un manual que es desfasa: si cal una feina manual per a refer les captures, no es farà.

## Decisions

### Contingut: `docs/manual/`

- Una carpeta, un fitxer Markdown per pàgina, amb un prefix numèric que dona l'ordre de lectura.
  Les imatges van a `docs/manual/img/`.
- Llengua: valencià, seguint `.agents/skills/language-rules/` (l'app tracta l'usuari de «vós»,
  imperatiu de 2a persona del singular per als botons). Els noms de botons i pestanyes s'escriuen
  exactament com a la UI, entre cometes baixes «».
- Les pàgines **no** porten frontmatter ni peu «Veïns» (s'exceptuen de la regla de `docs/`) perquè
  es renderitzen dins de l'app. `docs/MAP.md` només enllaça l'índex del manual.
- Cada pàgina comença amb un comentari HTML amb les rutes que cobreix, per exemple
  `<!-- rutes: /persons /persons/:id -->`. Serveix per a trobar quina pàgina s'ha d'actualitzar quan
  es toca una ruta. El sanititzador d'Angular elimina els comentaris, i per això no es veu a l'app.
- Plantilla de pàgina:
  1. `# Títol` (nom de la pantalla tal com es veu a la navegació)
  2. **Per a què serveix** (2-3 frases)
  3. **On és** (camí de clics)
  4. Captura principal
  5. **Pas a pas** de les tasques habituals (numerat, amb captures quan cal)
  6. **Si sou de pinyes** / **Si sou de troncs o xicalla** (només quan la feina canvia)
  7. **Compte amb** (errors i confusions habituals)
  8. **Relacionat** (enllaços a altres pàgines)

### Pàgines

| Fitxer | Cobreix |
|---|---|
| `00-benvinguda.md` | com fer servir el manual, recorregut recomanat per perfil, glossari |
| `01-primers-passos.md` | entrar, navegació principal, Inici, menú d'usuari, Aparença |
| `02-dades-app-antiga.md` | per què les dades venen de l'app antiga, Sincronització global (`/sync`) |
| `03-persones.md` | llista, persona nova, detall, invitació, adult responsable, delegacions, historial de pinyes |
| `04-etiquetes.md` | etiquetes, categories, «Posicions de figura», assistent «Etiqueta persones», com condicionen l'assignació |
| `05-temporades.md` | temporades i events fora de temporada |
| `06-usuaris-i-acces.md` | usuaris, rols, invitacions; per a ADMIN, «Privacitat i legal» |
| `07-assajos-i-actuacions.md` | llistes, crear/editar, detall (Resum, Assistència, Notes, Imprimeix), confirmació d'arribada |
| `08-plantilles.md` | llista de plantilles, figures i composicions, barra de l'editor, editor de composicions |
| `09-plantilles-pinya.md` | pestanyes Pinya i Rengles (pinyes) |
| `10-plantilles-tronc.md` | pestanya Tronc i «Estructura del tronc» (troncs/xicalla) |
| `11-segments-i-figures.md` | pestanya «Pinyes i Figures» de l'event: segments, figures, comptadors, cordons, mode, publicació |
| `12-assignacio-troncs.md` | espai de treball del segment, pestanya Troncs, panell de persones, «Importa tronc» |
| `13-assignacio-pinyes.md` | pestanya Pinyes, «Importa pinya», «Reinicialitza», comptadors |
| `14-conflictes.md` | persones en dos llocs alhora: on es veuen i com es resolen |
| `15-distribucio-i-nodes-extra.md` | pestanyes Distribució i Nodes extra |
| `16-previsualitza-i-projeccio.md` | Previsualitza i projecció a pantalla completa |
| `17-participacio.md` | pestanya Participació: equilibrar la càrrega |
| `18-comunicacio.md` | notícies i notificacions |
| `19-pwa.md` | què veu un membre i què veu un tècnic a la PWA, «Passa llista» |
| `20-preguntes-frequents.md` | dubtes i trucs que isquen de la demo i de l'ús |

### Visor: Configuració → Manual

- Una targeta «Manual» a `/config`, visible per a TECHNICAL i ADMIN. Rutes `/config/manual` i
  `/config/manual/:slug`; sense `slug`, s'obri `00-benvinguda`.
- `apps/dashboard/project.json` copia `docs/manual` a `/manual` com a recurs estàtic. Caddy ja serveix
  els fitxers reals abans del fallback a `index.html`.
- La llista de pàgines és una constant (`MANUAL_PAGES`: slug, títol, grup) que dibuixa el menú lateral
  (un selector en mòbil).
- El component baixa `/manual/<slug>.md` com a text i el renderitza amb `MarkdownService`
  (`@muixer/ui/markdown`), amb els mateixos estils `prose` que `lib-markdown-view`. Després de renderitzar:
  - `src="img/…"` passa a `/manual/img/…`;
  - un clic en un enllaç a `NN-x.md` navega amb el router a `/config/manual/NN-x`, en comptes d'obrir
    una pestanya nova (el servei posa `target="_blank"` a tots els enllaços).
  - Els enllaços relatius també funcionen a GitHub i a Obsidian.
- No cal tocar `MarkdownService`.

### Captures

- Una suite de Playwright pròpia, `apps/dashboard-e2e/playwright.manual.config.ts` +
  `src/manual/manual-shots.spec.ts`. Reutilitza `loginViaUi` i `spaGoto` de la suite d'auditoria i
  `TARGETS` per als ID de detall.
- Una sola llista declarativa de captures: fitxer de sortida, app, ruta, preparació opcional (obrir
  una pestanya o un modal) i element opcional per a ressaltar amb un contorn.
- Mides fixes: Dashboard 1280×800, PWA 390×844. Tema clar forçat.
- Els camps personals del detall de Persona es tapen amb l'opció `mask` de Playwright.
- Ordre: `pnpm run docs:manual-shots`. Escriu directament a `docs/manual/img/`.
- Dades: BD local de desenvolupament (dades sincronitzades reals; només àlies).
- Vista de membre de la PWA: només si hi ha `E2E_MEMBER_EMAIL`/`E2E_MEMBER_PASSWORD`; si no, es
  descriu amb text a partir de la vista de tècnic.

### Manteniment (regla a `CLAUDE.md`)

Qualsevol canvi de comportament visible del Dashboard o de la PWA (pantalla, pestanya, botó, flux o
text de botó nous o canviats) actualitza en el mateix PR:

- la pàgina del manual que cobreix la ruta (es troba amb `grep -rl "rutes:.*<ruta>" docs/manual`);
- les captures afectades (`pnpm run docs:manual-shots`);
- `MANUAL_PAGES`, si s'afig una pàgina.

### Demo

- Guió per a qui presenta a `docs/internal/demo-dashboard-guio.md`: agenda d'1 h 30 min,
  videotrucada amb pantalla compartida, unes 10 persones (programadors i tècnics), tots els perfils
  junts.
- La demo segueix l'ordre del manual. Per a cada bloc indica:
  - quina pàgina s'obri;
  - què es fa en directe i amb quines dades;
  - què ha de mirar cada perfil;
  - el temps.
- Comença ensenyant on és el manual.
- **Coneixements compartits:** durant la demo s'apunten els dubtes, els trucs i les maneres de fer
  de cada tècnic. Després es bolquen a `20-preguntes-frequents.md` o a la pàgina corresponent.

### Prioritat abans de la demo

1. Visor i script de captures. Si el visor no arriba a temps, la demo es pot fer igualment amb
   els fitxers del manual.
2. Contingut en l'ordre del flux: base comuna → events → plantilles → segments → assignació →
   distribució/previsualització → participació → PWA/comunicació.
3. Guió de la demo.
4. Després de la demo: preguntes freqüents i correccions.

## Coses que ha de saber qui escriu el contingut

- Al Dashboard no hi ha cap comptador «mans necessàries vs. gent apuntada». El que més s'hi
  acosta són:
  - les insígnies de cada segment, «23/35 pinyes, 29/45 total» en mode Pinyes;
  - els comptadors del panell de persones, «N lliures · N elegibles per a pinya».

  S'explica amb aquestes peces.
- Ara mateix «Passa llista» a la PWA es mostra tots els dies (ho permet una opció de proves,
  `docs/DEBT.md` F13). S'ha de descriure el comportament previst, que és mostrar-lo només el dia de l'event.
- `app-ad-hoc-nodes-help-modal` no es mostra enlloc. No s'ha d'esmentar.
- Les insígnies i les etiquetes d'estat d'assistència canvien segons la fase de l'event (abans, el
  dia, després), segons `event-phase.util.ts`.

## Decisions preses per Claude (revisables)

- Una pàgina per pantalla en un sol manual, amb blocs per perfil, en lloc de tres manuals separats
  per perfil. Motiu: la consulta ràpida va per pantalla i, a més, el flux comparteix pantalles.
- Llista de pàgines en una constant TS en lloc d'un índex JSON.
- Captures amb la suite de Playwright i no amb el `driver.mjs` de la skill: queda dins del repo, es
  pot mantindre i permet ressaltar i tapar camps.
- Guió de demo a `docs/internal/` i no a `docs/manual/`: és per a qui presenta, no per als tècnics.
- Ajuda contextual «?» per pantalla fora de la v1.
