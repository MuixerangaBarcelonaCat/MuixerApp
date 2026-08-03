---
tags: [qa]
---

# Compliment LOPDGDD i RGPD — Informe tècnic i pla d'implementació

> **Estat:** implementat (Fases A–D: model de dades, backend, Dashboard, PWA). Verificat amb
> tests i end-to-end al navegador. Branca: `feature/gdpr-lopdgdd-compliance`.
>
> Aquest document és l'**informe tècnic** de tot el que calia implementar per complir la
> LOPDGDD (Llei Orgànica 3/2018) i el RGPD (Reglament UE 2016/679). Descriu les decisions
> d'arquitectura, els canvis al model de dades, el pla d'implementació per fases i les
> obligacions organitzatives de la colla.
>
> ⚠️ **No és assessorament jurídic.** Els textos legals (Política de Privacitat, RAT) són
> plantilles de partida amb placeholders (`[COLLA]`, `[NIF]`, `[CONTACTE]`) que ha de revisar
> una persona amb criteri legal i completar des de `/config/legal` abans de producció.
>
> **Pendent (fora d'aquest sprint):** L1/L2 (RAT i redacció legal definitiva, §9) i el dret a
> l'oblit ajornat a [[DEBT]] SEC5 (§7, §11).

**Data:** 3 d'agost de 2026 · **Implementat:** 3 d'agost de 2026

---

## 1. Abast

### En aquest sprint

| # | Acció | Tipus | Estat |
|---|-------|-------|-------|
| C1 | **Consentiment explícit (click-wrap)** — modal obligatori al primer inici de sessió (Dashboard i PWA) que exigeix acceptar la Política de Privacitat per continuar | Tècnica | ✅ Fet |
| C2 | **Transparència en el registre** — clàusula informativa breu al formulari d'alta de membres (responsable de les dades = la colla, finalitat) | Tècnica | ✅ Fet |
| C3 | **Registre d'activitat de seguretat** — `log` intern d'accessos a dades sensibles i canvis de consentiment, per a auditories | Tècnica | ✅ Fet |
| C4 | **Textos legals editables a BBDD** — Política de Privacitat i clàusula de transparència guardades a BBDD i versionades, editables des de `/config` sense desplegar | Tècnica | ✅ Fet |
| L1 | **Registre d'Activitats de Tractament (RAT)** — document intern (§9.1) | Organitzativa | ⚪ Pendent — plantilla al §9.1, cal revisió humana |
| L2 | **Text de Política de Privacitat** — redacció adaptada a associació sense ànim de lucre (§9.2) | Organitzativa | ⚪ Pendent — plantilla sembrada a BBDD (v1), cal completar placeholders i revisió legal |

### Ajornat → deute tècnic ([[DEBT]] SEC5)

| # | Acció | Motiu de l'ajornament |
|---|-------|-----------------------|
| D1 | **Garantia del Dret a l'Oblit** — anonimització a BBDD (nom, cognoms, email, telèfon) conservant històric de pinyes i assistència de forma anònima | Decisió del sprint: ajornat |
| D2 | **Control de re-importació al `SyncModule`** — filtre perquè el legacy no torne a carregar les dades d'un membre anonimitzat | **Acoblat a D1**: sense anonimització no hi ha res a filtrar (vegeu §7) |

---

## 2. Decisions d'arquitectura (avaluació demanada)

### 2.1 On es guarda el consentiment: `User` o `Person`?

**Decisió: a `User`.**

El model separa dos conceptes que sovint es confonen:

- **`users`** (`user.entity.ts`) — el **compte**: `email`, `passwordHash`, `role`, tokens d'invitació/reset. És qui fa login i, per tant, qui pot fer el gest de click-wrap.
- **`persons`** (`person.entity.ts`) — la **persona física** (subjecte de dades): `name`, `firstSurname`, `secondSurname`, `phone`, `birthDate`, `gender`… **No té `email`** (l'email viu a `users`). Relació `User 1—0..1 Person` via `users.person_id`.

Raons per posar el consentiment a `User` i no a `Person`:

1. **El click-wrap només el pot fer un compte.** Acceptar la política és un acte d'un usuari autenticat; el gate del frontend es dispara des de `/auth/me` (que retorna `UserProfile`, derivat de `User`).
2. **La majoria de `persons` no tenen compte.** Xicalla i membres sincronitzats del legacy existeixen com a `Person` sense cap `User`. Si el consentiment visquera a `Person`, quedaria N/A a la major part de les files i no es podria capturar en el moment del login.
3. **Els delegats encaixen de forma natural** (vegeu §2.2).

**Camps nous a `User`:**

| Camp | Tipus | Nul·lable | Propòsit |
|------|-------|-----------|----------|
| `privacyPolicyAcceptedAt` | `timestamptz` | sí | Quan va acceptar (null = no ha acceptat mai) |
| `privacyPolicyVersion` | `int` | sí | Quina versió va acceptar. Permet re-consentiment quan es publica una versió nova |

> Es guarda la **versió** acceptada (còpia, no FK) perquè el registre de consentiment ha de
> sobreviure encara que s'edite o s'esborre el document. El gate compara
> `user.privacyPolicyVersion` amb la versió activa de la Política de Privacitat.

### 2.2 Què passa amb les persones delegades

La delegació té dues peces al model actual:

- **`person_delegates`** (`person-delegate.entity.ts`) — enllaç `User → Person` amb `delegateType` (`PARENT | PARTNER | GUARDIAN`), únic per `[user, person]`.
- **`persons.managedBy: User`** i **`persons.mentor: Person`** — camps a la mateixa `Person`.

Cas típic: un **pare/mare (User)** gestiona l'assistència d'una **xicalla (Person sense compte)**.

**Implicació per al consentiment:** el gate de click-wrap dispara per a **qualsevol `User`** autenticat (MEMBER/TECHNICAL/ADMIN). El delegat és un `User` → accepta **una sola vegada per al seu compte**. Les persones que gestiona no fan login i, per tant, no tenen acceptació pròpia: legalment, **el tutor/guardià consent en nom del menor**, i aquesta relació ja queda modelada a `person_delegates` amb `delegateType = PARENT | GUARDIAN`.

**Conseqüència pràctica:** no cal cap gate especial per als delegats. Sí que cal que la
**clàusula de transparència (C2)** i la **Política de Privacitat (C4)** deixen explícit que:
(a) els tutors accepten en nom dels menors, i (b) la base jurídica del tractament de dades de
menors és la relació de tutela declarada. Això es documenta al **RAT (§9.1)**.

### 2.3 Camps editables a BBDD (textos legals)

**No existeix cap taula de configuració** app-wide al codi actual (verificat: cap entitat
`Config`/`Setting`/`Colla`; el directori `apps/api/src/config` només valida variables d'entorn;
`/config` al dashboard és només una agrupació d'UI sobre CRUD existents).

Per tant, cal una **entitat nova**. Com que el consentiment ha de referenciar una **versió**
del document (per re-disparar el modal quan canvie la política), la millor opció és una taula de
**documents legals versionats**, no un simple key-value:

**Nova entitat `LegalDocument` (`legal_documents`):**

| Camp | Tipus | Notes |
|------|-------|-------|
| `id` | uuid PK | |
| `type` | enum `LegalDocumentType` | `PRIVACY_POLICY \| TRANSPARENCY_CLAUSE` (extensible) |
| `version` | `int` | s'incrementa per `type` en cada publicació |
| `content` | `text` | text en català (markdown) |
| `isActive` | `boolean` | la versió publicada actualment de cada `type` (només una activa per type) |
| `publishedAt` | `timestamptz` | |
| `createdAt` / `updatedAt` | `timestamptz` | convenció del projecte |

Això cobreix el requisit ("guardar certs camps a BBDD per canviar-los fàcilment"):
la Política de Privacitat i la clàusula de transparència s'editen des de `/config/legal`
sense desplegar, i el versionat fa que publicar una versió nova torne a demanar consentiment.

---

## 3. Canvis al model de dades

Resum (detall a implementar; afegir a [[DATA_MODEL]] «Pendent de modelar» fins que existisquen):

**Entitats noves**

1. **`LegalDocument`** (`legal_documents`) — textos legals versionats (§2.3).
2. **`AuditLog`** (`audit_logs`) — registre d'activitat de seguretat, append-only (§6).

**Entitat modificada**

3. **`User`** — afegir `privacyPolicyAcceptedAt`, `privacyPolicyVersion` (§2.1).

**Enums nous a `@muixer/shared`**

- `LegalDocumentType` = `PRIVACY_POLICY | TRANSPARENCY_CLAUSE`
- `AuditAction` = `CONSENT_ACCEPTED | CONSENT_REVOKED | SENSITIVE_DATA_ACCESS | SENSITIVE_DATA_EXPORT` (+ `PERSON_ANONYMIZED` reservat per a D1)

**Ajornat (D1, no ara)**

- `Person` — afegir `anonymizedAt: timestamptz | null` (marca d'anonimització) → habilita el filtre de sync D2.

Totes les taules segueixen les convencions del projecte: PK uuid, `createdAt`/`updatedAt`
`timestamptz`, migracions amb `synchronize: false` (auto-run en dev).

---

## 4. C1 — Consentiment explícit (click-wrap)

### Backend

- **Estendre `UserProfile`** (`libs/shared/src/interfaces/auth.interfaces.ts`) amb
  `privacyPolicyAcceptedAt: string | null` i un booleà computat
  `requiresPrivacyConsent: boolean` (true si `privacyPolicyVersion` < versió activa de
  `PRIVACY_POLICY`, o null). `AuthService.toUserProfile()` (`auth.service.ts:75`) el calcula.
- **Endpoint `POST /consent/privacy-policy`** (autenticat, qualsevol rol; **fora de `/auth/`**
  perquè l'interceptor del dashboard treu el Bearer a les rutes `/auth/`): posa
  `privacyPolicyAcceptedAt = now()` i `privacyPolicyVersion = versió activa`, i escriu un
  `AuditLog` `CONSENT_ACCEPTED`. Idempotent.
- **Endpoint `GET /legal/:type/active`** (autenticat, p. ex. `GET /legal/PRIVACY_POLICY/active` —
  el paràmetre és el valor de l'enum `LegalDocumentType`, no un slug): retorna el contingut de la
  versió activa per mostrar-lo al modal.

### Frontend (Dashboard i PWA)

Patró recomanat: **overlay modal bloquejant** al shell, com el splash-screen
(`app.component.ts` `showSplash = !auth.isReady()`), no un `guard` amb redirecció (evita bucles
de redirecció i és més fàcil de provar).

- **Dashboard** — el shell és el component arrel `App` (`app.ts` + `app.html`). Afegir un
  `<app-privacy-consent-modal>` a `app.html` gated per un signal `auth.requiresPrivacyConsent()`,
  al costat del patró de toast. Mentre el signal siga true, el modal tapa tota la UI i només
  permet llegir la política i acceptar.
- **PWA** — el shell és `AppShellComponent` (`core/layout/app-shell/`). Ja té el patró exacte:
  ```html
  @if (!auth.hasLinkedPerson()) { <app-no-person-banner /> }
  <router-outlet />
  ```
  Afegir, en paral·lel, un modal bloquejant gated per `auth.requiresPrivacyConsent()`. És el
  mateix mecanisme que el `no-person-banner`, però bloquejant en comptes de descartable.

En acceptar → cridar `POST /consent/privacy-policy` → refrescar el signal `currentUser` →
el modal desapareix.

---

## 5. C2 — Transparència en el registre

- **Formulari d'alta i edició de membres** al Dashboard (`features/persons/components/person-detail`,
  bloc d'edició de "Informació personal"): mostrar una clàusula informativa breu (responsable = la
  colla, finalitat = gestió de pinyes i assistència, drets de la persona, contacte). És l'única
  superfície on es captura/edita PII de `persons` — la PWA no en té (el seu `profile` és un
  placeholder sense formulari), per això la clàusula només calia al Dashboard.
- El text **prové de `LegalDocument` type `TRANSPARENCY_CLAUSE`** (editable, §2.3) via
  `GET /legal/TRANSPARENCY_CLAUSE/active`. Així no és text hardcodejat.
- És **informatiu** (no un segon click-wrap): es mostra en el moment de recollir les dades,
  complint el principi de transparència (art. 13 RGPD).

---

## 6. C3 — Registre d'activitat de seguretat (audit log)

**Nova entitat `AuditLog` (`audit_logs`), append-only:**

| Camp | Tipus | Notes |
|------|-------|-------|
| `id` | uuid PK | |
| `actorUserId` | uuid, nul·lable | qui fa l'acció (null = sistema) |
| `action` | enum `AuditAction` | vegeu §3 |
| `targetType` | varchar, nul·lable | p. ex. `Person`, `User` |
| `targetId` | uuid, nul·lable | id de l'objecte afectat |
| `metadata` | jsonb, nul·lable | context addicional (camps consultats, versió, etc.) |
| `ipAddress` | varchar, nul·lable | |
| `createdAt` | `timestamptz` | (sense `updatedAt`: és immutable) |

**Com registrar:**

- **Canvis de consentiment** — sempre, des de `POST /consent/privacy-policy` (`CONSENT_ACCEPTED`).
  `CONSENT_REVOKED` i `PERSON_ANONYMIZED` queden **reservats** a l'enum `AuditAction` per quan
  existisquen fluxos de revocació/anonimització (D1, ajornat).
- **Accés a dades sensibles** — `AuditService.record()` cridat explícitament a `GET /persons/:id`
  (`SENSITIVE_DATA_ACCESS`). No hi ha encara cap endpoint d'exportació de PII, així que
  `SENSITIVE_DATA_EXPORT` queda definit a l'enum però sense cap punt de crida — s'afegirà quan
  s'implemente un export.
- **Retenció** — **pendent**: definir un període (p. ex. 1–2 anys) i un cron de neteja, com el
  que ja neteja `refresh_tokens`. No implementat en aquest sprint.

El log **no** ha de contenir les dades sensibles en si (només *que* s'hi va accedir, qui i quan).

---

## 7. D2 — Control de re-importació (per què s'ajorna amb D1)

El filtre de re-importació al `SyncModule` només té sentit **si existeix l'anonimització (D1)**:
el seu únic propòsit és evitar que el legacy torne a carregar les dades d'un membre ja anonimitzat.
Sense D1 no hi ha cap membre anonimitzat i el filtre no filtra res. Per això **D2 s'ajorna junt
amb D1**.

**Nota tècnica important per quan s'implemente** (`person-sync.strategy.ts:380`,
`upsertPerson`): avui, quan un `legacyId` coincideix amb una `Person` **inactiva**
(`isActive === false`), el codi la re-crea com a fila **nova i activa** (comportament deliberat,
BUG-9). Per tant, l'anonimització **no** es pot modelar només com a `isActive = false`: caldrà una
marca dedicada `anonymizedAt` i un `return` primerenc a `upsertPerson` que **salte** el `legacyId`
anonimitzat **abans** de la branca `!isActive → createPerson`. Altrament, la propera sync
ressuscitaria les dades anonimitzades.

---

## 8. Pla d'implementació — executat

Implementat amb TDD (`.agents/skills/test-driven-development/`) seguint els patrons de
`nestjs-best-practices`. Desviacions respecte al pla original marcades amb ⚠️.

**Fase A — Model de dades i migracions** ✅
1. Enums a `@muixer/shared`: `LegalDocumentType`, `AuditAction`.
2. Entitats `LegalDocument` i `AuditLog` + migracions + registre a `entities.ts`.
3. Columnes `privacyPolicyAcceptedAt` / `privacyPolicyVersion` a `User` + migració.
4. Migració de seed amb la v1 de `PRIVACY_POLICY` i `TRANSPARENCY_CLAUSE` (textos placeholder,
   §9.2) — verificada aplicant-la contra Postgres real.

**Fase B — Backend: mòduls `legal`, `audit` i consentiment** ✅
5. Mòdul `legal`: `GET /legal/documents` (llista), `GET /legal/:type/active` (autenticat, sense
   `@Roles`), `POST /legal/documents` (publica versió nova, ADMIN/TECHNICAL).
6. Mòdul `audit`: `AuditService.record()` — append-only, mai llança (atrapa i logueja errors
   perquè un fallo d'auditoria no trenque l'operació principal).
7. `AuthService.toUserProfile()` estès amb `privacyPolicyAcceptedAt` + `requiresPrivacyConsent`;
   nou `AuthService.acceptPrivacyPolicy()`.
8. ⚠️ **Endpoint final: `POST /consent/privacy-policy`**, NO `/auth/accept-privacy-policy` com
   deia el pla inicial. Motiu descobert en verificar-ho al navegador: l'interceptor HTTP del
   Dashboard treu deliberadament el Bearer de totes les rutes `/auth/*` (per evitar bucles de
   refresh), així que un endpoint de consentiment sota `/auth/` arribava sempre com a 401. Nou
   `ConsentController` fora del prefix `/auth/`.
9. `GET /persons/:id` registra `SENSITIVE_DATA_ACCESS`.

**Fase C — Dashboard** ✅
10. `PrivacyConsentModalComponent` (bloquejant: sense backdrop-close, sense Cancel·la) muntat a
    `app.html` al costat de `<app-toast />`.
11. `LegalDocumentService` (`core/services/`) + pantalla **`/config/legal`**
    (`LegalDocumentsComponent`) — ⚠️ ruta `legal`, no `/config/privacy` com deia el pla inicial.
12. Clàusula de transparència al formulari d'edició de persona (`person-detail`).

**Fase D — PWA** ✅
13. `ConsentModalComponent` — el primer modal de la PWA — muntat a `AppShellComponent` al costat
    del `no-person-banner`. Mateix endpoint `/consent/privacy-policy`.
14. ⚠️ No calia clàusula de transparència a la PWA: no hi ha cap formulari on es capturen dades
    de `persons` (el `profile` és un placeholder sense camps). El requisit de C2 ja queda cobert
    del tot pel Dashboard (§5).

**Fase E — Documentació** ✅
15. `node scripts/generate-data-model.mjs` i `generate-doc-map.mjs` (equivalents a `pnpm run
    docs:model`/`docs:map`, executats directament perquè aquest entorn té Node 24 i el
    `package.json` fixa `engines.node ^22`). Afegides entrades `legal`/`audit` → `[[GDPR_COMPLIANCE]]`
    a `DOC_HINTS` de `scripts/generate-doc-map.mjs`. [[DATA_MODEL]] i [[MAP]] actualitzats;
    aquest document i [[ROADMAP]] marcats com a fets.

**Pendent real (no bloquejant, per a un sprint futor):**
- Cron de retenció de `audit_logs` (§6).
- `SENSITIVE_DATA_EXPORT` sense cap punt de crida (no hi ha encara cap endpoint d'exportació de PII).
- L1 (RAT) i completar els placeholders de L2 amb dades reals + revisió legal (§9).

---

## 9. Obligacions organitzatives (plantilles de partida)

> ⚠️ Plantilles per revisar amb criteri legal. Adaptar dades reals de la colla.

### 9.1 Registre d'Activitats de Tractament (RAT)

Document intern (art. 30 RGPD). Estructura mínima proposada:

| Apartat | Contingut a emplenar |
|---------|----------------------|
| Responsable del tractament | Nom, NIF i contacte de la colla (associació sense ànim de lucre) |
| Finalitat | Gestió de la massa social: membres, assistència a assajos/actuacions, disseny i planificació de figures (pinyes) |
| Base jurídica | Execució de la relació associativa (interès legítim/contracte associatiu); per a menors, consentiment del tutor legal (relació modelada a `person_delegates`) |
| Categories d'interessats | Membres majors d'edat, membres menors d'edat (xicalla) i els seus tutors |
| Categories de dades | Identificatives (nom, cognoms, àlies), de contacte (email, telèfon), data de naixement, gènere, alçada d'espatlla, notes internes |
| Destinataris | **Cap.** Ús estrictament intern de la colla; no es cedeixen ni es comercialitzen |
| Transferències internacionals | Cap (dades allotjades a la UE — verificar ubicació del VPS) |
| Terminis de conservació | Mentre es mantinga la relació associativa + termini legal aplicable; després, anonimització (D1) |
| Mesures de seguretat | Accés per rols (ADMIN/TECHNICAL/MEMBER), JWT + refresh rotatiu, registre d'activitat (C3), xifratge en repòs pendent ([[DEBT]] SEC3) |

### 9.2 Política de Privacitat (esquelet)

Text que es carregarà com a `LegalDocument` `PRIVACY_POLICY` v1. Seccions mínimes:

1. **Qui és el responsable** — la colla (nom, NIF, contacte).
2. **Quines dades recollim i per què** — identificatives i de contacte, per gestionar la massa
   social, l'assistència i la planificació de pinyes.
3. **Base jurídica** — relació associativa; per a menors, consentiment del tutor.
4. **Ús estrictament intern** — declaració expressa que **no es cedeixen a tercers ni es fan
   servir amb finalitats comercials**.
5. **Conservació** — mentre dure la relació associativa; després anonimització.
6. **Drets** — accés, rectificació, supressió (dret a l'oblit), oposició, portabilitat, i com
   exercir-los (contacte de la colla).
7. **Seguretat** — mesures tècniques i organitzatives.
8. **Menors** — tractament de dades de xicalla amb consentiment del tutor.
9. **Canvis a la política** — el versionat torna a demanar consentiment.

---

## 10. Decisions obertes per revisar

| # | Decisió | Recomanació |
|---|---------|-------------|
| O1 | Gate de consentiment: modal bloquejant vs. `guard` amb redirecció | **Modal bloquejant** (evita bucles, més fàcil de provar) |
| O2 | Audit d'accés a PII: crides explícites vs. interceptor global | **Crides explícites** als endpoints sensibles per començar |
| O3 | Confirmar que D2 (filtre de sync) s'ajorna amb D1, o si es vol el bastidor inert ja ara | **Ajornar junts** (§7); D2 no fa res sense D1 |
| O4 | Ubicació del VPS/dades (per al RAT: transferències internacionals) | Verificar que és a la UE ([[DEPLOY_PRE]]) |
| O5 | Període de retenció de l'audit log | Proposta: 1–2 anys + cron de neteja |

---

## 11. Ajornat: Dret a l'oblit (D1 + D2)

Registrat com a deute tècnic a [[DEBT]] **SEC5**. Resum del que caldrà:

- Marca `anonymizedAt` a `Person` (no reutilitzar `isActive`, §7).
- Procés transaccional d'anonimització: buidar `name`, `firstSurname`, `secondSurname`, `phone`,
  `alias` (i l'`email` del `User` enllaçat), conservant `node_assignments` i `attendances` de
  forma anònima (les FK a `Person` són `onDelete: RESTRICT`, així que la fila `Person` es
  conserva anonimitzada, no s'esborra).
- Filtre a `person-sync.strategy.ts` (§7) perquè el legacy no ressuscite la persona.
- Event `PERSON_ANONYMIZED` a l'audit log.

---

*Veïns: [[DATA_MODEL]] · [[AUTH_FLOW]] · [[SYNC_ARCHITECTURE]] · [[DEBT]] · [[MAP]]*
