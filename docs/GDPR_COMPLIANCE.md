---
tags: [qa]
---

# Compliment LOPDGDD i RGPD — Informe tècnic i pla d'implementació

> **Estat:** proposta per revisar. Res d'això està implementat encara.
> Branca: `feature/gdpr-lopdgdd-compliance`.
>
> Aquest document és l'**informe tècnic** de tot el que cal implementar per complir la
> LOPDGDD (Llei Orgànica 3/2018) i el RGPD (Reglament UE 2016/679). Descriu les decisions
> d'arquitectura, els canvis al model de dades, un pla d'implementació per fases i les
> obligacions organitzatives de la colla.
>
> ⚠️ **No és assessorament jurídic.** Els textos legals (Política de Privacitat, RAT) són
> plantilles de partida que ha de revisar una persona amb criteri legal abans de publicar-los.

**Data:** 3 d'agost de 2026

---

## 1. Abast

### En aquest sprint

| # | Acció | Tipus |
|---|-------|-------|
| C1 | **Consentiment explícit (click-wrap)** — modal obligatori al primer inici de sessió (Dashboard i PWA) que exigeix acceptar la Política de Privacitat per continuar | Tècnica |
| C2 | **Transparència en el registre** — clàusula informativa breu al formulari d'alta de membres (responsable de les dades = la colla, finalitat) | Tècnica |
| C3 | **Registre d'activitat de seguretat** — `log` intern d'accessos a dades sensibles i canvis de consentiment, per a auditories | Tècnica |
| C4 | **Textos legals editables a BBDD** — Política de Privacitat i clàusula de transparència guardades a BBDD i versionades, editables des de `/config` sense desplegar | Tècnica |
| L1 | **Registre d'Activitats de Tractament (RAT)** — document intern (§9.1) | Organitzativa |
| L2 | **Text de Política de Privacitat** — redacció adaptada a associació sense ànim de lucre (§9.2) | Organitzativa |

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
la Política de Privacitat i la clàusula de transparència s'editen des de `/config/privacy`
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
- **Endpoint `POST /auth/accept-privacy-policy`** (autenticat, qualsevol rol): posa
  `privacyPolicyAcceptedAt = now()` i `privacyPolicyVersion = versió activa`, i escriu un
  `AuditLog` `CONSENT_ACCEPTED`. Idempotent.
- **Endpoint `GET /legal/privacy-policy/active`** (autenticat): retorna el contingut de la
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

En acceptar → cridar `POST /auth/accept-privacy-policy` → refrescar el signal `currentUser` →
el modal desapareix.

---

## 5. C2 — Transparència en el registre

- **Formulari d'alta de membres** al Dashboard (`features/persons`, `user-form-modal` /
  formulari de persona) i **acceptació d'invitació** a la PWA: mostrar una clàusula informativa
  breu (responsable = la colla, finalitat = gestió de pinyes i assistència, drets de la persona,
  contacte).
- El text **prové de `LegalDocument` type `TRANSPARENCY_CLAUSE`** (editable, §2.3) via
  `GET /legal/transparency-clause/active`. Així no és text hardcodejat.
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

- **Canvis de consentiment** — sempre, des dels endpoints de C1 (`CONSENT_ACCEPTED` /
  `CONSENT_REVOKED`).
- **Accés a dades sensibles** — `AuditService.record()` cridat explícitament als punts on es
  llegeixen/exporten PII de `persons` (detall de persona, exports). Alternativa: un
  `NestInterceptor` limitat a rutes concretes de `person`. Recomanació: començar amb crides
  explícites als endpoints sensibles (més precís, menys soroll) i valorar l'interceptor si creix.
- **Retenció** — definir un període (p. ex. 1–2 anys) i un cron de neteja, com el que ja neteja
  `refresh_tokens`.

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

## 8. Pla d'implementació (ordre suggerit)

Amb TDD (`.agents/skills/test-driven-development/`) i `nestjs-best-practices`.

**Fase A — Model i textos legals (base de tot)**
1. Enums a `@muixer/shared`: `LegalDocumentType`, `AuditAction`.
2. Entitat `LegalDocument` + migració + registre a `entities.ts`.
3. Mòdul `legal` (NestJS): CRUD ADMIN/TECHNICAL + `GET /legal/:type/active`.
4. UI `/config/privacy`: nova ruta a `config.routes.ts` + nova targeta a `config.component.ts`
   (editor de text + versionat).
5. Migració de seed amb la v1 de `PRIVACY_POLICY` i `TRANSPARENCY_CLAUSE` (§9.2).

**Fase B — Consentiment (C1)**
6. Camps `privacyPolicyAcceptedAt` / `privacyPolicyVersion` a `User` + migració.
7. Estendre `UserProfile` amb `requiresPrivacyConsent`.
8. `POST /auth/accept-privacy-policy`.
9. Modal bloquejant al Dashboard i a la PWA.

**Fase C — Transparència (C2)**
10. Mostrar `TRANSPARENCY_CLAUSE` als formularis d'alta (Dashboard) i invitació (PWA).

**Fase D — Audit log (C3)**
11. Entitat `AuditLog` + migració + `AuditService`.
12. Registrar events de consentiment (des de C1).
13. Registrar accessos a PII als endpoints sensibles + cron de retenció.

**Fase E — Documentació**
14. `pnpm run docs:model` (per l'AUTO de [[DATA_MODEL]]) i `pnpm run docs:map` un cop existisquen
    els mòduls/entitats. Actualitzar aquest document (treure «proposta») i marcar la fase a
    [[ROADMAP]].

**Transversal**
- **Textos legals L1 (RAT) i L2 (Política)** — es poden redactar en paral·lel a la Fase A; la
  Política és el seed del pas 5.

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
