# Rol Junta i gestió administrativa — requisits i disseny

**Data:** 2026-11-26 · **Estat:** pendent d'aprovació

## Per què

La Junta és l'òrgan màxim de la colla. Porta la part administrativa, econòmica i burocràtica: gestiona
persones, fa llistes d'activitats on no es fan figures i s'hi paga, controla qui ha pagat la quota de
soci i demana documents als membres. Ara ho fa amb fulls de càlcul (la quota de soci, sobretot, costa
molt de controlar) i no té lloc a MuixerApp.

Hi ha dades de Junta que **els tècnics no han de veure**: qui ha pagat la quota, els pagaments, els
documents lliurats i, més endavant, els vots. Per això la Junta necessita un rol propi, i no n'hi ha prou
amb fer-los ADMIN.

**Èxit:** la Junta deixa l'Excel de socis, sap en tot moment qui té vot a l'assemblea i qui té pendent
cada document, sense que el procés siga complicat per a ella.

## Objectius

1. Un rol `JUNTA` que veu i gestiona les dades administratives i que no veu Pinyes.
2. Que les dades sensibles de Junta no arriben mai a un compte TECHNICAL o MEMBER, per construcció.
3. Substituir l'Excel de socis: registrar una quota en segons i saber l'estat de cada soci.
4. Saber qui té pendent cada document que la Junta demana.
5. Deixar documentades, per ordre de prioritat, les funcionalitats que vindran després.

## Fora d'abast (d'este document)

- Vistes pròpies de Junta a la PWA: la Junta usa la PWA com qualsevol membre.
- El disseny de les fases 4–7 (activitats, pagaments, transport, votacions): ací només en queden els
  requisits coneguts. Cadascuna tindrà la seua sessió de disseny.
- Guardar documents, fitxers o dades bancàries (IBAN, comprovants). Només es guarden checks i dates.

## Anti-objectius (seria un fracàs encara que funcionara)

- Que un tècnic puga veure l'estat de quota o els documents d'algú, per qualsevol via (un camp de més
  a `Person`, un filtre, una exportació).
- Que registrar una quota o un document demane més passos que l'Excel actual.
- Que algú no-ADMIN puga donar-se ADMIN, o que un TECHNICAL puga crear un compte JUNTA.

## Restriccions

- Un sol rol per compte (`users.role`). El `RolesGuard` és pla: cada endpoint declara els rols permesos.
- Qui és tècnic i Junta alhora rep el rol **ADMIN** (decisió de la Junta/producte).
- Tots els membres són `Person`. Un soci que no fa muixeranga també es dona d'alta com a `Person`.
- Les mutacions sensibles queden a l'`AuditLog`.
- UI en valencià, amb el sistema de disseny (`@muixer/ui`), i el manual d'usuari s'actualitza a cada fase
  visible.

## Enfocaments considerats

| | Enfocament | Pros | Contres |
|---|---|---|---|
| **A** ✅ | Rol pla nou `JUNTA` a l'enum; endpoints nous amb `@Roles(JUNTA, ADMIN)`; dades de Junta en mòduls i endpoints propis, mai com a camps de `Person` | Encaixa amb el guard actual; aïlla les dades per construcció | Cal revisar els llocs on ara diu `TECHNICAL, ADMIN` o «és staff» |
| B | Permisos per usuari (`canSeeMembership`, `canEditFigures`…) | Permet tècnic + Junta sense ser ADMIN | El cas dual ja es resol amb ADMIN; reescriu tota l'autorització |
| C | Diversos rols per compte (`roles[]`) | Modela bé persones amb doble funció | Mateix problema que B; toca JWT, guards i els dos frontends |

**Triat: A.**

## Prioritat d'implementació

| # | Fase | Depèn de | Detall |
|---|------|----------|--------|
| 1 | Rol JUNTA | — | Disseny complet ↓ |
| 2 | Socis i quotes | 1 | Disseny complet ↓ |
| 3 | Lliurament de documents | 1 (i 2 per a l'abast «Socis») | Disseny complet ↓ |
| 4 | Activitats | 1 | Requisits ↓ |
| 5 | Pagaments d'activitats i bestretes | 4 | Requisits ↓ |
| 6 | Transport | 4 | Requisits ↓ |
| 7 | Votacions | 2 | Requisits ↓ |

---

## Fase 1 — Rol JUNTA

### Matriu d'accés

| Àrea | MEMBER | TECHNICAL | JUNTA | ADMIN |
|---|---|---|---|---|
| PWA (membre: assistència pròpia, segments publicats) | ✔ | ✔ | ✔ | ✔ |
| PWA «Passa llista» | — | ✔ | — | ✔ |
| Dashboard: Inici | — | ✔ | ✔ | ✔ |
| Persones: llistat i fitxa (tots els camps) | — | ✔ | lectura | ✔ |
| Persones: alta i edició de camps personals | — | ✔ | ✔ | ✔ |
| Persones: edició de camps tècnics | — | ✔ | — | ✔ |
| Esborrat permanent de persones | — | — | — | ✔ |
| Temporades | — | ✔ | ✔ | ✔ |
| Assajos i actuacions: consulta (llistat, detall, assistència) | — | ✔ | lectura | ✔ |
| Assajos i actuacions: crear, editar, esborrar, marcar assistència | — | ✔ | — | ✔ |
| Pinyes (plantilles, composicions, segments, projecció) | — | ✔ | — | ✔ |
| Etiquetes | — | ✔ | lectura | ✔ |
| Comunicació (notícies, notificacions) | — | ✔ | ✔ | ✔ |
| Usuaris | crea MEMBER/TECHNICAL | crea MEMBER/TECHNICAL | crea MEMBER/TECHNICAL/JUNTA | tot |
| Dispositius i sessions | — | — | ✔ | ✔ |
| Legal | — | — | ✔ | ✔ |
| Configuració de la colla | — | — | — | ✔ |
| Sync del sistema antic | — | — | — | ✔ |
| Design system | — | — | — | ✔ |
| **Seccions de Junta** (socis, documents i, després, activitats…) | — | — | ✔ | ✔ |

Decidit per la Junta/producte: usuaris, dispositius i legal per a JUNTA; JUNTA crea
MEMBER/TECHNICAL/JUNTA però no ADMIN; TECHNICAL continua creant membres i tècnics; JUNTA **només
consulta** assajos i actuacions (no els crea, no els edita i no marca l'assistència).

Decisions meues (a revisar):
- **TECHNICAL no pot crear, editar ni canviar el rol d'un compte JUNTA.** Si no, un tècnic podria
  donar-se accés a dades de Junta. Mateix patró que la regla actual «només un ADMIN toca un ADMIN»
  (`user.service.ts`).
- **JUNTA no pot canviar el rol d'un ADMIN ni promoure ningú a ADMIN.**
- JUNTA no veu Pinyes: ni la ruta ni els endpoints. Tampoc rep l'enllaç «Passa llista» a la PWA.
- JUNTA veu les etiquetes (surten a la fitxa de persona) però no les gestiona.
- JUNTA no pot revocar sessions ni esborrar dispositius d'un compte ADMIN (mateixa regla que l'edició
  de rols).
- Assajos i actuacions per a JUNTA: els `GET` d'`event.controller` (llistat, detall, assistència) obrin a
  JUNTA; les escriptures es queden TECHNICAL/ADMIN (`@Roles` per mètode, no per classe). Al detall de
  l'esdeveniment, JUNTA no veu els segments, el PDF de resum ni cap botó d'edició o d'assistència.

### Persones: camps personals i tècnics

La Junta veu tota la fitxa, però només edita els camps personals (decisió de la Junta/producte).

| Personals (JUNTA edita) | Tècnics (JUNTA només veu) |
|---|---|
| `name`, `firstSurname`, `secondSurname`, `birthDate`, `phone`, `gender`, `joinDate`, alta/baixa (`isActive`), correu del compte | `alias`, `shoulderHeight`, etiquetes, `isXicallaManual`, `availability`, `onboardingStatus`, `notes`/`notesEmoji`, `shirtDate`, `mentor`, `isProvisional`, `isMember`, i tot el de Pinyes |

- **Validació al servidor:** amb rol JUNTA, `POST/PATCH /persons` accepten només els camps personals. Un
  camp tècnic al cos retorna 403, i no s'ignora en silenci. La llista de camps personals viu a
  `@muixer/shared` i la usen l'API i el formulari del Dashboard (els camps tècnics es mostren
  desactivats per a JUNTA).
- **Alta feta per la Junta:** el formulari no demana l'àlies. El servidor en deriva un d'únic a partir del
  nom (la mateixa lògica que ara fa el sync amb `deriveUniqueAlias`, extreta a un lloc compartit). La
  tècnica el pot canviar després. Decisió meua.
- **Correu:** és `users.email`, l'identificador d'accés, no un camp de `Person`. Es mostra a la fitxa i
  s'hi pot editar, amb l'avís «Este correu és el que fa servir per entrar a l'app». Per dins passa per
  `PATCH /users/:id`, amb les regles de rol (JUNTA no toca un ADMIN). Una persona sense compte no té
  correu, i no s'afegeix cap correu de contacte a `Person`.
- **Esborrat permanent:** continua sent només ADMIN.
- **Prerequisit:** abans d'activar el rol JUNTA es deixa d'usar el sync amb el sistema antic (decisió de
  la Junta/producte). El sync sobreescriu nom, cognoms, telèfon i data de naixement a cada execució
  (`person-sync.strategy.ts`) i perdria les edicions de la Junta. El sync no es toca en este projecte.

### Què canvia

- `UserRole.JUNTA` a `@muixer/shared` + migració de l'enum de Postgres.
- API: revisar cada `@Roles(TECHNICAL, ADMIN)` i cada `@Roles(ADMIN)` amb la matriu. Els controladors de
  Pinyes (`figure`, `composition`, `event-segment`, `node-assignment`, `event-summary`) no canvien.
- `user.service`: regles de qui pot crear/editar quins rols (taula de dalt).
- Dashboard: el guard d'arrel (`rolesGuard(TECHNICAL, ADMIN)`), `isStaff` de `role.guard.ts`,
  `AuthService.isStaff/isAdmin`, les rutes de `/config` i la navegació. Etiqueta i color del rol al
  `user-chip`, al formulari d'usuari i al modal de delegació.
- PWA: afegir JUNTA als guards de l'`AppShell` (`app.routes.ts`); el check «és staff» de la PWA
  (`event-detail`, `event-card`) continua sent TECHNICAL/ADMIN.
- Endpoints `me` i `push-subscription`: afegir JUNTA allà on hi ha MEMBER.
- Tests: una spec per regla nova de `user.service` i, a l'API, un test que confirme que TECHNICAL rep 403
  en un endpoint de Junta.

---

## Fase 2 — Socis i quotes

### Com funciona avui

Les persones arriben a la colla com a `Person` per a la tècnica. Quan ja estan integrades, se'ls explica
que la quota de soci (voluntària) ajuda la colla i dona vot a l'assemblea. Qui paga es registra com a soci.
La quota és **anual**, de **import fix** per a tothom, i cadascú la paga **quan vol**, ara només **per
transferència**. Si algú no paga, no es dona de baixa: simplement no té vot.

### Model

**`membership_fees`** (nova taula; només JUNTA/ADMIN):

| Camp | Tipus | Notes |
|---|---|---|
| `id` | uuid | |
| `person` | FK `persons` | |
| `paidAt` | date | Data de la transferència |
| `validFrom` | date | Calculada en registrar-la (vegeu vigència) |
| `validUntil` | date | `validFrom + 12 mesos − 1 dia` |
| `amount` | numeric(10,2) | Còpia de l'import de la configuració en el moment del registre |
| `paymentMethod` | enum `PaymentMethod` | Ara només `TRANSFER`, per defecte |
| `notes` | text, nul·lable | |
| `registeredBy` | FK `users` | |
| `createdAt` / `updatedAt` | | |

**Configuració de la colla:** nou camp `membershipFeeAmount` (numeric). L'edita ADMIN, com la resta de
la configuració. Decisió meua: si la Junta ha de poder canviar-lo, es mou a una pantalla de Junta.

**Vigència (12 mesos):** si la persona no té cap quota vigent el dia `paidAt`, `validFrom = paidAt`. Si
en té una de vigent (renova abans d'hora), `validFrom = validUntil de l'anterior + 1 dia`, perquè qui
s'avança no hi perda mesos. Aprovat.

**Correccions (decisió meua):** la vigència no es guarda congelada. Quan es crea, edita o esborra una
quota, el servidor recalcula, en la mateixa transacció, `validFrom`/`validUntil` de totes les quotes
d'aquella persona per ordre de `paidAt`. Així, desfer un error d'una quota antiga corregeix les
posteriors. La regla és una funció pura a `@muixer/shared` amb test.

**Sense importació:** la Junta introdueix a mà la quota vigent de cada soci (decisió de la Junta). No hi
ha importació de l'Excel.

**Socis que no fan muixeranga:** són `Person` actives i apareixen a les llistes tècniques (assistència,
Pinyes, camises) com qualsevol altra persona, perquè no bloqueja res (decisió de la Junta). No s'afegeix
cap marca de «soci» a `Person`: els tècnics no han de poder deduir-ho.

**Estat de soci derivat, mai guardat** (com `isXicalla`):
- **Al corrent:** té una quota amb `validFrom ≤ avui ≤ validUntil` (i, per tant, té vot).
- **Caducat:** n'ha pagat alguna, però cap de vigent.
- **No soci:** no n'ha pagat mai.

La regla viu a `@muixer/shared` (una funció pura que rep les quotes i la data) i al SQL de la consulta
del llistat, amb un test que en verifique l'equivalència.

### API (`membership`, `@Roles(JUNTA, ADMIN)`)

- `GET /membership/members`: llistat paginat de persones actives amb estat, última quota i `validUntil`.
  Filtres: estat, «venç en els pròxims N dies», cerca per nom/àlies. Ordenació amb whitelist.
- `GET /persons/:id/membership-fees`: historial d'una persona.
- `POST /persons/:id/membership-fees`: `{ paidAt, paymentMethod?, notes? }`. L'import i la vigència els
  calcula el servidor.
- `PATCH /membership-fees/:id` i `DELETE /membership-fees/:id`: corregir errors. Esborrar és real (no és
  soft delete) perquè una quota mal registrada no ha existit, però queda a l'auditoria.
- Auditoria: `MEMBERSHIP_FEE_CREATED/UPDATED/DELETED` amb persona, dates i import.

Cap camp de quota s'afegeix a `Person` ni a les respostes de `/persons`.

### Dashboard

- Nova secció de Junta **«Socis»**: `app-data-table` amb Persona, Estat (badge), Vàlida fins a i Última
  quota. Filtres d'estat i «Venç aviat». Botó **«Registra una quota»** per fila: un modal amb la data
  (avui per defecte), la forma de pagament («Transferència», preseleccionada) i les notes.
- Fitxa de persona: una targeta «Soci» amb l'estat i l'historial, visible només per a JUNTA/ADMIN.
- Pàgina nova al manual d'usuari.

---

## Fase 3 — Lliurament de documents

### Requisits

La Junta demana documents als membres (per exemple, drets d'imatge). Només es registra el **check** de
lliurament, mai el document. Hi ha documents **permanents** (una vegada acceptats, valen per sempre) i
documents **per temporada**. Cada document es demana a **tothom**, només als **socis** o a una **llista
de persones**. **No es demana mai a menors**: tenen delegada la participació.

### Model

**`document_types`**: `id`, `name`, `description` (nul·lable), `validity` (`PERMANENT | PER_SEASON`),
`audience` (`ALL | MEMBERS | SELECTED`), `isActive`, timestamps.

**`document_type_persons`**: M:N `document_type` ↔ `person`, només per a `audience = SELECTED`.

**`document_deliveries`**: `id`, `documentType`, `person`, `season` (FK, nul·lable; obligatori si
`PER_SEASON`), `deliveredAt` (date), `registeredBy`, timestamps. Únic per `(documentType, person, season)`.

**A qui es demana** (derivat):
- Persones actives, **excepte les menors**, i:
  - `ALL`: totes;
  - `MEMBERS`: els socis **al corrent** el dia de la consulta (fase 2);
  - `SELECTED`: les de la llista.
- Decisió meua: «menor» és l'edat per davall de `majorityAge` si hi ha `birthDate`, i
  `isXicallaManual` si no n'hi ha (la mateixa regla que `deriveIsXicalla`). A revisar si Xicalla no
  equival a menor a la vostra colla.

**Pendent:** a qui es demana i no té lliurament (per a `PER_SEASON`, de la temporada triada).

Decisions meues:
- **Temporada per defecte** de la graella: la que conté avui; entre temporades, l'última que ha començat.
  El selector permet triar-ne qualsevol.
- **L'audiència es calcula sempre amb l'estat d'avui**, també en temporades passades (sociat actual,
  edat actual). És més simple, i la Junta treballa sobre la temporada en curs.
- **Un lliurament existent es mostra sempre com a «Lliurat»**, encara que la persona ja no estiga dins
  l'audiència (ha deixat de ser sòcia, l'han tret de la llista…). Un document permanent signat quan era
  menor continua comptant quan fa la majoria d'edat.
- Cel·les: *Lliurat* · *Pendent* · *No s'hi demana*.

### API (`documents`, `@Roles(JUNTA, ADMIN)`)

- CRUD de `document-types` (soft delete amb `isActive`) i de la seua llista de persones.
- `GET /documents/matrix?seasonId=`: persones × tipus actius, amb l'estat de cada cel·la (lliurat /
  pendent / no s'hi demana).
- `PUT /documents/:typeId/deliveries/:personId` `{ deliveredAt, seasonId? }` i `DELETE` per desmarcar-lo.
  És un toggle idempotent, com l'assistència.
- Auditoria de cada marca o desmarca.

### Dashboard

- Secció de Junta **«Documents»**: graella de persones × documents. Un clic marca el lliurament amb la
  data d'avui; un altre clic el desmarca. Filtre «només pendents» i selector de temporada.
- Gestió de tipus de document (nom, vigència, a qui es demana, llista de persones).
- Fitxa de persona: els documents de la persona, només per a JUNTA/ADMIN.
- Pàgina nova al manual.

---

## Fases següents — requisits coneguts

Cadascuna tindrà una sessió de disseny pròpia abans d'implementar-la.

### Fase 4 — Activitats

- Esdeveniments organitzats per la Junta on **no es fan figures** i sovint **es paga** (sopars, eixides,
  viatges…).
- **Taula pròpia `activities`, separada d'`events`.** No hereta segments, figures, el canvi automàtic a
  «Assistit», les estadístiques de camisa ni les temporades derivades d'assajos/actuacions. El que
  comparteixen (títol, data, lloc, descripció) es copia i no s'abstrau.
- Llista d'inscrits/assistents pròpia, base de les fases 5 i 6.
- Obert: les veuen els membres a la PWA i s'hi poden inscriure? Les veuen els tècnics?

### Fase 5 — Pagaments d'activitats i bestretes

- Control de qui ha pagat cada activitat i de les bestretes (pagaments a compte).
- Reaprofitarà la forma de pagament de la fase 2.
- Obert: preu per persona o per tipus d'inscrit (menor, soci…)? Qui avança diners (la colla o un
  membre)? Cal saber el saldo per persona?

### Fase 6 — Transport

- Organitzar el transport per anar a activitats i, possiblement, a actuacions.
- Obert: autobús amb places vs cotxes particulars, qui va amb qui, si depèn de la fase 5 (pagament del
  bus). El model es decidirà quan existisquen les activitats.

### Fase 7 — Votacions

- Votacions de les assemblees. Només voten els **socis al corrent** (fase 2).
- Obert: vot presencial registrat per la Junta o vot dels membres des de la PWA? Vot secret? Quòrum?
  Delegació de vot? Qui és soci al corrent en quin moment (en obrir la votació o en votar)?

---

## Decisions que deixe al constructor

- Noms exactes de rutes, components i mòduls, sempre que seguisquen les convencions del repo.
- Com s'agrupa la navegació de les seccions de Junta al Dashboard.
- Si el llistat de socis calcula l'estat en SQL o en memòria (el volum és de centenars de persones).

*Veïns: [[DATA_MODEL]] · [[AUTH_FLOW]] · [[GDPR_COMPLIANCE]] · [[ROADMAP]]*
