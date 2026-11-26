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

**Enfocament triat (A):**
- S'afegeix un rol pla `UserRole.JUNTA`.
- Els endpoints nous porten `@Roles(JUNTA, ADMIN)`.
- Les dades de Junta van en mòduls propis (`membership`, `documents`) i **mai** com a camps de `Person` ni dins les respostes de `/persons`.

**Alternatives descartades:**
- **B. Permisos per usuari:** reescriu tota l'autorització, i el cas tècnic + Junta ja es resol amb ADMIN.
- **C. `roles[]`:** el mateix problema que B, i a més toca el JWT, els guards i els dos frontends.

**Restriccions:**
- El `RolesGuard` és pla, sense jerarquia.
- Les mutacions sensibles van a l'`AuditLog`.
- La UI es fa en valencià amb `@muixer/ui`.
- Cada fase visible actualitza el manual d'usuari.

## Fase 1

- **Rol:** `UserRole.JUNTA` a `@muixer/shared` + migració `ALTER TYPE` de l'enum de Postgres.
- **API:**
  - Revisar cada `@Roles(TECHNICAL, ADMIN)` i `@Roles(ADMIN)` amb la matriu de la part 1.
  - Pinyes no canvia: `figure`, `composition`, `event-segment`, `node-assignment` i `event-summary`.
  - `event.controller`: `@Roles` per mètode. Els `GET` (llistat, detall, assistència) s'obrin a JUNTA; les escriptures es queden TECHNICAL/ADMIN.
  - Afegir JUNTA allà on hi ha MEMBER, a `me` i `push-subscription`.
- **`user.service`:**
  - JUNTA crea i edita MEMBER, TECHNICAL i JUNTA.
  - TECHNICAL no toca JUNTA.
  - Ningú que no siga ADMIN toca ADMIN, tampoc les sessions ni els dispositius.
- **Persones:**
  - La llista de camps personals viu a `@muixer/shared`: `name`, `firstSurname`, `secondSurname`, `birthDate`, `phone`, `gender`, `joinDate`, `isActive`.
  - Amb JUNTA, `POST/PATCH /persons` amb un camp tècnic retorna 403; no s'ignora en silenci.
  - El formulari del Dashboard mostra els camps tècnics desactivats per a JUNTA.
  - **Àlies:** si no arriba, el servidor el deriva amb `deriveUniqueAlias`, extret del sync a un lloc compartit.
  - **Correu:** és `users.email` i s'edita via `PATCH /users/:id`. No s'afegeix cap correu de contacte a `Person`.
  - **`joinDate`:** si no arriba, avui, tant a `POST /persons` com a `POST /persons/provisional`. Ara no surt al formulari: cal afegir-lo, amb una ajuda («Per defecte, el dia que es va donar d'alta la persona a l'app»). No s'omplin les existents.
  - El sync (`person-sync.strategy.ts`) no es toca. Deixar-lo d'usar és el prerequisit.
- **Dashboard:**
  - Guard d'arrel, `isStaff` de `role.guard.ts`, `AuthService.isStaff/isAdmin`, rutes de `/config` i navegació.
  - Etiqueta i color del rol a `user-chip`, al formulari d'usuari i al modal de delegació.
  - Al detall d'esdeveniment, amagar segments, PDF, edició i assistència per a JUNTA.
- **PWA:** JUNTA s'afegeix al guard de l'`AppShell`. El check «és staff» (`event-detail`, `event-card`) continua sent TECHNICAL/ADMIN.
- **Tests:** una spec per regla de rol a `user.service`, el 403 de TECHNICAL a un endpoint de Junta i el 403 de JUNTA en editar un camp tècnic.

## Fase 2 — `membership`

- **Taula `membership_fees`:**
  - `id`, `person` (FK)
  - `paidAt`, `validFrom`, `validUntil` (= `validFrom` + 12 mesos − 1 dia)
  - `amount` (numeric(10,2), copiat de `colla_settings.membershipFeeAmount`)
  - `paymentMethod` (enum, ara només `TRANSFER`, per defecte)
  - `notes`, `registeredBy` (FK `users`), timestamps
- **Vigència:**
  - `validFrom = paidAt`, o `validUntil` de l'anterior + 1 dia si n'hi havia una de vigent.
  - En crear, editar o esborrar, es recalcula la cadena sencera de la persona per ordre de `paidAt`, en una transacció.
  - La regla és una funció pura a `@muixer/shared`.
- **Estat derivat, mai guardat:**
  - *Al corrent*: `validFrom ≤ avui ≤ validUntil`.
  - *Caducat*: en té alguna, però no vigent.
  - *No soci*: cap.
  - La funció pura i el SQL del llistat porten un test d'equivalència.
- **Endpoints:**
  - `GET /membership/members`: paginat, filtres d'estat, venciment en N dies i cerca, `sortBy` amb whitelist.
  - `GET` i `POST /persons/:id/membership-fees`: el POST rep `{ paidAt, paymentMethod?, notes? }`.
  - `PATCH` i `DELETE /membership-fees/:id`: el DELETE és real.
- **Auditoria:** `MEMBERSHIP_FEE_CREATED`, `UPDATED` i `DELETED`.
- **Dashboard:**
  - Secció «Socis» amb `app-data-table`.
  - Modal «Registra una quota»: data d'avui i Transferència preseleccionades.
  - Targeta «Soci» a la fitxa de persona.

## Fase 3 — `documents`

- **Taules:**
  - `document_types`: `name`, `description`, `validity` (`PERMANENT | PER_SEASON`), `audience` (`ALL | MEMBERS | SELECTED`), `isActive`.
  - `document_type_persons`: M:N, només per a `SELECTED`.
  - `document_deliveries`: `documentType`, `person`, `season` (obligatori si `PER_SEASON`), `deliveredAt`, `registeredBy`. Única per `(documentType, person, season)`.
- **Audiència:**
  - Persones actives no menors, segons `deriveIsXicalla` (`majorityAge` o `isXicallaManual`).
  - `MEMBERS` vol dir socis al corrent avui.
- **Temporada per defecte:** la que conté avui; entre temporades, l'última que ha començat.
- **Endpoints:**
  - CRUD de `document-types` (soft delete) i de la seua llista de persones.
  - `GET /documents/matrix?seasonId=`.
  - `PUT` i `DELETE /documents/:typeId/deliveries/:personId`: toggle idempotent.
  - Totes les marques i desmarques s'auditen.

**Es deixa a qui ho implemente:**
- Noms de rutes, components i mòduls.
- L'agrupació de la navegació de Junta.
- Calcular l'estat de soci en SQL o en memòria (són centenars de persones).

*Veïns: [[DATA_MODEL]] · [[AUTH_FLOW]] · [[GDPR_COMPLIANCE]] · [[ROADMAP]]*
