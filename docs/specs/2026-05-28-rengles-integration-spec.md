# Rengles Integration — Especificació d'Arquitectura Unificada

> Data: 28 de maig de 2026
> Estat: Especificació pre-implementació (antesala dels plans)
> Branques avaluades:
> - `story/deploy-server-pre` (nosaltres): P5.1 → P5.10
> - `feat/modul_pinyes_rengles` (Ferran): P5.1 → P5.3 + rengles + cordons dinàmics

---

## Índex

1. [Resum executiu](#1-resum-executiu)
2. [Anàlisi comparativa](#2-anàlisi-comparativa)
3. [Concepte de rengla — definició formal](#3-concepte-de-rengla--definició-formal)
4. [Avaluació: Famílies vs Rengles dinàmiques](#4-avaluació-famílies-vs-rengles-dinàmiques)
5. [Model de dades unificat proposat](#5-model-de-dades-unificat-proposat)
6. [Cordó obert — integració al model de rengles](#6-cordó-obert--integració-al-model-de-rengles)
7. [UX de creació de nodes — Ghost clone](#7-ux-de-creació-de-nodes--ghost-clone)
8. [Editor de rengles — disseny d'interfície](#8-editor-de-rengles--disseny-dinterfície)
9. [Selector de cordons a l'assignació](#9-selector-de-cordons-a-lassignació)
10. [Impacte sobre funcionalitats existents](#10-impacte-sobre-funcionalitats-existents)
11. [Estratègia de migració](#11-estratègia-de-migració)
12. [Decisions arquitecturals (tancades)](#12-decisions-arquitecturals-tancades)
13. [Fases d'implementació](#13-fases-dimplementació)
14. [Glossari de termes](#14-glossari-de-termes)

---

## 1. Resum executiu

Existeixen dues implementacions paral·leles del mòdul de Pinyes. La nostra branca (`story/deploy-server-pre`) té una arquitectura robusta amb famílies, variants, snapshot immutable, upgrade de cordons, projecció i composicions. La branca de Ferran (`feat/modul_pinyes_rengles`) aporta un concepte nou i valuós: les **rengles** — la línia radial de posicions que va del centre de la pinya cap enfora — i un **selector dinàmic de cordons** a l'assignació, que elimina la necessitat de templates separats per cordó.

**Proposta central**: Integrar les rengles com a primera classe dins del nostre model actual, afegint `renglaId` i `renglaPosition` als nodes. Això permetrà:

- **Un sol template per figura** amb totes les posicions de tots els cordons
- **Selecció de cordons a l'assignació** (dinàmica, sense variants)
- **Simplificació de la UX de creació de templates** (clonació de nodes, creació automàtica de rengles)
- **Manteniment de la infraestructura de snapshot, upgrade i projecció**
- **Possible eliminació de les famílies** per agrupar variants de pinya, reutilitzant-les com a agrupador lògic opcional

---

## 2. Anàlisi comparativa

### 2.1 Comparació d'entitats

| Concepte | Nosaltres (`story/deploy-server-pre`) | Ferran (`feat/modul_pinyes_rengles`) |
|----------|--------------------------------------|--------------------------------------|
| **Agrupació de figures** | `FigureFamily` → N `FigureTemplate` (variants per cordó) | No existeix. 1 template = 1 figura completa |
| **Variants per cordó** | Templates separats (1C, 2C, 3C) amb `variantOrder` | Tots els nodes en 1 template; `renglaPosition` determina el cordó |
| **Nodes de template** | `FigureNode` (PINYA) + `FigureFamilyNode` (TRONC/BASE compartit) | `FigureNode` (totes les zones, sense compartir) |
| **Llinatge de nodes** | `originNodeId` traces fins al node arrel de la variant 1 | No existeix |
| **Rengles** | No existeix. `ringLevel` (1, 2, 3) identifica el cordó | `rengla: string` + `renglaPosition: number` |
| **Cordó obert** | `positionType: 'cordo-obert'` amb `ringLevel: null` | Últim node d'una rengla, marcat dinàmicament com ELLIPSE |
| **Snapshot** | `InstanceNode` (còpia immutable de `FigureNode`) | No existeix. `NodeAssignment` → directament `FigureNode` |
| **Upgrade** | `POST /instances/:id/upgrade` → afegeix nodes de la variant N+1 | No existeix. Canvi de cordons és visual (filtre) |
| **Selecció de cordons** | Implicit: tries el template de la variant desitjada | `numberOfCordons` + `openCordons` a `FigureInstance` |
| **Projecció** | Grid CSS fullscreen, panells tronc flotants, vista per figura | No implementat |
| **Composicions** | `CompositionTemplate` + `CompositionSlot` | Implementat (P5.2 bàsic) |
| **Import massiu** | Bulk import amb `sourceNodeId` matching | No implementat |
| **Lock d'assignació** | `ASSIGNMENT_LOCK_DAYS` amb 403 | No implementat |
| **Editor visual de rengles** | No existeix | `RenglaOverlayComponent` (SVG, 431 línies) |
| **Diàleg de cordons** | No existeix | Modal amb selector numèric + toggle cordó obert per tipus |

### 2.2 Estat actual de la BBDD (branca nostra)

| Dada | Valor |
|------|-------|
| Famílies | 5 (Alta de 5, Pilotó, Pinet doble, Roscana, Torreta) |
| Templates | 8 (3 de Pinet doble: 1C/2C/3C; 2 de Roscana: 1C/2C; resta 1C) |
| Nodes de template (`figure_nodes`) | ~132 (PINYA, amb ringLevel 1/2/3 + cordo-obert) |
| Nodes compartits (`figure_family_nodes`) | ~34 (TRONC/BASE) |
| Instàncies | 9 (5 snapshotted, 4 no) |
| Instance nodes | 146 |
| Assignacions | 99 |

### 2.3 Què aporta cada branca

**Ferran aporta (i nosaltres no tenim):**
- Concepte de **rengla** com a primitiva de domini
- **Editor visual de rengles** amb overlay SVG, numeració, línies de connexió
- **Selector dinàmic de cordons** a l'assignació (no cal triar variant)
- **Cordó obert configurable per rengla** a l'assignació

**Nosaltres aportem (i Ferran no té):**
- **Famílies + variants** amb `variantOrder` i `originNodeId` per llinatge
- **FigureFamilyNode** — tronc/base compartit entre variants
- **Lazy snapshot** → `InstanceNode` → assignacions immutables
- **Upgrade de cordó** (afegir nodes de la variant superior sense perdre assignacions)
- **Projecció** fullscreen amb grid, panells tronc, vista individual
- **Bulk import** amb remapeig per `sourceNodeId`
- **Assignment lock** temporal
- **Soft position matching** (persona → posició preferent)
- Moltes millores de UX: auto-advance, optimistic UI, swap, keyboard shortcuts

---

## 3. Concepte de rengla — definició formal

### Què és una rengla?

Una **rengla** és una seqüència ordenada de nodes de pinya que parteixen des del centre de la figura cap enfora, formant una línia radial. Cada posició dins la rengla correspon a un **cordó** diferent.

```
                          Cordó 3    Cordó 2    Cordó 1    Centre
                            ↓          ↓          ↓         ↓
  Rengla "Mans Nord":   [MANS·3] → [MANS·2] → [MANS·1] → [CROSSA]
  Rengla "Vents Est":   [VENTS·3]→ [VENTS·2]→ [VENTS·1]→ [AGULLA]
  Rengla "Lat. NE":     [LAT·3] → [LAT·2] → [LAT·1]  → ·
  Rengla "CO Nord":     [C.O.]  →    ·     →    ·      → ·
```

### Nomenclatura de posicions dins d'una rengla

| Posició (renglaPosition) | Nom tècnic | Descripció |
|--------------------------|------------|------------|
| 1 | Primeres mans / Primers vents / Primers laterals | Posicions del primer cordó |
| 2 | Segones mans / Segons vents / Segons laterals | Posicions del segon cordó |
| 3 | Terceres mans / Tercers vents / Tercers laterals | Posicions del tercer cordó |
| N+1 (opcional) | Cordó obert | Persona que vigila la figura per darrere |

### Relació amb `ringLevel`

El camp `ringLevel` actual identifica exactament el mateix concepte que `renglaPosition`: el cordó al qual pertany un node. La diferència és que `ringLevel` és un atribut individual de cada node, mentre que **rengla** afegeix la dimensió de **quins nodes formen una línia radial junts**.

```
ringLevel = 1  →  renglaPosition = 1  (primer cordó)
ringLevel = 2  →  renglaPosition = 2  (segon cordó)
ringLevel = 3  →  renglaPosition = 3  (tercer cordó)
```

### Nodes sense rengla

Alguns nodes no pertanyen a cap rengla:
- **Agulla**: centre de la pinya (no es repeteix per cordons)
- **Crossa**: centre de la pinya (no es repeteix)
- **Contrafort**: centre de la pinya (no es repeteix)
- **Tap**: posició fixa
- **Direccions** (FIGURE_DIRECTION, XICALLA_DIRECTION): marcadors, no persones

Aquests nodes sempre es mostren independentment del nombre de cordons seleccionat.

### Nodes que comencen a un cordó superior

Algunes posicions només apareixen quan la figura té 3+ cordons (per exemple, laterals extra a figures grans). Per a això, una rengla pot tenir el seu `startPosition > 1`. Exemple:

```
Rengla "Lat. extra NW":  startPosition = 3
  → renglaPosition 3: [LAT·3]  (només apareix a partir del 3r cordó)
```

---

## 4. Avaluació: Famílies vs Rengles dinàmiques

### 4.1 El problema que resolien les famílies

Les famílies van néixer per gestionar que una mateixa figura (p.e. "Pinet doble") pot fer-se amb 1, 2 o 3 cordons. Cada variant era un template amb nodes de pinya diferent. Això permetia:

1. **Upgrade de cordó**: afegir nodes d'un cordó extra a una instància ja assignada
2. **Llinatge de nodes** (`originNodeId`): traçar quin node del cordó 2 correspon a quin del cordó 1
3. **Tronc compartit**: `FigureFamilyNode` per no duplicar la torre

### 4.2 El que les rengles fan millor

Amb rengles, **tots els nodes de tots els cordons existeixen en un sol template**. El cordó visible es tria a l'assignació. Avantatges:

| Aspecte | Famílies + variants | Rengles dinàmiques |
|---------|--------------------|--------------------|
| **Templates a crear** | 3 per una figura de 3 cordons | 1 sol |
| **UX de creació** | Crear 3 templates, derivar, mantenir sincronitzats | Crear 1 template, definir rengles |
| **Afegir cordó a l'assignació** | Operació `upgrade` (backend, irreversible en instància) | Canvi visual instantani (frontend, reversible) |
| **Consistència pinya** | Risc de divergència entre variants | Un sol conjunt de nodes, sempre coherent |
| **Coordinats nodals** | Cada variant posiciona els seus nodes | Totes les posicions en un sol canvas |
| **Llinatge cross-variant** | `originNodeId` complex, errors de matching possibles | No necessari: tot és un sol template |

### 4.3 El que les famílies segueixen fent bé

| Aspecte | Valor |
|---------|-------|
| **Agrupació lògica** | "Pinet doble" com a concepte, no com a template |
| **Tronc compartit** | `FigureFamilyNode` evita duplicació |
| **Metadades de família** | Descripció, slug, branding futur |
| **Multi-tenant futur** | `collaId` a nivell de família |

### 4.4 Decisió proposada

**Les famílies es mantenen com a agrupador lògic opcional**, però **les variants per cordó desapareixen**. Cada família tindrà **un sol template** (o un molt reduït nombre per raons excepcionals, com figures amb forma diferent per cordó).

La funció que feien les variants (1C, 2C, 3C) passa a ser responsabilitat de les **rengles + selector de cordons**.

```
ABANS:
  FigureFamily "Pinet doble"
    ├── FigureTemplate "PD4 — 1C" (12 nodes PINYA)
    ├── FigureTemplate "PD4 — 2C" (24 nodes PINYA)
    └── FigureTemplate "PD4 — 3C" (32 nodes PINYA + 4 cordó obert)

DESPRÉS:
  FigureFamily "Pinet doble"   ← agrupador lògic, metadades, tronc compartit
    └── FigureTemplate "PD4"    ← UN sol template amb 32+4 nodes PINYA
         ├── 8 rengles principals (mans, vents, laterals × 4)
         │    cadascuna amb 3 posicions (renglaPosition 1, 2, 3)
         ├── 4 rengles de cordó obert (1 posició cadascuna)
         └── 4 nodes centre (agulla, crosses, contrafort) → sense rengla
```

### 4.5 Implicacions

| Impacte | Detall |
|---------|--------|
| **`variantOrder`** | Manté sentit si mai hi ha 2+ templates per família per raons excepcionals, però per defecte = 1 |
| **`originNodeId`** | Ja no és necessari per matching de cordons (tot està en un template). Pot mantenir-se per compatibilitat |
| **Upgrade** | Es reconverteix: de "afegir nodes d'una variant superior" a "incrementar `numberOfCordons` a la instància" |
| **Derivació** | Desapareix com a workflow habitual. Es manté `duplicate` per copiar templates sencers |
| **Seeds** | S'unifiquen: un sol template per família amb tots els nodes |
| **Llista de pinyes** | Tab "Famílies" segueix mostrant famílies, però cada una té normalment 1 variant |

---

## 5. Model de dades unificat proposat

### 5.1 Canvis a `FigureNode`

```typescript
@Entity('figure_nodes')
export class FigureNode {
  // ... camps existents ...

  @Column({ type: 'int', nullable: true })
  ringLevel: number | null;           // ES MANTÉ — compatibilitat i semàntica de cordó

  @Column({ type: 'uuid', nullable: true })
  originNodeId: string | null;        // ES MANTÉ — compatibilitat, ús futur

  // ── NOUS CAMPS ──

  @Column({ type: 'uuid', nullable: true })
  renglaId: string | null;            // ID de la rengla a la qual pertany (NULL = node lliure)

  @Column({ type: 'int', nullable: true })
  renglaPosition: number | null;      // Posició dins la rengla (1 = primer cordó, 2 = segon, ...)
}
```

### 5.2 Nova entitat `Rengla`

Opció A (evaluada i **descartada**): string lliure com Ferran.
Opció B (**proposada**): entitat separada per a integritat i UI.

```typescript
@Entity('rengles')
export class Rengla {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => FigureTemplate, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn()
  template: FigureTemplate;

  @Column({ type: 'varchar' })
  name: string;                       // "Mans Nord", "Vents Est", "Laterals NE"

  @Column({ type: 'int', default: 0 })
  sortOrder: number;                  // Ordre visual al llistat de rengles

  @Column({ type: 'int', default: 1 })
  startPosition: number;              // Primer cordó on apareix (1 = apareix sempre, 3 = només des del 3r)

  @Column({ type: 'boolean', default: false })
  allowsCordoObert: boolean;          // Si aquesta rengla pot tenir cordó obert al final

  @CreateDateColumn()
  createdAt: Date;
}
```

**Per què entitat separada i no string lliure?**

1. **`startPosition`**: no es pot emmagatzemar a un string; cal una entitat per guardar configuració per rengla
2. **`allowsCordoObert`**: configuració per rengla de si el cordó obert és possible
3. **`sortOrder`**: ordre de rengles per a la UI del selector de cordons
4. **Integritat referencial**: `renglaId` és FK, evita rengles orfes
5. **UI del llistat de rengles**: permet listar/editar rengles com objectes

### 5.3 Relació `ringLevel` ↔ `renglaPosition`

Aquests dos camps estan relacionats però no són redundants:

| Camp | Àmbit | Propòsit |
|------|-------|----------|
| `ringLevel` | Global al template | "En quin cordó concèntric estic?" — usat per visualització al canvas |
| `renglaPosition` | Dins d'una rengla | "Quina posició tinc dins la meva línia radial?" |

En la majoria de casos, `ringLevel === renglaPosition`. Però `ringLevel` segueix sent útil per:
- Nodes sense rengla (agulla, crossa) que tenen `ringLevel = null`
- Cordó obert: `ringLevel = null`, `renglaPosition = MAX+1`
- Lògica visual de renderització concèntrica al canvas

**Invariant**: Per a un node dins d'una rengla amb `renglaPosition = P` i sense cordó obert: `ringLevel = rengla.startPosition + P - 1`.

### 5.4 Canvis a `InstanceNode`

```typescript
@Entity('instance_nodes')
export class InstanceNode {
  // ... camps existents ...

  // ── NOUS CAMPS (copiats en snapshot) ──

  @Column({ type: 'uuid', nullable: true })
  renglaId: string | null;

  @Column({ type: 'int', nullable: true })
  renglaPosition: number | null;
}
```

El snapshot copia `renglaId` i `renglaPosition` per a que la lògica de filtratge per cordons funcioni post-snapshot sense accedir al template.

### 5.5 Canvis a `FigureInstance`

```typescript
@Entity('figure_instances')
export class FigureInstance {
  // ... camps existents ...

  // ── NOUS CAMPS ──

  @Column({ type: 'int', nullable: true })
  numberOfCordons: number | null;     // Quants cordons es mostren (NULL = tots)

  @Column({ type: 'jsonb', nullable: true })
  openCordons: string[] | null;       // IDs de rengles amb cordó obert actiu
}
```

### 5.6 Diagrama de relacions actualitzat

```
FigureFamily
    │ 1:N (RESTRICT)
    ├──► FigureTemplate ──── 1:N (CASCADE) ────► FigureNode
    │         │                                       │
    │         │                                  renglaId → Rengla
    │         │                                  renglaPosition
    │         │                                  ringLevel
    │         │
    │         ├─── 1:N (CASCADE) ────► Rengla
    │         │         name, startPosition, allowsCordoObert
    │         │
    │         ├─ 1:N ────► FigureInstance
    │         │         numberOfCordons, openCordons
    │         │         snapshotted, sourceVariantOrder
    │         │         │
    │         │         ├─ 1:N ────► InstanceNode
    │         │         │                renglaId, renglaPosition
    │         │         │
    │         │         └─ 1:N ────► NodeAssignment → InstanceNode + Person
    │         │
    │         
    └──► FigureFamilyNode ─── zone: TRONC/BASE only (sense canvis)
```

### 5.7 Taula resum de canvis al model

| Entitat | Camp nou | Tipus | Nullable | Descripció |
|---------|----------|-------|----------|------------|
| `FigureNode` | `renglaId` | uuid FK | Sí | Referència a `Rengla` |
| `FigureNode` | `renglaPosition` | int | Sí | Posició dins la rengla |
| `InstanceNode` | `renglaId` | uuid (no FK) | Sí | Copiat del `FigureNode` al snapshot |
| `InstanceNode` | `renglaPosition` | int | Sí | Copiat del `FigureNode` al snapshot |
| `FigureInstance` | `numberOfCordons` | int | Sí | Cordons a mostrar |
| `FigureInstance` | `openCordons` | jsonb | Sí | IDs de rengles amb cordó obert |
| **Nova entitat** | `Rengla` | — | — | Definició d'una línia radial de nodes |

---

## 6. Cordó obert — integració al model de rengles

### 6.1 Estat actual

Avui el cordó obert és un node amb `positionType: 'cordo-obert'` i `ringLevel: null`. Es tracta com un node independent que sempre es mostra, independentment del nombre de cordons.

### 6.2 Problema

El cordó obert hauria de ser **opcional i configurable per rengla**, només visible quan la rengla té un cert nombre de cordons.

### 6.3 Solució proposada

1. **Al template**: els nodes de cordó obert **es mantenen com a nodes amb `positionType: 'cordo-obert'`** però s'assignen a una rengla i tenen `renglaPosition = MAX + 1` dins d'aquella rengla.

2. **La rengla** té `allowsCordoObert: boolean` per indicar si pot tenir cordó obert.

3. **A l'assignació**: el diàleg de cordons mostra un toggle per activar/desactivar el cordó obert per cada rengla (o per tipus de rengla). L'activació/desactivació es guarda a `FigureInstance.openCordons[]`.

4. **Filtratge de nodes visibles** (frontend):
```typescript
const visibleNodes = allNodes.filter(node => {
  if (!node.renglaId || node.renglaPosition === null) return true;
  
  const rengla = renglesMap.get(node.renglaId);
  const maxCordon = numberOfCordons ?? Infinity;
  
  // Node dins del rang de cordons visibles?
  if (node.renglaPosition > maxCordon) return false;
  
  // Node és cordó obert? Només si la rengla està a openCordons
  if (node.positionType === 'cordo-obert') {
    return openCordons?.includes(node.renglaId);
  }
  
  // Node fora del startPosition de la rengla?
  if (rengla && node.renglaPosition < rengla.startPosition) return false;
  
  return true;
});
```

### 6.4 Exemple visual

```
Configuració del template "Pinet doble":
  Rengla "Mans Nord" (startPosition=1, allowsCordoObert=true):
    pos 1: MANS [ringLevel=1]
    pos 2: MANS [ringLevel=2]
    pos 3: MANS [ringLevel=3]
    pos 4: CORDO OBERT [ringLevel=null, positionType=cordo-obert]

A l'assignació amb numberOfCordons=2, openCordons=["rengla-mans-nord-id"]:
  → Es mostren: MANS pos 1, MANS pos 2, CORDO OBERT pos 4 ✓
  → No es mostra: MANS pos 3 ✗

A l'assignació amb numberOfCordons=2, openCordons=[]:
  → Es mostren: MANS pos 1, MANS pos 2 ✓
  → No es mostren: MANS pos 3, CORDO OBERT ✗
```

---

## 7. UX de creació de nodes — Ghost clone

### 7.1 Problema actual

Crear nodes al template editor és tediós:
- Cada node apareix a `(200, 200) ± random 20px`
- Cal arrossegar-lo manualment a la posició correcta
- No hi ha alineació automàtica
- Crear rengles de 3+ nodes és feina repetitiva

### 7.2 Solució proposada: "Ghost clone"

Quan un node de pinya ja existeix al canvas, apareix una **zona clicable darrere** que permet crear un clon del node alineat automàticament.

**Mecànica visual:**

```
┌─────────┐   ┌ ─ ─ ─ ─ ─┐
│  MANS   │   ╎     +     ╎    ← Ghost node (borde discontinu, color apagat)
│         │   ╎           ╎
└─────────┘   └ ─ ─ ─ ─ ─┘
  Node real     Clone fantasma
```

**Comportament:**

1. **Visualització**: darrere de cada node de pinya que pertany a una rengla (o que podria pertànyer-hi), apareix un rectangle fantasma amb:
   - Borde discontinu (`stroke-dasharray`)
   - Color més apagat (opacitat 30-40%)
   - Un `+` centrat
   - Mides idèntiques al node original

2. **Posicionament**: el ghost node es posiciona automàticament **radialmente cap enfora** respecte al centre de la pinya:
   - Es calcula la direcció del node actual respecte al centre del canvas
   - El ghost es col·loca a una distància fixa (p.e. `node.width + gap`) en la mateixa direcció
   - Si el node ja forma part d'una rengla amb més d'un node, s'alinea en la mateixa línia radial

3. **Acció al clicar `+`**:
   - Es crea un nou `FigureNode` amb les mateixes propietats (positionType, color, shape, dimensions)
   - Es posiciona a la coordenada del ghost
   - S'assigna a la mateixa rengla del node pare, amb `renglaPosition = pare.renglaPosition + 1`
   - `ringLevel = pare.ringLevel + 1` (si el pare en tenia)
   - Label: incrementat (p.e. pare="MANS" → fill="MANS")
   - El nou ghost apareix darrere del nou node (chain)

4. **Nodes sense rengla**: per a nodes que encara no pertanyen a cap rengla, el ghost segueix apareixent. En clicar `+`, es crea la rengla automàticament amb el node pare com a posició 1 i el nou node com a posició 2.

### 7.3 Lógica de posicionament radial

```typescript
function calculateGhostPosition(
  node: FigureNodeItem,
  centerX: number,
  centerY: number,
  gap: number = 10
): { x: number; y: number } {
  const dx = node.x - centerX;
  const dy = node.y - centerY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  if (distance < 1) {
    return { x: node.x, y: node.y + node.height + gap };
  }
  
  const unitX = dx / distance;
  const unitY = dy / distance;
  const offset = Math.max(node.width, node.height) + gap;
  
  return {
    x: node.x + unitX * offset,
    y: node.y + unitY * offset,
  };
}
```

### 7.4 Modes del ghost clone

| Situació | Comportament |
|----------|-------------|
| Node sense rengla, sense ghost clicks previs | Ghost apareix en la direcció radial |
| Node dins d'una rengla | Ghost s'alinea amb la línia de la rengla |
| Últim node d'una rengla | Ghost apareix, clonar crea el següent cordó |
| Node amb `positionType: 'cordo-obert'` | No apareix ghost (cordó obert és terminal) |
| Nodes centrals (agulla, crossa, contrafort) | No apareix ghost (no formen rengles) |

### 7.5 Alternativa complementària: toolbar de creació ràpida

A més del ghost clone individual, es pot oferir una acció de **"Crear rengla completa"** des del toolbar:

1. L'usuari clica "Nova rengla" al toolbar
2. Selecciona el positionType (mans, vents, laterals)
3. Indica quants cordons (1-5)
4. El sistema crea N nodes alineats radialment des d'un punt de partida, ja assignats a una nova rengla

---

## 8. Editor de rengles — disseny d'interfície

### 8.1 Mode edició de rengles (adaptat de Ferran)

L'editor de rengles és un **mode del template editor** (no una pantalla separada). S'activa amb el botó "Edita rengles" a la topbar.

**Integració amb el nostre sistema:**

| Aspecte | Implementació de Ferran | Adaptació proposada |
|---------|------------------------|-------------------|
| **Overlay** | SVG separat sobre el canvas Konva | Mateixa estratègia: `RenglaOverlayComponent` SVG |
| **Creació de rengla** | Click seqüencial als nodes | Igual, però associat a l'entitat `Rengla` |
| **Finalització** | `Enter` o botó "Finalitzar" | Igual + modal per posar nom i `startPosition` |
| **Visualització** | Cercles amb número + línies | Igual + colors per rengla del `RENGLA_COLORS` |
| **Persistència** | `rengla: string` directament al node | Crea entitat `Rengla` + actualitza `renglaId`/`renglaPosition` als nodes |
| **Canvas mode** | Canvas en `readonly` durant edició rengles | Igual |

### 8.2 Flux de l'editor de rengles

```
1. Usuari clica "Edita rengles" → renglaEditMode = true
2. Canvas passa a mode readonly (no drag/resize)
3. Overlay SVG apareix amb els nodes PINYA visibles
4. Rengles ja definides es mostren amb línies + badges de color
5. Usuari clica nodes per crear nova rengla:
   a. Primer click: node 1 (posició 1 = primer cordó)
   b. Segon click: node 2 (posició 2 = segon cordó)
   c. N clicks: node N
   d. "Finalitzar" o Enter: obre mini-diàleg amb:
      - Nom de la rengla (auto-suggerit: "MANS 1", "VENTS 2"...)
      - startPosition (defecte: 1; canviable per rengles que comencen al 3r cordó)
      - allowsCordoObert: checkbox
6. Es crea la Rengla i s'assignen renglaId + renglaPosition als nodes seleccionats
7. Autosave del template (debounce habitual)
```

### 8.3 Gestió de rengles existents

- **Veure**: cada rengla definida es mostra amb color propi, línia discontínua entre nodes, badges amb posició
- **Editar**: clicar sobre una rengla seleccionada permet canviar nom, startPosition, allowsCordoObert
- **Eliminar**: botó "Suprimir rengla" → elimina la Rengla i posa `renglaId = null` als nodes afectats
- **Reordenar nodes dins la rengla**: arrossegar badges o usar fletxes amunt/avall

---

## 9. Selector de cordons a l'assignació

### 9.1 Disseny del diàleg (adaptat de Ferran)

Al canvas d'assignació, un botó "Cordons" obre un modal de configuració.

```
┌─────────────────────────────────────────┐
│  Configuració de cordons                │
├─────────────────────────────────────────┤
│                                         │
│  Cordons visibles:  [−]  2  [+]         │
│  (tots els cordons fins a posició 2)    │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  Cordó obert:                           │
│  ☑ Mans (4 rengles)                     │
│  ☐ Vents (2 rengles)                    │
│  ☐ Laterals (4 rengles)                 │
│  ☐ Tots                                 │
│                                         │
│           [Cancel·lar]  [Desar]         │
└─────────────────────────────────────────┘
```

### 9.2 Persistència de la configuració

La configuració de cordons es guarda a `FigureInstance`:
- `numberOfCordons: number | null` — NULL = tots
- `openCordons: string[] | null` — array de `renglaId`s

Endpoint: `PUT /events/:eventId/segments/:segmentId/instances/:instanceId`
Body: `{ numberOfCordons, openCordons }`

### 9.3 Impacte en el canvas

Quan l'usuari canvia el nombre de cordons:
1. El frontend recalcula `activeNodes` filtrant per `renglaPosition <= numberOfCordons`
2. El canvas Konva es re-renderitza amb els nodes visibles
3. Les assignacions existents a nodes ara invisibles **es mantenen** a la BBDD però no es mostren
4. Si l'usuari augmenta els cordons, les assignacions reapareixen

### 9.4 Relació amb l'upgrade actual

L'`upgrade` actual (afegir nodes d'una variant superior) es reconverteix:

| Operació | Abans (variants) | Després (rengles) |
|----------|------------------|--------------------|
| Augmentar cordons | `POST /instances/:id/upgrade` → crea nous InstanceNodes | Frontend: `numberOfCordons++` → nodes ja existents es fan visibles |
| Reduir cordons | No existia | Frontend: `numberOfCordons--` → nodes s'amaguen (assignacions es mantenen) |
| Snapshot | Copia nodes del template actiu | Copia TOTS els nodes (tots els cordons) |
| Nous nodes al canvas | Backend crea InstanceNodes nous | No cal: ja existien al snapshot |

**Benefici clau**: L'upgrade deixa de ser una operació de backend irreversible. Es converteix en un simple canvi de filtre visual, completament reversible.

---

## 10. Impacte sobre funcionalitats existents

### 10.1 Snapshot (lazy snapshot)

**Canvi**: El snapshot ara copia TOTS els nodes del template (tots els cordons), no només els de la variant activa.

**Impacte**: Més `InstanceNode`s per instància (p.e. 32 en lloc de 12 per un PD4), però simplifica la lògica (no cal upgrade posterior).

**Camps addicionals copiats**: `renglaId` (com a UUID pla, no FK) i `renglaPosition`.

### 10.2 Upgrade de cordó

**Canvi**: L'upgrade com a operació de backend **desapareix** en la seva forma actual. Es manté com a API per compatibilitat, però internament:
- Si `snapshotted = true`: simplement actualitza `numberOfCordons` a la instància
- Si `snapshotted = false`: no cal fer res, els nodes ja són visibles

**Codi que s'elimina/simplifica**: `upgradeInstance()` a `NodeAssignmentService`, matching per `originNodeId`.

### 10.3 Bulk import

**Canvi**: El matching entre instàncies per a bulk import ara és per `sourceNodeId` (que no canvia) + `renglaId` + `renglaPosition`. Molt més fiable que el matching per `originNodeId` cross-variant.

### 10.4 Projecció

**Canvi mínim**: La projecció ja renderitza els nodes del `InstanceNode`. Només cal afegir el filtratge per `numberOfCordons` de la instància per a mostrar els cordons correctes.

### 10.5 Composicions

**Sense canvi**: Les composicions referencien `FigureTemplate`, que ara tindrà tots els nodes. El `CompositionSlot` pot incloure `numberOfCordons` si cal.

### 10.6 Llista de templates / famílies

**Canvi UX**: El tab "Famílies" segueix existint. Cada família normalment tindrà 1 variant. El "node count" reflectirà tots els nodes (tots els cordons). Es pot afegir info de "X rengles definides".

### 10.7 TroncView / FigureFamilyNode

**Sense canvi**: El tronc i les bases segueixen compartits a nivell de família. Les rengles només apliquen a nodes PINYA.

### 10.8 Assignment lock

**Sense canvi**: El lock temporal segueix funcionant sobre `NodeAssignment`.

---

## 11. Estratègia d'integració

> **Decisió**: Es neteja completament la BBDD de figures. No hi ha dades a migrar — es comença de zero amb el model de rengles. Si la integració no encaixa, es pot fer rollback al model anterior (git revert) sense pèrdua de dades de producció.

### 11.1 Schema (TypeORM synchronize en dev)

1. Crear taula `rengles`
2. Afegir `renglaId`, `renglaPosition` a `figure_nodes`
3. Afegir `renglaId`, `renglaPosition` a `instance_nodes`
4. Afegir `numberOfCordons`, `openCordons` a `figure_instances`

TypeORM `synchronize: true` aplica tots els canvis automàticament en dev.

### 11.2 Canvis de codi per àrea

| Àrea | Acció |
|------|-------|
| **Entitats** | Afegir camps nous a FigureNode, InstanceNode, FigureInstance; crear Rengla |
| **FigureTemplateService** | Afegir CRUD de rengles dins del template update flow |
| **NodeAssignmentService.snapshotInstance** | Copiar renglaId/renglaPosition als InstanceNode |
| **NodeAssignmentService.upgradeInstance** | Simplificar: actualitzar `numberOfCordons` en lloc de crear nodes |
| **NodeAssignmentService.getInstanceNodes** | Afegir filtratge per `numberOfCordons` |
| **Frontend models** | Afegir interfícies Rengla, actualitzar FigureNodeItem |
| **TemplateEditorComponent** | Integrar RenglaOverlayComponent + ghost clone |
| **AssignmentCanvasComponent** | Afegir diàleg de cordons + filtratge `activeNodes` |
| **FigureCanvasComponent** | Renderitzar ghost clones en mode editor |

### 11.3 Retrocompatibilitat

- **API**: Els endpoints existents segueixen funcionant. `numberOfCordons = null` → mostra tots els nodes (comportament per defecte)
- **Rengles opcionals**: Fins que no es defineixen rengles, tot funciona com abans (nodes sense rengla sempre es mostren)
- **Rollback**: Si la integració no funciona, git revert + `docker:clean` + `docker:up` restaura l'estat anterior

---

## 12. Decisions arquitecturals (tancades)

Les cinc decisions obertes originals han quedat resoltes amb l'opció recomanada en cada cas.

### D1 — ✅ Eliminar variants de cordó, quedar-se amb la variant màxima

**Decisió**: Per a cada família, la variant màxima (p.e. 3C per al Pinet doble) passa a ser l'únic template. Les variants menors (1C, 2C) s'eliminen. Les instàncies que referencien variants menors s'actualitzen per apuntar a la variant màxima amb `numberOfCordons` equivalent. La Fase 2 inclou el script de migració idempotent.

**Justificació**: Les dades actuals són poques (99 assignacions, 9 instàncies, 5 famílies). El model net és la prioritat. La retrocompatibilitat es garanteix via `numberOfCordons`.

### D2 — ✅ Rengla com a entitat separada amb FK

**Decisió**: Entitat `Rengla` pròpia a la taula `rengles`, amb FK a `FigureTemplate`. Els nodes (`FigureNode`, `InstanceNode`) guarden `renglaId` com a UUID i `renglaPosition` com a enter.

**Justificació**: `startPosition` i `allowsCordoObert` necessiten un lloc estructurat. Els strings embeddats impedien validació, edició i llistat de rengles des de l'API.

### D3 — ✅ Ghost clone implementat a Konva (no SVG overlay)

**Decisió**: Els nodes fantasma del ghost clone es renderitzen com a grups Konva amb opacitat reduïda i shape en mode `stroke` discontinu dins de `FigureCanvasComponent`. L'overlay SVG es reserva exclusivament per a l'editor de rengles (anotacions, no nodes interactius).

**Justificació**: Els ghosts han de seguir el zoom/pan del stage i respectar el snap-to-grid. Un overlay SVG separat requeriria sincronització de coordenades amb Konva que duplicaria complexitat.

### D4 — ✅ Nodes centrals sense rengla (`renglaId = null`, sempre visibles)

**Decisió**: Agulla, crossa, contrafort, tap i els nodes de direcció queden amb `renglaId = null`. La regla de filtratge és: *un node sense rengla sempre es mostra, independentment de `numberOfCordons`*.

**Justificació**: Semànticament correcte — aquests nodes no formen part de cap línia radial. El filtratge `!node.renglaId || node.renglaPosition <= numberOfCordons` és trivial.

### D5 — ✅ Cordó obert: `renglaPosition = MAX+1`, identificat per `positionType: 'cordo-obert'`

**Decisió**: Un node de cordó obert pertany a la seva rengla amb `renglaPosition = (nombre_de_cordons_reals + 1)`. S'identifica per `positionType: 'cordo-obert'` (camp existent). La visibilitat depèn que `openCordons` inclogui el `renglaId` de la seva rengla.

**Justificació**: Evita afegir un camp booleà redundant. `positionType: 'cordo-obert'` ja porta la semàntica i permet el filtratge correcte sense camps nous.

---

## 13. Fases d'implementació

> **Nota**: La BBDD es neteja completament abans de començar. No hi ha dades a migrar — es comença de zero. Si la integració de rengles no encaixa, es pot fer rollback al model anterior sense pèrdua de dades.

La implementació es divideix en **5 fases** independents i lliurables. Cada fase té un abast ben delimitat que permet revisar i validar abans de continuar. F1 és prerequisit de la resta; F2-F4 poden iniciar-se en paral·lel un cop F1 és estable.

```
F1 Backend Core  →  F2 Editor Rengles
                ↓         ↓
           F3 Ghost Clone  F4 Cordons Assignació
                ↓         ↓
                F5 Projecció + Poliment
```

---

### F1 — Backend Core: entitats, schema i lògica de snapshot

**Objectiu**: Afegir els camps i l'entitat `Rengla` al backend sense trencar res. Zero canvis de UX. Al final d'aquesta fase el backend suporta rengles però cap template en té de definides.

**Abast backend**:
- Nova entitat `Rengla` (`rengles` table): `id`, `templateId`, `name`, `sortOrder`, `startPosition`, `allowsCordoObert`
- `FigureNode`: afegir `renglaId: string | null` (uuid, no FK strict), `renglaPosition: int | null`
- `FigureFamilyNode`: afegir `renglaId`, `renglaPosition` (per si en el futur les bases necessiten rengla; ara sempre `null`)
- `InstanceNode`: afegir `renglaId`, `renglaPosition` (copiats en snapshot)
- `FigureInstance`: afegir `numberOfCordons: int | null`, `openCordons: uuid[] | null`
- `FigureTemplateService`: CRUD de rengles dins del cicle de vida del template (`syncRengles()` al `PUT /figure-templates/:id`)
- `NodeAssignmentService.snapshotInstance()`: copiar `renglaId` + `renglaPosition` als `InstanceNode`
- `NodeAssignmentService.getInstanceNodes()`: afegir filtratge per `numberOfCordons` i `openCordons`
- `FigureInstanceService.update()`: acceptar `numberOfCordons` i `openCordons` al body
- DTOs actualitzats: `UpdateFigureTemplateDto`, `UpdateInstanceDto`, `FigureNodeDto`
- Tests unitaris i d'integració per a tota la lògica nova

**Abast frontend**: Cap canvi visible. Afegir camps nous als models TypeScript (`FigureNodeItem`, `FigureInstanceModel`, `RenglaModel`).

**Criteri de done**:
- `nx test api` passa
- `PUT /figure-templates/:id` amb payload que inclou `rengles: []` retorna 200
- `GET /node-assignments/instances/:id/nodes` amb `numberOfCordons = 2` filtra correctament (test manual amb Swagger)
- Cap endpoint existent trenca

---

### F2 — Editor de rengles: overlay visual al template editor

**Objectiu**: El Cap de Pinyes pot definir i editar rengles visualment sobre el canvas del template editor.

**Abast**:
- Port i adaptació de `RenglaOverlayComponent` de la branca de Ferran:
  - Adaptar al model d'entitat `Rengla` (IDs vs strings)
  - Inputs: `nodes: FigureNodeItem[]`, `rengles: RenglaModel[]`, `stageTransform`
  - Outputs: `renglaCreated`, `renglaUpdated`, `renglaDeleted`
- Integrar a `TemplateEditorComponent`:
  - Botó "Edita rengles" a la topbar (toggle `renglaEditMode()`)
  - En mode rengla: canvas Konva en `readonly`, overlay actiu
  - Sobre els nodes PINYA mostra: badge amb posició si el node ja té rengla, cercle d'acció si no
  - Seqüència de clicks → nova rengla en curs → Enter/Finalitzar → modal mini (nom, startPosition, allowsCordoObert)
  - Cancel amb Escape o botó
- Visualització de rengles definides: línies discontínues entre nodes, colors per rengla, badge amb `renglaPosition`
- Persistència: el `PUT /figure-templates/:id` ja inclou `rengles` al payload (F1); el save debounce existent funciona
- Gestió d'eliminació de rengla: posa `renglaId = null` als nodes afectats
- Tests del component (Vitest)

**Criteri de done**:
- Es pot crear una rengla amb 3 nodes en un template existent i guardar
- La rengla apareix visualitzada en tornar a obrir l'editor
- Eliminar una rengla no elimina els nodes, només les desassigna

---

### F3 — Ghost clone: creació de nodes per clonació radial

**Objectiu**: Crear nodes nous al template editor per clonació ràpida, alineats radialment darrere del node d'origen.

**Abast**:
- `FigureCanvasComponent` en mode `editor`:
  - Calcular el centroide de tots els nodes PINYA visibles (centre de la figura)
  - Per a cada node PINYA que **no** és `positionType: 'cordo-obert'` ni node central (agulla, crossa, contrafort, tap): renderitzar un grup Konva ghost darrere seu
  - Ghost: `Rect` o `Ellipse` del mateix tamany, `opacity: 0.25`, `dash: [6, 4]`, sense fill (stroke only), color del node pare, text `+` centrat
  - Posicionament radial: `calculateGhostPosition(node, centroid, gap=12)`
  - Click sobre ghost: emetre `(ghostCloneRequested)` output amb `{ sourceNode, targetPosition }`
- `TemplateEditorComponent`:
  - Rebre `(ghostCloneRequested)` i cridar `cloneNodeRadially(sourceNode, targetPosition)`
  - `cloneNodeRadially()`:
    - Crea nou `FigureNode` amb les propietats del node origen (positionType, color, shape, width, height)
    - Posiciona a `targetPosition`
    - Si el node origen té `renglaId`: afegir a la mateixa rengla amb `renglaPosition = origen.renglaPosition + 1`
    - Si el node origen no té `renglaId`: crear nova `Rengla` (nom auto-suggerit) i assignar origen com posició 1, nou node com posició 2
    - `ringLevel = origen.ringLevel + 1` (si el node origen en tenia)
    - Label igual al del node pare
  - Autosave debounce existent s'ocupa de persistir
- No mostrar ghosts quan `renglaEditMode() = true` (evitar confusió visual)
- Tests unitaris de `calculateGhostPosition()`

**Criteri de done**:
- Clicar `+` darrere d'un node MANS crea un nou node MANS alineat radialment i l'afegeix a la mateixa rengla (posició N+1)
- Clicar `+` darrere d'un node sense rengla crea el node i una nova rengla automàtica
- No apareix ghost per nodes centrals ni cordons oberts

---

### F4 — Selector de cordons a l'assignació

**Objectiu**: L'assignador pot triar quants cordons vol veure i si vol activar cordó obert per rengla, sense canviar de template.

**Abast**:
- `AssignmentCanvasComponent`:
  - Botó "Cordons" a la topbar (quan hi ha instància activa)
  - `CordonsDialogComponent` (modal inline): selector numèric `numberOfCordons` + llista de rengles amb `allowsCordoObert = true` amb toggle per activar/desactivar
  - `activeNodes` computed: `allNodes.filter(node => isNodeVisible(node, numberOfCordons, openCordons))`
  - Lògica de `isNodeVisible()`:
    ```
    if (!node.renglaId) return true
    if (node.positionType === 'cordo-obert') return openCordons.includes(node.renglaId)
    return node.renglaPosition <= (numberOfCordons ?? Infinity)
    ```
  - Desar configuració: `PATCH /events/:eventId/segments/:segmentId/instances/:instanceId` amb `{ numberOfCordons, openCordons }`
  - Carregar configuració existent en entrar al canvas (la instància ja porta `numberOfCordons` i `openCordons`)
- Eliminar el botó "Afegir cordó" (upgrade) i tota la UI d'upgrade del frontend
- Mantenir l'endpoint `POST /instances/:id/upgrade` al backend (per no trencar API), però ja no s'usa
- Tests del component i de la funció `isNodeVisible()`

**Criteri de done**:
- Canviar de 3 a 2 cordons amaga els nodes de posició 3 però manté les assignacions existents
- Tornar a 3 cordons recupera les assignacions
- Activar cordó obert per "Mans" mostra el node de cordó obert de les rengles de mans
- La configuració persisteix entre sessions (recarregar pàgina i es recorda)

---

### F5 — Projecció, poliment i documentació

**Objectiu**: Ajustar els components restants, netejar codi mort i actualitzar la documentació tècnica.

**Abast**:
- `ProjectionService.getProjection()`: incloure `numberOfCordons` i `openCordons` de la instància a la resposta
- `ProjectionViewComponent` + `FigureProjectionComponent`: aplicar `isNodeVisible()` als nodes de projecció
- `TemplateListComponent`: canviar "X variants" per "X rengles definides" a les targetes de família; simplificar la lògica de "Bases desordenades" (ja no hi ha variants a validar)
- Netejar codi mort:
  - `originNodeId` matching a `bulkImport` (substituït per `renglaId + renglaPosition`)
  - Funcions de derivació de variants (`deriveNodes()`, `deriveFromTemplateId`)
  - UI d'upgrade: botó "Afegir cordó", "Variant màxima", `upgradeInstance()` al frontend
  - `PinyesOnboardingModal`: actualitzar el contingut (famílies → rengles; upgrade → selector de cordons)
- Actualitzar `docs/PINYES_MODULE.md` amb la nova arquitectura

**Criteri de done**:
- La projecció mostra els cordons correctes per a cada instància configurada
- `nx lint api && nx lint dashboard` sense errors nous
- `nx test api && nx test dashboard` passa
- `docs/PINYES_MODULE.md` reflecteix l'arquitectura post-integració

---

### Resum de fases

| Fase | Abast principal | Risc | Durada estimada |
|------|----------------|------|-----------------|
| **F1** Backend Core | Entitats, schema, snapshot, filtres | Baix (additiu) | 1 sessió |
| **F2** Editor Rengles | Overlay SVG, UX de creació de rengles | Mig (component complex) | 1-2 sessions |
| **F3** Ghost Clone | Konva ghosts, clonació radial | Mig (lògica geomètrica) | 1 sessió |
| **F4** Selector Cordons | Dialog, filtratge, persistència | Baix (lògica clara) | 1 sessió |
| **F5** Poliment + Docs | Projecció, cleanup, documentació | Baix | 1 sessió |

---

## 14. Glossari de termes


| Terme | Definició |
|-------|-----------|
| **Rengla** | Línia radial de nodes que va del centre de la pinya cap enfora. Cada posició dins la rengla correspon a un cordó diferent. |
| **Cordó** | Anell concèntric de posicions al voltant de la pinya. El primer cordó és el més intern, el tercer el més extern. |
| **Cordó obert** | Persona al final d'una rengla principal que vigila la figura des de fora. Posició opcional i de seguretat. |
| **renglaPosition** | Posició ordinal d'un node dins de la seva rengla (1 = primer cordó, 2 = segon, ...). |
| **startPosition** | Primer cordó on una rengla comença a existir. La majoria comencen a 1, però algunes rengles extra només apareixen a partir del 3r cordó. |
| **numberOfCordons** | Nombre de cordons visibles en una instància. Configurable per l'assignador. NULL = tots. |
| **openCordons** | Llista de rengles que tenen el cordó obert actiu en una instància concreta. |
| **Ghost clone** | Node fantasma visual al canvas editor que permet crear un clon d'un node existent alineat radialment. |
| **ringLevel** | Camp existent que identifica el cordó concèntric d'un node. Manté la seva semàntica actual. |
| **Família** | Agrupador lògic de templates. Manté el tronc compartit. Amb rengles, normalment contindrà 1 sol template. |
| **Snapshot** | Còpia immutable dels nodes d'un template a una instància. Amb rengles, copia TOTS els nodes de tots els cordons. |

---

*Document creat el 28 de maig de 2026. Decisions arquitecturals tancades el 28 de maig de 2026.*
*Actualitzat el 28 de maig de 2026: eliminada la fase de migració (F2 original). BBDD neta, sense seeds ni scripts de migració.*
*Els plans d'implementació es creen en mode Plan referenciament les fases F1–F5 d'aquest document.*

*Referències:*
- *`docs/PINYES_MODULE.md` — documentació tècnica completa del mòdul*
- *`feat/modul_pinyes_rengles` — branca de Ferran amb l'implementació de rengles*
- *`story/deploy-server-pre` — branca principal amb tot l'stack actual*
