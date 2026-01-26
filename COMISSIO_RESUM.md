# APPsistència 2.0 - Resum per a la Comissió

**Projecte:** Sistema de Gestió d'Assistència per Muixerangues
**Client:** Muixeranga de Barcelona
**Equip:** Comissió Tecnològica de la Muixeranga de Barcelona
**Llicència:** OpenSource
**Data:** Gener 2026

---

## 🎯 Per què fem això?

**L'aplicació actual NO és nostra.** No som propietaris del codi i no podem evolucionar-la al nostre parer.

**Objectiu:** Crear una aplicació OpenSource 100% nostra amb control total sobre l'evolució i les funcionalitats.

### Beneficis principals:

- ✅ Control total del codi i evolució
- ✅ Fixem bugs sense dependre de tercers
- ✅ Desenvolupem funcionalitats que realment necessitem
- ✅ Altres colles poden usar-la i contribuir
- ✅ Cost €0 (OpenSource)
- ✅ Sostenibilitat garantida (no depèn d'una empresa)

---

## 🔒 Transparència i Dades Personals

**⚠️ ÉS MOLT IMPORTANT:** Les dades personals dels membres de la colla són propietat de la colla i cal el seu permís explícit per utilitzar-les.

### Què hem de fer abans de començar:

1. **Demandar permís a la colla** per:
   - Exportar les dades de l'aplicació actual (Appsistència)
   - Utilitzar aquestes dades per crear la nova aplicació
   - Migrar les dades personals dels membres a la nova base de dades

2. **Ser transparents** sobre:
   - Quines dades es migraran (noms, alçades, etiquetes, assistències, etc.)
   - On s'emmagatzemaran les dades
   - Qui tindrà accés a les dades
   - Com es protegiran les dades personals

3. **Obtenir consentiment explícit** abans de:
   - Exportar cap dada de l'aplicació actual
   - Crear la nova base de dades amb dades reals
   - Començar la migració de dades

**Principi:** La transparència i el respecte per la privacitat de les dades personals és fonamental. No procedirem sense el permís explícit de la colla.

---

## ⚠️ IMPORTANT: Decisions Tecnològiques Pendents

**Totes les decisions d'arquitectura i stack tecnològic són PENDENTS de decisió de l'equip.**

El document conté **propostes i recomanacions** basades en anàlisi tècnica, però **cap decisió està presa**. L'equip haurà de:

- Decidir el stack tecnològic complet (frontend, backend, base de dades, etc.)
- Valorar les diferents opcions proposades
- Escollir les tecnologies que millor s'adaptin a l'equip i al projecte

**Les tecnologies mencionades en aquest document són només recomanacions per facilitar la discussió i la decisió.**

---

## 🏗️ Què construirem?

El sistema es divideix en **4 components**:

### 1. Backend (API)

- Autenticació i autorització
- API REST per tots els serveis
- Gestió de base de dades

### 2. App de Gestió (Dashboard Web)

- Per administradors, tècnica i junta
- Gestió completa: usuaris, esdeveniments, persones, figures
- **Vista de projecció** per mostrar figures durant assajos/actuacions

### 3. App Mòbil (PWA)

- Per membres de la colla
- Confirmar assistència
- Check-in amb QR/GPS/Presencial
- **Veure figures i posicions assignades** (mateixa vista que projecció)
- Feed de notícies
- Funciona offline

### 4. Mòdul Figures (Independent)

- Editor visual per crear/editar figures
- Crear plantilles exportables
- Validacions d'estructura

---

## 📺 Vista de Projecció de Figures

**Funcionalitat clau:** Visualització de figures idèntica en:

- 🖥️ **Dashboard (Pantalla Gran):** Projecció durant assajos/actuacions
- 📱 **App Mòbil (PWA):** Consulta individual per cada membre

**Cas d'ús típic:**

1. Tècnica prepara figura "Micalet" per treballar avui
2. Assigna membres a cada posició (des de Dashboard)
3. Obre "Vista Projecció" en mode fullscreen
4. Projecta en pantalla gran (TV/projector)
5. Membres veuen on han d'anar:
   - A la pantalla gran (tots)
   - Al seu mòbil (individual)
6. Mostra en temps real qui ha fet check-in

---

## 🔧 Propostes Tècniques (PENDENTS DE DECISIÓ)

**⚠️ Aquestes són PROPOSTES i RECOMANACIONS, no decisions preses. L'equip ha de decidir.**

### Frontend Framework (A DECIDIR)

**Opció A: React + Vite** (recomanada per defecte)

- Més popular, més flexible, més recursos
- Ecosistema enorme
- Learning curve mitjana

**Opció B: Angular 17+** (si equip té experiència)

- Tot inclòs, sintaxi similar NestJS
- Millor tipat TypeScript
- Framework més estructurat

**Opció C: Altres** (a valorar)

- Next.js, Vue, etc.

→ **Acció:** Decidir a la reunió kickoff

### App Mòbil (A DECIDIR)

**Opció A: PWA (Progressive Web App)** ⭐⭐⭐ (recomanada)

- Cost: €0
- Updates instantanis
- 1 codebase (web)
- Funciona com app nativa (icona a home screen, offline, notificacions)
- Suficient per les nostres necessitats

**Opció B: Ionic + Capacitor** (a valorar)

- APIs natives avançades
- Porta oberta a stores en futur
- Cost: €0 (web) o €99/any (si stores)

**Opció C: React Native / Flutter** (a valorar)

- Apps natives
- Cost: €99/any
- Més temps desenvolupament

→ **Acció:** Decidir a la reunió kickoff

### Backend (A DECIDIR)

**Proposta: NestJS (TypeScript)**

- Framework robust i escalable
- Sintaxi similar a Angular (si triem Angular frontend)
- Ecosistema madur

**Alternatives a valorar:**

- Express.js
- Fastify
- Altres frameworks Node.js

→ **Acció:** Decidir a la reunió kickoff

### Base de Dades (A DECIDIR)

**Proposta: PostgreSQL** (recomanada)

- Relacional, robusta, ACID
- JSONB per flexibilitat (plantilles de figures)
- Molt bona integració amb NestJS

**Alternatives a valorar:**

- PostgreSQL + JSONB
- MongoDB + PostgreSQL (híbrida)
- Altres bases de dades

**Cache (a valorar):**

- Redis (per sessions i cache)

→ **Acció:** Decidir a la reunió kickoff

---

## 💰 Costos

| Concepte                        | PWA         | Apps Natives                     |
| ------------------------------- | ----------- | -------------------------------- |
| **Llicències anuals**    | €0         | €99/any (Apple) + €25 (Google) |
| **Temps desenvolupament** | 100%        | 200-250%                         |
| **Updates**               | Instantanis | 1-7 dies approval                |
| **Manteniment**           | 1 codebase  | 2-3 codebases                    |

**Estalvi PWA vs Nativa: ~€100-200/any + 60% temps desenvolupament**

---

## 🔔 Funcionalitats Principals

### Flux d'Assistència

1. Tècnica crea esdeveniment (assaig/actuació)
2. Membres reben notificació push
3. Membres indiquen "Puc anar" o "No vaig" des de l'app
4. El dia de l'esdeveniment: Check-in amb QR/Presencial
5. Vista de figures mostra en temps real qui ha arribat
6. Resum post-esdeveniment amb estadístiques

### Notificacions

- Nous esdeveniments
- Recordatoris (48h, 2h abans)
- Notícies
- Assignació a figures (opcional)

### Vista de Figures

- Visualització de figures amb posicions assignades
- Mostra qui ha fet check-in (en verd/negreta)
- Funciona offline (cache última figura vista)
- Mode projecció (pantalla gran) i mode mòbil (individual)

---

## 🚀 Pla de Desenvolupament (Preliminar)

**⚠️ Aquest pla és preliminar i dependrà de les decisions tecnològiques que prengui l'equip.**

### Fase 1: Setup i Backend Core (Sprint 1-2)

- Setup repos i CI/CD
- Backend base + Autenticació (stack a decidir)
- Base de dades + ORM (stack a decidir)

### Fase 2: CRUD Bàsic (Sprint 3-4)

- Gestió Usuaris/Membres
- CRUD Esdeveniments
- Sistema Assistència bàsic
- Dashboard web (stack frontend a decidir)

### Fase 3: App Mòbil (Sprint 5-6)

- Setup app mòbil (PWA/Ionic/altre - a decidir)
- Confirmar assistència
- Check-in (QR/Presencial)
- Offline mode
- Notificacions push

### Fase 4: Mòdul Figures (Paral·lel)

- Editor Canvas (llibreria a decidir)
- Crear plantilles
- Component `<FiguraViewer />` reutilitzable
- Vista de projecció

### Fase 5: Features Avançades (Sprint 7-8)

- Reports i analytics
- Notícies
- Preferències notificacions
- Refinaments UX

---

## ❓ Decisions Tecnològiques a Prendre (OBLIGATORI)

**⚠️ AQUESTES DECISIONS SÓN OBLIGATÒRIES ABANS DE COMENÇAR EL DESENVOLUPAMENT**

### 1. Frontend Framework (OBLIGATORI)

- [ ] React + Vite (recomanada per ecosistema i flexibilitat)
- [ ] Angular 17+ (si l'equip té experiència Angular)
- [ ] Altres (especificar): _______________

### 2. App Mòbil (OBLIGATORI)

- [ ] **PWA Pura** (RECOMANADA ⭐⭐⭐)
- [ ] Ionic + Capacitor (a valorar)
- [ ] React Native / Flutter (a valorar)
- [ ] Altres (especificar): _______________

### 3. Backend Framework (OBLIGATORI)

- [ ] NestJS (TypeScript) - recomanada
- [ ] Express.js
- [ ] Fastify
- [ ] Altres (especificar): _______________

### 4. Base de Dades (OBLIGATORI)

- [ ] PostgreSQL (recomanada)
- [ ] PostgreSQL + JSONB
- [ ] MongoDB + PostgreSQL (híbrida)
- [ ] Altres (especificar): _______________

### 5. Cache/Sessions (A VALORAR)

- [ ] Redis
- [ ] No cal cache inicial
- [ ] Altres (especificar): _______________

### 6. Monorepo vs Multi-repo (OBLIGATORI)

- [ ] Monorepo (compartir codi fàcilment)
- [ ] Multi-repo (més independència)

### 7. Canvas Library per Figures (OBLIGATORI)

- [ ] Konva.js (recomanada)
- [ ] Fabric.js
- [ ] Altres (especificar): _______________

---

## 📝 Pròxims Passos

### 0. Permís per Dades Personals (PRIORITARI)

**⚠️ ABANS DE COMENÇAR QUALSEVOL DESENVOLUPAMENT:**

1. **Demandar permís a la colla** per exportar i utilitzar les dades de l'aplicació actual
2. **Explicar transparentment** quines dades es migraran i com es protegiran
3. **Obtenir consentiment explícit** abans de procedir

**Nota:** Podem desenvolupar amb dades de prova (mock data) mentre esperem el permís.

### 1. Reunió Kickoff: Decidir stack (1-2h)

- Votar: React vs Angular
- Confirmar: PWA
- Decidir: Monorepo vs Multi-repo

### 2. Setup Repos: Crear estructura (1 dia)

### 3. Tasques Inicials Paral·leles:

- Backend: Auth + Users + DB Schema (amb dades mock)
- Frontend: Login + layout base
- Figures: Research + POC canvas
- Mobile: Setup PWA

---

## 🔐 OpenSource

**Per què OpenSource?**

- Propietat i control total del codi
- Transparència amb la colla
- Sostenibilitat (no depèn d'una empresa)
- Altres colles poden usar-la i contribuir

**Llicència:** MIT (més permissiva) o GPL-3.0 (copyleft) - a decidir

---

## 📞 Contacte

**Colla:** Muixeranga de Barcelona
**GitHub:** (enllaç quan estigui públic)
**Equip:** Comissió Tecnològica (equip transversal i autogestionat)

---

**Bona feina equip! 💪 Fem aquesta app molt bona i útil per la colla.**
