# APPsistència 2.0 - Document de Kickoff per l'Equip

**Projecte:** Sistema de Gestió d'Assistència per Muixerangues  
**Client:** Muixeranga de Barcelona  
**Equip:** Comissió Tecnològica de la Muixeranga de Barcelona
**Llicència:** OpenSource  
**Data:** Gener 2026

---

## 🎯 TL;DR - Decisions Clau

Aquest document és extens. Si tens pressa, aquestes són les decisions més importants:

### 🔑 Per què fem això?

**L'aplicació actual NO és nostra.** No som propietaris del codi i no podem evolucionar-la al nostre parer.

**Objectiu:** Crear una aplicació OpenSource 100% nostra amb control total sobre l'evolució i les funcionalitats.

---

### 1️⃣ Frontend Framework: React o Angular?
- **React** (Recomanat per defecte): Més popular, més flexible, més recursos
- **Angular** (Si equip té experiència): Tot inclòs, sintaxi similar NestJS, millor tipat

→ **Acció:** Votar a la reunió kickoff

### 2️⃣ App Mòbil: PWA, React Native, Ionic/Capacitor o Nativa?
- **PWA** (MOLT recomanat ⭐⭐⭐): €0 cost, updates instantanis, 1 codebase
- **Ionic + Capacitor** (A valorar ⭐⭐): €0 cost, accés a APIs natives, 1 codebase
  - Combina el millor de PWA amb capacitats natives
  - Accés a funcionalitats del dispositiu (càmera, notificacions locals, etc.)
  - Publicació opcional a stores si es necessita en el futur
  - Compatible amb React o Angular
  - Més pes que PWA pura però menys que React Native
- React Native: €99/any, 1-7 dies approval, 1.5x temps
- Nativa: €99/any, 1-7 dies approval, 2.5x temps

→ **Recomanació forta: PWA** (veure secció detallada més avall)

### 3️⃣ Backend: NestJS ✅ (recomanat) 
### 4️⃣ BBDD: PostgreSQL + Redis? (a valorar)
### 5️⃣ Vista Projecció Figures: Component compartit Dashboard + PWA
- Pantalla gran per assajos
- Mateixa vista al mòbil
- Responsive i reutilitzable

---

## 📖 Context del Projecte

### Situació Actual
Tenim una aplicació PHP monolítica que gestiona:
- Assistència a assajos i actuacions
- Persones i perfils amb etiquetes de posició
- Editor bàsic de figures (conjunts humans)
- Notificacions push

### ❌ Problemes Crítics de l'Aplicació Actual

1. **NO som propietaris del codi** 🔒
   - No podem evolucionar-la al nostre parer
   - Dependència d'un tercer per qualsevol canvi
   - Manca de control sobre el roadmap
   - Risc de discontinuïtat del servei

2. **Limitacions Tècniques**
   - Codi monolític difícil de mantenir
   - Poc flexible per adaptar-se a noves necessitats
   - Impossibilitat d'escalar o millorar sense el propietari

3. **Manca de Transparència**
   - Codi tancat, no sabem què passa internament
   - Dificultat per debugar problemes
   - No podem contribuir millores

### 🎯 Objectiu del Nou Projecte

Reescriure completament l'aplicació amb una arquitectura modular, moderna i mantenible que:

✅ **Sigui 100% nostra i OpenSource**
- Control total del codi i evolució
- Comunitat pot contribuir
- Transparent amb la colla
- Llibertat per adaptar-ho a les nostres necessitats

✅ **Tecnologies Modernes**
- Millori l'experiència d'usuari (especialment mòbil)
- Faciliti el manteniment i escalabilitat
- Stack actual i amb futur

✅ **Adaptabilitat**
- Dissenyada específicament per les nostres necessitats
- Flexible per créixer segons es requereix
- Codi net i ben documentat per futurs desenvolupadors/colles

---

## 🆚 Situació Actual vs Nova Aplicació

### Comparativa: Dependència vs Propietat

| Aspecte | Aplicació Actual (NO nostra) | Nova Aplicació (OpenSource) |
|---------|------------------------------|----------------------------|
| **Propietat Codi** | ❌ Propietari extern | ✅ 100% nostra |
| **Control Evolució** | ❌ Depèn del propietari | ✅ Control total |
| **Adaptació Necessitats** | ❌ Limitat/impossible | ✅ Total flexibilitat |
| **Fixes Bugs** | ❌ Esperar al propietari | ✅ Fix immediat |
| **Noves Features** | ❌ Depèn de roadmap extern | ✅ Decidim nosaltres |
| **Transparència** | ❌ Caixa negra | ✅ Codi obert |
| **Continuïtat** | ⚠️ Risc discontinuïtat | ✅ Sempre disponible |
| **Costos Llicència** | 💰 Possible pagament | ✅ €0 |
| **Comunitat** | ❌ No podem contribuir | ✅ Contribucions obertes |
| **Documentació** | ⚠️ La que ens donen | ✅ Nosaltres decidim |
| **Altres Colles** | ❌ No poden usar | ✅ Poden beneficiar-se |
| **Manteniment** | ❌ Depèn del propietari | ✅ Equip propi + comunitat |

### Beneficis Tangibles de Ser Propietaris

#### A Curt Termini (Mesos 1-6)
- ✅ Adaptem funcionalitats a les nostres necessitats exactes
- ✅ Fixem bugs crítics sense esperar a ningú
- ✅ Desenvolupem features que realment necessitem
- ✅ Millorem UX on detectem problemes

#### A Mitjà Termini (Mesos 6-12)
- ✅ Altres colles poden usar-la i contribuir millores
- ✅ Creix la comunitat i compartim costos de desenvolupament
- ✅ Aprenenem i millorem el projecte contínuament
- ✅ Reduïm dependències externes

#### A Llarg Termini (1+ anys)
- ✅ Sostenibilitat garantida (no depèn d'una empresa)
- ✅ Evolució natural segons necessitats reals
- ✅ Patrimoni digital de la colla
- ✅ Referència per altres organitzacions culturals

### Risc Mitigat

**Escenari Pitjor Cas amb App Actual:**
- Propietari decideix tancar el servei → ❌ Perdem tot
- Propietari puja preus → 💰 Hem de pagar o marxar
- Bug crític → ⏰ Esperem indefinidament
- Feature necessària → 🙏 Preguem que la desenvolupin

**Escenari Pitjor Cas amb App Nostra:**
- Desenvolupador marxa → ✅ Codi disponible, busquem altre
- Bug crític → ✅ Comunitat pot ajudar
- Falta feature → ✅ Desenvolupem o esperem contribució
- Canvi requisits → ✅ Adaptem el codi nosaltres

---

## 🏗️ Arquitectura del Sistema

### Divisió en Components Independents

El projecte es divideix en **4 components** que es desenvoluparan per separat:

```
┌─────────────────────────────────────────────────────────┐
│                    1. BACKEND (API)                      │
│                       NestJS                             │
│  - Autenticació i autorització                          │
│  - API REST per tots els serveis                        │
│  - Gestió BBDD i business logic                         │
└─────────────────────────────────────────────────────────┘
                            ▲
                            │ API REST
              ┌─────────────┼─────────────┐
              │             │             │
              ▼             ▼             ▼
┌─────────────────┐ ┌──────────────┐ ┌─────────────────┐
│  2. APP GESTIÓ  │ │ 3. APP MÒBIL │ │ 4. MÒDUL FIGURES│
│   (Dashboard)   │ │    (PWA)     │ │   (Standalone)  │
│                 │ │              │ │                 │
│ - Usuaris       │ │ - Confirmar  │ │ - Editor Canvas │
│ - Esdeveniments │ │   assistència│ │ - Plantilles    │
│ - Persones      │ │ - Check-in   │ │ - Validacions   │
│ - Notícies      │ │ - 📺 Veure   │ │ - Exportació    │
│ - Figures       │ │   figures    │ │                 │
│ - 📺 Projecció  │ │ - Notícies   │ │                 │
│ - Reports       │ │              │ │                 │
└─────────────────┘ └──────────────┘ └─────────────────┘
        │                   │
        └───────┬───────────┘
                │
                ▼
    ┌─────────────────────────┐
    │ 📺 Component Compartit: │
    │   <FiguraViewer />      │
    │                         │
    │ - Projecció (TV/PC)     │
    │ - Vista Mòbil (PWA)     │
    │ - Mateix codi, 2 UX     │
    └─────────────────────────┘
```

### Característiques de cada Component

#### 1️⃣ Backend (API)
- **Responsable:** Lògica de negoci, persistència, autenticació
- **Endpoints:** REST API per tots els components
- **Stack Fix:** NestJS + TypeScript

#### 2️⃣ App de Gestió (Dashboard Web)
- **Usuaris:** Administradors, Tècnica, Junta
- **Funcionalitats:** 
  - CRUD complet de tot el sistema
  - **Vista Projecció:** Pantalla gran per mostrar figures durant assajos/actuacions
- **Dispositius:** Desktop/Tablet + Pantalla de projecció

#### 3️⃣ App Mòbil (PWA)
- **Usuaris:** Membres de la colla
- **Funcionalitats:** 
  - Confirmar assistència
  - Check-in amb Presencial/QR/GPS
  - **Veure figures i posicions assignades** (mateixa vista que projecció)
  - Feed de notícies
  - Vista per a Administradors/Tècnica/Junta que facilita la gestió de la colla i les figures.
- **Dispositius:** Smartphone (iOS/Android)
- **Requisit:** Responsive i offline-first

#### 4️⃣ Mòdul Figures (Independent)
- **Equip:** Separat del principal
- **Funcionalitats:** 
  - Editor visual canvas per crear/editar figures
  - Crear plantilles custom exportables
  - Validacions d'estructura
  - Importació de llista de persones amb etiquetes
- **Integració:** Via API (guardar plantilles, carregar persones)
- **Stand-alone:** Pot funcionar de forma independent amb dades mockeadas

---

## 📺 Vista de Projecció de Figures

### Funcionalitat Compartida: Web + Mòbil

Una funcionalitat clau és la **visualització de figures** que serà **idèntica** en:
- 🖥️ **Dashboard (Pantalla Gran):** Projecció durant assajos/actuacions
- 📱 **App Mòbil (PWA):** Consulta individual per cada membre

### Cas d'Ús: Assaig amb Projecció

```
Escenari típic a l'assaig:

1. Tècnica prepara figura "Micalet" per treballar avui
2. Assigna membres a cada posició (des de Dashboard)
3. Obre "Vista Projecció" en mode fullscreen
4. Projecta en pantalla gran (TV/projector)
5. Membres veuen on han d'anar:
   - A la pantalla gran (tots)
   - Al seu mòbil (individual)
6. Poden consultar-ho abans, durant i després de muntar
```

### Components de la Vista

```
┌────────────────────────────────────────────────┐
│  📍 Micalet - Assaig 20/01/2026                │
├────────────────────────────────────────────────┤
│                                                │
│           [Canvas Visualització]               │
│                                                │
│         🔴 (Xicalla: Maria, 145cm)            │
│              │                                 │
│         🔵──🔵 (Nivell 2)                     │
│       Joan  Pere                              │
│       180cm 175cm                             │
│              │                                 │
│      🔵──🔵──🔵──🔵 (Nivell 1)               │
│    Laura Anna Carles Marta                    │
│    165cm 168cm 178cm 170cm                    │
│                                                │
│         [Pinya: 28 persones]                  │
│      (Vista simplificada o detallada)         │
│                                                │
├────────────────────────────────────────────────┤
│ ✅ Tots els llocs assignats                   │
│ ⚠️  Revisar: Alçada Nivell 2 Joan > Laura    │
└────────────────────────────────────────────────┘
```

### Modes de Visualització

#### Mode Projecció (Dashboard - Pantalla Gran)
```yaml
Target: TV/Projector (1920x1080 o superior)
Layout: Fullscreen (sense menús)
Font Size: Gran (llegible a 5-10 metres)
Interacció: Només navegació (teclat/control remot)
Auto-refresh: Cada 30s (si hi ha canvis)
Funcionalitats:
  - Mostrar figura completa
  - Noms + Alçades (opcional toggle)
  - Només àlies (més net)
  - Zoom: Tronc vs Pinya
  - Canviar entre figures de l'esdeveniment
```

**Shortcut keys:**
- `F` = Fullscreen toggle
- `←` `→` = Canviar figura
- `Z` = Zoom tronc
- `P` = Zoom pinya
- `N` = Toggle noms complets / àlies
- `H` = Toggle alçades

#### Mode Mòbil (PWA - Individual)
```yaml
Target: Smartphone (responsive)
Layout: Compacte, scroll vertical
Font Size: Normal (llegible en mà)
Interacció: Touch (zoom, pan)
Funcionalitats:
  - Veure figura completa
  - Highlight: La meva posició (ressaltat)
  - Detalls: Click en posició → info membre
  - Comparar: Veure figures anteriors
  - Offline: Cache última figura vista
```

**Features mòbil específiques:**
- 🎯 **"On estic?"** → Auto-scroll a la meva posició
- 📸 **Screenshot** → Guardar imatge per consultar offline
- 🔔 **Notificació** → Si canvia la meva posició
- 👥 **Comparar** → "Qui està al meu costat?"

### Implementació Tècnica

#### Component Reutilitzable

```typescript
// Mateix component per Dashboard i PWA
<FiguraViewer
  figuraEsdevenimentId="uuid"
  mode="projection" | "mobile"
  highlightMembreId="uuid" // Opcional (mòbil)
  showNames={true}
  showAltures={true}
  showCheckInStatus={true} // ⭐ DIFERENCIA qui ha fet check-in
  interactive={false} // false en projecció
  zoom="full" | "tronc" | "pinya"
  realTimeUpdate={true} // Actualitza quan algú fa check-in
/>
```

**Lògica de visualització check-in:**
```typescript
interface MembrePosicio {
  membre: Membre;
  posicio: Posicio;
  assistencia: {
    estat: 'PUC_ANAR' | 'CHECK_IN' | 'NO_VAIG' | 'PENDENT';
    checkInAt?: Date;
  };
}

// Visual styling segons estat
const getMembreStyle = (assistencia) => {
  switch (assistencia.estat) {
    case 'CHECK_IN':
      return {
        color: '#2e7d32', // Verd
        fontWeight: 'bold',
        border: '2px solid #4caf50',
        icon: '✅'
      };
    case 'PUC_ANAR':
      return {
        color: '#9e9e9e', // Gris
        opacity: 0.6,
        icon: '⏰'
      };
    case 'NO_VAIG':
      return {
        color: '#d32f2f', // Vermell
        opacity: 0.3,
        icon: '❌'
      };
    default:
      return {
        color: '#757575',
        opacity: 0.4,
        icon: '⚪'
      };
  }
};
```

#### Responsive Design

```scss
// Adaptació segons dispositiu
.figura-viewer {
  // Mobile (PWA)
  @media (max-width: 768px) {
    font-size: 14px;
    .persona-node { radius: 20px; }
  }
  
  // Tablet
  @media (min-width: 769px) and (max-width: 1024px) {
    font-size: 16px;
    .persona-node { radius: 25px; }
  }
  
  // Desktop/Projection
  @media (min-width: 1025px) {
    font-size: 20px;
    .persona-node { radius: 30px; }
  }
  
  // Large Screen Projection
  @media (min-width: 1920px) {
    font-size: 28px;
    .persona-node { radius: 40px; }
  }
}
```

#### URLs i Routing

```yaml
Dashboard (Gestió):
  - /esdeveniments/:id/figures → Llistat figures
  - /esdeveniments/:id/figures/:figuraId/edit → Editor
  - /esdeveniments/:id/figures/:figuraId/view → Vista normal
  - /esdeveniments/:id/figures/:figuraId/projection → Mode projecció ⭐

PWA (Mòbil):
  - /figures → Figures properes
  - /figures/:figuraId → Vista figura (amb highlight propi) ⭐
  - /figures/:figuraId/detall → Detalls ampliats
```

#### Actualització en Temps Real (Opcional - Futur)

```typescript
// WebSocket per sync live
socket.on('figura:updated', (figuraId) => {
  if (currentFiguraId === figuraId) {
    refetchFigura();
    showToast('Figura actualitzada!');
  }
});

// Cas d'ús: Tècnica fa canvi mentre està projectat
// → Pantalla s'actualitza automàticament
// → Mòbils també s'actualitzen
```

### Funcionalitats Extra (Futur)

#### Mode Presentació
```yaml
Narrativa: Mostra ordre d'actuació
Timer: Temps planificat per figura
Status: Encara no treballada / Treballada / Carregada
```

#### Mode Comparació
```yaml
Split Screen: Figura actual vs figura anterior (qualsevol del històric)
Històric: Veure evolució de la figura en diferents actuacions
```

#### QR Code a Projecció
```yaml
Display: Codi QR gran a la pantalla
Funció: Escanejar per obrir figura al mòbil
Cas d'ús: Membre nou, no té l'app instal·lada
  → Escaneja QR
  → Obre figura al navegador
  → Veu on ha d'anar
```

### Beneficis d'aquesta Implementació

✅ **Codi Compartit**
- 1 component = 2 experiències
- Menys bugs (mateix codi)
- Manteniment més fàcil

✅ **Consistència**
- Mateix visual en pantalla i mòbil
- Sense confusions ("és diferent?")
- Aprenentatge únic

✅ **Flexibilitat**
- Funciona amb projector, TV, tablet, mòbil
- Responsive automàtic
- No cal hardware específic

✅ **Offline-First**
- PWA cache última figura
- Funciona sense internet durant assaig
- Sync quan hi ha connexió

---

## 🔧 Stack Tecnològic Proposat

### Backend (Recomanat)
```yaml
Framework: NestJS (TypeScript)
Node: v22+ LTS
Package Manager: pnpm o npm
```

### Base de Dades - OPCIONS

#### Opció A: PostgreSQL (Recomanada) ⭐
```yaml
BBDD Principal: PostgreSQL 15+
Cache/Sessions: Redis 7+ (valorar si es necessita més velocitat)
ORM: Prisma o TypeORM
```

**Pros:**
- ✅ Relacional, robusta, ACID
- ✅ JSON support (JSONB) per dades flexibles (per exemple, les plantilles de figures)
- ✅ Molt bona integració amb NestJS
- ✅ Fàcil hosting (a valorar)
- ✅ Audit logs i full-text search integrat

**Contras:**
- ❌ Pot ser "overkill" per projectes petits
- ❌ Schema rígid (però es pot usar JSONB)

**Ideal per:**
- Gestió de persones amb relacions complexes
- Validacions d'integritat
- Queries complexes (reports/analytics)

---

#### Opció B: MongoDB + PostgreSQL (Híbrida)
```yaml
BBDD Persones/Events: PostgreSQL
BBDD Figures/Canvas: MongoDB
Cache: Redis
```

**Pros:**
- ✅ Flexibilitat per figures (schema-less)
- ✅ Postgres per dades crítiques
- ✅ Mongo per dades amb estructura variable

**Contras:**
- ❌ Més complexitat (2 BBDD)
- ❌ Més difícil fer joins entre sistemes
- ❌ Overhead de manteniment

**Ideal per:**
- Si el canvas té moltes variacions
- Si volem permetre customitzacions extremes

---

#### Opció C: PostgreSQL + JSONB (Flexibilitat dins SQL) ⭐
```yaml
BBDD: PostgreSQL amb columnes JSONB
Cache: Redis
ORM: Prisma
```

**Pros:**
- ✅ Una sola BBDD
- ✅ Flexibilitat per camps variables (JSONB)
- ✅ Mantenim avantatges SQL
- ✅ Queries potents amb `jsonb_path_query`

**Contras:**
- ❌ Queries JSONB són més lentes que columnes natives
- ❌ Cal aprendre sintaxi JSONB

**Ideal per:**
- Projecte OpenSource (més fàcil setup)
- Vols simplicitat però flexibilitat

---

### **Recomanació Final Backend:**
```yaml
BBDD: PostgreSQL 15+ (amb JSONB quan calgui)
Cache/Queue: Redis 7+
ORM: Prisma (millor DX, tipus autogenerats)
Migrations: Prisma Migrate
```

---

### Frontend - OPCIONS

#### Opció 1: React + Vite + Material-UI (Recomanada) ⭐
```yaml
Framework: React 18 + TypeScript
Build: Vite
UI Library: Material-UI (MUI) v5
State: Zustand o Redux Toolkit
Forms: React Hook Form + Zod
Canvas: Konva.js (react-konva)
Charts: Recharts
HTTP: Axios + React Query
```

**Pros:**
- ✅ Ecosistema madur
- ✅ MUI molt complet (components + datepicker + grid)
- ✅ Vite súper ràpid
- ✅ React Query: cache automàtic
- ✅ Molt material/docs disponible

**Contras:**
- ❌ Bundle size gran amb MUI
- ❌ Overwriting styles MUI pot ser tediós

---

#### Opció 2: React + Vite + Ant Design
```yaml
UI Library: Ant Design v5
Resta igual que Opció 1
```

**Pros:**
- ✅ Estètica més "enterprise"
- ✅ Molt components out-of-the-box
- ✅ Table amb edició inline molt potent

**Contras:**
- ❌ Documentació a vegades en xinès
- ❌ Menys "material design"

---

#### Opció 3: Next.js 14 (App Router) + Shadcn/ui
```yaml
Framework: Next.js 14 (SSR/SSG)
UI: Shadcn/ui (Radix + Tailwind)
State: Zustand
```

**Pros:**
- ✅ SSR per SEO (si cal)
- ✅ Shadcn molt modern i customitzable
- ✅ API routes integrades (opcional)

**Contras:**
- ❌ Més complex si no necessitem SSR
- ❌ Shadcn requereix copy/paste components
- ❌ Learning curve Next.js

---

#### Opció 4: Angular 17+ (Standalone Components)
```yaml
Framework: Angular 17+ (TypeScript)
UI: Angular Material
State: RxJS + Signals (natiu Angular)
Forms: Reactive Forms
Canvas: Konva.js (konva/angular-konva) o ng-canvas
HTTP: HttpClient (natiu)
```

**Pros:**
- ✅ Framework complet "batteries included"
- ✅ TypeScript first (millor tipat que React)
- ✅ Angular Material molt madur i consistent
- ✅ RxJS potent per gestió estat async
- ✅ Dependency Injection natiu
- ✅ CLI molt potent (ng generate)
- ✅ Millor per equips grans i projectes enterprise
- ✅ Signals (nova API) simplifica reactivitat

**Contras:**
- ❌ Learning curve més pronunciada
- ❌ Més verbose que React
- ❌ Menys flexibilitat (opinionated)
- ❌ Ecosistema de llibreries més petit
- ❌ Bundle size més gran per defecte
- ❌ Menys popular que React (menys recursos/tutorials)

**Ideal per:**
- Equips amb experiència Angular
- Projectes que requereixen estructura molt definida
- Si ja teniu backend NestJS (sintaxi similar)

---

#### Opció 5: Ionic + Capacitor (Híbrid PWA + Nativa)
```yaml
Framework Base: React o Angular (a escollir)
UI: Ionic Components (optimitzats per mòbil)
Capacitor: Accés APIs natives
Build: Web (PWA) + iOS + Android (opcional)
State: Zustand/Redux (React) o RxJS (Angular)
```

**Pros:**
- ✅ PWA + capacitats natives en 1 codebase
- ✅ Accés a càmera, notificacions locals, GPS, etc.
- ✅ Publicar a stores OPCIONAL (si cal en futur)
- ✅ €0 si només web, €99/any només si publiquem a Apple Store
- ✅ Compatible amb React o Angular (trieu el que vulgueu)
- ✅ UI components optimitzats per mòbil i táctil
- ✅ Updates web instantanis (com PWA)
- ✅ Millor que React Native en performance web

**Contras:**
- ❌ Més pes que PWA pura (~100-200KB extra)
- ❌ Ionic UI té estil propi (pot requerir customització)
- ❌ Si publiquem a stores, encara cal aprovació (1-7 dies)
- ❌ Més complex que PWA pura
- ❌ Menys flexible que React/Angular purs

**Ideal per:**
- Voleu PWA però amb porta oberta a stores futur
- Necessiteu APIs natives que PWA no suporta bé
- Voleu UI específica mòbil (no responsive web)
- Equip vol usar React o Angular però amb twist mòbil

**Cas d'ús per nosaltres:**
```
Escenari 1 (Recomanat): 
  - Desenvolupar amb Ionic + React/Angular
  - Desplegar com a PWA (€0)
  - Si en 6 mesos veiem que cal store → Build iOS/Android

Escenari 2 (Més conservador):
  - Començar amb PWA pura (més simple)
  - Si detectem limitacions → Migrar a Ionic (relativament fàcil)
```

**Comparativa amb altres opcions:**

| Aspecte | PWA Pura | Ionic + Capacitor | React Native |
|---------|----------|-------------------|--------------|
| **Cost llicències** | €0 | €0 (o €99 si stores) | €99/any |
| **Bundle size** | Petit | Mitjà | Gran |
| **APIs Natives** | Limitat | Excel·lent | Excel·lent |
| **Updates** | Instant | Instant (web) / Stores (app) | Stores |
| **Complexitat** | Baixa | Mitjana | Alta |
| **Stores** | No* | Opcional | Obligatori |
| **Performance** | Molt bona | Bona | Excel·lent |

*PWA es pot "instal·lar" sense store via "Add to Home Screen"

---

### **Recomanació Final Frontend:**

#### React vs Angular vs Ionic: Comparativa Completa

| Aspecte | React Pura | Angular Pur | Ionic (React/Angular) |
|---------|------------|-------------|----------------------|
| **Learning Curve** | Mitjana | Alta | Mitjana-Alta |
| **Flexibilitat** | Alta | Mitjana | Mitjana |
| **Bundle Size** | Petit | Gran | Mitjà |
| **TypeScript** | Opcional | Obligatori | Segons base |
| **APIs Natives** | Via PWA (limitat) | Via PWA (limitat) | Excel·lent via Capacitor |
| **UI Mòbil** | Responsive web | Responsive web | Components natius mòbil |
| **Stores** | No (PWA) | No (PWA) | Opcional |
| **Sintaxi Backend** | Diferent | Similar NestJS ⭐ | Segons base |
| **Comunitat** | Enorme | Gran | Mitjana |
| **Ideal per** | Apps web flexibles | Enterprise web | Apps mòbil-first híbrides |

**Recomanació segons prioritats:**

✅ **React + PWA** (Recomanada per defecte) si:
- Voleu simplicitat i rapidesa
- No necessiteu APIs natives avançades
- Preferiu ecosistema enorme React
- Update instantanis més importants que store presence

✅ **Angular + PWA** si:
- Equip amb experiència Angular
- Voleu estructura molt definida
- Backend NestJS (sintaxi similar)
- Projecte gran amb molts desenvolupadors

✅ **Ionic + Capacitor (React o Angular)** si:
- Voleu PWA PERÒ amb porta oberta a stores
- Necessiteu APIs natives (càmera avançada, notificacions locals robustes, etc.)
- Voleu UI específicament dissenyada per mòbil
- No us importa ~200KB extra de bundle
- Considereu publicar a Apple Store / Play Store en el futur

❌ **React Native** només si:
- Necessiteu performance nativa crítica
- Voleu definitivamente estar a les stores
- Pressupost permet €99/any + overhead desenvolupament

❌ **Apps Natives** (NO recomanat):
- Massa cost, temps i complexitat per aquest projecte

---

**Per App Gestió (Dashboard):**

**Opció A (Recomanada si equip sense experiència Angular): React Stack** ⭐
```yaml
Framework: React 18 + Vite + TypeScript
UI: Material-UI v5 (MUI)
State: Zustand (simple) o Redux Toolkit (complex)
Forms: React Hook Form + Zod
Canvas: react-konva (Konva.js)
Charts: Recharts
API: Axios + TanStack Query (React Query)
Auth: Context API + JWT storage
```

**Opció B: Angular Stack** (si l'equip té experiència Angular)
```yaml
Framework: Angular 17+ (Standalone Components)
UI: Angular Material
State: RxJS + Signals (natiu Angular)
Forms: Reactive Forms + Custom Validators
Canvas: Konva.js (wrapper custom)
Charts: ngx-charts o Chart.js
API: HttpClient + Interceptors
Auth: Guards + Interceptors + Token Service
```

**Exemple codi Angular:**
```typescript
// membres.component.ts
import { Component, inject } from '@angular/core';
import { MembresService } from './membres.service';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-membres',
  standalone: true,
  template: `
    <mat-card *ngFor="let membre of membres()">
      <h3>{{ membre.nom }}</h3>
      <p>Alçada: {{ membre.alcadaEspatlles }}cm</p>
    </mat-card>
  `
})
export class MembresComponent {
  private membresService = inject(MembresService);
  
  // Signal (nou a Angular 17+)
  membres = toSignal(this.membresService.getMembres(), { 
    initialValue: [] 
  });
}
```

**Per App Mòbil - 3 Opcions:**

#### Opció A: PWA Pura (RECOMANADA per defecte) ⭐⭐⭐
```yaml
Approach: Progressive Web App
Base: Same stack que Dashboard (React o Angular)
UI: MUI/Angular Material + components touch
PWA: Vite PWA Plugin (React) o @angular/pwa (Angular)
Offline: Workbox + IndexedDB (via Dexie.js)
QR Scanner: html5-qrcode
Geolocalització: Navigator API
Camera: MediaDevices API
Notifications: FCM Web Push
Install: Add to Home Screen (sense store)
Cost: €0
Updates: Instantanis
```

**Millor per:** Simplicitat, cost zero, updates ràpids, suficient per les nostres necessitats actuals.

---

#### Opció B: Ionic + Capacitor (A valorar) ⭐⭐
```yaml
Approach: Híbrid PWA + Capacitat Nativa
Framework: Ionic amb React o Angular
UI: Ionic Components (optimitzats mòbil)
Capacitor: APIs natives (càmera, notificacions, etc.)
Build Targets: 
  - Web (PWA) → Deploy principal
  - iOS (opcional) → Si cal store
  - Android (opcional) → Si cal store
Offline: Mateix que PWA + Storage natiu
Plugins: @capacitor/camera, @capacitor/geolocation, etc.
Cost: €0 (o €99/any només si publiquem iOS)
Updates: 
  - Web: Instantanis
  - Store: 1-7 dies approval
```

**Millor per:** 
- Voleu APIs natives més robustes
- Porta oberta a publicar a stores en futur
- UI específica mòbil (no responsive web)
- Notificacions locals sense dependre de FCM

**Exemple Ionic + React:**
```typescript
import { IonPage, IonHeader, IonContent } from '@ionic/react';
import { Camera, CameraResultType } from '@capacitor/camera';

const AssistenciaPage: React.FC = () => {
  const scanQR = async () => {
    // Accés directe a càmera nativa
    const photo = await Camera.getPhoto({
      resultType: CameraResultType.Uri,
      quality: 90
    });
    // Process QR...
  };
  
  return (
    <IonPage>
      <IonHeader>Confirmar Assistència</IonHeader>
      <IonContent>
        <button onClick={scanQR}>Escanejar QR</button>
      </IonContent>
    </IonPage>
  );
};
```

**Quan triar Ionic sobre PWA:**
```
✅ Trieu Ionic si:
- Necessiteu notificacions locals robustes (sense internet)
- Voleu accés a APIs natives avançades
- Considereu publicar a stores en 6-12 mesos
- UI mòbil nativa és prioritat sobre responsive web
- No us importa ~200KB bundle extra

✅ Quedeu amb PWA si:
- Simplicitat és prioritat
- Updates instantanis són crítics
- No voleu gestió de stores MAI
- APIs web són suficients (ho són pel nostre cas)
```

---

#### Opció C: React Native (NO recomanada)
```yaml
Cost: €99/any + més temps desenvolupament
Updates: 1-7 dies approval
Complexitat: Alta
```

**Només si:** Voleu definitivamente stores i performance nativa crítica.

---

### **Decisió Recomanada per l'Equip:**

**Fase 1 (MVP - Mesos 0-6):** 
→ **PWA Pura** amb React o Angular
- Cost €0
- Més simple i ràpid
- Suficient per validar el producte

**Fase 2 (Si cal - Mesos 6+):**
→ Avaluar si necessitem **migrar a Ionic** per:
- Publicar a stores (visibilitat)
- APIs natives més robustes
- UI més nativa

**Nota:** Migrar de PWA (React) a Ionic (React) és relativament senzill, així que no perdem molt començant amb PWA.

---

### Mòdul Figures (Independent)

El mòdul Figures es desenvoluparà per separat amb:

```yaml
Framework: React + Vite + TypeScript (standalone)
Canvas: Konva.js (react-konva) o Fabric.js
State: Zustand (local state)
Mock Data: json-server (mentre no hi ha backend)
Export: html-to-image o canvas.toBlob()
```

**Integració futura:**
- Endpoint per guardar plantilles: `POST /api/figures/templates`
- Endpoint per importar persones: `GET /api/membres?include=etiquetes`
- Exportar plantilles com JSON per importar a esdeveniments

**Standalone mode:**
- Funciona sense backend
- Llista de persones mockejada
- Guarda plantilles a localStorage
- Exporta JSON per importar després

---

## 📱 PWA vs Apps Natives - Anàlisi Detallat

### Decisió Recomanada: PWA (Progressive Web App) ⭐⭐⭐

Per aquest projecte, **recomanem FORTAMENT anar amb PWA** i NO desenvolupar apps natives. Vegem per què:

### Comparativa Completa

| Aspecte | PWA | Apps Natives (iOS + Android) |
|---------|-----|------------------------------|
| **Cost Desenvolupament** | 1x codebase | 2-3x codebase (iOS + Android + potser Web) |
| **Temps Desenvolupament** | 100% | 200-250% (2 plataformes) |
| **Llicències Anuals** | €0 | €99/any (Apple) + €25 única (Google) ≈ €125/any |
| **Revisió/Aprovació Store** | Cap | 1-7 dies (Apple), 1-3 dies (Google) |
| **Actualitzacions** | Instantànies | Requires submission + approval + user update |
| **Equip Necessari** | 1-2 devs web | 1 iOS + 1 Android + 1 web = 3 devs |
| **Manteniment Anual** | Baix | Alt (3 codebases) |
| **Distribució** | URL | Store submission |
| **Testing** | Web (cross-browser) | iOS + Android (múltiples versions) |

---

### 💰 Resum Costos Anuals

| Concepte | PWA | React Native | Apps Natives |
|----------|-----|--------------|--------------|
| **Llicències** | €0 | €99/any | €99/any |
| **Hosting** | ~€100/any | ~€100/any | ~€100/any |
| **Temps Dev** | 1x (baseline) | 1.5x | 2.5x |
| **Manteniment** | 1 codebase | 1 codebase, 2 builds | 2-3 codebases |
| **Updates** | Instant | 1-7 dies | 1-7 dies |
| **CI/CD Cost** | Baix | Mitjà | Alt |
| **Testing Devices** | Navegadors (gratis) | iOS + Android devices | iOS + Android devices |
| **TOTAL 1r any** | ~€100 | ~€200 + 1.5x temps | ~€200 + 2.5x temps |
| **TOTAL anual** | ~€100 | ~€200 + overhead | ~€200 + overhead |

**Estalvi PWA vs Nativa: ~€100-200/any + 60% temps desenvolupament**

---

### Costos Detallats

#### Opció A: PWA (RECOMANADA) ⭐
```yaml
Setup Inicial:
  - Desenvolupament: 1 codebase web
  - Testing: Chrome, Safari, Firefox
  - Deploy: Vercel/Netlify (free tier o ~10€/mes)
  
Costos Recurrents Anuals:
  - Llicències: €0
  - Hosting Frontend: €0-120/any (segons tràfic)
  - SSL: €0 (inclòs Vercel/Netlify)
  - Manteniment: 1 codebase
  - Testing: Navegadors (gratuït)
  
TOTAL ANUAL: ~€0-120
Temps desenvolupament: 100% (baseline)
```

#### Opció B: Apps Natives
```yaml
Setup Inicial:
  - Desenvolupament iOS: Swift/SwiftUI
  - Desenvolupament Android: Kotlin/Compose
  - Desenvolupament Web: (encara necessari per dashboard)
  - Comptes Developer:
    - Apple Developer: €99/any
    - Google Play: €25 (única vegada)
  - Certificats/Provisioning: Temps + complexitat
  
Costos Recurrents Anuals:
  - Llicències Apple: €99/any
  - Llicències Google: €0 (després del primer any)
  - Hosting stores: €0
  - Manteniment: 3 codebases diferents
  - Testing dispositius: €€€ (múltiples devices)
  - CI/CD: Fastlane + TestFlight + més complex
  
TOTAL ANUAL: ~€99 + costos desenvolupament 2-3x
Temps desenvolupament: 200-250%
```

#### Opció C: React Native / Flutter
```yaml
Setup Inicial:
  - Desenvolupament: 1 codebase compartit (millor que natiu pur)
  - Però encara requereix:
    - Compte Apple: €99/any
    - Compte Google: €25
    - Build/deployment separat per plataforma
    - Testing en ambdues plataformes
  
Costos Recurrents Anuals:
  - Llicències: €99/any
  - Manteniment: 1 codebase (millor) però builds dobles
  - Store submissions: Doble process
  
TOTAL ANUAL: ~€99 + overhead stores
Temps desenvolupament: 120-150% (millor que natiu, pitjor que PWA)
```

---

### Funcionalitats: PWA vs Nativa

#### ✅ Funcionalitats que PWA cobreix perfectament:

| Feature | PWA Support | Notes |
|---------|-------------|-------|
| **Push Notifications** | ✅ Sí | FCM funciona a iOS 16.4+, Android sempre |
| **Offline Mode** | ✅ Sí | Service Workers + IndexedDB |
| **Camera (QR)** | ✅ Sí | MediaDevices API |
| **Geolocalització** | ✅ Sí | Navigator.geolocation |
| **Add to Home Screen** | ✅ Sí | Icona a pantalla igual que app |
| **Fullscreen** | ✅ Sí | Manifest display: standalone |
| **Background Sync** | ✅ Sí | Sync API (Android), workarounds iOS |
| **Local Storage** | ✅ Sí | IndexedDB (fins a 50MB+) |
| **Share API** | ✅ Sí | Web Share API |
| **Credentials** | ✅ Sí | Biometrics via WebAuthn |

#### ⚠️ Funcionalitats limitades en PWA:

| Feature | PWA Support | Workaround | Necessari per nosaltres? |
|---------|-------------|------------|--------------------------|
| **Background Location** | ❌ Limitat | No crític | ❌ NO (només check-in puntual) |
| **Contactes/Calendari** | ❌ No | API externa | ❌ NO |
| **NFC** | ⚠️ Android només | No crític | ❌ NO |
| **Bluetooth** | ⚠️ Experimental | Web Bluetooth | ❌ NO |
| **App Store Presence** | ❌ No | Link a web | ⚠️ Millor distribució directa |

**Conclusió:** Per les nostres necessitats, PWA té totes les funcionalitats.

---

### Cicle de Vida: Update/Deploy

#### PWA:
```
1. Developer pushes to main
2. CI/CD build (2-5 min)
3. Deploy to Vercel (automàtic)
4. Users refresh → nova versió (instant)
   O bé: Service Worker update automàtic
   
TEMPS TOTAL: 5-10 minuts
```

#### Apps Natives:
```
1. Developer pushes to main
2. Build iOS (10-15 min)
3. Build Android (10-15 min)
4. Submit iOS → App Store Review (1-7 dies ⏰)
5. Submit Android → Play Store (1-3 dies)
6. Approval (si passa)
7. Users update manualment (o auto si configurat)
   - Només ~60% users actualitzen en primera setmana
   
TEMPS TOTAL: 1-7 dies + update user
RISC: Rebutjat per reviewer (més temps)
```

---

### Esforç de Manteniment

#### PWA:
```yaml
Update Dependencies:
  - npm update (1 cop/mes)
  - Testing: Només web browsers
  
Fix Bug Crític:
  - Fix → Push → Deploy → Live en 10 min
  
OS Updates:
  - iOS/Android updates: Normalment compatibles
  - Només si canvien APIs web (rar)
  
Breaking Changes:
  - Afecten a tots a la vegada
  - Fix once, deploy once
```

#### Apps Natives:
```yaml
Update Dependencies:
  - iOS: Xcode, Swift, libraries
  - Android: Android Studio, Kotlin, libraries
  - Pot requerir canvis de codi per cada plataforma
  
Fix Bug Crític:
  - Fix iOS → Submit → Wait approval (1-7 dies)
  - Fix Android → Submit → Wait (1-3 dies)
  - Usuaris encara en versió vella fins update
  
OS Updates:
  - iOS 17, iOS 18... requereix testing + adapta
  - Android 13, 14... requereix testing + adapta
  - Deprecacions APIs (rewrite necessari)
  
Breaking Changes:
  - Fix en 2-3 llocs diferents
  - Testing multiply per plataforma
```

---

### Experiència Usuari: PWA moderna vs App

**Mite: "Les PWA es veuen com webs, no com apps"**

❌ **FALS**. Una PWA ben feta és indistingible d'una app nativa:

```yaml
PWA Moderna:
  - Icona a Home Screen: ✅ Igual que app
  - Fullscreen (sense browser chrome): ✅
  - Splash screen: ✅
  - Gestures natiu (swipe, pull-to-refresh): ✅
  - Transicions suaus: ✅ (60fps amb optimització)
  - Offline funciona: ✅
  - Push notifications: ✅
  - Camera/GPS: ✅
  
Diferència real per usuari: MÍNIMA o nul·la
```

**Casos d'ús reals:**
- **Twitter (X)**: PWA oficial molt usada
- **Starbucks**: PWA, no app nativa
- **Uber**: Va començar amb PWA abans d'app
- **Pinterest**: 60% tràfic mòbil via PWA

---

### Recomanació Final: PWA ⭐

#### Per què PWA és millor per aquest projecte:

✅ **Cost:** €0 llicències vs €99/any  
✅ **Velocitat:** Deploy instant vs 1-7 dies approval  
✅ **Manteniment:** 1 codebase vs 2-3  
✅ **Equip:** 1-2 devs vs 3+  
✅ **Updates:** Instantanis vs esperar users  
✅ **Bugs crítics:** Fix en minuts vs dies  
✅ **Funcionalitats:** Cobreix 100% necessitats  
✅ **OpenSource:** Més fàcil contribucions (tots poden testejar)  
✅ **Distribució:** URL vs process stores  
✅ **Testing:** Més simple i ràpid  

#### Quan consideraríem App Nativa:

❌ Si necessitéssim: Background location continu, NFC crítico, widgets complexos, integració profunda OS  
❌ Si pressupost no fos problema  
❌ Si l'app store presence fos crítica per negoci  

**Per una colla de muixerangues OpenSource: PWA és la millor opció, sense dubte.**

---

### Implementació PWA: Checklist

```typescript
// vite.config.ts - React example
import { VitePWA } from 'vite-plugin-pwa';

export default {
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'APPsistència',
        short_name: 'APPsistència',
        description: 'Gestió assistència Muixerangues',
        theme_color: '#1976d2',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.appsistencia\.cat\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 // 24h
              }
            }
          }
        ]
      }
    })
  ]
};
```

**Testing PWA:**
```bash
# Lighthouse audit
npm run build
npx serve dist
# Obrir Chrome DevTools → Lighthouse → PWA audit

# Should score 100/100 in PWA category
```

---

## 👥 Flux d'Assistència i Registre

### Estats de l'Assistència

```
PENDENT → PUC_ANAR → NO_VAIG
   ↓          ↓
(default)  CHECK_IN → ASSISTIT
              ↓
         NO_PRESENTAT (si confirmat però no va venir)
```

### Workflow Complet

#### 1. Creació Esdeveniment (Equip Tècnic)
```
Tècnica crea assaig/actuació des del Dashboard:
- Data i hora
- Lloc
- Descripció
- Figures planificades (opcional)
- Recordatori automàtic (X dies abans)

→ Sistema crea esdeveniment
→ Tots els membres veuen l'esdeveniment a la llista
```

#### 2. Notificació Inicial als Membres
```
Sistema envia push notification:
"Nou assaig: Divendres 20h - Confirma assistència"

Membre rep notificació amb accés directe a l'app
```

#### 3. Membre Visualitza i Indica Assistència (APP Mòbil)
```
El membre obre l'app i veu la llista d'esdeveniments:

┌─────────────────────────────────┐
│ Assaig - Divendres 18/10 20h   │
├─────────────────────────────────┤
│ 📊 Estat actual:                │
│   🟢 Puc anar: 56 persones      │
│   🔴 No vaig: 12 persones       │
│   ⚪ Pendents: 18 persones      │
├─────────────────────────────────┤
│ Tu encara no has indicat res    │
│                                 │
│  [ ✅ Puc anar ]  [ ❌ No vaig ]│
└─────────────────────────────────┘

Membre fa click:
- "Puc anar" → Estat passa a PUC_ANAR (confirmat)
- "No vaig" → Estat passa a NO_VAIG (sense justificació)

Pot canviar la resposta fins el dia de l'esdeveniment.
```

#### 4. Recordatoris Automàtics
```
Sistema envia recordatoris:
- 48h abans → Als PENDENTS ("Recorda indicar si vindràs") opcional segons la assistència de la persona en els útims 3 mesos  
- 2h abans → Als que han dit "Puc anar" ("Ens veiem avui a les 20h!")
```

#### 5. Check-in el Dia de l'Esdeveniment

El membre que ha indicat "Puc anar" arriba al lloc i fa check-in:

**Opció A: QR Code (Recomanada per Assajos Indoor)** ⭐
```
1. Tècnica genera QR desde Dashboard
2. Projecta QR en pantalla gran o mostra a l'entrada
3. Membre obre l'APP i escaneja QR:
   - Click botó "Escanejar QR"
   - Obre càmera
   - Escaneja el codi
   - ✅ Check-in registrat amb timestamp
   - Nom del membre apareix a la pantalla de projecció
```

**Opció B: Check-in Manual/Presencial**
```
1. Membre arriba (Presencial)
2. A la porta està la tablet de la colla amb un buscador de membres
3. Busca el seu nom i clica en "He arribat" / "Check-in"
4. Sistema registra check-in amb timestamp
```

**Opció C: Tècnica des de la app mòbil (PWA) te permisos per marcar el check-in dels membres de la colla**
```
1. Tècnica des de la app mòbil (PWA) te permisos per marcar el check-in dels membres de la colla
```

**Opció D: Check-in per Tècnica (Fallback)**
```
1. Tècnica des de Dashboard veu llista de confirmats
2. Click checkbox al costat del nom quan arriba
3. Marcar com "Check-in" manualment
```

#### 6. Visualització a les Figures (Característica Clau) 🎯

**Després de fer check-in, el nom del membre apareix diferent a les figures:**

```
📺 PANTALLA DE PROJECCIÓ + 📱 APP MÒBIL:

┌────────────────────────────────────────┐
│  📍 Micalet - Assaig 20/01/2026        │
├────────────────────────────────────────┤
│                                        │
│         🔴 Maria ✅ (CHECK-IN)         │
│         (Xicalla, 145cm)               │
│              │                         │
│         🔵──🔵 (Nivell 2)             │
│       Joan✅  Pere⏰                   │
│       180cm   175cm                    │
│     (CHECK-IN) (Pendent)               │
│              │                         │
│      🔵──🔵──🔵──🔵 (Nivell 1)       │
│    Laura✅ Anna⏰ Carles✅ Marta✅     │
│   (CHECK-IN) (Pendent) (CHECK-IN)...  │
│                                        │
├────────────────────────────────────────┤
│ ✅ Check-in: 48/56 (86%)              │
│ ⏰ Confirmats pendents arribada: 8    │
└────────────────────────────────────────┘

Llegenda:
✅ = Membre ha fet check-in (nom en VERD o NEGRETA)
⏰ = Membre confirmat però encara no ha arribat (nom en GRIS o NORMAL)
❌ = Posició sense assignar (cercle buit)
```

**Implementació Visual:**
```css
/* Diferenciació visual */
.membre-check-in {
  color: #2e7d32; /* Verd */
  font-weight: bold;
  border: 2px solid #4caf50;
}

.membre-pendent {
  color: #9e9e9e; /* Gris */
  opacity: 0.6;
}
```

**Beneficis:**
- ✅ Tècnica veu en temps real qui ha arribat
- ✅ Membres veuen qui està present
- ✅ Facilita començar figures quan hi ha prou gent
- ✅ Detecta ràpidament si falta algú clau

#### 7. Seguiment en Temps Real (Dashboard)
```
┌─────────────────────────────────────────┐
│ Assaig Divendres 20h - EN CURS         │
├─────────────────────────────────────────┤
│ ✅ Check-in: 48/56 (86%)               │
│ 🟢 "Puc anar": 56                      │
│ ⏰ Confirmats però no arribats: 8      │
│ 🔴 "No vaig": 12                       │
│ ⚪ No han respost: 18                  │
├─────────────────────────────────────────┤
│ Últims check-ins:                      │
│ • Joan - fa 1 min                      │
│ • Maria - fa 2 min                     │
│ • Pere - fa 5 min                      │
└─────────────────────────────────────────┘
```

#### 8. Tancament Esdeveniment
```
Sistema automàticament (1h després de finalitzar):
- Marca els que van dir "Puc anar" però no van fer check-in → NO_PRESENTAT
- Els que van fer check-in → ASSISTIT
- Els que van dir "No vaig" → Mantenen NO_VAIG (sense penalització)
```

#### 9. Resum Post-Esdeveniment
```
Estadístiques guardades:
- Total confirmats "Puc anar": 56
- Total assistents reals (check-in): 48
- No presentats (van dir que sí però no van venir): 8
- Taxa assistència: 85.7%
- Hora mitjana arribada (check-in): 19:52h
- Membres més puntuals / més retardats
```

---

## 🔔 Sistema de Notificacions

### Arquitectura Notificacions

```yaml
Provider: Firebase Cloud Messaging (FCM)
Suport: iOS, Android, Web (PWA)
Backend: NestJS + FCM Admin SDK
Storage Tokens: Taula `dispositius`
```

### Tipus de Notificacions

#### 1. Esdeveniment Nou
```json
{
  "title": "📅 Nou Assaig Programat",
  "body": "Divendres 20/10 a les 20h - Confirma assistència",
  "data": {
    "type": "ESDEVENIMENT_NOU",
    "esdeveniments_id": "uuid",
    "action": "OBRIR_CONFIRMACIO"
  }
}
```

#### 2. Recordatori Assistència
```json
{
  "title": "⏰ Recordatori: Assaig demà!",
  "body": "Demà divendres 20h - Has confirmat assistència",
  "data": {
    "type": "RECORDATORI",
    "esdeveniment_id": "uuid"
  }
}
```

#### 3. Notícia Nova
```json
{
  "title": "📰 Nova notícia publicada",
  "body": "Actuació confirmada per les Festes de Gràcia",
  "data": {
    "type": "NOTICIA",
    "noticia_id": "uuid"
  }
}
```

#### 4. Figura Assignada (Opcional)
```json
{
  "title": "🎯 T'hem assignat a una figura!",
  "body": "Micalet - Nivell 2 - Assaig divendres",
  "data": {
    "type": "FIGURA_ASSIGNADA",
    "figura_id": "uuid"
  }
}
```

### Workflow Notificacions

```
┌──────────────────────────────────────────────┐
│ 1. Tècnica crea esdeveniment                 │
└────────────┬─────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────┐
│ 2. Backend guarda esdeveniment               │
│    Emite event: "esdeveniment.creat"         │
└────────────┬─────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────┐
│ 3. Notification Service (Queue)              │
│    - Obté membres actius                     │
│    - Filtra segons preferències              │
│    - Obté tokens FCM                         │
└────────────┬─────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────┐
│ 4. FCM envia notificacions                   │
│    - Batching (max 500 per request)          │
│    - Retry amb exponential backoff           │
│    - Guardar log enviament                   │
└────────────┬─────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────┐
│ 5. APP Mòbil rep notificació                 │
│    - Service Worker (PWA)                    │
│    - Mostra notificació OS                   │
│    - Click → Navega a detall                 │
└──────────────────────────────────────────────┘
```

### Preferències Usuari

Cada membre pot configurar:
```yaml
Notificacions Esdeveniments:
  - Nous esdeveniments: ON/OFF
  - Recordatoris: ON/OFF (i quan: 48h, 24h, 2h)
  - Canvis d'última hora: ON

Notificacions Figures:
  - Assignació a figura: ON/OFF
  - Canvis en figures: ON/OFF

Notícies:
  - Notícies noves: ON/OFF
  - Notícies urgents: ON (sempre)

Horari DND:
  - De 22:00 a 08:00 (no molestar)
```

### Segmentació

Enviar només a:
- Membres amb etiqueta específica (ex: només PRIMERES)
- Membres confirmats/pendents
- Membres amb X% assistència
- Per regió/grup

---

## 🎨 Consideracions Especials pel Mòdul Figures

### Standalone Development

El mòdul Figures es pot desenvolupar completament independent:

```javascript
// Mock data per treballar sense backend
const mockPersones = [
  { id: 1, nom: 'Joan', alcada: 180, etiquetes: ['PRIMERES', 'LATERALS'] },
  { id: 2, nom: 'Maria', alcada: 165, etiquetes: ['PRIMERES'] },
  // ...
];

// localStorage per guardar plantilles
localStorage.setItem('figures_templates', JSON.stringify(templates));
```

### Integració Futura

Quan el backend estigui llest:

```typescript
// 1. Importar persones
const persones = await fetch('/api/membres?actius=true&include=etiquetes');

// 2. Guardar plantilla
await fetch('/api/figures/templates', {
  method: 'POST',
  body: JSON.stringify(plantillaFigura)
});

// 3. Assignar a esdeveniment
await fetch('/api/esdeveniments/{id}/figures', {
  method: 'POST',
  body: JSON.stringify({
    figura_template_id: 'uuid',
    posicionament: { ... }
  })
});
```

### Format Exportació Plantilla

```json
{
  "version": "1.0",
  "plantilla": {
    "nom": "Micalet",
    "tipus": "tronc_sol",
    "estructura": {
      "tronc": {
        "nivells": [
          {
            "ordre": 1,
            "posicions": [
              {
                "id": "p1",
                "coordenades": { "x": 100, "y": 200, "z": 0 },
                "etiquetes_requerides": ["PRIMERES"],
                "alcada_maxima": null
              }
            ]
          }
        ]
      },
      "pinya": null,
      "xicalla": { "posicions": 1, "alcada_maxima": 150 }
    },
    "validacions": {
      "alcades": true,
      "etiquetes": true
    }
  }
}
```

---

## 🗄️ Model de Dades Simplificat

### Entitats Principals

```
Users (autenticació)
  ├── Membres (perfils)
  │     ├── EtiquetesPosicio (M:N)
  │     ├── Dispositius (tokens FCM)
  │     └── Assistencies
  │
  ├── Esdeveniments
  │     ├── Assistencies
  │     └── FiguresEsdeveniment
  │
  ├── Figures (plantilles)
  │     ├── Posicions
  │     └── FiguresEsdeveniment
  │
  └── Noticies
```

### Schema Bàsic (Prisma exemple)

```prisma
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  password  String
  rol       Rol      @default(MEMBRE)
  membre    Membre?
}

model Membre {
  id              String   @id @default(uuid())
  userId          String   @unique
  user            User     @relation(fields: [userId], references: [id])
  nom             String
  cognoms         String
  alcadaEspatlles Int
  esXicalla       Boolean  @default(false)
  actiu           Boolean  @default(true)
  
  etiquetes       EtiquetaPosicio[]
  assistencies    Assistencia[]
  dispositius     Dispositiu[]
}

model Esdeveniment {
  id          String   @id @default(uuid())
  nom         String
  tipus       TipusEsdeveniment
  dataHora    DateTime
  lloc        String
  coordenades Json?    // { lat, lng } per geolocalització
  
  assistencies Assistencia[]
  figures      FiguraEsdeveniment[]
}

model Assistencia {
  id              String   @id @default(uuid())
  membreId        String
  esdevenimentId  String
  estat           EstatAssistencia  @default(PENDENT)
  
  // Timestamps
  resposaAt       DateTime?  // Quan va indicar "Puc anar" o "No vaig"
  checkInAt       DateTime?  // Quan va fer check-in (arribada real)
  
  membre          Membre       @relation(fields: [membreId], references: [id])
  esdeveniment    Esdeveniment @relation(fields: [esdevenimentId], references: [id])
  
  @@unique([membreId, esdevenimentId])
}

enum EstatAssistencia {
  PENDENT       // No ha respost encara
  PUC_ANAR      // Ha indicat que vindrà
  NO_VAIG       // Ha indicat que NO vindrà (sense justificació)
  CHECK_IN      // Ha fet check-in (ha arribat)
  ASSISTIT      // Va assistir (check-in completat, esdeveniment finalitzat)
  NO_PRESENTAT  // Va dir "Puc anar" però no va fer check-in
}

enum Rol {
  ADMIN
  TECNICA
  JUNTA
  MEMBRE
}
```

---

## 🚀 Pla de Desenvolupament

### Fase 1: Setup i Backend Core (Sprint 1-2)
```
- Setup repos (mono-repo o multi-repo)
- CI/CD (GitHub Actions)
- Docker + docker-compose
- NestJS base + Auth (JWT)
- PostgreSQL + Prisma
- Tests unitaris basics
```

### Fase 2: CRUD Básic (Sprint 3-4)
```
- Gestió Usuaris/Membres
- CRUD Esdeveniments
- Sistema Assistència bàsic
- Dashboard web amb MUI
```

### Fase 3: PWA Mobile (Sprint 5-6)
```
- Setup PWA amb Vite
- Confirmar assistència
- Check-in (QR + Geo)
- Offline mode (IndexedDB)
- Notificacions FCM
```

### Fase 4: Mòdul Figures (Paral·lel, Equip Separat)
```
- Editor Canvas (Konva.js)
- Crear plantilles
- Validacions bàsiques
- Component <FiguraViewer /> reutilitzable ⭐
- Exportació PNG/JSON
- Integració amb API
```

### Fase 4.5: Vista Projecció Figures (Sprint 6-7)
```
- Component FiguraViewer adaptat a projecció
- Mode fullscreen per pantalla gran
- Responsive design (mobile + desktop + TV)
- Highlight posició pròpia (PWA)
- Navegació entre figures
- Keyboard shortcuts
- Integració a Dashboard i PWA
```

### Fase 5: Features Avançades (Sprint 7-8)
```
- Reports i analytics
- Notícies
- Preferències notificacions
- WebSocket per actualització temps real figures (opcional)
- Refinaments UX
```

---

## 🧪 Testing Strategy

```yaml
Backend:
  Unit: Jest + Supertest
  E2E: Jest + Supertest
  Coverage: > 80%

Frontend:
  Unit/Integration: Vitest + Testing Library
  E2E: Playwright
  Visual: Storybook (opcional)

Canvas Module:
  Unit: Vitest
  Snapshot: Konva canvas snapshots
```

---

## 📦 Deployment

### Opcions Hosting

#### Backend + BBDD
1. **Railway** (Recomanat MVP)
   - Deploy automàtic des de GitHub
   - PostgreSQL + Redis inclòs
   - ~$10-20/mes

2. **Render**
   - Similar a Railway
   - Free tier disponible

3. **AWS (Futur)**
   - ECS + RDS
   - Més control però més complex

#### Frontend (Dashboard)
1. **Vercel** (Recomanat) ⭐
   - Deploy automàtic
   - CDN global
   - Free tier generós

2. **Netlify**
   - Similar a Vercel

#### PWA
- **Vercel** també (same build)
- CDN per service worker

---

## 🔐 Seguretat i OpenSource

### Per què OpenSource?

**Motivació Principal:** L'aplicació actual NO és nostra. No som propietaris del codi i no podem evolucionar-la al nostre parer.

**Amb aquest projecte OpenSource:**

✅ **Propietat i Control**
- Codi 100% nostre
- Decidim el roadmap
- No dependem de tercers
- Podem fer fork si cal

✅ **Transparència amb la Colla**
- Tothom pot veure què fa l'app
- Decisions tècniques obertes
- Contribucions de la comunitat
- Confiança i col·laboració

✅ **Sostenibilitat**
- Si un desenvolupador marxa, altres poden continuar
- Documentació oberta per nous desenvolupadors
- Comunitat pot ajudar a mantenir
- No hi ha vendor lock-in

✅ **Beneficis per Altres Colles**
- Altres muixerangues poden usar-la
- Compartim esforços de desenvolupament
- Millora col·lectiva del projecte

### Consideracions OpenSource

```yaml
Llicència: MIT (més permissiva) o GPL-3.0 (copyleft)
Repository: GitHub público
Secrets: .env files (NEVER commit)
Demo: Omplir amb dades fake (Faker.js)
Docs: README complet + Contributing.md + Code of Conduct
Issues: GitHub Issues + templates + labels
CI/CD: Públic (GitHub Actions)
Releases: Semantic Versioning (v1.0.0, v1.1.0...)
```

### Variables d'Entorn

```env
# Backend .env
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=<generar aleatori>
JWT_EXPIRATION=7d
FCM_PROJECT_ID=...
FCM_PRIVATE_KEY=...

# Frontend .env
VITE_API_URL=http://localhost:3000
VITE_FCM_VAPID_KEY=...
```

### Seguretat Backend

- Passwords: bcrypt cost 12
- Rate limiting: 100 req/15min per IP
- CORS: Només origins coneguts
- Helmet.js per headers seguretat
- SQL Injection: Prisma protegeig automàticament
- XSS: Sanitizar inputs amb class-validator

---

## 📊 Monitorització

```yaml
Errors: Sentry (free tier)
Logs: Pino logger + Loki (opcional)
Uptime: UptimeRobot (free tier)
Analytics: Plausible o Umami (OpenSource)
```

---

## 🤝 Workflow Equip

### Branching Strategy

```
main (producció)
  ├── develop (integració)
  │     ├── feature/auth-login
  │     ├── feature/events-crud
  │     └── feature/canvas-editor
  └── hotfix/... (si cal)
```

### Commits

```bash
feat: afegir login amb JWT
fix: corregir validació alçades
docs: actualitzar README
refactor: simplificar service assistència
test: afegir tests unitaris membres
```

### Pull Requests

- Mínim 1 aprovació
- CI passa (tests + lint)
- Squash merge a develop

---

## ❓ Decisions a Prendre per l'Equip

### 1. Base de Dades
- [ ] PostgreSQL (recomanada)
- [ ] PostgreSQL + JSONB
- [ ] MongoDB + PostgreSQL

### 2. Frontend Framework
- [ ] React + Vite (recomanada per ecosistema i flexibilitat)
- [ ] Angular 17+ (recomanada si l'equip té experiència Angular)
- [ ] Next.js (si necessitem SSR)

### 3. Frontend UI Library
- [ ] Material-UI (React - recomanada)
- [ ] Ant Design (React)
- [ ] Angular Material (Angular - inclosa)
- [ ] Shadcn/ui (React/Next)

### 4. State Management
**Si React:**
- [ ] Zustand (simple i modern)
- [ ] Redux Toolkit (complex però molt testat)
- [ ] Context API (molt simple, built-in)

**Si Angular:**
- [ ] RxJS + Signals (natiu Angular 17+, recomanat)
- [ ] NgRx (Redux-like per Angular, per apps molt complexes)

### 5. Canvas Library
- [ ] Konva.js + react-konva / ng-wrapper (recomanada - millor performance)
- [ ] Fabric.js (més features out-of-box però menys performant)
- [ ] React Flow (si volem flowchart-style, menys flexible)

### 6. Monorepo vs Multi-repo
- [ ] Monorepo (Nx o Turborepo - compartir codi fàcilment)
- [ ] Multi-repo (repos separats - més independència)

### 7. App Mòbil ⭐ DECISIÓ CRÍTICA

**Opció A (Recomanada MVP):**
- [x] **PWA Pura (RECOMANADA ⭐⭐⭐)**
  - Cost: €0 llicències
  - Temps: 100% (1 codebase web)
  - Updates: Instantanis
  - Manteniment: Baix
  - APIs: Web APIs suficients per nosaltres
  - Stores: No (Add to Home Screen)
  - **Millor per començar ràpid i validar**

**Opció B (Terme Mitjà):**
- [ ] **Ionic + Capacitor (A VALORAR ⭐⭐)**
  - Cost: €0 (web) o €99/any (si stores)
  - Temps: 110-120% (1 codebase + config nativa)
  - Updates: Instantanis (web) / 1-7 dies (stores)
  - Manteniment: Mitjà
  - APIs: Natives via Capacitor (més robustes)
  - Stores: Opcional (porta oberta futur)
  - **Millor si voleu flexibilitat futura**
  
**Opció C (NO recomanada):**
- [ ] React Native / Flutter
  - Cost: €99/any
  - Temps: 150%
  - Updates: 1-7 dies approval
  - Manteniment: Mitjà
  - **Només si stores és obligatori des de dia 1**
  
**Opció D (NO recomanada):**
- [ ] Apps Natives (iOS Swift + Android Kotlin)
  - Cost: €99/any + molt més temps
  - Temps: 250%
  - Updates: 1-7 dies
  - Manteniment: Alt (3 codebases)
  - **NO recomanat per projecte OpenSource**

**Estratègia recomanada:**
1. Començar amb **PWA Pura** (més simple, ràpid, €0)
2. Si als 6 mesos necessitem stores → Migrar a **Ionic** (migració relativament fàcil)
3. Ionic ens dona porta oberta sense comprometre'ns des del principi

### 8. Testing
- [ ] Coverage mínim 80%
- [ ] Coverage mínim 60%
- [ ] E2E obligatori antes de merge

---

## 📝 Pròxims Passos Immediats

### ⚡ Decisions Clau a Prendre Primer

Abans de començar, cal decidir:

1. **Frontend Framework**: React o Angular?
   - React: Ecosistema més gran, més flexible, més recursos online
   - Angular: Tot inclòs, millor si equip amb experiència Angular, sintaxi similar NestJS
   
2. **App Mòbil**: PWA, Ionic o híbrid?
   - **PWA Pura** (recomanada ⭐⭐⭐): Més simple, €0, updates instantanis
   - **Ionic + Capacitor** (terme mitjà ⭐⭐): APIs natives, porta oberta stores
   - React Native / Nativa: NO recomanat (massa cost/complexitat)
   
   **Recomanació:** Començar amb PWA, avaluar Ionic als 6 mesos si cal

3. **BBDD**: PostgreSQL simple o PostgreSQL + JSONB?

### ✅ Tasques Immediates

1. **Reunió Kickoff**: Decidir stack (1-2h)
   - Votar: React vs Angular
   - Confirmar: PWA (ja recomanada)
   - Decidir: Monorepo vs Multi-repo
   
2. **Setup Repos**: Crear estructura (1 dia)
3. **Setup CI/CD**: GitHub Actions (0.5 dia)
4. **Tasques Inicials Paral·leles**:
   - Backend: Auth + Users + DB Schema
   - Frontend: Login + layout base + routing
   - Figures: Research Konva + POC canvas + component reutilitzable
   - Mobile: Setup PWA + Service Worker + FCM
   - Vista Projecció: Dissenyar component compartit (Dashboard + PWA)

---

## 📞 Contacte

**Product Owner:** Llorenç Vaquer Gregori  
**Colla:** Muixeranga de Barcelona  
**GitHub:** (enllaç quan estigui públic)  
**Documentació:** `/docs/prd/`

---

## 📚 Referències

### Backend
- [NestJS Docs](https://docs.nestjs.com)
- [Prisma Docs](https://www.prisma.io/docs)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [Redis Docs](https://redis.io/docs/)

### Frontend - React
- [React Docs](https://react.dev)
- [Vite Docs](https://vitejs.dev)
- [Material-UI (MUI)](https://mui.com)
- [React Query (TanStack)](https://tanstack.com/query)
- [Zustand](https://github.com/pmndrs/zustand)
- [React Hook Form](https://react-hook-form.com)

### Frontend - Angular
- [Angular Docs](https://angular.dev)
- [Angular Material](https://material.angular.io)
- [RxJS Docs](https://rxjs.dev)
- [Angular Signals](https://angular.dev/guide/signals)

### Canvas & Charts
- [Konva.js](https://konvajs.org)
- [react-konva](https://konvajs.org/docs/react/)
- [Recharts](https://recharts.org)

### Mobile & PWA
- [Vite PWA Plugin](https://vite-pwa-org.netlify.app)
- [Angular PWA](https://angular.io/guide/service-worker-getting-started)
- [FCM Setup](https://firebase.google.com/docs/cloud-messaging)
- [Web APIs (Camera, GPS)](https://developer.mozilla.org/en-US/docs/Web/API)

### DevOps
- [Docker Docs](https://docs.docker.com)
- [GitHub Actions](https://docs.github.com/en/actions)

---

**Bona feina equip! 💪 Fem aquesta app molt bona i útil per la colla.**
