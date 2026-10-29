# S01 · Benvinguda i primers passos: pla de secció

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (o subagent-driven-development) per a executar este pla tasca per tasca. Els passos fan servir caselles (`- [ ]`).

**Objectiu:** escriure les dues pàgines d'entrada del manual: com fer-lo servir (amb el recorregut per perfil i el glossari) i com entrar i moure's pel Dashboard. També cal mantindre la captura `00-config-manual.png`.

**Pàgines:**
- `docs/manual/00-benvinguda.md`: substitueix el fitxer provisional de la Task 2 del pla arrel.
- `docs/manual/01-primers-passos.md`

**Rutes cobertes:**
- `00-benvinguda`: `/config/manual`, `/config/manual/:slug`
- `01-primers-passos`: `/login`, `/forgot-password`, `/reset-password`, `/home`, i també el menú d'usuari i la navegació principal, que es veuen a totes les pantalles.

**Spec:** `docs/superpowers/specs/2026-10-21-manual-us-dashboard-design.md`
**Pla arrel:** `docs/superpowers/plans/2026-10-21-manual/00-general.md` (plantilla de secció, interfície `ManualShot`, `MANUAL_PAGES`)

**Prerequisits:** les tasques 1-3 del pla arrel estan fetes (visor, `ManualShot`, `shots/index.ts`, `pnpm run docs:manual-shots`).

---

## Fonts verificades

Tots els textos entre «» d'este pla s'han copiat d'aquests fitxers (camins relatius a `apps/dashboard/src/app/` si no s'indica el contrari):

| Fitxer | Què s'hi ha copiat |
|---|---|
| `app.routes.ts` | rutes públiques (`login`, `forgot-password`, `reset-password`); la resta demana TECHNICAL o ADMIN |
| `app.html` | capçalera i pestanyes amagades a les rutes d'autenticació i a pantalla completa; modal de consentiment de privacitat |
| `core/auth/guards/role.guard.ts` | un rol no permés torna a `/login` |
| `apps/api/src/modules/auth/auth.service.ts` (l. 143-146) | el servidor rebutja els comptes MEMBER al Dashboard |
| `features/auth/login/login.component.html` + `.ts` | «MuixerApp», «Inicieu sessió per continuar», «Correu electrònic», «Contrasenya», «Heu oblidat la contrasenya?», «Inicia sessió», error «Correu electrònic o contrasenya incorrectes.», mínim de 6 caràcters |
| `features/auth/forgot-password/forgot-password.component.html` | «Recuperació de contrasenya», «Envia l'enllaç de recuperació», «Si l'adreça existeix, rebreu un correu…», «Torna a l'inici de sessió» |
| `features/auth/reset-password/reset-password.component.html` + `.ts` | «Contrasenya nova», «Confirmeu la contrasenya», «Estableix la contrasenya», «La contrasenya ha de tindre almenys 8 caràcters», «Les contrasenyes no coincideixen», «L'enllaç de recuperació no és vàlid o ha caducat.» |
| `shared/components/layout/header/header.component.html` | logo + «MuixerApp» |
| `shared/components/layout/tab-nav/tab-nav.component.ts` + `.html` | pestanyes «Inici», «Persones», «Assajos», «Actuacions», «Plantilles», «Comunicació», «Configuració»; en mòbil, botó «Navegar»; entre `sm` i `md` només icones |
| `shared/components/layout/user-chip/user-chip.component.html` + `.ts` | àlies (o nom, o correu), insígnia de rol «Admin» / «Tècnica», correu, «Aparença», «Sobre l'app», «Tancar sessió» |
| `libs/ui/src/lib/components/theme-picker/theme-picker.component.ts` | opcions «Sistema», «Clar», «Fosc» (només icones, amb tooltip) |
| `shared/components/about-app-modal/about-app-modal.component.ts` | modal «Sobre l'app»: «Contacte» («Encara no hi ha cap adreça de correu. Parleu amb la Comissió Tecnològica.»), «Política de privacitat», enllaç «GitHub», copyright |
| `shared/components/privacy-consent-modal/privacy-consent-modal.component.ts` | «Política de Privacitat» / «La Política de Privacitat s'ha actualitzat», botó únic «Accepte» (no es pot tancar d'una altra manera) |
| `features/home/home.component.html` + `.ts` | «Benvingut/da, X!», targetes «Pròxim assaig» i «Pròxima actuació» (tota la targeta enllaça al detall de l'event), «✓ N apuntats», «✗ N no venen», «? N pendents», buits «Cap assaig programat properament» → «Veure assajos» i «Cap actuació programada properament» → «Veure actuacions», targeta «Sincronització de dades antigues» → «Sincronitza tot» |
| `features/config/config.component.ts` | targetes «Usuaris», «Etiquetes», «Temporades»; només ADMIN: «Privacitat i legal», «Design System». La targeta «Manual» l'afig la Task 2 del pla arrel |
| `core/guards/desktop-only.guard.ts` | en pantalles de menys de 768 px, l'editor de plantilles i el de composicions tornen a `/pinyes` amb l'error «Aquesta funcionalitat només està disponible en dispositius d'escriptori o tauleta.» |
| `features/pinyes/components/template-list/template-list.component.html` + `.ts` | tutorial «Com funciona el mòdul de Pinyes», que s'obri sol la primera vegada |
| `features/events/components/segment-manager/segment-manager.component.html` + `.ts`, `features/pinyes/components/segment-workspace/segment-workspace.component.ts`, `libs/shared/src/utils/tronc-summary.util.ts` | termes del glossari: «Segment nou», «Publicat», pestanyes del segment («Pinyes», «Troncs», «Distribució», «Nodes extra», «Previsualitza»), modes «Completa» / «Peu» / «Remat» / «Neta» |

No s'ha pogut verificar:
- **Si l'usuari de proves té una Persona vinculada.** Si no en té, el xip d'usuari i la salutació d'Inici mostren el **correu**. Cal mirar-ho en revisar les captures (Task A, pas 4).
- **La durada exacta de la sessió per a l'usuari.** El token d'accés dura 15 min i el de refresc 7 dies, amb rotació (vegeu `CLAUDE.md` › Authentication). El manual ho pot dir així: «si passeu una setmana sense entrar-hi, vos tornarà a demanar la contrasenya». No s'ha comprovat en un navegador real.

---

## Task A: captures

**Files:**
- Create: `apps/dashboard-e2e/src/manual/shots/s01.ts`
- Modify: `apps/dashboard-e2e/src/manual/shots/index.ts`. Lleva l'entrada provisional `00-config-manual.png` que hi va posar la Task 3 i afig `...s01` al principi de `MANUAL_SHOTS`.

**Suposició:** el runner resol `ready`, `highlight`, `mask` i `clip` amb `page.locator()`. Per això algun selector fa servir `:has-text()` de Playwright. Si el runner fa servir `document.querySelector`, cal canviar eixos selectors per CSS pur.

**`display:contents`:** `lib-card`, `lib-button` i `lib-button-group` no tenen caixa pròpia. Per això `ready`, `highlight` i `clip` apunten al primer fill (`lib-card[title="…"] > *`). El runner ja ho corregeix sol, però els selectors de fill són més segurs. Els selectors de `mask` que baixen fins a un `dd` o un `input` ja apunten a elements amb caixa.

- [ ] **Step 1: Crea `shots/s01.ts`**

```ts
import { Page } from '@playwright/test';
import { ManualShot } from '../manual-shot';

/** Opens the user menu (CSS focus dropdown in the header). */
async function openUserMenu(page: Page): Promise<void> {
  await page.locator('app-user-chip [role="button"]').first().click();
  await page.locator('app-user-chip ul.dropdown-content').waitFor({ state: 'visible' });
}

/** Personal data that can appear in the header chip/menu: the e-mail always, the name if no Person is linked. */
const USER_MENU_MASK = ['app-user-chip li.menu-title span.truncate'];

export const s01: ManualShot[] = [
  // ── 00-benvinguda ────────────────────────────────────────────────
  {
    file: '00-config-manual.png',
    app: 'dashboard',
    path: '/config',
    ready: 'lib-card[title="Manual"] > *',
    highlight: 'lib-card[title="Manual"] > *', // lib-card is display:contents
  },
  {
    file: '00-manual-visor.png',
    app: 'dashboard',
    path: '/config/manual/00-benvinguda',
    ready: '.prose h1',
    settle: 500,
  },

  // ── 01-primers-passos ────────────────────────────────────────────
  {
    file: '01-inici.png',
    app: 'dashboard',
    path: '/home',
    ready: 'lib-card[title="Pròxim assaig"] > *',
    settle: 800, // let the two event cards leave the skeleton state
  },
  {
    file: '01-navegacio.png',
    app: 'dashboard',
    path: '/home',
    ready: 'app-tab-nav a[href="/home"]',
    clip: 'app-tab-nav > div:first-child', // desktop tab strip
  },
  {
    file: '01-menu-usuari.png',
    app: 'dashboard',
    path: '/home',
    ready: 'app-user-chip [role="button"]',
    prepare: openUserMenu,
    highlight: 'app-user-chip ul.dropdown-content',
    mask: USER_MENU_MASK,
  },
  {
    file: '01-aparenca.png',
    app: 'dashboard',
    path: '/home',
    ready: 'app-user-chip [role="button"]',
    prepare: openUserMenu,
    highlight: '[data-testid="appearance-item"]',
    mask: USER_MENU_MASK,
    clip: 'app-user-chip ul.dropdown-content',
  },
  {
    file: '01-sobre-app.png',
    app: 'dashboard',
    path: '/home',
    ready: 'app-user-chip [role="button"]',
    prepare: async (page) => {
      await openUserMenu(page);
      await page.getByTestId('about-item').click();
      await page.locator('dialog[open] [data-testid="privacy-policy-viewer"]').waitFor();
    },
    settle: 800, // privacy policy markdown is @defer-loaded
  },
  // Last on purpose: /login is reached client-side with the session still in memory
  // (the dashboard login route has no "already logged in" guard). If it ever drops
  // the session, the runner's re-login handles the next section.
  {
    file: '01-login.png',
    app: 'dashboard',
    path: '/login',
    ready: 'form button[type="submit"]',
  },
];
```

- [ ] **Step 2: Afig `s01` a `shots/index.ts`** (`import { s01 } from './s01';`, `MANUAL_SHOTS = [...s01, …]`) i lleva l'entrada provisional `00-config-manual.png`.

- [ ] **Step 3: Executa-les**

Run: `pnpm run dev:up && E2E_EMAIL=… E2E_PASSWORD=… SHOTS=00,01 pnpm run docs:manual-shots`
Expected: 8 PNG nous o actualitzats a `docs/manual/img/`: `00-config-manual.png`, `00-manual-visor.png`, `01-inici.png`, `01-navegacio.png`, `01-menu-usuari.png`, `01-aparenca.png`, `01-sobre-app.png`, `01-login.png`.

- [ ] **Step 4: Revisa els PNG un per un**
  - `01-menu-usuari.png` i `01-aparenca.png`: el correu està tapat. Si el xip mostra un correu en lloc d'un àlies (l'usuari de proves no té Persona vinculada), afig `'app-user-chip [role="button"] span.text-sm'` a `USER_MENU_MASK`. Afig també `'h1'` a `01-inici.png`, perquè la salutació mostra el mateix text.
  - `01-inici.png`: si la BD local no té cap assaig ni actuació futurs, les targetes mostren l'estat buit («Cap assaig programat properament»). És vàlid, però la pàgina ha d'explicar els dos estats. Si es vol l'estat ple, cal crear un assaig futur a la BD local abans de capturar (S04 explica com).
  - `01-aparenca.png`: el botó actiu ha de ser «Sistema» (tema per defecte amb `colorScheme: 'light'`).
  - `01-login.png`: el formulari és buit, sense cap correu escrit.
  - Cap captura no mostra el tutorial «Com funciona el mòdul de Pinyes». Només s'obri a `/pinyes`, i esta secció no hi va.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard-e2e/src/manual/shots/s01.ts apps/dashboard-e2e/src/manual/shots/index.ts docs/manual/img/00-*.png docs/manual/img/01-*.png
git commit -m "docs(manual): add screenshots for welcome and first steps"
```

---

## Task B: `docs/manual/00-benvinguda.md`

**Files:**
- Modify: `docs/manual/00-benvinguda.md` (substitueix la línia provisional de la Task 2)

Esta pàgina no és d'una pantalla. Fa servir la plantilla adaptada: **Per a què serveix** · **On és** · captura · cos propi (tres seccions) · **Relacionat**. No porta «Pas a pas» ni blocs de perfil.

- [ ] **Step 1: Escriu la pàgina amb este esquema**

```markdown
<!-- rutes: /config/manual /config/manual/:slug -->
# Benvinguda
```

1. **Per a què serveix** (2-3 frases). Explica què és el manual: una pàgina per a cada pantalla del Dashboard, escrita per als tècnics de pinyes, troncs i xicalla. Diu que el manual es manté al dia: cada canvi de l'app actualitza la pàgina que toca.
2. **On és**. Al Dashboard: «Configuració» → targeta «Manual». També es pot obrir directament `/config/manual`.
   - Captura `img/00-config-manual.png`.
3. **Com fer-lo servir.** Hi ha dos usos:
   - **Consulta ràpida.** Esteu encallats en una pantalla. Busqueu-la pel nom al menú de l'esquerra (en mòbil, al desplegable de dalt). Els títols són els noms de les pestanyes i botons del Dashboard. Cada pàgina té un «Pas a pas» i un «Compte amb».
   - **Lectura ordenada.** Si és la primera vegada, llegiu-lo en l'ordre del menú. L'ordre és el mateix en què es prepara un event.
   - Captura `img/00-manual-visor.png`.
   - Expliqueu també:
     - els blocs «Si sou de pinyes» / «Si sou de troncs o xicalla»: només apareixen quan la feina canvia;
     - els noms entre «» són exactament els que veureu a la pantalla.
4. **Recorregut recomanat per perfil.** Una taula de tres columnes: Tothom / Pinyes / Troncs i xicalla. Les files són els passos del flux de l'spec:
   1. base comuna;
   2. plantilles;
   3. esquelet de l'event;
   4. assignació en dos torns;
   5. distribució;
   6. revisió.

   Cada cel·la enllaça la pàgina que toca:
   - **Tothom:**
     - [01](01-primers-passos.md), [02](02-dades-app-antiga.md), [03](03-persones.md), [04](04-etiquetes.md), [05](05-temporades.md), [07](07-assajos-i-actuacions.md), [08](08-plantilles.md), [11](11-segments-i-figures.md), [14](14-conflictes.md), [16](16-previsualitza-i-projeccio.md), [17](17-participacio.md), [19](19-pwa.md);
     - si administreu usuaris: [06](06-usuaris-i-acces.md) i [18](18-comunicacio.md).
   - **Pinyes:** [09](09-plantilles-pinya.md), [13](13-assignacio-pinyes.md) i [15](15-distribucio-i-nodes-extra.md).
   - **Troncs i xicalla:** [10](10-plantilles-tronc.md) i [12](12-assignacio-troncs.md).
   - Afig una frase sobre l'ordre: troncs i xicalla assignen primer, perquè trien persones abans; pinyes ompli després amb la gent que queda.
5. **Glossari.** Una llista de definicions, en ordre alfabètic, d'una o dues frases cadascuna, sense tecnicismes. Quan la paraula de la pantalla és diferent de la de la plaça, s'indiquen totes dues. Entrades mínimes:
   - **Actuació / Assaig**: els dos tipus d'event. Pestanyes «Actuacions» i «Assajos».
   - **App antiga**: l'aplicació d'assistència d'abans. Les persones, els assajos i les actuacions encara venen d'allà → [02](02-dades-app-antiga.md).
   - **App dels membres (PWA)**: l'app del mòbil on els membres diuen si vénen («Vaig» / «No vaig») i veuen on estan col·locats → [19](19-pwa.md).
   - **Assignar**: posar una persona en un lloc d'una figura d'un segment.
   - **Base**: la fila de persones del tronc que va a terra (pis 1), damunt de la qual puja la resta.
   - **Composició**: diverses figures col·locades juntes i alçades amb un nom, per a afegir-les d'una vegada a un segment. Pestanya «Composicions» de «Plantilles».
   - **Conflicte**: una persona que està en dos llocs alhora dins del mateix segment. L'app no ho impedeix, però ho avisa → [14](14-conflictes.md).
   - **Cordó**: cada anell de la pinya, comptat des del centre cap enfora (1r, 2n, 3r…). Al segment es pot reduir el nombre de cordons d'una figura, i també es poden deixar «Cordons oberts».
   - **Distribució**: on es col·loca cada figura del segment a la pantalla i a la plaça. Pestanya «Distribució».
   - **Etiqueta**: una marca de la persona (per exemple, una posició que sap fer) que decideix a qui es proposa per a cada lloc. Té una categoria: Pinya, Tronc, Xicalla o Altres → [04](04-etiquetes.md).
   - **Figura**: la construcció humana que es fa a la plaça. Al Dashboard, la figura es crea com a **plantilla** i, quan es posa en un segment, es fa una còpia per a eixe segment.
   - **Lloc (node)**: cada posició d'una figura on va una persona. La pantalla de vegades en diu «node» («Propietats del node», «Nodes extra»). Al manual en diem lloc.
   - **Mode de la figura**: «Completa», «Peu», «Remat» o «Neta», segons quina part de la figura es fa. **Cal validar amb un tècnic la definició de cada mode abans d'escriure-la** (S06 n'és la font). Pista del codi (`tronc-summary.util.ts`): «Remat» deixa fora la base del tronc, «Peu» retalla els pisos de dalt sense ningú, i «Neta» és la figura sense pinya.
   - **Nodes extra**: llocs afegits a mà a un segment, fora de la plantilla (per exemple, decoració o una persona de reforç) → [15](15-distribucio-i-nodes-extra.md).
   - **Persona provisional**: una persona creada al Dashboard només amb l'àlies, per a algú que encara no és a l'app antiga. Té el prefix «~» → [03](03-persones.md).
   - **Pinya**: la base de persones que envolta i sosté el tronc. La treballen els tècnics de pinyes.
   - **Pis**: cada altura del tronc (pis 1 és la base).
   - **Plantilla**: el model d'una figura (llocs de pinya, rengles i tronc), que es reaprofita en molts events. Pestanya «Plantilles» → [08](08-plantilles.md). Canviar una plantilla no canvia les figures que ja tenen gent assignada en un segment.
   - **Previsualitza / Projecció**: com es veurà el segment a la pantalla gran i a l'app dels membres → [16](16-previsualitza-i-projeccio.md).
   - **Publicar**: fer visible un segment als membres a la seua app. Es fa amb la icona de l'ull del segment («Publicat» / «No publicat»).
   - **Rengla**: la fila de llocs de pinya que va del centre cap enfora, un lloc per cordó.
   - **Segment (prova)**: cada bloc d'un assaig o actuació. A la plaça en diem prova. La pantalla en diu «Segment» («Segment nou»).
   - **Temporada**: període de dates que agrupa events per a les estadístiques → [05](05-temporades.md).
   - **Tronc**: la part de la figura que puja per damunt de la pinya, per pisos. La treballen els tècnics de troncs i de xicalla.
   - **Xicalla**: els xiquets i xiquetes de la colla. A la fitxa de la persona apareix com a «Menor de 16».
6. **Relacionat:** [Primers passos](01-primers-passos.md), [Preguntes freqüents](20-preguntes-frequents.md).

- [ ] **Step 2: Verifica-ho al visor.** Obri `/config/manual` (sense slug ha d'obrir la benvinguda) i `/config/manual/00-benvinguda`. Comprova que:
  - les dues imatges es veuen;
  - cada enllaç del recorregut navega dins de l'app;
  - els enllaços a pàgines que encara no existeixen mostren «Esta pàgina encara s'està escrivint.» i no trenquen res.

- [ ] **Step 3: Checklist de llengua** (la del pla arrel):
  - «vós»: «Busqueu», «llegiu-lo»;
  - formes valencianes: «este», «xiquets»;
  - cap «al + infinitiu»;
  - el glossari no deixa cap terme tècnic sense explicar (ni «node», ni «snapshot», ni «instància»).

- [ ] **Step 4: Commit**

```bash
git add docs/manual/00-benvinguda.md
git commit -m "docs(manual): write welcome page with reading routes and glossary"
```

---

## Task C: `docs/manual/01-primers-passos.md`

**Files:**
- Create: `docs/manual/01-primers-passos.md`

- [ ] **Step 1: Escriu la pàgina amb este esquema**

```markdown
<!-- rutes: /login /forgot-password /reset-password /home -->
# Primers passos
```

1. **Per a què serveix.** Com entrar al Dashboard, què hi ha a cada pestanya de dalt i què ensenya la pantalla «Inici». Només hi poden entrar els comptes de tècnica i d'administració. Els membres fan servir l'app del mòbil.
2. **On és.** Al navegador, l'adreça del Dashboard. Recomaneu ordinador o tauleta (vegeu «Compte amb»).
3. Captura principal `img/01-inici.png`.
4. **Pas a pas.**
   1. **Entrar.**
      - Escriviu el «Correu electrònic» i la «Contrasenya» i feu clic a «Inicia sessió».
      - El botó no s'activa fins que el correu té format de correu i la contrasenya té almenys 6 caràcters.
      - Captura `img/01-login.png`.
   2. **Si no recordeu la contrasenya.**
      - Feu clic a «Heu oblidat la contrasenya?», escriviu el correu i feu clic a «Envia l'enllaç de recuperació».
      - Sempre apareix el mateix missatge, «Si l'adreça existeix, rebreu un correu…», tant si el correu existeix com si no.
      - Obriu l'enllaç del correu. Escriviu la «Contrasenya nova» (mínim 8 caràcters) i «Confirmeu la contrasenya». Feu clic a «Estableix la contrasenya».
      - Si l'enllaç és vell, apareix «L'enllaç de recuperació no és vàlid o ha caducat.»: torneu a demanar-ne un amb «Torna a sol·licitar la recuperació».
   3. **Acceptar la política de privacitat** (només la primera vegada, o quan canvia).
      - Apareix una finestra «Política de Privacitat» (o «La Política de Privacitat s'ha actualitzat»).
      - Només es tanca amb «Accepte».
   4. **Moure's per l'app.** Captura `img/01-navegacio.png`. Una frase per pestanya, amb un enllaç a la pàgina del manual:

      | Pestanya | Què hi ha | Pàgina |
      |---|---|---|
      | «Inici» | resum dels pròxims events | esta mateixa |
      | «Persones» | les persones de la colla | [03](03-persones.md) |
      | «Assajos» / «Actuacions» | els events | [07](07-assajos-i-actuacions.md) |
      | «Plantilles» | figures i composicions | [08](08-plantilles.md) |
      | «Comunicació» | notícies i notificacions | [18](18-comunicacio.md) |
      | «Configuració» | usuaris, etiquetes, temporades i este manual | [04](04-etiquetes.md), [05](05-temporades.md), [06](06-usuaris-i-acces.md) |

      - En una pantalla estreta les pestanyes queden en icones.
      - En un mòbil es plegen en un botó «Navegar».
      - La pestanya «Plantilles» és la porta d'entrada a tot el treball de pinyes. Les figures dels events, en canvi, es preparen des de l'event, a la pestanya «Pinyes i Figures» → [11](11-segments-i-figures.md).
   5. **Llegir «Inici».**
      - La salutació «Benvingut/da, …!».
      - Les targetes «Pròxim assaig» i «Pròxima actuació» mostren:
        - la data, l'hora i el lloc;
        - els comptadors «✓ N apuntats», «✗ N no venen» i «? N pendents».
      - Feu clic a la targeta per a obrir l'event. Si no n'hi ha cap de programat, apareix «Cap assaig programat properament» amb el botó «Veure assajos» (o «Veure actuacions»).
      - La targeta «Sincronització de dades antigues» → «Sincronitza tot» porta a la pantalla d'importació des de l'app antiga → [02](02-dades-app-antiga.md).
   6. **El menú d'usuari** (dalt a la dreta, amb les vostres inicials). Captura `img/01-menu-usuari.png`.
      - Mostra el correu i el rol: «Tècnica» o «Admin».
      - **«Aparença»**: tres botons amb icona: «Sistema» (segueix el mòbil o l'ordinador), «Clar» i «Fosc». Captura `img/01-aparenca.png`.
        - L'elecció es guarda en eixe navegador, no al compte.
        - Les figures i la projecció sempre es veuen en clar, per a llegir-les bé.
      - **«Sobre l'app»**: el contacte, la política de privacitat i l'enllaç al codi a «GitHub». Captura `img/01-sobre-app.png`.
      - **«Tancar sessió»**: tanca la sessió en eixe navegador i torna a la pantalla d'entrada.
   7. **On és este manual**: «Configuració» → «Manual» (enllaç a [00](00-benvinguda.md)).
5. **Si sou de pinyes / Si sou de troncs o xicalla.** No n'hi ha: esta pàgina és igual per a tots els perfils.
6. **Compte amb.**
   - **Compte de membre.** Amb un compte de membre, el Dashboard respon «Correu electrònic o contrasenya incorrectes.» encara que la contrasenya siga bona. El missatge enganya: el que passa és que el compte no té permís de tècnica. Parleu amb qui administra els usuaris → [06](06-usuaris-i-acces.md). Vegeu «Troballes» al final d'este pla.
   - **Sessió oberta.** La sessió queda oberta en eixe navegador. En un ordinador compartit, feu «Tancar sessió» en acabar.
   - **Plantilles al mòbil.** L'editor de plantilles i el de composicions no s'obrin en un mòbil (pantalles de menys de 768 px d'ample). En una tauleta sí. Al mòbil, apareix l'avís «Aquesta funcionalitat només està disponible en dispositius d'escriptori o tauleta.» i torneu a «Plantilles».
   - **Tutorial de Plantilles.** La primera vegada que obriu «Plantilles» apareix el tutorial «Com funciona el mòdul de Pinyes». Si marqueu «No tornes a mostrar» no tornarà a eixir en eixe navegador.
   - **Tema.** «Aparença» és per navegador: si canvieu d'ordinador, torna a «Sistema».
   - **«Sincronitza tot» no ho sincronitza tot.** El botó d'«Inici» no importa res per si sol: només obri la pantalla «Sincronització global». A més, només un compte d'administració pot llançar una importació → [02](02-dades-app-antiga.md).
7. **Relacionat:** [Benvinguda](00-benvinguda.md), [Dades de l'app antiga](02-dades-app-antiga.md), [Usuaris i accés](06-usuaris-i-acces.md), [L'app dels membres](19-pwa.md).

- [ ] **Step 2: Verifica-ho al visor.**
  - Obri `/config/manual/01-primers-passos`: totes les imatges es veuen i els enllaços interns naveguen.
  - Comprova en l'app real que «Heu oblidat la contrasenya?» i «Sobre l'app» encara diuen el mateix (`nx serve dashboard`).

- [ ] **Step 3: Checklist de llengua.**
  - «vós»: «Escriviu», «Feu clic».
  - Botons literals: «Inicia sessió», «Tancar sessió», «Accepte».
  - Formes valencianes.
  - Cap gerundi sol. Ull amb «S'està enviant…»: copieu-lo literal només si cal.
  - No escriviu «token», «guard» ni «localStorage»: «queda guardat en eixe navegador».

- [ ] **Step 4: Commit**

```bash
git add docs/manual/01-primers-passos.md
git commit -m "docs(manual): write first steps page"
```

---

## Notes per a la demo (les fa servir S10)

**Temps:** 8 minuts al principi de la demo, abans de la base comuna.

| Minut | Què s'ensenya en directe | Dades |
|---|---|---|
| 0-2 | **On és el manual.** «Configuració» → «Manual». Recorregut ràpid per la benvinguda: els dos usos, la taula per perfil i el glossari. Proposeu a cada tècnic que trobe la seua columna. | — |
| 2-3 | **Entrar.** Mostreu la pantalla d'entrada amb la captura `01-login.png`, sense escriure cap contrasenya en directe amb la pantalla compartida. Expliqueu «Heu oblidat la contrasenya?». | compte de qui presenta, ja obert abans de compartir pantalla |
| 3-5 | **Pestanyes.** Passeu per les 7 pestanyes, una frase per pestanya. Remarqueu que «Plantilles» és el mòdul de figures, però que l'event es prepara des de l'event. | BD on es fa la demo (pre o local) |
| 5-6 | **Inici.** Feu clic a «Pròxim assaig» i torneu enrere. Expliqueu «apuntats / no venen / pendents». | l'assaig real més pròxim |
| 6-8 | **Menú d'usuari.** Canvieu «Aparença» a «Fosc» en directe i torneu a «Sistema». Obriu «Sobre l'app». | — |

**Què ha de mirar cada perfil:**
- **Tothom:** on és el manual i el glossari, sobretot segment = prova i lloc = node.
- **Pinyes:** el glossari de cordó, rengla i «Cordons oberts».
- **Troncs i xicalla:** base, pis i «Menor de 16» = xicalla.

**Preguntes probables:**
- «Puc entrar amb el meu compte de membre?» → No, cal rol de tècnica. El missatge d'error enganya.
- «Ho puc fer tot des del mòbil?» → Quasi tot, però les plantilles no. Una tauleta sí que serveix.
- «Per què el tema fosc no em canvia les figures?» → Les figures sempre es veuen en clar, a propòsit.
- «Quant de temps em dura la sessió?» → Uns dies en el mateix navegador.

**Abans de la demo:**
- Comproveu que l'usuari amb qui presenteu té l'àlies vinculat, perquè el xip no mostre el correu.
- Tingueu la sessió ja oberta.

---

## Troballes (per a qui coordina els plans)

1. **Error enganyós per als membres al Dashboard.** L'API rebutja els comptes MEMBER amb un 401 que diu «Només els usuaris tècnics o administradors poden accedir al panell de gestió». La pantalla d'entrada, però, mostra sempre «Correu electrònic o contrasenya incorrectes.» per a qualsevol error (`login.component.ts`, l. 46-48).
2. **Textos fora de la guia d'estil:**
   - `desktop-only.guard.ts` diu «Aquesta funcionalitat…» en lloc de «Esta».
   - El tutorial (`tutorial-modal.component.html`) diu «No tornes a mostrar», amb «tu» en lloc de «vós».
   - El tutorial de Pinyes (`template-list.component.ts`) diu «Pots importar…» i fa servir «snapshot» i «template».
3. **«Sincronitza tot» a Inici no sincronitza res.** Només navega a `/sync`. L'API té `GET /sync/all`, però cap pantalla no el fa servir.
4. **La salutació i el xip poden mostrar el correu.** Passa quan l'usuari no té cap Persona vinculada (`displayName` cau a `email`).
