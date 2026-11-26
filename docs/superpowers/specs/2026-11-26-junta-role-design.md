# Rol Junta i gestió administrativa — requisits i disseny

**Data:** 2026-11-26 · **Estat:** pendent d'aprovació de la Junta

> La **part 1** és per a la Junta: què tindreu i què cal aprovar. La **part 2** és l'annex tècnic per a
> qui ho implemente.

# Part 1 — Per a la Junta

## Per què

La Junta porta la part administrativa i econòmica de la colla:
- gestiona persones;
- organitza activitats sense figures, on sovint es paga;
- controla les quotes de soci, ara amb un Excel que costa molt de mantindre;
- demana documents als membres.

Ara mateix la Junta no té lloc a MuixerApp. Hi ha dades que **els tècnics no han de veure**: quotes, pagaments, documents i, més endavant, vots. Per això la Junta tindrà un **rol propi**.

**Què volem aconseguir:** deixar l'Excel de socis i saber en tot moment qui té vot i qui té documents pendents, sense complicar la feina de la Junta.

**Fora d'abast:**
- Pantalles específiques de Junta a l'app de membres. La Junta l'usa com qualsevol membre.
- Guardar documents, comprovants o dades bancàries. Només es marca si s'han lliurat o pagat, i quan.

## Prioritat

| # | Fase | Què aporta | Necessita |
|---|------|-----------|-----------|
| 1 | **Rol Junta** | Accés al Dashboard amb permisos propis | — |
| 2 | **Socis i quotes** | Substitueix l'Excel de socis | 1 |
| 3 | **Documents** | Qui té pendent cada document | 1, 2 |
| 4 | Activitats | Activitats sense figures | 1 |
| 5 | Pagaments i bestretes | Qui ha pagat cada activitat | 4 |
| 6 | Transport | Organització del transport | 4 |
| 7 | Votacions | Vots a l'assemblea | 2 |

Les fases 1–3 estan definides en aquest document. Les fases 4–7 encara no tenen disseny: cadascuna el tindrà quan toque.

## Fase 1 — Rol Junta

**Qui és qui:** cada compte té un sol rol. Qui és tècnic **i** Junta alhora rep el rol **Administrador**, que ho pot fer tot.

| Què | Tècnica | Junta | Admin |
|---|---|---|---|
| App de membres (assistència pròpia, figures publicades) | ✔ | ✔ | ✔ |
| «Passa llista» a l'app de membres | ✔ | — | ✔ |
| Persones: veure la fitxa sencera | ✔ | ✔ | ✔ |
| Persones: alta i dades personals | ✔ | ✔ | ✔ |
| Persones: dades tècniques | ✔ | veure | ✔ |
| Esborrar una persona per sempre | — | — | ✔ |
| Temporades, comunicació | ✔ | ✔ | ✔ |
| Assajos i actuacions | ✔ | només veure | ✔ |
| Pinyes (figures, segments, projecció) | ✔ | — | ✔ |
| Etiquetes | ✔ | veure | ✔ |
| Usuaris | crea membres i tècnics | crea membres, tècnics i Junta | tot |
| Dispositius i sessions, textos legals | — | ✔ | ✔ |
| Configuració de la colla, sincronització antiga | — | — | ✔ |
| **Socis, documents (i, més endavant, activitats…)** | — | ✔ | ✔ |

**Dades de les persones:**
- **Personals (la Junta les edita):** nom, cognoms, data de naixement, telèfon, gènere, data d'entrada, alta/baixa i correu.
- **Tècniques (la Junta només les veu):** àlies, alçada, etiquetes, Xicalla, lesió, acollida, notes, camisa, mentor i figures.

**Correu i data d'entrada:**
- El **correu** és el que la persona fa servir per entrar a l'app. En canviar-lo, l'app ho avisa.
- La **data d'entrada** es posa sola el dia que es crea la persona a l'app. Es pot editar, i el Dashboard explica que és el valor per defecte.

**⚠ Abans d'activar la Junta cal deixar de fer servir la sincronització amb el sistema antic.** Si no, cada sincronització esborra els canvis que la Junta haja fet en les dades personals.

## Fase 2 — Socis i quotes

**Com funciona avui:**
- La quota és voluntària, anual i amb el mateix import per a tothom.
- Cadascú la paga quan vol, per transferència.
- Pagar dona vot a l'assemblea. Qui no paga no es dona de baixa: simplement no té vot.

**Com funcionarà:**
- **Registrar una quota:** es tria la persona i la data de la transferència. L'import el posa l'app i la forma de pagament és «Transferència» per defecte, amb la possibilitat d'afegir-ne d'altres en el futur.
- **Vigència: 12 mesos des del pagament.** Si algú renova abans que li vença, els 12 mesos nous comencen quan acaben els anteriors.
- **Estat de cada persona, calculat per l'app:**
  - *Al corrent* — té vot.
  - *Caducat* — ha pagat alguna vegada, però ja no està vigent.
  - *No soci* — no ha pagat mai.
- **Pantalla «Socis»:** llista de persones amb l'estat i la data de venciment, filtres (al corrent, caducats, vencen aviat) i el botó «Registra una quota». A la fitxa de cada persona, el seu historial de quotes.
- **Correccions:** una quota es pot editar o esborrar, i l'app recalcula els venciments. Tot queda registrat a l'historial de canvis.
- **Sense importació:** la Junta introdueix a mà la quota vigent de cada soci.
- Un soci que no fa muixeranga s'afegeix igualment com a persona, i surt a les llistes de la tècnica com qualsevol altre. La tècnica no pot saber qui és soci.

## Fase 3 — Documents

**Què es registra:** només una marca de lliurat i la data, mai el document.

**Configuració de cada document** (per exemple, «Drets d'imatge»), que fa la Junta:
- **Vigència:** *permanent* (es lliura una vegada) o *per temporada*.
- **A qui es demana:**
  - *tothom*;
  - *només socis al corrent*;
  - *una llista de persones*.
- **Mai als menors**, perquè tenen la participació delegada.

**Pantalla «Documents»:** una graella de persones × documents, amb un selector de temporada (per defecte, l'actual) i un filtre «només pendents».
- Un clic marca el document com a lliurat amb la data d'avui; un altre clic el desmarca.
- Cada casella pot estar *Lliurat*, *Pendent* o *No s'hi demana*.
- A la fitxa de cada persona es veuen els seus documents.

**Regles:**
- A qui es demana un document es calcula amb la situació d'avui, també en temporades passades.
- Un document lliurat sempre compta, encara que la persona ja no hi entre. Per exemple, si va signar els drets d'imatge quan era menor, continua comptant quan fa la majoria d'edat.

## Fases 4–7 — preguntes per a més endavant

- **Activitats:** sopars, eixides, viatges… Tindran la seua pròpia llista d'inscrits, separada dels assajos i les actuacions.
  - Les veuen els membres a l'app?
  - S'hi poden inscriure?
  - Les veu la tècnica?
- **Pagaments i bestretes:**
  - Preu únic o per tipus de persona (menor, soci…)?
  - Qui avança els diners?
  - Cal saber el saldo de cada persona?
- **Transport** (a activitats i potser a actuacions):
  - Autobús o cotxes?
  - Qui va amb qui?
  - Es paga el bus?
- **Votacions:** només voten els socis al corrent.
  - Presencial o des de l'app?
  - Vot secret?
  - Quòrum?
  - Vot delegat?
  - Es mira si algú és soci al corrent quan s'obri la votació o quan vota?

## Decisions proposades que cal revisar

1. Un tècnic **no** pot crear ni modificar comptes de Junta: si poguera, podria donar-se accés a les dades de Junta. La Junta **no** pot tocar comptes d'Administrador (rol, sessions ni dispositius).
2. L'import de la quota es configura a la configuració de la colla i, de moment, només el canvia un Administrador.
3. Quan la Junta dona d'alta una persona, no li demana l'àlies: l'app en genera un a partir del nom, i la tècnica el pot canviar.
4. Per «menor» s'usa la mateixa regla que Xicalla: l'edat respecte a la majoria d'edat de la colla o, si no hi ha data de naixement, la marca manual.
5. Les persones que ja existeixen i no tenen data d'entrada es queden sense. No s'hi posa la data d'importació, perquè no seria la data real d'entrada.
6. Al detall d'un assaig o d'una actuació, la Junta no veu les figures ni el PDF de resum.

---

# Part 2 — Annex tècnic

Aquesta part recull les decisions tècniques acordades. No és el pla d'implementació: cada fase tindrà el seu pla
abans de començar.

## 2.1 Arquitectura d'autorització

### Enfocament triat

| | Enfocament | Pros | Contres | |
|---|---|---|---|---|
| **A** | Rol pla nou `UserRole.JUNTA`. Els endpoints de Junta porten `@Roles(JUNTA, ADMIN)` | Encaixa amb el `RolesGuard` actual (pla, sense jerarquia). Les dades queden aïllades per construcció | Cal revisar tots els llocs on ara diu `TECHNICAL, ADMIN` o «és staff» | ✅ |
| B | Permisos per usuari (`canSeeMembership`, `canEditFigures`…) | Permet tècnic + Junta sense ser ADMIN | El cas dual ja es resol amb ADMIN. Reescriu tota l'autorització | |
| C | Diversos rols per compte (`roles[]`) | Modela bé les persones amb doble funció | Mateix problema que B. Toca el JWT, els guards i els dos frontends | |

### Principis

1. **Un sol rol per compte** (`users.role`). Qui és tècnic i Junta alhora és `ADMIN`.
2. **Aïllament per construcció.** Les dades de Junta (quotes, documents i, més endavant, pagaments i vots) viuen
   en mòduls, taules i endpoints propis.
   - Mai s'afegeixen com a camps de `Person`.
   - Mai surten a cap resposta que puga rebre `TECHNICAL` o `MEMBER`: ni a `/persons`, ni a `/me`, ni a la
     projecció.
   - Així, un error en una vista tècnica no pot filtrar l'estat de soci de ningú.
3. **Llistes explícites.** El guard no té jerarquia, per tant cada endpoint enumera els rols. `ADMIN` hi és
   sempre que hi siga `JUNTA` o `TECHNICAL`.
4. **Auditoria.** Tota mutació de dades de Junta escriu a l'`AuditLog` amb accions noves a
   `libs/shared/src/enums/audit-action.enum.ts`. Avui no hi ha cap endpoint que llija l'auditoria, de manera
   que no és una via de fuita.

### Escalada de privilegis (`user.service`)

Avui ja existeix la regla «només un ADMIN modifica un ADMIN» (`user.service.ts`, línies
~400–510). S'amplia així:

| Actor ↓ / compte objectiu → | MEMBER | TECHNICAL | JUNTA | ADMIN |
|---|---|---|---|---|
| TECHNICAL | crea, edita | crea, edita | — | — |
| JUNTA | crea, edita | crea, edita | crea, edita | — |
| ADMIN | tot | tot | tot | tot |

- «Edita» inclou el canvi de rol (`grant-role`), la desactivació, el correu, les sessions
  (`DELETE users/:id/sessions*`) i els dispositius (`users/:id/push-subscriptions*`).
- Ningú pot assignar un rol que no podria crear.

## 2.2 Fase 1 — Rol JUNTA

### Model i migració

- `UserRole.JUNTA = 'JUNTA'` a `libs/shared/src/enums/user-role.enum.ts`, amb la descripció del rol a la
  capçalera.
- Migració `ALTER TYPE "users_role_enum" ADD VALUE 'JUNTA'`. El nom exacte del tipus es comprova a l'última
  migració que el va tocar.
  - En Postgres, `ADD VALUE` no es pot desfer amb un `DROP VALUE`.
  - El `down` ha de recrear el tipus sense el valor, o bé es documenta com a no reversible.

### Canvis d'autorització a l'API

| Controlador | Ara | Després |
|---|---|---|
| `person` (classe) | TECHNICAL, ADMIN | + JUNTA (lectura i escriptura de camps personals; vegeu més avall) |
| `person` `DELETE :id/permanent`, `deletion-check` | ADMIN | sense canvis |
| `season` | TECHNICAL, ADMIN | + JUNTA |
| `event` `GET /`, `GET :id`, `GET :id/attendance` | TECHNICAL, ADMIN (classe) | + JUNTA, amb `@Roles` per mètode |
| `event` `POST`, `PUT :id`, `DELETE :id`, `PUT :id/attendance/:personId` | TECHNICAL, ADMIN | sense canvis |
| `tag` `GET` | TECHNICAL, ADMIN | + JUNTA (les escriptures, sense canvis) |
| `news`, `push-notification`, `notification-schedule` | TECHNICAL, ADMIN | + JUNTA |
| `user` (classe) | ADMIN, TECHNICAL | + JUNTA, amb les regles d'escalada de 2.1 |
| `user` `devices-summary`, `sessions*`, `push-subscriptions*` | ADMIN | + JUNTA (no sobre comptes ADMIN) |
| `legal` (escriptures) | ADMIN | + JUNTA |
| `me`, `push-subscription` (`me/…`) | MEMBER, TECHNICAL, ADMIN | + JUNTA |
| `me` endpoints de staff (l. 74) | TECHNICAL, ADMIN | sense canvis |
| `person-delegate` | TECHNICAL, ADMIN | + JUNTA |
| `auth` endpoint de staff (l. 261) | TECHNICAL, ADMIN | revisar què exposa abans de decidir-ho |
| `colla-settings` `PATCH`, `sync` | ADMIN | sense canvis |
| `figure`, `composition`, `event-segment`, `node-assignment`, `event-summary` | TECHNICAL, ADMIN | **sense canvis** (Pinyes) |

### Persones: camps personals i tècnics

- **Llista de camps a `@muixer/shared`:** una constant `PERSON_PERSONAL_FIELDS` amb `name`, `firstSurname`,
  `secondSurname`, `birthDate`, `phone`, `gender`, `joinDate` i `isActive`. La fan servir l'API i el formulari
  del Dashboard.
- **Validació:**
  - Amb rol `JUNTA`, `POST /persons`, `POST /persons/provisional` i `PATCH /persons/:id` rebutgen amb **403**
    qualsevol clau del cos que no siga a la llista. No s'ignora en silenci: una petició mal formada s'ha de
    veure.
  - L'activació/desactivació (`PATCH :id/activate`, soft delete) també s'obri a JUNTA, perquè correspon a
    `isActive`.
- **Àlies en una alta de Junta:**
  - `alias` és obligatori i únic. Si no arriba, el servidor en deriva un.
  - La lògica actual és a `PersonSyncStrategy.deriveUniqueAlias`, però rep un `legacyPerson`. S'ha d'extreure
    a una funció que reba `{ name, firstSurname, secondSurname }`, i el sync la passa a usar.
- **Correu:**
  - És `users.email` (identificador d'accés) i no es copia a `Person`.
  - La fitxa de persona el mostra quan hi ha un `User` vinculat i l'edita via `PATCH /users/:id`, amb les regles
    d'escalada.
  - Avís a la UI: «Este correu és el que fa servir per entrar a l'app».
- **`joinDate`:**
  - En qualsevol alta sense `joinDate`, el servidor posa la data d'avui (amb el mateix criteri de data que la
    resta de dates `date`).
  - S'afegeix al formulari del Dashboard amb el text d'ajuda «Per defecte, el dia que es va donar d'alta la
    persona a l'app».
  - Les persones existents amb `joinDate` nul no es modifiquen.
- **Sync:** `person-sync.strategy.ts` sobreescriu `name`, `firstSurname`, `secondSurname`, `phone` i
  `birthDate` a cada execució (línies ~434–440). No es modifica: el prerequisit operatiu és deixar d'executar
  el sync abans de donar comptes JUNTA.

### Dashboard

- **Guard d'arrel** (`app.routes.ts`): `rolesGuard(TECHNICAL, JUNTA, ADMIN)`.
- **Rutes de Pinyes** (`/pinyes/**`) i `/sync`: `rolesGuard(TECHNICAL, ADMIN)` i `rolesGuard(ADMIN)`.
- **`AuthService`:**
  - `isStaff` deixa de ser ambigu. Es proposen `canUsePinyes` (TECHNICAL, ADMIN) i `canUseJunta` (JUNTA,
    ADMIN), i es revisa cada ús d'`isStaff`/`isAdmin`.
  - `role.guard.ts` té el seu propi `isStaff`, que també cal revisar.
- **Navegació:**
  - Les entrades de Pinyes s'amaguen per a JUNTA.
  - Apareix un grup «Junta» (Socis i Documents a les fases 2 i 3) per a JUNTA i ADMIN.
- **`/config`:** `users`, `users/devices` i `legal` passen a `rolesGuard(JUNTA, ADMIN)` (`users` manté també
  TECHNICAL). `colla` i `design-system` es queden ADMIN.
- **Detall d'esdeveniment:** per a JUNTA, sense segments, sense botó de PDF, sense edició i amb l'assistència
  només en lectura.
- **Fitxa i formulari de persona:** els camps tècnics, desactivats per a JUNTA.
- **Etiquetes del rol:** «Junta» a `user-chip`, `user-list`, `user-form-modal` i `person-delegate-modal`, amb
  un color del sistema de disseny (cap hex).

### PWA

- `app.routes.ts`: JUNTA s'afegeix al `rolesGuard` de l'`AppShell`.
- «Passa llista» i els checks «és staff» (`event-detail`, `event-card`) continuen sent TECHNICAL/ADMIN.

### Tests mínims

- `user.service`: una spec per cel·la de la taula d'escalada.
- API (e2e o integració):
  - TECHNICAL rep 403 en un endpoint de Junta.
  - JUNTA rep 403 en un endpoint de Pinyes.
  - JUNTA rep 403 en un `PATCH /persons/:id` amb `alias`.
- `joinDate` per defecte en una alta.

## 2.3 Fase 2 — Socis i quotes (mòdul `membership`)

### Model

**`membership_fees`**

| Camp | Tipus | Notes |
|---|---|---|
| `id` | uuid | |
| `personId` | FK `persons`, `ON DELETE RESTRICT` | Una persona amb quotes no s'esborra per sempre (afegir-ho a `personDeletionBlockerReasons`) |
| `paidAt` | `date` | Data de la transferència |
| `validFrom` | `date` | Calculada pel servidor |
| `validUntil` | `date` | `validFrom + 12 mesos − 1 dia` |
| `amount` | `numeric(10,2)` | Còpia de `colla_settings.membershipFeeAmount` en el moment del registre |
| `paymentMethod` | enum `PaymentMethod` (`@muixer/shared`) | Ara només `TRANSFER`. Per defecte, `TRANSFER` |
| `notes` | `text`, nul·lable | |
| `registeredById` | FK `users`, nul·lable (`ON DELETE SET NULL`) | |
| `createdAt`, `updatedAt` | `timestamptz` | |

- Índex per `(personId, paidAt)`.
- **`colla_settings`:** camp nou `membershipFeeAmount numeric(10,2)`, amb un valor per defecte a
  `DEFAULT_COLLA_SETTINGS`. L'edita ADMIN (decisió 2 de la part 1).

### Regles

- **Vigència** (funció pura `computeFeeValidity(fees)` a `@muixer/shared`):
  - Es recorren les quotes de la persona ordenades per `paidAt`.
  - Per a cada quota: si `paidAt` ≤ `validUntil` de l'anterior, `validFrom = validUntil anterior + 1 dia`; si
    no, `validFrom = paidAt`.
  - `validUntil = validFrom + 12 mesos − 1 dia`.
- **Recàlcul:** cada `POST`/`PATCH`/`DELETE` recalcula i desa la cadena sencera de la persona dins la mateixa
  transacció. Són poques files per persona, i així els venciments mai queden incoherents després d'una
  correcció.
- **Estat derivat** (`membershipStatus(fees, today)`): `UP_TO_DATE` si hi ha alguna quota amb
  `validFrom ≤ today ≤ validUntil`; `EXPIRED` si n'hi ha però cap de vigent; `NONE` si no n'hi ha cap.
  - No es guarda mai, és el mateix patró que `isXicalla` (invariant 14 de `DATA_MODEL.md`).
  - El llistat el calcula en SQL. Un test comprova que el SQL i la funció pura donen el mateix resultat.

### API (`@Roles(JUNTA, ADMIN)`)

| Mètode i ruta | Descripció |
|---|---|
| `GET /membership/members` | Persones actives amb `status`, `validUntil` i `lastPaidAt`. Envelope `{ data, meta }`. Filtres: `status`, `expiringWithinDays`, `search` (nom, cognoms, àlies). `sortBy` amb `@IsIn` (`name`, `validUntil`, `lastPaidAt`) |
| `GET /persons/:id/membership-fees` | Historial de la persona, de la més recent a la més antiga, amb l'estat actual |
| `POST /persons/:id/membership-fees` | `{ paidAt, paymentMethod?, notes? }`. L'import i la vigència els posa el servidor |
| `PATCH /membership-fees/:id` | `{ paidAt?, paymentMethod?, notes? }`. Recalcula la cadena |
| `DELETE /membership-fees/:id` | Esborrat real (una quota mal registrada no ha existit). Recalcula la cadena |

- **Auditoria:** `MEMBERSHIP_FEE_CREATED`, `MEMBERSHIP_FEE_UPDATED` i `MEMBERSHIP_FEE_DELETED`, amb la persona,
  `paidAt`, l'import i el diff.
- **Swagger:** DTOs amb `@ApiProperty`. Les rutes no s'enumeren a mà enlloc més.

### Dashboard

- **Ruta `/junta/socis`** (`rolesGuard(JUNTA, ADMIN)`): `app-page-header`, `app-filter-bar` i
  `app-data-table` amb les columnes Persona (primary), Estat (`lib-badge`), Vàlida fins a i Última quota.
- **Acció de fila «Registra una quota»:** `lib-modal` amb:
  - data (avui per defecte);
  - forma de pagament (un `select` amb només «Transferència», preseleccionada);
  - notes.
- **Fitxa de persona:** targeta «Soci» amb l'estat i l'historial, amb edició i esborrat. Es carrega només si
  el rol és JUNTA/ADMIN; un TECHNICAL no fa ni la petició.
- **Manual:** pàgina nova a `docs/manual/` i entrada a `MANUAL_PAGES`.

## 2.4 Fase 3 — Lliurament de documents (mòdul `documents`)

### Model

**`document_types`**: `id`, `name` (únic), `description` (nul·lable), `validity` (`PERMANENT | PER_SEASON`),
`audience` (`ALL | MEMBERS | SELECTED`), `isActive` (soft delete) i timestamps.

**`document_type_persons`**: taula M:N (`documentTypeId`, `personId`). Només té sentit si
`audience = SELECTED`. Si l'audiència canvia, la llista es conserva però s'ignora.

**`document_deliveries`**

| Camp | Tipus | Notes |
|---|---|---|
| `id` | uuid | |
| `documentTypeId` | FK | |
| `personId` | FK, `ON DELETE CASCADE` | El lliurament no té valor sense la persona |
| `seasonId` | FK `seasons`, nul·lable | Obligatori si `PER_SEASON` i nul si `PERMANENT` (es valida al servei) |
| `deliveredAt` | `date` | |
| `registeredById` | FK `users`, nul·lable | |
| `createdAt`, `updatedAt` | `timestamptz` | |

- Unicitat per `(documentTypeId, personId, seasonId)`.
- Com que `seasonId` pot ser nul, cal un índex únic parcial addicional per als permanents:
  `(documentTypeId, personId) WHERE seasonId IS NULL`.

### Regles

- **Audiència** (a qui es demana):
  - Persones amb `isActive = true` i no menors. «Menor» = `deriveIsXicalla`, és a dir, `majorityAge` si hi ha
    `birthDate` i `isXicallaManual` si no n'hi ha.
  - A més: `ALL` totes; `MEMBERS` les que tenen `membershipStatus = UP_TO_DATE` avui; `SELECTED` les de la
    llista.
- **Estat de la cel·la:**
  - `DELIVERED` si hi ha un lliurament (per a `PER_SEASON`, de la temporada triada), **encara que la persona ja
    no siga dins l'audiència**.
  - Si no n'hi ha: `PENDING` si és dins l'audiència i `NOT_REQUIRED` si no hi és.
- **Temporada per defecte:** la que conté avui (`startDate ≤ avui ≤ endDate`). Entre temporades, la de
  `startDate` més recent anterior a avui.
- L'audiència sempre es calcula amb l'estat d'avui, també quan es consulta una temporada passada.

### API (`@Roles(JUNTA, ADMIN)`)

| Mètode i ruta | Descripció |
|---|---|
| `GET /document-types` | Llista (filtre `isActive`) |
| `POST /document-types`, `PATCH /document-types/:id` | Alta i edició. `validity` no es pot canviar si ja hi ha lliuraments (409) |
| `DELETE /document-types/:id` | Soft delete (`isActive = false`) |
| `PUT /document-types/:id/persons` | Reemplaça la llista `SELECTED`: `{ personIds: uuid[] }` |
| `GET /documents/matrix?seasonId=&onlyPending=` | Files de persones amb les cel·les per tipus actiu |
| `PUT /documents/:typeId/deliveries/:personId` | `{ deliveredAt, seasonId? }`. Upsert idempotent |
| `DELETE /documents/:typeId/deliveries/:personId?seasonId=` | Desmarca el lliurament |
| `GET /persons/:id/documents` | Documents de la persona (per a la fitxa) |

- **Auditoria:** `DOCUMENT_TYPE_CREATED`, `DOCUMENT_TYPE_UPDATED`, `DOCUMENT_TYPE_DELETED`,
  `DOCUMENT_DELIVERY_SET` i `DOCUMENT_DELIVERY_CLEARED`.
- Una persona amb lliuraments pot seguir esborrant-se per sempre (cascade): un lliurament no és un bloquejador.

### Dashboard

- **Ruta `/junta/documents`:** graella amb una fila per persona i una columna per tipus actiu.
  - Selector de temporada i filtre «Només pendents».
  - Clic a la cel·la: `PUT` amb la data d'avui; un altre clic, `DELETE`. Actualització optimista amb rollback
    i toast si falla.
  - Al mòbil, una vista de targetes per persona en lloc de la graella, seguint `app-data-table`.
- **Gestió de tipus:** `lib-modal` amb nom, descripció, vigència, audiència i, si és `SELECTED`, un
  `person-search-input` múltiple.
- **Fitxa de persona:** targeta «Documents» (només JUNTA/ADMIN).
- **Manual:** pàgina nova.

## 2.5 Fases 4–7 — notes tècniques preliminars

No són decisions tancades. Serveixen de punt de partida per a cada sessió de disseny.

- **Activitats:**
  - Taula `activities` separada d'`events`: títol, data, hora, lloc, enllaç del lloc, descripció i
    `isActive`.
  - Una taula pròpia d'inscripcions (`activity_registrations`: persona, estat, data).
  - No hereta res d'`events`: ni temporada derivada, ni `attendanceRevision`, ni la `AttendanceSweepService`,
    ni `countsForStatistics`.
  - Si els membres s'hi han d'inscriure des de la PWA, caldrà un endpoint `me/activities`, que seria la primera
    vista de Junta exposada als membres.
- **Pagaments i bestretes:** reutilitzaran `PaymentMethod`. Probablement seran una taula `activity_payments`
  vinculada a la inscripció; si cal saldo per persona, un llibre de moviments (càrrec/abonament) en lloc d'un
  camp de saldo.
- **Transport:** depèn de les activitats. Hi ha dos models possibles: vehicles amb places
  (`transport_vehicles` + `transport_seats`) o una simple marca «necessita transport» a la inscripció. Es
  decidirà amb els requisits.
- **Votacions:**
  - Elegibilitat = `membershipStatus = UP_TO_DATE` en el moment que es fixe (obrir o votar).
  - Si el vot és secret, el registre de *qui ha votat* i el de *què s'ha votat* han d'anar en taules sense
    relació entre elles.
  - És la fase amb més requisits legals (GDPR, estatuts), per això va l'última.

## 2.6 Es deixa a qui ho implemente

- Noms exactes de rutes, components i mòduls, sempre que seguisquen les convencions del repo.
- L'agrupació de la navegació de Junta al Dashboard.
- Si el llistat de socis calcula l'estat en SQL o en memòria (són centenars de persones). Si es fa en memòria,
  el test d'equivalència amb el SQL deixa de ser necessari.

*Veïns: [[DATA_MODEL]] · [[AUTH_FLOW]] · [[GDPR_COMPLIANCE]] · [[ROADMAP]]*
