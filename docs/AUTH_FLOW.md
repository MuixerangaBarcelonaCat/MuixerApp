---
tags: [domini]
---

# Auth Flow — MuixerApp

> P4.1 Auth Layer. JWT + Passport. Implementat abril 2026.
> §6-7 actualitzades agost 2026: l'onboarding de membres passa d'invitació per correu
> (mai implementada) a enllaç copiat manualment + registre a la PWA, i s'hi afegeix el
> flux de dependents (xicalla).
> §6.0 afegida setembre 2026: regla d'accés (només s'entra si ja existeix la `Person`),
> els dos estats d'entrada segons si ja tenim el correu, i comparació d'emails
> insensible a majúscules.
> §8.1 afegida setembre 2026 i **desactivada immediatament**: l'enllaç de recuperació
> generat per un tècnic està implementat però comentat al codi. La secció explica per què
> i què caldria abans de rehabilitar-lo.

---

## Resum

Autenticació basada en **JWT access token** (memòria) + **refresh token** (httpOnly cookie amb rotació + detecció de reutilització). Dues strategies de Passport: `local` (login) i `jwt` (protecció global).

---

## Guia per a l'equip de suport (llenguatge planer)

Pensada per a qui ajudarà usuaris finals (xicalla, membres, familiars) sense coneixements tècnics durant les proves de PWA i Dashboard. Sense jerga.

**Dos tipus de compte:**
- **Dashboard** (ADMIN/TECHNICAL): gent de la junta/tècnica, gestiona tota l'app.
- **PWA** (MEMBER): membres normals, només veuen les seues coses (assajos, actuacions, la seua fitxa).

**Regla d'or:** només pot entrar a l'app algú que ja existisca com a **Persona** al Dashboard (encara que siga una fitxa provisional, a mitges). Els perfils els creen i gestionen sempre els admins/tècnics; ningú es dona d'alta pel seu compte.

**Com fa "login" un membre per primera vegada — no hi ha registre lliure:**
1. Algú del Dashboard (ADMIN/TECHNICAL) entra a la fitxa de la persona i prem **"Crea enllaç d'invitació"**.
2. Este enllaç **no s'envia sol per correu** — l'admin l'ha de copiar i enviar-lo a mà (WhatsApp, normalment) a la persona.
3. La persona obre l'enllaç al mòbil → s'obre la PWA a la pantalla **"Activa el teu compte"**, ja amb **totes les dades que tenim d'ella prellenades** (nom, cognoms, gènere, telèfon, data de naixement) → les revisa i corregeix, completa el que falte, tria una contrasenya, accepta la política de privacitat → **ja queda dins**, sense haver de tornar a fer login.
   - **Si ja teníem el seu correu** (ve del sistema antic), apareix escrit i **no el pot canviar** — si és incorrecte, l'ha de canviar un tècnic des del Dashboard abans que ella active el compte.
   - **Si no en teníem cap** (persona donada d'alta a mà), el correu l'escriu ella. Si ja pertany a un altre compte, li dirà que aquest correu ja existeix — llavors cal mirar si eixa persona ja té compte o si hi ha una fitxa duplicada.
4. **L'enllaç caduca als 3 dies.** Si caduca abans que la persona l'active, l'admin torna a prémer el mateix botó i genera un enllaç nou — sempre l'últim que s'ha enviat és el vàlid, els anteriors deixen de funcionar.
5. **Un cop el compte ja està actiu, el botó d'invitació desapareix** de la fitxa i es mostra l'indicador "Compte actiu" — a partir d'ací la persona entra sempre amb el seu email i contrasenya.

**Login del dia a dia (compte ja actiu):** email + contrasenya, tant al Dashboard com a la PWA. La sessió es manté sola una bona temporada (8 hores al Dashboard, 7 dies a la PWA) sense haver de tornar a introduir res — només cal tornar a fer login si ha passat molt de temps o s'ha fet "Tanca la sessió".

**Si un membre oblida la contrasenya (compte ja actiu):**
1. A la pantalla de login, prem **"Heu oblidat la contrasenya?"** (existeix tant al Dashboard com a la PWA) i escriu el seu email.
2. Si eixe email correspon a un compte actiu, li arriba un correu amb un enllaç per triar una contrasenya nova, **vàlid només 1 hora**.
3. **Este enllaç sempre obre la pantalla al Dashboard** (encara que la persona l'haja demanat des de la PWA) — és normal, no cal que el membre "entri" al Dashboard, només fer clic i triar la contrasenya des del mòbil.
4. En triar la contrasenya nova, **es tanquen totes les sessions obertes** (mòbil, tauleta, etc.) — cal tornar a fer login a tot arreu amb la contrasenya nova.
5. Si no li arriba el correu: comprovar que l'email escrit és exactament el que té guardat al seu compte — per seguretat, el sistema **mai diu si un email existeix o no** (sempre respon "revisa el correu", encara que l'email fóra incorrecte).

**Important — què fer si un membre encara no ha activat mai el compte i ha "oblidat" la contrasenya:** no aplica "Heu oblidat la contrasenya?" (el seu compte encara no en té cap). Cal tornar al pas de dalt: l'admin li genera un **enllaç d'invitació** nou des de la fitxa.

**Si un membre no recorda la contrasenya i ara mateix no pot entrar al seu correu:** de moment **l'única via és el correu**. Ha de recuperar l'accés a la seua bústia (des del mòbil sol ser només obrir l'app de correu) i seguir els passos de dalt. No hi ha cap manera que un tècnic li done accés directament: es va implementar un enllaç de recuperació generat pel tècnic i **es va desactivar a propòsit** perquè qualsevol que reba eixe enllaç pot entrar al compte, i reenviant-lo per WhatsApp no podem comprovar que arribe a la persona correcta (§8.1).

Què **sí** pot fer un tècnic per ajudar-lo:
- Dir-li **quin correu** té guardat al compte (el pot consultar a la seua fitxa) — moltes vegades el problema és només que prova amb un correu equivocat.
- Si el correu de la fitxa és antic o incorrecte, canviar-l'hi des del Dashboard i que després faça "Heu oblidat la contrasenya?" amb el correu nou.

**Important — què fer si el compte encara no s'ha activat mai:** allí no serveix "Heu oblidat la contrasenya?" (el compte encara no en té cap). Cal generar un **enllaç d'invitació** nou des de la fitxa.

**Important — si un membre JA actiu ha perdut l'accés del tot (mòbil perdut, no recorda ni el correu):** el tècnic li diu quin correu té al compte i, si cal, l'hi canvia per un al qual sí puga accedir; a partir d'ací, "Heu oblidat la contrasenya?". Que la persona s'el canvie ella mateixa segueix requerint la contrasenya actual.

**Qui pot veure/reenviar l'enllaç d'invitació d'una persona:** només ADMIN/TECHNICAL des del Dashboard (fitxa de la persona). El sistema no l'envia mai automàticament — sempre passa per una persona real que el reenvia a mà, per això no cal tindre un email configurat per a cada membre per activar el compte.

---

## 1. Login


```
Client (Dashboard/PWA)                    Backend (NestJS)
─────────────────────                     ────────────────
POST /auth/login                    →     LocalStrategy.validate()
{ email, password, clientType }           ├─ findOne(email) + bcrypt.compare
                                          ├─ return User (amb Person rel)
                                          │
                                          AuthService.login(user, clientType)
                                          ├─ signAccessToken(user) → JWT {sub, email, role}
                                          ├─ tokenService.createRefreshToken(user, clientType)
                                          │   ├─ randomBytes(32) → token opac
                                          │   ├─ SHA-256 hash → DB (refresh_tokens)
                                          │   └─ return rawToken
                                          │
                                    ←     Set-Cookie: muixer_rt=<rawToken> (httpOnly)
                                          { accessToken, user: UserProfile }
```

**Emmagatzematge al client:**
- `accessToken` → signal en memòria (`_accessToken` signal, mai localStorage)
- `refreshToken` → cookie httpOnly `muixer_rt` (el browser la gestiona)

**Silent refresh al bootstrap:**
- `AuthService` constructor crida `POST /auth/refresh` automàticament
- `isReady` signal (+ `whenReady()` Promise) indica quan la init ha acabat
- Guards async esperen `whenReady()` abans de decidir → zero parpellejos
- No es bloqueja el renderitzat de l'app (no `APP_INITIALIZER` bloquejant)

---

## 2. Request autenticat

```
Client                                    Backend
──────                                    ───────
GET /api/persons                    →     JwtAuthGuard (global)
Authorization: Bearer <accessToken>       ├─ @Public()? → skip guard
                                          ├─ JwtStrategy.validate(payload)
                                          │   └─ ExtractJwt.fromAuthHeaderAsBearerToken()
                                          ├─ RolesGuard (global)
                                          │   └─ @Roles()? → check user.role ∈ allowedRoles
                                    ←     200 OK / 401 / 403
```

**Angular interceptor** (`authInterceptor`): afegeix `Authorization: Bearer` a totes les requests fora de `/auth/`.

---

## 3. Refresh (rotació de token)

```
Client                                    Backend
──────                                    ───────
POST /auth/refresh                  →     AuthController.refresh()
Cookie: muixer_rt=<oldToken>              ├─ llegir cookie
                                          ├─ tokenService.rotateRefreshToken(oldToken)
                                          │   ├─ SHA-256(oldToken) → buscar a DB
                                          │   ├─ ⚠ usedAt != null? → REVOCAR FAMÍLIA
                                          │   ├─ revokedAt != null? → 401
                                          │   ├─ expiresAt < now? → 401
                                          │   ├─ marcar oldToken com used
                                          │   └─ crear nou token (mateixa família)
                                          ├─ signAccessToken(user)
                                    ←     Set-Cookie: muixer_rt=<newToken>
                                          { accessToken, user: UserProfile }
```

**Flux automàtic al Dashboard**: si una request rep 401, l'interceptor crida `/auth/refresh`, actualitza l'access token i reintenta la request original. Si el refresh falla → `clearState()` + redirect a `/login`.

---

## 4. Logout

```
POST /auth/logout       →  revocar token actual + clearCookie
POST /auth/logout-all   →  revocar TOTS els tokens del user + clearCookie
```

---

## 5. Setup inicial (bootstrap)

```
POST /auth/setup/user                   →     AuthController.setupUser()
Headers: X-Setup-Token: <SETUP_TOKEN>         ├─ validar SETUP_TOKEN env
Body: { email, password, role?, personId? }   ├─ crear User (isActive: true)
                                              ├─ link a Person (per personId o per email match)
                                        ←     UserProfile
```

> Endpoint per crear el primer user TECHNICAL sense auth prèvia. Eliminar `SETUP_TOKEN` de `.env` en producció després del primer ús.

---

## 6. Onboarding de membres (enllaç d'invitació, no correu)

### 6.0 Regla d'accés

**Només s'entra a l'app si abans existeix una `Person`.** No hi ha registre lliure ni cap
pantalla pública on algú puga donar-se d'alta. La seqüència és sempre la mateixa:

```
Un ADMIN/TECHNICAL crea la Person   →   genera l'enllaç d'invitació   →   la persona l'activa
   (o la porta el sync legacy)              (Dashboard, fitxa)              (PWA, /activate)
```

La `Person` pot ser **provisional** (alias amb prefix `~`, dades a mitges): serveix igualment
per convidar, i activar el compte la promou a definitiva. Qui gestiona el padró de persones
són sempre els admins i tècnics; l'usuari final només completa i corregeix les seues pròpies
dades durant l'activació.

**Dos estats d'entrada**, segons si ja tenim el correu de la persona:

| Origen de la `Person` | `user.email` en generar l'enllaç | Camp email a `/activate` |
|---|---|---|
| Sync legacy amb correu | ple (el sync crea el `User` esborrany amb el correu legacy) | prellenat i **bloquejat** |
| Sync legacy sense correu | `null` | buit i editable |
| Creada a mà al Dashboard | `null` | buit i editable |

`Person` **no té columna email** — el correu viu només a `User`. Per això una persona creada
a mà arriba a l'activació sense correu conegut i és ella qui l'escriu; si el que escriu ja
pertany a un altre compte, rep un 409 (`Ja existeix un compte amb aquest email`). Quan el
correu ja el tenim, el del cos de la petició s'ignora i es manté el de l'admin: canviar-lo és
una acció de tècnic, no d'usuari.

Els correus es normalitzen a minúscules en escriure'ls i es comparen sense distingir
majúscules (`AuthService.findByEmail`), tant al login com al registre i al canvi de correu —
un membre que escriu `Joan@Correu.cat` entra igual.

### 6.1 Generació de l'enllaç i activació

No s'envia cap correu: l'admin genera un enllaç des del Dashboard i el reenvia manualment
(WhatsApp). El membre l'obri a la PWA, revisa les dades que ja tenim, completa el que falta i
el compte s'activa amb auto-login.

```
Dashboard (admin)                         Backend
──────────────────                        ───────
POST /users/invite-link             →     UserController.createInviteLink()
{ personId }                              UserService.createOrRefreshInviteLink()
                                          ├─ person.user inexistent? → crea User
                                          │   (email: null, isActive: false, role: MEMBER)
                                          │   i degrada el delegat primari si n'hi ha
                                          ├─ person.user actiu? → 400 (ja té compte)
                                          ├─ genera token (randomBytes) + SHA-256 hash
                                          ├─ inviteExpiresAt = now + INVITE_TOKEN_TTL_HOURS
                                    ←     { inviteUrl, expiresAt }
```

El botó **"Crea enllaç d'invitació"** no es desactiva mai: repetir la crida regenera el
token (i és l'única manera de "reenviar" un enllaç caducat). Un cop el compte és actiu, el
botó desapareix i es mostra només l'indicador "Compte actiu": per a un compte que ja existeix
l'única via de recuperació és el correu (§8), perquè l'acció equivalent generada pel tècnic
està desactivada (§8.1).

```
PWA (membre)                              Backend
─────────────                             ───────
GET /auth/invite/:token             →     AuthController.getInviteContext()
                                          ├─ valida hash + expiresAt
                                    ←     { email (o null), person (prellenat),
                                            expiresAt, legalDocument }

POST /auth/invite/register          →     AuthController.registerViaInvite()
{ token, email, password,                 AuthService.registerViaInvite() — transaccional:
  legalAccepted, name, firstSurname,      ├─ valida token; email = user.email ?? dto.email
                                          │   (si el compte ja en té, el del cos s'ignora)
                                          ├─ si no en tenia: 409 si el correu és d'un ALTRE
                                          │   usuari — el propi esborrany no compta
  secondSurname?, gender, phone,          ├─ activa User (email, password, isActive: true)
  birthDate }                             ├─ promou Person (PersonService.update amb manager):
                                          │   isProvisional → false, treu prefix `~` de l'alias
                                          ├─ registra AuditAction.CONSENT_ACCEPTED
                                          ├─ auto-login (access + refresh, clientType PWA)
                                    ←     Set-Cookie + { accessToken, user }
```

El formulari de registre és `PersonRegistrationDataDto` (nom, cognoms, gènere, telèfon E.164
validat amb `libphonenumber-js`, data de naixement) + `email`/`password`/`legalAccepted` —
compartit amb el flux de dependents (§7) via el mateix DTO base.

**Tots** els camps que el context retorna arriben prellenats (nom, cognoms, gènere, telèfon
partit en país + número via `splitPhoneNumber`, data de naixement) i són editables: l'usuari
corregeix el que estiga malament i completa el que falte. L'única excepció és el correu quan
ja el tenim (§6.0). El formulari, doncs, és de **revisió**, no d'alta des de zero.

---

## 7. Dependents (xicalla) pendents de completar

Una xicalla mai té compte propi: es vincula com a `PersonDelegate` primari a un membre ja
registrat (abans o després que este activi el seu propi compte — cap dels dos ordres bloqueja
l'altre). Completar les seues dades és una acció autenticada normal, **no** un segon enllaç
d'invitació.

```
PWA (membre autenticat)                   Backend (@Roles MEMBER, TECHNICAL, ADMIN)
────────────────────────                  ─────────────────────────────────────────
GET /me/pending-dependents           →    MeService.getPendingDependents(userId)
                                          └─ PersonDelegateService
                                               .findProvisionalPrimaryDependents(userId)
                                    ←      PendingDependent[] (personId, alias, prellenat)

POST /me/pending-dependents           →   MeService.completePendingDependent(userId, dto)
{ personId, name, firstSurname,           ├─ re-consulta el set elegible (autorització:
  secondSurname?, gender, phone,          │   rebutja 400 si personId no hi és)
  birthDate }                             ├─ PersonService.update(personId, {…, isProvisional: false})
                                    ←      200
```

La PWA mostra un banner a Inici quan la llista no és buida (alias si n'hi ha 1, recompte si
n'hi ha més) i completa **un dependent alhora**: envia, torna a demanar la llista, i mostra el
següent (o navega a Inici si ja no en queda cap). `PersonDataFieldsComponent` (el subformulari
de dades personals) és exactament el mateix component que useu al registre (§6) — cap
duplicació de camps ni validadors.

---

## 8. Forgot / reset password

Només per usuaris amb `email` (Dashboard). Mai revela si l'email existeix.

```
POST /auth/forgot-password          →     AuthController.forgotPassword()
{ email }                                 AuthService.forgotPassword()
                                          ├─ findByEmail — si no existeix, retorna igual (silenciós)
                                          ├─ randomBytes(16) → token opac + SHA-256 hash → DB
                                          ├─ expiresAt = now + PASSWORD_RESET_TTL (1h)
                                          ├─ MailService.send(buildPasswordResetEmail) amb SITE_ADDRESS
                                    ←     200 (sempre, independentment de si l'email existia)

POST /auth/reset-password           →     AuthController.resetPassword()
{ token, password }                       AuthService.resetPassword()
                                          ├─ SHA-256(token) → buscar + validar expiresAt
                                          ├─ actualitza password (bcrypt)
                                          ├─ revokeAllUserTokens(userId) — tanca totes les sessions
                                    ←     200
```

`SITE_ADDRESS` (Dashboard) és una variable diferent de `PWA_SITE_ADDRESS` (§6, enllaç d'invitació) — no confondre-les.

### 8.1 Enllaç de recuperació generat per un tècnic — implementat i DESACTIVAT

> **Estat: desactivat a propòsit.** El codi existeix però està comentat a
> `user.controller.ts`, `user.service.ts`, `user.module.ts`, `auth.constants.ts`,
> `invite.interfaces.ts`, `audit-action.enum.ts`, `person.service.ts` i
> `person-detail.component.{ts,html}`. Els tests corresponents es van retirar; són al commit
> `e2f5e96`. **No el rehabiliteu sense llegir «Què caldria abans» d'aquesta secció.**

#### Quin problema volia resoldre

El flux per correu (§8) assumeix que la persona pot llegir la seua bústia en eixe moment. Per a
un membre poc tecnològic això sovint no és cert, i el deixa bloquejat. La idea era que un
ADMIN/TECHNICAL generés l'enllaç des de la fitxa de la persona i el reenviés a mà, igual que
l'enllaç d'invitació — sense que el correu hi participés en cap pas.

```
Dashboard (tècnic)                        Backend (@Roles ADMIN, TECHNICAL)
──────────────────                        ─────────────────────────────────
POST /users/recovery-link           →     UserController.createRecoveryLink()
{ personId }                              UserService.createRecoveryLink(personId, actor.sub)
                                          ├─ sense Person → 400
                                          ├─ Person sense User → 400 ("no té cap compte vinculat")
                                          ├─ User no actiu / sense passwordHash → 400
                                          │   ("useu l'enllaç d'invitació")
                                          ├─ randomBytes(16) → resetToken (SHA-256) a la DB
                                          ├─ resetExpiresAt = now + RECOVERY_LINK_TTL_HOURS (24h)
                                          ├─ AuditAction.RECOVERY_LINK_CREATED (actor + persona)
                                    ←     { recoveryUrl, expiresAt }
```

Reutilitzava **el mateix `resetToken`** que el flux per correu, així que consumir-lo passava per
`POST /auth/reset-password` sense cap camí nou: revocava totes les sessions obertes i esborrava
el token.

#### Per què està desactivat

L'enllaç és un **token portador** («bearer token»): l'única credencial és conéixer la URL. Qui la
tinga pot triar una contrasenya nova i entrar al compte, i el sistema **no comprova en cap moment
que siga el propietari**. Això, en si mateix, és igual que el flux per correu — la diferència
crítica és **el canal**:

| | Per correu (§8) | Generat pel tècnic (§8.1) |
|---|---|---|
| A qui arriba l'enllaç | a la bústia del propietari del compte, per definició | a qui el tècnic decidisca, escrivint un número a mà |
| Qui pot equivocar-se | ningú: l'adreça la té el sistema | el tècnic (número equivocat, fitxa duplicada) i el receptor (reenviament a un grup) |
| Reenviament posterior | improbable | trivial: és un missatge de WhatsApp |
| Vida de la finestra d'atac | 1 hora | 24 hores |

Concretament: un ADMIN/TECHNICAL ja té el poder de suplantar qualsevol compte (pot canviar-ne
l'email, generar invitacions...), i això és inherent al rol. El problema no era el privilegi, era
que **el token eixia de les seues mans** i viatjava per un canal que no controlem. Un error
d'un dígit al número de telèfon, o un reenviament sense pensar, entregava un compte sencer a una
altra persona durant 24 hores. L'únic senyal que quedava era que el propietari legítim es trobava
desconnectat de sobte, sense saber per què.

Amb una colla d'unes desenes de persones que es coneixen entre elles el risc pràctic és baix, però
el cost de tenir-ho desactivat també: qui no recorda la contrasenya obre l'app de correu del
mòbil. Preferim la via que no depén del criteri de qui reenvia.

#### Què caldria abans de rehabilitar-ho

En ordre de cost/benefici. Els tres primers punts són barats i canvien el pitjor cas de «24 hores
per suplantar en silenci» a «minuts, i el propietari rep un avís»:

1. **TTL molt més curt** — 15 minuts en lloc de 24 hores (`RECOVERY_LINK_TTL_HOURS`). Converteix
   «enllaç reenviable durant un dia» en «enllaç que només serveix ara mateix, amb el tècnic al
   costat». Els 24 h originals es van triar pensant en WhatsApp asíncron, que és justament el forat.
2. **Auditar el consum i avisar el propietari** — afegir una acció d'auditoria dins
   `AuthService.resetPassword` (ara només s'audita la *creació* de l'enllaç, no el seu ús) i
   enviar un avís «S'ha canviat la teua contrasenya» pel mòdul `push-notification` (ja existeix,
   amb VAPID configurat) i/o per `MailService`. No ho evita, però ho fa detectable.
3. **Segon factor que el tècnic no dicta** — la pantalla `/reset-password` demana, a més de la
   contrasenya nova, una dada que ja tenim a la `Person` i que no viatja dins de l'enllaç: la
   **data de naixement**. No és un secret fort dins d'una colla, però trenca el cas «he obert un
   enllaç que no era per a mi». El throttle de `/auth` (10 req/60 s) ja limita l'endevinació.
4. **Enviar-lo pel canal verificat** — que el backend l'envie per SMS a `person.phone` en lloc de
   copiar-lo al portapapers del tècnic. Elimina l'error de destinatari, però requereix un
   proveïdor d'SMS (cost real).

**El que NO cal fer:** lligar el token a una IP o a un dispositiu. Amb mòbils en 4G/5G canviant
d'IP contínuament generaria més incidències de suport que atacs evitats.

#### Detalls d'implementació que es mantenen al codi comentat

El botó **"Crea enllaç de recuperació"** només es mostrava a la branca de compte actiu de
`person-detail` (per a un compte pendent l'acció correcta és l'enllaç d'invitació, i el backend
també ho refusava). L'enllaç apuntava a la **PWA** (`PWA_SITE_ADDRESS`), no al Dashboard, perquè
el destinatari és un membre; per això la PWA té la seua pròpia ruta `/reset-password`
(`app.routes.ts`), bessona de la del Dashboard. **Eixa ruta i el seu component es mantenen
actius**: ara mateix no hi aterra ningú (el correu de §8 usa `SITE_ADDRESS`), però és el destí
natural del correu d'un membre si algun dia el volem apuntar a la PWA.

---

## 9. Consentiment legal (`ConsentController`)

Fora del prefix `/auth/` a propòsit: l'interceptor Angular afegeix `Authorization: Bearer` a totes les crides fora de `/auth/`, i acceptar el consentiment requereix un usuari ja autenticat.

```
POST /consent/privacy-policy        →     ConsentController.acceptPrivacyPolicy()
                                          (autenticat) — registra acceptació de la versió vigent
```

---

## Components del sistema

### Backend (`apps/api/src/modules/auth/`)

| Fitxer | Responsabilitat |
|--------|----------------|
| `auth.module.ts` | Registra Passport, JWT, ThrottlerModule, entitats |
| `auth.controller.ts` | login, refresh, logout, logout-all, me, `GET invite/:token`, `POST invite/register`, setup/user, forgot/reset-password |
| `consent.controller.ts` | `POST /consent/privacy-policy` (fora de `/auth/`, veure §9) |
| `auth.service.ts` | Lògica de negoci: validate, login, refresh, logout, `getInviteContext`, `registerViaInvite` (transaccional User+Person), setupUser, forgotPassword/resetPassword |
| `token.service.ts` | CRUD de refresh tokens: create, rotate (reuse detection), revoke |
| `strategies/local.strategy.ts` | Passport Local: email + password via bcrypt |
| `strategies/jwt.strategy.ts` | Passport JWT (`jwt`): extract Bearer token only, validate payload |
| `strategies/jwt-sse.strategy.ts` | Passport JWT (`jwt-sse`): Bearer o `?token=` query param — només per rutes `@SseAuth()` (veure [[SSE_AUTH]]) |
| `decorators/sse-auth.decorator.ts` | `@SseAuth()` — marca una ruta perquè el guard usi `jwt-sse` enlloc de `jwt` |
| `guards/jwt-auth.guard.ts` | Guard global (APP_GUARD). Respecta `@Public()`, delega a `jwt-sse` si `@SseAuth()` |
| `guards/roles.guard.ts` | Guard global (APP_GUARD). Respecta `@Roles()` — llista plana, sense jerarquia |
| `decorators/public.decorator.ts` | `@Public()` — exclou endpoint del JwtAuthGuard |
| `decorators/roles.decorator.ts` | `@Roles(UserRole.TECHNICAL)` — restringeix per rol |
| `decorators/current-user.decorator.ts` | `@CurrentUser()` — extreu `JwtPayload` del request |
| `entities/refresh-token.entity.ts` | Entitat TypeORM: hash, family, clientType, expiresAt, usedAt, revokedAt |
| `constants/auth.constants.ts` | TTLs (env-configurable), cookie name, claus metadata |

**Enllaç d'invitació i dependents** (fora del mòdul `auth`, però part del mateix flux):

| Fitxer | Responsabilitat |
|--------|----------------|
| `modules/user/user.service.ts` | `createOrRefreshInviteLink(personId)` — crea/reutilitza `User`, genera i (re)hasheja el token |
| `modules/user/user.service.ts` | `createRecoveryLink(personId, actorUserId)` — **comentat**: enllaç de contrasenya nova per a un compte ja actiu (§8.1) |
| `modules/person/dto/person-registration-data.dto.ts` | DTO base compartit (registre propi i dependents): nom, cognoms, gènere, telèfon (`IsValidPhoneNumber`), data naixement |
| `modules/person-delegate/person-delegate.service.ts` | `findProvisionalPrimaryDependents(userId)` — dependents provisionals on l'usuari és delegat primari |
| `modules/me/me.service.ts` | `getPendingDependents` / `completePendingDependent` (`GET`/`POST /me/pending-dependents`) |
| `common/validators/is-valid-phone-number.decorator.ts` | `@IsValidPhoneNumber()` — backed by `libphonenumber-js` |

### Frontend (`apps/dashboard/src/app/core/auth/`)

| Fitxer | Responsabilitat |
|--------|----------------|
| `services/auth.service.ts` | Signal-based: `currentUser`, `isAuthenticated`, `isReady`, `userRole`. Constructor → silent refresh. `refresh()` dedup via `share()`. `whenReady()` Promise pels guards. |
| `interceptors/auth.interceptor.ts` | Afegeix `Bearer` header. 401 → `refresh()` (dedup) → retry. Refresh fail → redirect `/login` |
| `guards/auth.guard.ts` | `CanActivateFn` async: `await whenReady()` → si no autenticat → redirect `/login` |
| `guards/role.guard.ts` | `rolesGuard(...roles)`: async factory, `await whenReady()` → verifica `userRole()` ∈ allowedRoles |
| `models/auth.models.ts` | Interfaces: `LoginRequest`, `AuthResponse`, `UserProfile`, `PersonSummary` |

### PWA (`apps/pwa/src/app/`)

| Fitxer | Responsabilitat |
|--------|----------------|
| `features/auth/activate/activate.component.ts` | Ruta `/activate?token=`. Prellenat via `getInviteContext`, formulari complet, `registerViaInvite` → auto-login → `/home` |
| `features/auth/reset-password/reset-password.component.ts` | Ruta `/reset-password?token=` per a qualsevol `resetToken`; en desar, remet a `/login`. Ara mateix sense trànsit: el correu de §8 aterra al Dashboard (§8.1) |
| `shared/components/person-data-fields/person-data-fields.component.ts` | Subformulari reutilitzat pel registre i pels dependents — pren un `FormGroup` ja construït, no en té estat propi |
| `shared/utils/person-data-form.util.ts` | `buildPersonDataFormGroup`, `combinePhoneNumber`/`splitPhoneNumber` (país + número ↔ E.164 via `libphonenumber-js`), `getCountryOptions` |
| `features/dependents/pending-dependents/pending-dependents.component.ts` | Ruta `/pending-dependents`. Completa **un dependent alhora**, torna a demanar la llista entre cada enviament |
| `core/services/dependents.service.ts` | `getPending()` / `completePending(payload)` |
| `core/auth/services/auth.service.ts` | + `getInviteContext(token)`, `registerViaInvite(payload)` |
| `features/home/home.component.ts` | Banner de dependents pendents (`GET /me/pending-dependents` via `rxResource`) |

### Shared (`libs/shared/src/`)

| Fitxer | Contingut |
|--------|-----------|
| `enums/client-type.enum.ts` | `ClientType.DASHBOARD \| ClientType.PWA` |
| `interfaces/auth.interfaces.ts` | `JwtPayload`, `PersonSummary`, `UserProfile` |
| `interfaces/invite.interfaces.ts` | `InviteLinkResponse`, `RecoveryLinkResponse`, `PersonRegistrationData`, `RegisterViaInviteRequest`, `InviteRegistrationContext` |
| `interfaces/me/pending-dependent.interface.ts` | `PendingDependent`, `DependentRegistrationRequest` |

---

## Variables d'entorn

| Variable | Exemple | Descripció |
|----------|---------|------------|
| `JWT_SECRET` | `strong-random-64-chars` | Secret per signar access tokens |
| `JWT_ACCESS_TTL` | `900` | Vida access token en segons (15 min) |
| `JWT_REFRESH_TTL_DASHBOARD` | `28800` | Vida refresh token Dashboard en segons (8h) |
| `JWT_REFRESH_TTL_PWA` | `604800` | Vida refresh token PWA en segons (7 dies) |
| `REFRESH_TOKEN_COOKIE` | `muixer_rt` | Nom de la cookie httpOnly |
| `SETUP_TOKEN` | `uuid-aleatori` | Token per al bootstrap endpoint. Eliminar en prod |
| `CORS_ORIGINS` | `http://localhost:4200,http://localhost:4300` | Orígens permesos (comma-separated) |
| `PWA_SITE_ADDRESS` | `localhost:4300` | Host usat per construir `inviteUrl` (`/activate?token=`) |
| `SITE_ADDRESS` | `localhost:4200` | Host usat per construir l'enllaç de `reset-password` (Dashboard) — **diferent** de `PWA_SITE_ADDRESS` |
| `INVITE_TOKEN_TTL_HOURS` | `72` | Vida del token d'invitació en hores |
| ~~`RECOVERY_LINK_TTL_HOURS`~~ | — | **Desactivada** amb l'enllaç de recuperació generat per un tècnic (§8.1). Si es rehabilita, useu un valor molt més curt que les 24 hores originals |
| `COOKIE_SECURE` | `true` | Si no és `'false'` i `NODE_ENV=production`, marca la cookie `muixer_rt` com `secure` |

---

## Seguretat

- **bcrypt cost 12+** per hashing de passwords
- **SHA-256** per hashing de refresh tokens a DB (mai guardat en clar)
- **Rotació obligatòria**: cada ús de refresh token genera un de nou i invalida l'anterior
- **Detecció de reutilització**: si un token ja marcat com `used` es presenta, tota la família es revoca
- **Rate limiting**: `@nestjs/throttler` als endpoints auth (10 req/60s per IP)
- **Cookie segura**: `httpOnly`, `sameSite: lax`, `secure` en producció, `path: /api/auth`
  - `lax` (no `strict`) permet que el browser enviï la cookie en navegacions top-level des d'enllaços externs (WhatsApp → PWA)
- **Access token en memòria**: mai `localStorage`, es perd al tancar pestanya (per disseny)
- **Silent refresh**: al bootstrap, `AuthService` crida `/auth/refresh` automàticament. Un signal `isReady` i `whenReady()` Promise coordinen els guards perquè no redirigixin a `/login` abans que el refresh acabi.
- **Refresh dedup**: crides concurrents a `refresh()` comparteixen un únic HTTP request via `share()`, evitant detecció de reutilització al backend.

---

*Veïns: [[SSE_AUTH]] · [[DATA_MODEL]] · [[DEBT]] · [[MAP]]*
