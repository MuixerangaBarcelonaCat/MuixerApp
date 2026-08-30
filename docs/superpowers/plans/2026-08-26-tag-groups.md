# Grups d'etiquetes, regla mínima i catàleg definitiu — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Executat i tancat el 2026-08-27.** Dues coses d'aquest pla no van arribar a la versió final i
> no s'han de reintroduir: la constant `TAG_VIEWS` amb els presets «Guió» i «Pinyes» (tasques 1 i
> 8) —els xips de grup ja deixen fer qualsevol combinació— i els noms del catàleg en singular
> (tasca 2), que van passar al plural que fa servir l'equip tècnic. La referència viva és
> [docs/TAGS.md](../../TAGS.md).

**Goal:** Ajustar les etiquetes de persona a l'especificació dels tècnics: quatre grups, catàleg definitiu, regla mínima com a avís tou, filtre per grups, i desconnexió de l'import d'etiquetes que ve de l'App legacy.

**Architecture:** El «grup d'etiquetes» és el valor de `Tag.category`, que passa de tres a quatre valors (s'hi afegeix `XICALLA`). Cap taula nova. Una migració crea el catàleg definitiu i remapa les etiquetes importades del legacy. La regla mínima és una funció pura a `@muixer/shared` que el backend calcula i exposa al DTO de persona, i que només alimenta un badge d'avís i un filtre — mai bloqueja res.

**Tech Stack:** NestJS 11 · TypeORM 0.3 · PostgreSQL 15 · Angular 21 (standalone, OnPush, Signals) · DaisyUI v4 + Tailwind v3.4 · Nx 22 · Jest (API i `libs/shared`) · Vitest (dashboard) · testcontainers (integració).

**Spec:** `docs/superpowers/specs/2026-08-26-tag-groups-design.md`

## Global Constraints

- **Codi en anglès** (variables, funcions, classes, endpoints, columnes, missatges de commit); **text d'UI en català**. Llegeix `.agents/skills/language-rules/` abans d'escriure text visible.
- **TDD sempre**: prova primer, veure-la fallar, implementació mínima, veure-la passar, commit. Llegeix `.agents/skills/test-driven-development/`.
- Components Angular: standalone + `OnPush` + Signals; `input()`/`output()`, mai `@Input()`/`@Output()`.
- UI: components de `@muixer/ui` (`lib-button`, `lib-badge`, …) i tokens del design system. Cap hex cru, cap valor arbitrari de Tailwind, cap `@apply`.
- Enums i utils compartits venen de `@muixer/shared`; cada fitxer nou de `libs/shared/src` s'ha d'exportar a `libs/shared/src/index.ts`.
- `synchronize: false`: qualsevol canvi d'esquema o de dades va en una migració a `apps/api/src/migrations/` i s'ha de registrar a `apps/api/src/migrations/index.ts`.
- Els filtres de llista usen sempre la llista blanca `@IsIn(SORT_FIELDS)`; els paràmetres numèrics porten `@Type(() => Number)`.
- Llindars de cobertura de CI: API 75/70/78/76, dashboard 40/35/40/40.
- **Res del que es construeix ací pot bloquejar cap operació**: ni alta, ni edició, ni assignació.

## File Structure

**`libs/shared`**
- Modifica `src/enums/tag-category.enum.ts` — afegeix `XICALLA`.
- Modifica `src/utils/tag-category.util.ts` — `TAG_CATEGORY_LABELS` amb el nou valor; s'elimina `inferTagCategory` a la Task 3.
- Crea `src/utils/tag-compliance.util.ts` — regla mínima, funció pura.
- Crea `src/constants/tag-view.constants.ts` — les dues visualitzacions.
- Modifica `src/constants/node-preset.constants.ts` — constant `BASE_POSITION_TYPE`.

**`apps/api`**
- Crea `src/migrations/1784700000000-TagCatalog.ts` — catàleg definitiu + remapatge legacy.
- Modifica `src/modules/sync/strategies/person-sync.strategy.ts` — fora l'import d'etiquetes.
- Crea `src/modules/person/utils/tag-rule-filter.util.ts` — la subconsulta del filtre de la regla.
- Modifica `src/modules/person/person.service.ts`, `dto/person-response.dto.ts`, `dto/person-filter.dto.ts`, `constants/person-sort.constants.ts`.
- Modifica `src/modules/node-assignment/dto/available-persons-query.dto.ts` i `available-persons.service.ts` — `positionCategory` passa a llista.

**`apps/dashboard`**
- Modifica `features/config/components/tag-form-modal/*`, `tags-list/*`.
- Modifica `features/persons/components/person-list.component.*`, `models/person.model.ts`, el servei de persones.
- Modifica `features/pinyes/components/person-panel/person-panel.component.*`.
- Modifica `features/events/components/event-participation/event-participation.component.*`.
- Crea `shared/components/data/tag-view-filter/tag-view-filter.component.ts` — el selector de grups + presets, compartit pels quatre llocs.

**`docs`**
- Crea `docs/TAGS.md`; modifica `docs/MAP.md`, `docs/DATA_MODEL.md`, `docs/SYNC_ARCHITECTURE.md`, `CLAUDE.md`.

---

### Task 1: Quart grup i regla mínima a `@muixer/shared`

**Files:**
- Modify: `libs/shared/src/enums/tag-category.enum.ts`
- Modify: `libs/shared/src/utils/tag-category.util.ts:8-12`
- Create: `libs/shared/src/utils/tag-compliance.util.ts`
- Create: `libs/shared/src/constants/tag-view.constants.ts`
- Modify: `libs/shared/src/index.ts`
- Test: `libs/shared/src/utils/tag-compliance.util.spec.ts`

**Interfaces:**
- Consumes: `TagCategory` de `libs/shared/src/enums/tag-category.enum.ts`.
- Produces:
  - `TagCategory.XICALLA = 'XICALLA'`
  - `interface TagCompliance { ok: boolean; missing: TagCategory[] }`
  - `function evaluateTagCompliance(categories: TagCategory[]): TagCompliance`
  - `interface TagView { id: 'guio' | 'pinyes'; label: string; groups: TagCategory[] }`
  - `const TAG_VIEWS: readonly TagView[]`

- [ ] **Step 1: Escriu la prova que falla**

Crea `libs/shared/src/utils/tag-compliance.util.spec.ts`:

```ts
import { TagCategory } from '../enums/tag-category.enum';
import { evaluateTagCompliance } from './tag-compliance.util';

describe('evaluateTagCompliance', () => {
  it('compleix amb només una etiqueta de xicalla', () => {
    expect(evaluateTagCompliance([TagCategory.XICALLA])).toEqual({ ok: true, missing: [] });
  });

  it('compleix amb només una etiqueta d\'altres', () => {
    expect(evaluateTagCompliance([TagCategory.ALTRES])).toEqual({ ok: true, missing: [] });
  });

  it('compleix amb pinya i tronc alhora', () => {
    expect(evaluateTagCompliance([TagCategory.PINYA, TagCategory.TRONC])).toEqual({
      ok: true,
      missing: [],
    });
  });

  // Aquest cas fixa la decisió de disseny: satisfer més d'una condició NO és un avís.
  it('compleix amb xicalla, pinya i tronc alhora', () => {
    expect(
      evaluateTagCompliance([TagCategory.XICALLA, TagCategory.PINYA, TagCategory.TRONC]),
    ).toEqual({ ok: true, missing: [] });
  });

  it('no compleix sense cap etiqueta i demana pinya i tronc', () => {
    expect(evaluateTagCompliance([])).toEqual({
      ok: false,
      missing: [TagCategory.PINYA, TagCategory.TRONC],
    });
  });

  it('no compleix amb només pinya i demana tronc', () => {
    expect(evaluateTagCompliance([TagCategory.PINYA])).toEqual({
      ok: false,
      missing: [TagCategory.TRONC],
    });
  });

  it('no compleix amb només tronc i demana pinya', () => {
    expect(evaluateTagCompliance([TagCategory.TRONC])).toEqual({
      ok: false,
      missing: [TagCategory.PINYA],
    });
  });

  it('ignora etiquetes repetides del mateix grup', () => {
    expect(evaluateTagCompliance([TagCategory.PINYA, TagCategory.PINYA])).toEqual({
      ok: false,
      missing: [TagCategory.TRONC],
    });
  });
});
```

- [ ] **Step 2: Executa la prova i comprova que falla**

Run: `nx test shared`
Expected: FAIL — `Cannot find module './tag-compliance.util'`.

- [ ] **Step 3: Afegeix el valor `XICALLA` a l'enum**

A `libs/shared/src/enums/tag-category.enum.ts`, dins de `enum TagCategory`, afegeix la línia i actualitza el comentari de dalt:

```ts
/**
 * Grup d'una etiqueta (Tag). Els quatre grups amb què treballa l'equip tècnic.
 * - PINYA: posicions de pinya
 * - TRONC: posicions de tronc, direccions i base
 * - XICALLA: xicalla i xiquets/es de la colla
 * - ALTRES: la resta (acompanyants, fem pinya, imatge i paradeta)
 */
export enum TagCategory {
  TRONC = 'TRONC',
  PINYA = 'PINYA',
  XICALLA = 'XICALLA',
  ALTRES = 'ALTRES',
}
```

- [ ] **Step 4: Afegeix l'etiqueta de text del grup nou**

A `libs/shared/src/utils/tag-category.util.ts`, dins de `TAG_CATEGORY_LABELS`:

```ts
export const TAG_CATEGORY_LABELS: Record<TagCategory, string> = {
  [TagCategory.TRONC]: 'Tronc',
  [TagCategory.PINYA]: 'Pinya',
  [TagCategory.XICALLA]: 'Xicalla',
  [TagCategory.ALTRES]: 'Altres',
};
```

- [ ] **Step 5: Implementa la regla**

Crea `libs/shared/src/utils/tag-compliance.util.ts`:

```ts
import { TagCategory } from '../enums/tag-category.enum';

export interface TagCompliance {
  ok: boolean;
  /** Grups que li completarien la regla. Buit quan `ok`. */
  missing: TagCategory[];
}

/**
 * Regla mínima d'etiquetatge acordada amb l'equip tècnic: n'hi ha prou amb satisfer UNA de
 * les tres condicions (xicalla · altres · pinya+tronc). Satisfer-ne més d'una és normal i
 * mai és un avís. Mai bloqueja res: només alimenta un badge i un filtre de seguiment.
 */
export function evaluateTagCompliance(categories: TagCategory[]): TagCompliance {
  const has = (category: TagCategory): boolean => categories.includes(category);

  if (has(TagCategory.XICALLA) || has(TagCategory.ALTRES)) {
    return { ok: true, missing: [] };
  }

  const pinya = has(TagCategory.PINYA);
  const tronc = has(TagCategory.TRONC);

  if (pinya && tronc) return { ok: true, missing: [] };
  if (pinya) return { ok: false, missing: [TagCategory.TRONC] };
  if (tronc) return { ok: false, missing: [TagCategory.PINYA] };

  return { ok: false, missing: [TagCategory.PINYA, TagCategory.TRONC] };
}
```

- [ ] **Step 6: Crea les visualitzacions**

Crea `libs/shared/src/constants/tag-view.constants.ts`:

```ts
import { TagCategory } from '../enums/tag-category.enum';

export interface TagView {
  id: 'guio' | 'pinyes';
  label: string;
  groups: TagCategory[];
}

/** Les dues combinacions de grups amb què treballa la tècnica, segons la fase de la feina. */
export const TAG_VIEWS: readonly TagView[] = [
  { id: 'guio', label: 'Guió', groups: [TagCategory.XICALLA, TagCategory.TRONC] },
  { id: 'pinyes', label: 'Pinyes', groups: [TagCategory.PINYA, TagCategory.ALTRES] },
] as const;
```

- [ ] **Step 7: Exporta els fitxers nous**

A `libs/shared/src/index.ts`, després de `export * from './constants/node-preset.constants';` i de `export * from './utils/tag-category.util';` respectivament:

```ts
export * from './constants/tag-view.constants';
export * from './utils/tag-compliance.util';
```

- [ ] **Step 8: Executa les proves i comprova que passen**

Run: `nx test shared`
Expected: PASS, incloent-hi els specs existents `tag-category.util.spec.ts` i `own-position.util.spec.ts`.

- [ ] **Step 9: Comprova que res no s'ha trencat per l'enum nou**

Run: `nx lint shared && nx build api && nx build dashboard`
Expected: PASS. Si algun `Record<TagCategory, …>` o `switch` exhaustiu es queixa del valor nou, arregla'l allà mateix afegint el cas `XICALLA` amb el mateix tractament que `ALTRES`.

- [ ] **Step 10: Commit**

```bash
git add libs/shared apps
git commit -m "feat(shared): add XICALLA tag group, tag views and minimum tagging rule"
```

---

### Task 2: Migració del catàleg definitiu i remapatge del legacy

**Files:**
- Create: `apps/api/src/migrations/1784700000000-TagCatalog.ts`
- Modify: `apps/api/src/migrations/index.ts`
- Modify: `apps/api/src/modules/tag/tag-category.integration.spec.ts:18`
- Test: `apps/api/src/modules/tag/tag-catalog.integration.spec.ts`

**Interfaces:**
- Consumes: `TagCategory` (Task 1) — a la migració els valors s'escriuen com a literals SQL, perquè una migració no ha de dependre de codi que pot canviar.
- Produces: files de `positions` amb els slugs definitius: `mans`, `vent`, `segon-cordo`, `lateral`, `agulla`, `contrafort`, `crossa`, `tap`, `cordo-obert`, `persona-nova`, `baix`, `segona`, `terca`, `alcadora`, `figures-netes`, `sense-tronc`, `xicalla`, `xiquets-colla`, `acompanyant`, `fem-pinya`, `imatge-paradeta`. La Task 4 depèn de `persona-nova`.

- [ ] **Step 1: Escriu la prova d'integració que falla**

Crea `apps/api/src/modules/tag/tag-catalog.integration.spec.ts`:

```ts
import { Tag } from './tag.entity';
import { IntegrationDb, setupIntegrationDb, teardownIntegrationDb } from '../../test-integration/integration-db';

/**
 * La migració del catàleg definitiu ha de: crear les etiquetes acordades amb la tècnica,
 * remapar les assignacions de les etiquetes legacy a les definitives i esborrar les legacy
 * que queden sense enllaços.
 */
describe('Tag catalog migration (integration)', () => {
  let db: IntegrationDb;
  let personId: string;

  beforeAll(async () => {
    db = await setupIntegrationDb();

    // Torna a l'estat previ a la migració del catàleg i sembra dades com les de l'import legacy.
    await db.dataSource.undoLastMigration();

    await db.dataSource.query(
      `INSERT INTO "positions" (id, name, slug, "positionTypes", category) VALUES
        (gen_random_uuid(), 'Segon Lateral', 'segon-lateral', ARRAY['laterals'], 'PINYA'),
        (gen_random_uuid(), 'Lateral', 'lateral', ARRAY['laterals'], 'PINYA'),
        (gen_random_uuid(), 'Novatos', 'novatos', ARRAY[]::text[], 'ALTRES'),
        (gen_random_uuid(), 'Altres', 'altres', ARRAY[]::text[], 'ALTRES')`,
    );

    const [person] = await db.dataSource.query(
      `INSERT INTO "persons" (name, "firstSurname", alias) VALUES ('Test', 'Catalog', '~cataleg')
       RETURNING id`,
    );
    personId = person.id;

    await db.dataSource.query(
      `INSERT INTO "person_positions" ("personsId", "positionsId")
       SELECT $1, id FROM "positions" WHERE slug IN ('segon-lateral', 'lateral', 'novatos', 'altres')`,
      [personId],
    );

    await db.dataSource.runMigrations();
  });

  afterAll(async () => {
    await teardownIntegrationDb(db);
  });

  it('crea les etiquetes del catàleg amb el seu grup', async () => {
    const repo = db.dataSource.getRepository(Tag);

    const segonCordo = await repo.findOneByOrFail({ slug: 'segon-cordo' });
    expect(segonCordo.name).toBe('Segon Cordó');
    expect(segonCordo.category).toBe('PINYA');
    expect(segonCordo.positionTypes.sort()).toEqual(['mans', 'vents']);

    const xiquets = await repo.findOneByOrFail({ slug: 'xiquets-colla' });
    expect(xiquets.category).toBe('XICALLA');

    const baix = await repo.findOneByOrFail({ slug: 'baix' });
    expect(baix.positionTypes).toEqual(['base']);
  });

  it('remapa segon-lateral i lateral a una sola Lateral, sense duplicats', async () => {
    const rows = await db.dataSource.query(
      `SELECT t.slug FROM "person_positions" pp
       JOIN "positions" t ON t.id = pp."positionsId"
       WHERE pp."personsId" = $1 AND t.slug = 'lateral'`,
      [personId],
    );
    expect(rows).toHaveLength(1);
  });

  it('remapa novatos a persona-nova', async () => {
    const rows = await db.dataSource.query(
      `SELECT t.slug FROM "person_positions" pp
       JOIN "positions" t ON t.id = pp."positionsId"
       WHERE pp."personsId" = $1 AND t.slug = 'persona-nova'`,
      [personId],
    );
    expect(rows).toHaveLength(1);
  });

  it('descarta l\'etiqueta legacy altres i esborra les legacy òrfenes', async () => {
    const repo = db.dataSource.getRepository(Tag);
    expect(await repo.findOneBy({ slug: 'altres' })).toBeNull();
    expect(await repo.findOneBy({ slug: 'segon-lateral' })).toBeNull();
    expect(await repo.findOneBy({ slug: 'novatos' })).toBeNull();
  });
});
```

- [ ] **Step 2: Executa-la i comprova que falla**

Run: `nx run api:test-integration --testFile=apps/api/src/modules/tag/tag-catalog.integration.spec.ts`
Expected: FAIL — el catàleg no existeix (`findOneByOrFail` llança per `segon-cordo`).

- [ ] **Step 3: Escriu la migració**

Crea `apps/api/src/migrations/1784700000000-TagCatalog.ts`:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

interface CatalogTag {
  slug: string;
  name: string;
  category: 'PINYA' | 'TRONC' | 'XICALLA' | 'ALTRES';
  positionTypes: string[];
  color: string;
}

/** Catàleg definitiu acordat amb l'equip tècnic (2026-08). Noms en singular: descriuen una persona. */
const CATALOG: CatalogTag[] = [
  { slug: 'mans',            name: 'Mans',                 category: 'PINYA',   positionTypes: ['mans'],           color: '#FFE082' },
  { slug: 'vent',            name: 'Vent',                 category: 'PINYA',   positionTypes: ['vents'],          color: '#A5D6A7' },
  { slug: 'segon-cordo',     name: 'Segon Cordó',          category: 'PINYA',   positionTypes: ['mans', 'vents'],  color: '#00897B' },
  { slug: 'lateral',         name: 'Lateral',              category: 'PINYA',   positionTypes: ['laterals'],       color: '#80DEEA' },
  { slug: 'agulla',          name: 'Agulla',               category: 'PINYA',   positionTypes: ['agulla'],         color: '#0D9488' },
  { slug: 'contrafort',      name: 'Contrafort',           category: 'PINYA',   positionTypes: ['contrafort'],     color: '#EF9A9A' },
  { slug: 'crossa',          name: 'Crossa',               category: 'PINYA',   positionTypes: ['crossa'],         color: '#9FA8DA' },
  { slug: 'tap',             name: 'Tap',                  category: 'PINYA',   positionTypes: ['tap'],            color: '#BE185D' },
  { slug: 'cordo-obert',     name: 'Cordó Obert',          category: 'PINYA',   positionTypes: ['cordo-obert'],    color: '#FFF9C4' },
  { slug: 'persona-nova',    name: 'Persona Nova',         category: 'PINYA',   positionTypes: [],                 color: '#5C6BC0' },
  { slug: 'baix',            name: 'Baix',                 category: 'TRONC',   positionTypes: ['base'],           color: '#64748B' },
  { slug: 'segona',          name: 'Segona',               category: 'TRONC',   positionTypes: ['segona'],         color: '#1E88E5' },
  { slug: 'terca',           name: 'Terça',                category: 'TRONC',   positionTypes: ['terça'],          color: '#43A047' },
  { slug: 'alcadora',        name: 'Alçadora',             category: 'TRONC',   positionTypes: ['alçadora'],       color: '#00ACC1' },
  { slug: 'figures-netes',   name: 'Figures Netes (SP)',   category: 'TRONC',   positionTypes: [],                 color: '#8E24AA' },
  { slug: 'sense-tronc',     name: 'Sense Tronc',          category: 'TRONC',   positionTypes: [],                 color: '#9E9E9E' },
  { slug: 'xicalla',         name: 'Xicalla',              category: 'XICALLA', positionTypes: [],                 color: '#FFB300' },
  { slug: 'xiquets-colla',   name: 'Xiquet/a de la Colla', category: 'XICALLA', positionTypes: [],                 color: '#FF7043' },
  { slug: 'acompanyant',     name: 'Acompanyant',          category: 'ALTRES',  positionTypes: [],                 color: '#78909C' },
  { slug: 'fem-pinya',       name: 'Fem Pinya',            category: 'ALTRES',  positionTypes: [],                 color: '#7CB342' },
  { slug: 'imatge-paradeta', name: 'Imatge i Paradeta',    category: 'ALTRES',  positionTypes: [],                 color: '#EC407A' },
];

/** Etiqueta legacy → etiqueta definitiva. Les que ja comparteixen slug s'actualitzen en el lloc. */
const REMAP: Record<string, string> = {
  'segon-lateral': 'lateral',
  novatos: 'persona-nova',
  acompanyants: 'acompanyant',
  'nens-colla': 'xiquets-colla',
};

/** Etiquetes legacy que desapareixen sense substituta. */
const DISCARD = ['altres'];

export class TagCatalog1784700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const tag of CATALOG) {
      await queryRunner.query(
        `INSERT INTO "positions" (name, slug, "positionTypes", color, category)
         VALUES ($1, $2, $3::text[], $4, $5)
         ON CONFLICT (slug) DO UPDATE
           SET name = EXCLUDED.name,
               "positionTypes" = EXCLUDED."positionTypes",
               color = EXCLUDED.color,
               category = EXCLUDED.category`,
        [tag.name, tag.slug, tag.positionTypes, tag.color, tag.category],
      );
    }

    for (const [legacySlug, targetSlug] of Object.entries(REMAP)) {
      await queryRunner.query(
        `INSERT INTO "person_positions" ("personsId", "positionsId")
         SELECT pp."personsId", target.id
         FROM "person_positions" pp
         JOIN "positions" legacy ON legacy.id = pp."positionsId" AND legacy.slug = $1
         JOIN "positions" target ON target.slug = $2
         ON CONFLICT DO NOTHING`,
        [legacySlug, targetSlug],
      );
    }

    const obsolete = [...Object.keys(REMAP), ...DISCARD];
    const { count } = (
      await queryRunner.query(
        `SELECT COUNT(*)::int AS count FROM "person_positions" pp
         JOIN "positions" t ON t.id = pp."positionsId"
         WHERE t.slug = ANY($1::text[])`,
        [obsolete],
      )
    )[0];
    console.log(`[TagCatalog] remapping done, dropping ${count} legacy tag assignments`);

    await queryRunner.query(
      `DELETE FROM "person_positions"
       WHERE "positionsId" IN (SELECT id FROM "positions" WHERE slug = ANY($1::text[]))`,
      [obsolete],
    );

    await queryRunner.query(`DELETE FROM "positions" WHERE slug = ANY($1::text[])`, [obsolete]);
  }

  /**
   * Irreversible per disseny: el catàleg legacy no es pot reconstruir. El `down` només lleva
   * les etiquetes noves que no tenen cap persona assignada, per no perdre dades introduïdes
   * després de la migració. Cal còpia de seguretat abans d'executar-la en producció.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "positions" t
       WHERE t.slug = ANY($1::text[])
         AND NOT EXISTS (SELECT 1 FROM "person_positions" pp WHERE pp."positionsId" = t.id)`,
      [CATALOG.map((tag) => tag.slug)],
    );
  }
}
```

- [ ] **Step 4: Registra la migració**

A `apps/api/src/migrations/index.ts`, importa `TagCatalog1784700000000` i afegeix-la al final de l'array exportat, seguint el mateix format que les altres entrades del fitxer.

- [ ] **Step 5: Arregla el spec d'integració que assumeix ser l'última migració**

`tag-category.integration.spec.ts:18` fa `undoLastMigration()` una sola vegada per tornar abans de `TagCategory`. Ara l'última és `TagCatalog`, així que necessita dues passes. Substitueix la línia per:

```ts
    // Dues migracions enrere: primer TagCatalog, després TagCategory (la que estem provant).
    await db.dataSource.undoLastMigration();
    await db.dataSource.undoLastMigration();
```

- [ ] **Step 6: Executa les proves d'integració i comprova que passen**

Run: `nx run api:test-integration --testFile=apps/api/src/modules/tag/tag-catalog.integration.spec.ts`
Expected: PASS (4 proves).

Run: `nx run api:test-integration --testFile=apps/api/src/modules/tag/tag-category.integration.spec.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/migrations apps/api/src/modules/tag
git commit -m "feat(api): migrate to the definitive tag catalog and remap legacy tags"
```

---

### Task 3: Desconnectar l'import d'etiquetes del legacy

**Files:**
- Modify: `apps/api/src/modules/sync/strategies/person-sync.strategy.ts:20-34,125-128,384-411,443,562-578`
- Modify: `apps/api/src/modules/sync/strategies/person-sync.strategy.spec.ts`
- Delete: `libs/shared/src/utils/tag-category.util.ts` → només la funció `inferTagCategory` i el seu spec
- Delete: `libs/shared/src/utils/tag-category.util.spec.ts`
- Modify: `libs/shared/src/constants/node-preset.constants.ts`
- Modify: `docs/SYNC_ARCHITECTURE.md:45`

**Interfaces:**
- Consumes: res de tasques anteriors.
- Produces: `BASE_POSITION_TYPE = 'base'` a `node-preset.constants.ts`. `TAG_CATEGORY_LABELS` es queda a `tag-category.util.ts`; `inferTagCategory` desapareix.

- [ ] **Step 1: Escriu la prova que falla**

A `apps/api/src/modules/sync/strategies/person-sync.strategy.spec.ts`, afegeix un `describe` nou seguint el patró de mocks que ja fa servir el fitxer (repositoris mockejats amb `jest.fn()`):

```ts
  describe('tag import disconnection', () => {
    it('no crea ni actualitza cap etiqueta durant el sync', async () => {
      await runSync([legacyPersonFixture({ posicio: 'PRIMERES+CANALLA' })]);

      expect(positionRepository.save).not.toHaveBeenCalled();
      expect(positionRepository.create).not.toHaveBeenCalled();
    });

    it('crea la persona sense assignar-li etiquetes', async () => {
      await runSync([legacyPersonFixture({ posicio: 'PRIMERES' })]);

      const created = personRepository.create.mock.calls[0][0];
      expect(created.positions).toBeUndefined();
    });

    it('segueix derivant isXicalla de la posició legacy', async () => {
      await runSync([legacyPersonFixture({ posicio: 'CANALLA' })]);

      const created = personRepository.create.mock.calls[0][0];
      expect(created.isXicalla).toBe(true);
    });
  });
```

Adapta `runSync` i `legacyPersonFixture` als helpers que ja existeixen al fitxer; si no n'hi ha cap, extreu-los dels `describe` existents abans d'afegir aquest bloc.

- [ ] **Step 2: Executa la prova i comprova que falla**

Run: `nx test api --testFile=apps/api/src/modules/sync/strategies/person-sync.strategy.spec.ts`
Expected: FAIL — `positionRepository.save` sí que s'ha cridat.

- [ ] **Step 3: Lleva l'import d'etiquetes de l'estratègia de sync**

A `person-sync.strategy.ts`:

1. esborra la constant `POSITION_MAPPING` (`:20-34`) i la importació d'`inferTagCategory` de `@muixer/shared` (`:9`);
2. esborra els mètodes `extractUniquePositions` (`:374-382`), `upsertPosition` (`:384-411`) i `resolvePositions` (`:562-578`);
3. esborra el bloc del bucle principal que els cridava (`:125-128`), incloent-hi els esdeveniments SSE de progrés de posicions;
4. a `createPerson`, esborra `const positions = await this.resolvePositions(...)` (`:443`) i la propietat `positions` de l'objecte que es passa a `personRepository.create` (`:462`);
5. deixa `deriveIsXicalla` i la seua crida intactes;
6. si el repositori `positionRepository` queda sense cap ús, lleva'l del constructor i lleva `Tag` de `TypeOrmModule.forFeature` a `sync.module.ts`; si el `SyncModule` encara el necessita per a una altra estratègia, deixa'l.

- [ ] **Step 4: Executa la prova i comprova que passa**

Run: `nx test api --testFile=apps/api/src/modules/sync/strategies/person-sync.strategy.spec.ts`
Expected: PASS. Esborra del mateix fitxer els casos antics que provaven `POSITION_MAPPING` o `resolvePositions`.

- [ ] **Step 5: Esborra `inferTagCategory`**

A `libs/shared/src/utils/tag-category.util.ts` esborra la funció `inferTagCategory`, les constants `TRONC_POSITION_TYPES` i les importacions que ja no s'usen; el fitxer es queda només amb `TAG_CATEGORY_LABELS`. Esborra `libs/shared/src/utils/tag-category.util.spec.ts`.

A `libs/shared/src/constants/node-preset.constants.ts`, després de `PINYA_POSITION_TYPES`, afegeix:

```ts
/** Tipus de posició de la base del tronc. No és cap preset de node: és un valor solt del vocabulari. */
export const BASE_POSITION_TYPE = 'base';
```

A `apps/dashboard/src/app/features/config/components/tag-form-modal/tag-form-modal.component.ts:97`, substitueix el literal `'base'` per `BASE_POSITION_TYPE` importat de `@muixer/shared`.

- [ ] **Step 6: Comprova que ningú més usava la funció esborrada**

Run: `grep -rn "inferTagCategory" apps libs --include=*.ts`
Expected: cap resultat.

Run: `nx test shared && nx test api && nx build dashboard`
Expected: PASS.

- [ ] **Step 7: Actualitza la documentació del sync**

A `docs/SYNC_ARCHITECTURE.md:45`, substitueix la fila de `posicio` per:

```markdown
| `posicio` | *(ja no s'importa)* | Només se'n deriva `isXicalla`. Les etiquetes són propietat exclusiva de MuixerApp — vegeu [[TAGS]] |
```

- [ ] **Step 8: Commit**

```bash
git add apps libs docs
git commit -m "refactor(sync): stop importing person tags from the legacy app"
```

---

### Task 4: Etiqueta per defecte a l'alta d'una persona

**Files:**
- Modify: `apps/api/src/modules/person/person.service.ts:165-188`
- Test: `apps/api/src/modules/person/person.service.spec.ts`

**Interfaces:**
- Consumes: l'etiqueta amb slug `persona-nova` creada per la migració de la Task 2; `TagCategory` (Task 1).
- Produces: `PersonService.create` continua tornant `PersonResponseDto`; cap signatura nova.

- [ ] **Step 1: Escriu la prova que falla**

A `apps/api/src/modules/person/person.service.spec.ts`, afegeix dins del `describe('create')` existent:

```ts
    it('assigna «Persona Nova» quan no ve cap etiqueta de xicalla ni d\'altres', async () => {
      const personaNova = { id: 'tag-nova', slug: 'persona-nova', category: TagCategory.PINYA } as Tag;
      positionRepository.findOne.mockResolvedValue(personaNova);
      personRepository.create.mockImplementation((data) => data as Person);
      personRepository.save.mockImplementation(async (person) => person as Person);

      await service.create({ name: 'Nova', firstSurname: 'Persona', alias: 'nova' } as CreatePersonDto);

      const saved = personRepository.save.mock.calls[0][0] as Person;
      expect(saved.positions).toEqual([personaNova]);
    });

    it('no assigna cap etiqueta per defecte si ja en ve una de xicalla', async () => {
      const xicalla = { id: 'tag-xicalla', slug: 'xicalla', category: TagCategory.XICALLA } as Tag;
      positionRepository.findBy.mockResolvedValue([xicalla]);
      personRepository.create.mockImplementation((data) => data as Person);
      personRepository.save.mockImplementation(async (person) => person as Person);

      await service.create({
        name: 'Menuda',
        firstSurname: 'Colla',
        alias: 'menuda',
        positionIds: ['tag-xicalla'],
      } as CreatePersonDto);

      const saved = personRepository.save.mock.calls[0][0] as Person;
      expect(saved.positions).toEqual([xicalla]);
      expect(positionRepository.findOne).not.toHaveBeenCalled();
    });
```

Adapta els noms dels mocks (`positionRepository`, `personRepository`) als que ja fa servir el fitxer.

- [ ] **Step 2: Executa la prova i comprova que falla**

Run: `nx test api --testFile=apps/api/src/modules/person/person.service.spec.ts`
Expected: FAIL — `saved.positions` és `undefined` al primer cas.

- [ ] **Step 3: Implementa el valor per defecte**

A `apps/api/src/modules/person/person.service.ts`, afegeix la constant a prop de `PROVISIONAL_PREFIX`:

```ts
const DEFAULT_TAG_SLUG = 'persona-nova';
```

i dins de `create`, substitueix el bloc de `positionIds` per:

```ts
    if (positionIds && positionIds.length > 0) {
      person.positions = await this.findPositionsOrThrow(positionIds);
    }

    // Regla mínima d'etiquetatge: qui no és de xicalla ni d'«altres» entra com a persona nova,
    // perquè la tècnica puga fer-ne el seguiment fins que se li puga assignar una posició.
    const categories = (person.positions ?? []).map((tag) => tag.category);
    const needsDefault =
      !categories.includes(TagCategory.XICALLA) && !categories.includes(TagCategory.ALTRES);

    if (needsDefault) {
      const defaultTag = await this.positionRepository.findOne({
        where: { slug: DEFAULT_TAG_SLUG },
      });
      if (defaultTag) {
        person.positions = [...(person.positions ?? []), defaultTag];
      }
    }
```

Importa `TagCategory` de `@muixer/shared`.

Nota: si l'etiqueta no existeix (base de dades sense migrar) no es llança cap error — l'alta mai es pot bloquejar per això.

- [ ] **Step 4: Executa la prova i comprova que passa**

Run: `nx test api --testFile=apps/api/src/modules/person/person.service.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/person
git commit -m "feat(api): tag new persons as «Persona Nova» by default"
```

---

### Task 5: Exposar i filtrar la regla mínima a l'API

**Files:**
- Create: `apps/api/src/modules/person/utils/tag-rule-filter.util.ts`
- Modify: `apps/api/src/modules/person/dto/person-response.dto.ts`
- Modify: `apps/api/src/modules/person/dto/person-filter.dto.ts`
- Modify: `apps/api/src/modules/person/person.service.ts:33-120`
- Modify: `apps/api/src/modules/person/constants/person-sort.constants.ts:15,35`
- Test: `apps/api/src/modules/person/person.service.spec.ts`
- Test: `apps/api/src/modules/person/person-tag-rule.integration.spec.ts`

**Interfaces:**
- Consumes: `evaluateTagCompliance`, `TagCompliance` (Task 1).
- Produces:
  - `PersonResponseDto.tagCompliance: TagCompliance`
  - `PersonResponseDto.attendedCount: number` — assistències `ASSISTIT` de la temporada actual
  - `PersonFilterDto.tagRuleOk?: boolean`
  - `function applyTagRuleFilter(qb: SelectQueryBuilder<Person>, personAlias: string, ok: boolean): void`
  - camp d'ordenació nou `attendedCount`

- [ ] **Step 1: Escriu la prova d'integració que falla**

Crea `apps/api/src/modules/person/person-tag-rule.integration.spec.ts`:

```ts
import { IntegrationDb, setupIntegrationDb, teardownIntegrationDb } from '../../test-integration/integration-db';

/**
 * El filtre «no compleix la regla» ha de tornar exactament qui no satisfà cap de les tres
 * condicions. Una persona amb pinya + tronc és el cas normal i NO hi ha d'aparèixer.
 */
describe('Person tag rule filter (integration)', () => {
  let db: IntegrationDb;

  const insertPerson = async (alias: string, tagSlugs: string[]): Promise<string> => {
    const [person] = await db.dataSource.query(
      `INSERT INTO "persons" (name, "firstSurname", alias) VALUES ($1, 'Regla', $1) RETURNING id`,
      [alias],
    );
    if (tagSlugs.length > 0) {
      await db.dataSource.query(
        `INSERT INTO "person_positions" ("personsId", "positionsId")
         SELECT $1, id FROM "positions" WHERE slug = ANY($2::text[])`,
        [person.id, tagSlugs],
      );
    }
    return person.id;
  };

  beforeAll(async () => {
    db = await setupIntegrationDb();
  });

  afterAll(async () => {
    await teardownIntegrationDb(db);
  });

  it('inclou qui no té cap etiqueta i exclou els casos vàlids', async () => {
    const sense = await insertPerson('sense', []);
    const nomesPinya = await insertPerson('nomespinya', ['mans']);
    const pinyaITronc = await insertPerson('pinyatronc', ['mans', 'segona']);
    const nomesXicalla = await insertPerson('xicalleta', ['xicalla']);
    const nomesAltres = await insertPerson('acompanya', ['acompanyant']);

    const rows = await db.dataSource.query(
      `SELECT p.id FROM "persons" p
       WHERE NOT (
         EXISTS (SELECT 1 FROM "person_positions" pp JOIN "positions" t ON t.id = pp."positionsId"
                 WHERE pp."personsId" = p.id AND t.category IN ('XICALLA', 'ALTRES'))
         OR (
           EXISTS (SELECT 1 FROM "person_positions" pp JOIN "positions" t ON t.id = pp."positionsId"
                   WHERE pp."personsId" = p.id AND t.category = 'PINYA')
           AND EXISTS (SELECT 1 FROM "person_positions" pp JOIN "positions" t ON t.id = pp."positionsId"
                       WHERE pp."personsId" = p.id AND t.category = 'TRONC')
         )
       )`,
    );
    const ids = rows.map((row: { id: string }) => row.id);

    expect(ids).toContain(sense);
    expect(ids).toContain(nomesPinya);
    expect(ids).not.toContain(pinyaITronc);
    expect(ids).not.toContain(nomesXicalla);
    expect(ids).not.toContain(nomesAltres);
  });
});
```

- [ ] **Step 2: Executa-la i comprova que falla**

Run: `nx run api:test-integration --testFile=apps/api/src/modules/person/person-tag-rule.integration.spec.ts`
Expected: FAIL si el catàleg de la Task 2 no hi és; PASS si ja hi és — en eixe cas la prova documenta la forma SQL que la util ha de reproduir i has de continuar igualment amb el pas 3.

- [ ] **Step 3: Escriu la util del filtre**

Crea `apps/api/src/modules/person/utils/tag-rule-filter.util.ts`:

```ts
import { SelectQueryBuilder } from 'typeorm';
import { Person } from '../person.entity';

const hasCategory = (personAlias: string, categories: string[]): string =>
  `EXISTS (
     SELECT 1 FROM person_positions pp
     JOIN positions t ON t.id = pp."positionsId"
     WHERE pp."personsId" = ${personAlias}.id
       AND t.category IN (${categories.map((c) => `'${c}'`).join(', ')})
   )`;

/**
 * «Compleix la regla mínima d'etiquetatge»: té xicalla, o altres, o pinya i tronc alhora.
 * Mateixa regla que `evaluateTagCompliance` a `@muixer/shared`, expressada en SQL perquè el
 * filtre haja de paginar al servidor.
 */
export function applyTagRuleFilter(
  qb: SelectQueryBuilder<Person>,
  personAlias: string,
  ok: boolean,
): void {
  const rule = `(
    ${hasCategory(personAlias, ['XICALLA', 'ALTRES'])}
    OR (${hasCategory(personAlias, ['PINYA'])} AND ${hasCategory(personAlias, ['TRONC'])})
  )`;

  qb.andWhere(ok ? rule : `NOT ${rule}`);
}
```

- [ ] **Step 4: Afegeix el filtre al DTO i al servei**

A `person-filter.dto.ts`, després de `positionCategory`:

```ts
  @ApiPropertyOptional({ description: 'Filtrar per compliment de la regla mínima d\'etiquetatge' })
  @IsOptional()
  @Transform(toBool)
  tagRuleOk?: boolean;
```

A `person.service.ts`, afegeix `tagRuleOk` a la desestructuració de `filters` a `findAll` i, just després del bloc de `positionCategory`:

```ts
    if (tagRuleOk !== undefined) {
      applyTagRuleFilter(queryBuilder, 'person', tagRuleOk);
    }
```

Importa `applyTagRuleFilter` de `./utils/tag-rule-filter.util`.

- [ ] **Step 5: Afegeix el recompte d'assistències de la temporada actual**

A `person.service.ts`, dins de `findAll`, just després de crear el `queryBuilder`:

```ts
    // Assistències confirmades de la temporada en curs: és la senyal que fa visibles les
    // persones noves que ja venen recurrentment però encara no tenen posició assignada.
    queryBuilder.addSelect(
      `(SELECT COUNT(*)::int FROM attendances a
        JOIN events e ON e.id = a."eventId"
        WHERE a."personId" = person.id
          AND a.status = 'ASSISTIT'
          AND e."seasonId" = (
            SELECT s.id FROM seasons s
            WHERE s."startDate" <= CURRENT_DATE AND s."endDate" >= CURRENT_DATE
            ORDER BY s."startDate" DESC LIMIT 1
          ))`,
      'person_attendedCount',
    );
```

Perquè `getMany()` no perd els camps calculats, substitueix la lectura de dades per `getRawAndEntities()` i fusiona el recompte, seguint el mateix patró que ja usa `TagService.findAll` (`apps/api/src/modules/tag/tag.service.ts:29-37`).

A `person-sort.constants.ts`, afegeix `'attendedCount'` a `PERSON_SORT_BY_FIELDS` i l'entrada `attendedCount: 'person_attendedCount'` a `PERSON_SORT_COLUMN_MAP`.

- [ ] **Step 6: Exposa els camps nous al DTO de resposta**

A `person-response.dto.ts`, després de `positions`:

```ts
  @Expose()
  @Transform(({ obj }) =>
    evaluateTagCompliance(((obj.positions ?? []) as { category: TagCategory }[]).map((p) => p.category)),
  )
  tagCompliance: TagCompliance;

  @Expose()
  @Transform(({ obj }) => obj.attendedCount ?? 0)
  attendedCount: number;
```

Importa `evaluateTagCompliance`, `TagCompliance` i `TagCategory` de `@muixer/shared` i `Transform` de `class-transformer`.

- [ ] **Step 7: Assegura't que `positions` sempre està carregat allà on es construeix el DTO**

Run: `grep -n "PersonResponseDto" apps/api/src/modules/person/person.service.ts`

Per a cada `plainToInstance(PersonResponseDto, …)`, comprova que la consulta que l'alimenta carrega la relació `positions` (`leftJoinAndSelect('person.positions', …)` o `relations: ['positions']`). Afegeix-la on falte: sense ella `tagCompliance` sortiria sempre `ok: false`.

- [ ] **Step 8: Escriu la prova unitària del DTO**

A `person.service.spec.ts`:

```ts
    it('exposa tagCompliance calculada a partir de les etiquetes de la persona', async () => {
      personRepository.findOne.mockResolvedValue({
        id: 'p1',
        positions: [{ category: TagCategory.PINYA }, { category: TagCategory.TRONC }],
      } as unknown as Person);

      const result = await service.findOne('p1');

      expect(result.tagCompliance).toEqual({ ok: true, missing: [] });
    });
```

- [ ] **Step 9: Executa les proves i comprova que passen**

Run: `nx test api --testFile=apps/api/src/modules/person/person.service.spec.ts`
Expected: PASS.

Run: `nx run api:test-integration --testFile=apps/api/src/modules/person/person-tag-rule.integration.spec.ts`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/modules/person
git commit -m "feat(api): expose tagging rule compliance and season attendance count on persons"
```

---

### Task 6: `positionCategory` multivalor a l'assignació

**Files:**
- Modify: `apps/api/src/modules/node-assignment/dto/available-persons-query.dto.ts`
- Modify: `apps/api/src/modules/node-assignment/available-persons.service.ts:47-54,90,131-133`
- Test: `apps/api/src/modules/node-assignment/available-persons.service.spec.ts`

**Interfaces:**
- Consumes: `applyPositionCategoryFilter` (ja existeix, ja accepta llista).
- Produces: `AvailablePersonsQuery.positionCategory?: TagCategory[]` — la Task 9 hi envia una llista.

- [ ] **Step 1: Escriu la prova que falla**

A `available-persons.service.spec.ts`:

```ts
    it('filtra per diverses categories alhora', async () => {
      await service.findAvailable(instanceId, {
        positionCategory: [TagCategory.PINYA, TagCategory.ALTRES],
      });

      expect(applyPositionCategoryFilterMock).toHaveBeenCalledWith(
        expect.anything(),
        'person',
        [TagCategory.PINYA, TagCategory.ALTRES],
      );
    });
```

Mockeja `applyPositionCategoryFilter` amb `jest.mock('../person/utils/position-category-filter.util')` si el fitxer encara no ho fa; adapta la signatura de `findAvailable` a la que tinga el servei.

- [ ] **Step 2: Executa la prova i comprova que falla**

Run: `nx test api --testFile=apps/api/src/modules/node-assignment/available-persons.service.spec.ts`
Expected: FAIL — el tipus és de valor únic i la crida rep `[undefined]` o similar.

- [ ] **Step 3: Passa el paràmetre a llista**

A `available-persons-query.dto.ts`, substitueix la declaració de `positionCategory` per la mateixa forma que ja usa `PersonFilterDto`:

```ts
  @ApiPropertyOptional({ description: 'Filtrar per grups d\'etiquetes (multi-valor)', enum: TagCategory, isArray: true })
  @IsOptional()
  @Type(() => String)
  @Transform(({ value }) => (Array.isArray(value) ? value : value ? [value] : []))
  @IsEnum(TagCategory, { each: true })
  positionCategory?: TagCategory[];
```

A `available-persons.service.ts:53`, canvia el tipus a `positionCategory?: TagCategory[]` i el bloc `:131-133` per:

```ts
    if (positionCategory && positionCategory.length > 0) {
      applyPositionCategoryFilter(qb, 'person', positionCategory);
    }
```

- [ ] **Step 4: Executa la prova i comprova que passa**

Run: `nx test api --testFile=apps/api/src/modules/node-assignment/available-persons.service.spec.ts`
Expected: PASS.

- [ ] **Step 5: Comprova que el catàleg d'etiquetes accepta el grup nou**

A `apps/api/src/modules/tag/tag.service.spec.ts`, afegeix:

```ts
    it('filtra el catàleg pel grup XICALLA', async () => {
      await service.findAll({ category: [TagCategory.XICALLA] });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith('tag.category IN (:...categories)', {
        categories: [TagCategory.XICALLA],
      });
    });
```

Run: `nx test api --testFile=apps/api/src/modules/tag/tag.service.spec.ts`
Expected: PASS sense tocar `TagService` — `TagFilterDto` valida amb `@IsEnum(TagCategory)` i el valor nou hi entra sol. Si falla, el DTO té una llista blanca escrita a mà: afegeix-hi `XICALLA`.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/node-assignment apps/api/src/modules/tag
git commit -m "feat(api): accept multiple tag groups in the available persons filter"
```

---

### Task 7: Configuració d'etiquetes amb quatre grups

**Files:**
- Modify: `apps/dashboard/src/app/features/config/components/tags-list/tags-list.component.ts:22-26`
- Modify: `apps/dashboard/src/app/features/config/components/tag-form-modal/tag-form-modal.component.ts:66-121`
- Test: `apps/dashboard/src/app/features/config/components/tags-list/tags-list.component.spec.ts`
- Test: `apps/dashboard/src/app/features/config/components/tag-form-modal/tag-form-modal.component.spec.ts`

**Interfaces:**
- Consumes: `TagCategory.XICALLA`, `TAG_CATEGORY_LABELS`, `TAG_VIEWS` (Task 1).
- Produces: cap interfície nova; només comportament d'UI.

- [ ] **Step 1: Escriu les proves que fallen**

A `tags-list.component.spec.ts`:

```ts
  it('ordena els grups pinya, tronc, xicalla i altres', () => {
    const ordered = component.sortedTags([
      { category: TagCategory.ALTRES, name: 'Acompanyant' },
      { category: TagCategory.XICALLA, name: 'Xicalla' },
      { category: TagCategory.TRONC, name: 'Segona' },
      { category: TagCategory.PINYA, name: 'Mans' },
    ] as TagWithCount[]);

    expect(ordered.map((tag) => tag.category)).toEqual([
      TagCategory.PINYA,
      TagCategory.TRONC,
      TagCategory.XICALLA,
      TagCategory.ALTRES,
    ]);
  });
```

A `tag-form-modal.component.spec.ts`:

```ts
  it('no ofereix cap grup de positionTypes per a xicalla', () => {
    component.form.get('category')!.setValue(TagCategory.XICALLA);

    expect(component.visiblePositionTypeGroups()).toEqual([]);
  });
```

Adapta els noms (`sortedTags`, `TagWithCount`) als que ja existeixen als components.

- [ ] **Step 2: Executa-les i comprova que fallen**

Run: `nx test dashboard`
Expected: FAIL — `CATEGORY_ORDER` no té `XICALLA` i l'ordre surt malament.

- [ ] **Step 3: Afegeix el grup nou a l'ordenació**

A `tags-list.component.ts:22-26`:

```ts
const CATEGORY_ORDER: Record<TagCategory, number> = {
  [TagCategory.PINYA]: 0,
  [TagCategory.TRONC]: 1,
  [TagCategory.XICALLA]: 2,
  [TagCategory.ALTRES]: 3,
};
```

- [ ] **Step 4: Verifica el formulari**

`visiblePositionTypeGroups` (`tag-form-modal.component.ts:117-121`) filtra `positionTypeGroups` per categoria; com que cap grup té `category: TagCategory.XICALLA`, XICALLA ja retorna la llista buida sense tocar res. Executa la prova per confirmar-ho abans d'escriure cap codi nou; si passa, no afegisques res.

- [ ] **Step 5: Executa les proves i comprova que passen**

Run: `nx test dashboard`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/src/app/features/config
git commit -m "feat(dashboard): support the XICALLA tag group in the tag catalog screen"
```

---

### Task 8: Component compartit de visualitzacions

**Files:**
- Create: `apps/dashboard/src/app/shared/components/data/tag-view-filter/tag-view-filter.component.ts`
- Test: `apps/dashboard/src/app/shared/components/data/tag-view-filter/tag-view-filter.component.spec.ts`

**Interfaces:**
- Consumes: `TAG_VIEWS`, `TagCategory`, `TAG_CATEGORY_LABELS` (Task 1); `lib-button` de `@muixer/ui`.
- Produces: `<app-tag-view-filter [selected]="TagCategory[]" (selectedChange)="…" />` — el fan servir les tasques 9 i 10.

- [ ] **Step 1: Escriu la prova que falla**

Crea `tag-view-filter.component.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { TagCategory } from '@muixer/shared';
import { TagViewFilterComponent } from './tag-view-filter.component';

describe('TagViewFilterComponent', () => {
  const create = () => {
    const fixture = TestBed.createComponent(TagViewFilterComponent);
    fixture.componentRef.setInput('selected', []);
    fixture.detectChanges();
    return fixture;
  };

  it('el preset de guió selecciona xicalla i tronc', () => {
    const fixture = create();
    const emitted: TagCategory[][] = [];
    fixture.componentInstance.selectedChange.subscribe((v) => emitted.push(v));

    fixture.componentInstance.applyView('guio');

    expect(emitted).toEqual([[TagCategory.XICALLA, TagCategory.TRONC]]);
  });

  it('el preset de pinyes selecciona pinya i altres', () => {
    const fixture = create();
    const emitted: TagCategory[][] = [];
    fixture.componentInstance.selectedChange.subscribe((v) => emitted.push(v));

    fixture.componentInstance.applyView('pinyes');

    expect(emitted).toEqual([[TagCategory.PINYA, TagCategory.ALTRES]]);
  });

  it('activar un grup ja seleccionat el lleva', () => {
    const fixture = TestBed.createComponent(TagViewFilterComponent);
    fixture.componentRef.setInput('selected', [TagCategory.PINYA, TagCategory.TRONC]);
    fixture.detectChanges();
    const emitted: TagCategory[][] = [];
    fixture.componentInstance.selectedChange.subscribe((v) => emitted.push(v));

    fixture.componentInstance.toggleGroup(TagCategory.PINYA);

    expect(emitted).toEqual([[TagCategory.TRONC]]);
  });

  it('marca el preset com a actiu quan la selecció hi coincideix exactament', () => {
    const fixture = TestBed.createComponent(TagViewFilterComponent);
    fixture.componentRef.setInput('selected', [TagCategory.TRONC, TagCategory.XICALLA]);
    fixture.detectChanges();

    expect(fixture.componentInstance.isViewActive('guio')).toBe(true);
    expect(fixture.componentInstance.isViewActive('pinyes')).toBe(false);
  });
});
```

- [ ] **Step 2: Executa-la i comprova que falla**

Run: `nx test dashboard`
Expected: FAIL — el component no existeix.

- [ ] **Step 3: Implementa el component**

Crea `tag-view-filter.component.ts`:

```ts
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TAG_CATEGORY_LABELS, TAG_VIEWS, TagCategory, TagView } from '@muixer/shared';
import { ButtonComponent } from '@muixer/ui';

/**
 * Selector de grups d'etiquetes amb les dues visualitzacions de la tècnica: «Guió»
 * (xicalla + tronc) i «Pinyes» (pinya + altres). Selecció buida = tots els grups.
 */
@Component({
  selector: 'app-tag-view-filter',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent],
  template: `
    <div class="flex flex-wrap items-center gap-2">
      @for (view of views; track view.id) {
        <lib-button
          size="sm"
          variant="outline"
          [active]="isViewActive(view.id)"
          (clicked)="applyView(view.id)"
        >{{ view.label }}</lib-button>
      }

      <span class="divider divider-horizontal mx-0"></span>

      @for (group of groups; track group) {
        <lib-button
          size="sm"
          variant="ghost"
          [active]="selected().includes(group)"
          (clicked)="toggleGroup(group)"
        >{{ labels[group] }}</lib-button>
      }
    </div>
  `,
})
export class TagViewFilterComponent {
  readonly selected = input.required<TagCategory[]>();
  readonly selectedChange = output<TagCategory[]>();

  readonly views = TAG_VIEWS;
  readonly groups = Object.values(TagCategory);
  readonly labels = TAG_CATEGORY_LABELS;

  private readonly selectedSet = computed(() => new Set(this.selected()));

  isViewActive(id: TagView['id']): boolean {
    const view = TAG_VIEWS.find((v) => v.id === id);
    if (!view) return false;
    const current = this.selectedSet();
    return current.size === view.groups.length && view.groups.every((g) => current.has(g));
  }

  applyView(id: TagView['id']): void {
    const view = TAG_VIEWS.find((v) => v.id === id);
    if (!view) return;
    this.selectedChange.emit(this.isViewActive(id) ? [] : [...view.groups]);
  }

  toggleGroup(group: TagCategory): void {
    const current = this.selected();
    this.selectedChange.emit(
      current.includes(group) ? current.filter((g) => g !== group) : [...current, group],
    );
  }
}
```

- [ ] **Step 4: Executa la prova i comprova que passa**

Run: `nx test dashboard`
Expected: PASS. Si `lib-button` no accepta `active` o `variant="ghost"`, mira l'API real a `libs/ui/src/lib/components/button/` i ajusta la plantilla — no afegisques classes DaisyUI a mà.

- [ ] **Step 5: Connecta'l al catàleg d'etiquetes**

A `apps/dashboard/src/app/features/config/components/tags-list/tags-list.component.html`, afegeix el component damunt de la llista:

```html
<app-tag-view-filter [selected]="selectedGroups()" (selectedChange)="selectedGroups.set($event)" />
```

i al component: `readonly selectedGroups = signal<TagCategory[]>([]);` més un `computed` que filtre les etiquetes visibles quan `selectedGroups()` no està buit, mantenint l'ordre per grup que ja hi ha. Afegeix `TagViewFilterComponent` als `imports`.

Prova, a `tags-list.component.spec.ts`:

```ts
  it('filtra el catàleg pels grups seleccionats', () => {
    component.tags.set([
      { category: TagCategory.PINYA, name: 'Mans' },
      { category: TagCategory.TRONC, name: 'Segona' },
    ] as TagWithCount[]);

    component.selectedGroups.set([TagCategory.TRONC]);

    expect(component.visibleTags().map((tag) => tag.name)).toEqual(['Segona']);
  });
```

- [ ] **Step 6: Executa les proves i comprova que passen**

Run: `nx test dashboard`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/dashboard/src/app/shared/components/data/tag-view-filter apps/dashboard/src/app/features/config
git commit -m "feat(dashboard): add shared tag view filter component"
```

---

### Task 9: Llistat de persones — visualitzacions, avís de regla i seguiment

**Files:**
- Modify: `apps/dashboard/src/app/features/persons/models/person.model.ts`
- Modify: `apps/dashboard/src/app/features/persons/components/person-list.component.ts:118-190,441-443`
- Modify: `apps/dashboard/src/app/features/persons/components/person-list.component.html`
- Test: `apps/dashboard/src/app/features/persons/components/person-list.component.spec.ts`

**Interfaces:**
- Consumes: `TagViewFilterComponent` (Task 8); `PersonResponseDto.tagCompliance` i `attendedCount` (Task 5); `PersonFilterDto.tagRuleOk` (Task 5).
- Produces: cap interfície nova.

- [ ] **Step 1: Escriu les proves que fallen**

A `person-list.component.spec.ts`:

```ts
  it('envia tagRuleOk=false quan s\'activa el filtre de la regla', () => {
    component.toggleTagRuleFilter();

    expect(component.activeFilters().tagRuleOk).toBe(false);
  });

  it('desactiva el filtre de la regla si es torna a prémer', () => {
    component.toggleTagRuleFilter();
    component.toggleTagRuleFilter();

    expect(component.activeFilters().tagRuleOk).toBeUndefined();
  });

  it('redacta l\'avís amb els grups que falten', () => {
    const text = component.missingTagsLabel({
      ok: false,
      missing: [TagCategory.TRONC],
    });

    expect(text).toBe('Falta etiqueta de Tronc');
  });

  it('no redacta cap avís quan compleix la regla', () => {
    expect(component.missingTagsLabel({ ok: true, missing: [] })).toBe('');
  });
```

- [ ] **Step 2: Executa-les i comprova que fallen**

Run: `nx test dashboard`
Expected: FAIL — `toggleTagRuleFilter` i `missingTagsLabel` no existeixen.

- [ ] **Step 3: Amplia el model de persona del dashboard**

A `features/persons/models/person.model.ts`, afegeix al tipus `Person`:

```ts
  tagCompliance: TagCompliance;
  attendedCount: number;
```

i a `PersonFilterParams`:

```ts
  tagRuleOk?: boolean;
```

Importa `TagCompliance` de `@muixer/shared`.

- [ ] **Step 4: Implementa el filtre i l'avís al component**

A `person-list.component.ts`, afegeix:

```ts
  toggleTagRuleFilter(): void {
    this.toggleFilter('tagRuleOk', false);
    this.page.set(1);
    this.loadPersons();
  }

  missingTagsLabel(compliance: TagCompliance): string {
    if (compliance.ok) return '';
    const groups = compliance.missing.map((group) => TAG_CATEGORY_LABELS[group]).join(' i ');
    return `Falta etiqueta de ${groups}`;
  }
```

Importa `TAG_CATEGORY_LABELS` i `TagCompliance` de `@muixer/shared`. Comprova que `toggleFilter` lleva la clau quan el valor coincideix (`person-list.component.ts:191-200`) — és el que fa que la segona premuda desactive el filtre.

Afegeix `attendedCount` a `ALL_COLUMNS` com a columna ordenable amb etiqueta «Assistències» i, a `hasFilterChips`, inclou `this.activeFilters().tagRuleOk !== undefined`.

- [ ] **Step 5: Connecta la UI**

A `person-list.component.html`:

1. substitueix els xips de categoria actuals pel component compartit:

```html
<app-tag-view-filter
  [selected]="selectedCategories()"
  (selectedChange)="onCategoriesChange($event)"
/>
```

   i afegeix `TagViewFilterComponent` als `imports` del component. `onCategoriesChange` ja accepta una llista de categories (`person-list.component.ts:180-188`), així que no cal tocar-la.

2. afegeix el botó del filtre de la regla al costat del d'«Actius», amb `lib-button` i el text «No compleix la regla», lligat a `toggleTagRuleFilter()` i amb `[active]="activeFilters().tagRuleOk === false"`;

3. a la cel·la del nom de la taula, mostra el badge d'avís només quan cal:

```html
@if (!person.tagCompliance.ok) {
  <lib-badge variant="warning" size="sm" [title]="missingTagsLabel(person.tagCompliance)">
    Sense etiquetar
  </lib-badge>
}
```

- [ ] **Step 6: Desambigua el filtre de xicalla**

Ara conviuen dues coses que es diuen «xicalla»: el boolean `isXicalla` (menors) i el grup d'etiquetes. Al filtre existent que usa `isXicalla`, canvia el text visible a «Menor de 16» i deixa «Xicalla» només per al grup d'etiquetes. Busca'ls amb:

Run: `grep -rn "Xicalla" apps/dashboard/src/app/features/persons`

- [ ] **Step 7: Executa les proves i comprova que passen**

Run: `nx test dashboard`
Expected: PASS.

Run: `nx lint dashboard && nx build dashboard`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/dashboard/src/app/features/persons
git commit -m "feat(dashboard): add tag views, rule warning badge and attendance follow-up to the person list"
```

---

### Task 10: Panell d'assignació i participació amb grups múltiples

**Files:**
- Modify: `apps/dashboard/src/app/features/pinyes/components/person-panel/person-panel.component.ts:78-95,343-372,416-417,467-472`
- Modify: `apps/dashboard/src/app/features/pinyes/components/person-panel/person-panel.component.html:139-151`
- Modify: `apps/dashboard/src/app/features/events/components/event-participation/event-participation.component.ts:106,130,157-164,229-230,662,692-711`
- Modify: `apps/dashboard/src/app/features/events/components/event-participation/event-participation.component.html`
- Test: `apps/dashboard/src/app/features/pinyes/components/person-panel/person-panel.component.spec.ts`
- Test: `apps/dashboard/src/app/features/events/components/event-participation/event-participation.component.spec.ts`

**Interfaces:**
- Consumes: `TagViewFilterComponent` (Task 8); `positionCategory` com a llista (Task 6).
- Produces: cap interfície nova.

- [ ] **Step 1: Escriu les proves que fallen**

A `person-panel.component.spec.ts`:

```ts
  it('envia positionCategory com a llista', () => {
    component.onCategoryFilterChange([TagCategory.PINYA, TagCategory.ALTRES]);

    expect(lastQuery().positionCategory).toEqual([TagCategory.PINYA, TagCategory.ALTRES]);
  });

  it('omet positionCategory quan no hi ha cap grup seleccionat', () => {
    component.onCategoryFilterChange([]);

    expect(lastQuery().positionCategory).toBeUndefined();
  });

  it('preselecciona el grup del node quan se\'n tria un de pinya', () => {
    component.onNodeSelected({ zone: FigureZone.PINYA, positionType: 'mans' } as InstanceNode);

    expect(component.selectedCategories()).toEqual([TagCategory.PINYA]);
  });
```

A `event-participation.component.spec.ts`:

```ts
  it('filtra les files per qualsevol dels grups seleccionats', () => {
    component.onCategoriesChange([TagCategory.TRONC, TagCategory.XICALLA]);

    const categories = component.filteredRows().flatMap((r) => r.positions.map((p) => p.category));
    expect(categories.every((c) => c === TagCategory.TRONC || c === TagCategory.XICALLA)).toBe(true);
  });
```

Adapta `lastQuery`, `onNodeSelected` i `filteredRows` als noms reals dels components.

- [ ] **Step 2: Executa-les i comprova que fallen**

Run: `nx test dashboard`
Expected: FAIL — els components encara treballen amb una categoria única.

- [ ] **Step 3: Passa el panell de persones a grups múltiples**

A `person-panel.component.ts`:

1. `selectedCategory = signal<TagCategory | null>(null)` passa a `selectedCategories = signal<TagCategory[]>([])`;
2. `onCategoryFilterChange(category: TagCategory | null)` passa a `onCategoryFilterChange(categories: TagCategory[])`, que fa `this.selectedCategories.set(categories)` i recarrega;
3. `:416-417` passa a:

```ts
    const categories = this.selectedCategories();
    if (categories.length > 0) query['positionCategory'] = categories;
```

4. la selecció automàtica en triar node (`:343-351`) passa a `this.selectedCategories.set(category ? [category] : [])`, mantenint `categoryForZone` tal com està;
5. la neteja del filtre d'etiqueta quan la categoria ja no encaixa (`:347-350`, `:467-472`) passa a comprovar `categories.length === 0 || categories.includes(tag.category)`;
6. el filtre del desplegable d'etiquetes (`:87-95`) fa la mateixa comprovació.

A `person-panel.component.html:139-151`, substitueix els dos `lib-button` de categoria per:

```html
<app-tag-view-filter
  [selected]="selectedCategories()"
  (selectedChange)="onCategoryFilterChange($event)"
/>
```

i afegeix `TagViewFilterComponent` als `imports`.

- [ ] **Step 4: Passa la participació a grups múltiples**

A `event-participation.component.ts`:

1. `filterableCategories` (`:106`) passa a `Object.values(TagCategory)` — ara inclou XICALLA;
2. `categoryFilter = signal<TagCategory | null>(null)` passa a `categoryFilters = signal<TagCategory[]>([])`, amb un mètode `onCategoriesChange(categories: TagCategory[])`;
3. el filtre de files (`:164`) passa a:

```ts
    if (categories.length > 0) {
      rows = rows.filter((r) => r.positions.some((p) => categories.includes(p.category)));
    }
```

4. el xip de filtre actiu (`:229-230`) llista les etiquetes dels grups seleccionats separades per comes, i el seu `clear` (`:692-693`) buida l'array;
5. les columnes d'etiquetes per grup (`:307-325`) guanyen la de XICALLA, amb el mateix patró que les tres existents.

A la plantilla, substitueix el selector de categoria única pel component compartit, igual que als altres llocs.

- [ ] **Step 5: Executa les proves i comprova que passen**

Run: `nx test dashboard`
Expected: PASS.

Run: `nx lint dashboard && nx build dashboard`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/src/app/features/pinyes apps/dashboard/src/app/features/events
git commit -m "feat(dashboard): filter assignment and participation views by multiple tag groups"
```

---

### Task 11: Documentació

**Files:**
- Create: `docs/TAGS.md`
- Modify: `docs/MAP.md`
- Modify: `CLAUDE.md`
- Modify: `docs/DATA_MODEL.md` (generat)

**Interfaces:**
- Consumes: tot l'anterior.
- Produces: la documentació de referència del sistema d'etiquetes.

- [ ] **Step 1: Escriu `docs/TAGS.md`**

Crea el fitxer amb frontmatter `tags: [domini]` i aquestes seccions, escrites en prosa normal (no és cap resum: és la referència que consultarà qui toque etiquetes d'ací a un any):

1. **Model** — `Tag` a la taula `positions`, camps, M:N amb `Person` via `person_positions`, i que `category` és el «grup».
2. **Els quatre grups i el catàleg** — la taula del catàleg definitiu amb grup, nom, slug i `positionTypes`, copiada de l'spec.
3. **Relació amb les posicions de les plantilles** — la part central: `Tag.positionTypes` apunta als `positionType` dels presets de node (`libs/shared/src/constants/node-preset.constants.ts`) **sense clau forana ni validació**; no filtra res al servidor; només ordena candidats al panell de persones i pinta el punt de coincidència. Explica què implica per a qui cree una etiqueta nova: si no posa `positionTypes` l'etiqueta funciona igual, només perd l'ajuda d'ordenació.
4. **Regla mínima** — les tres condicions, que n'hi ha prou amb una, que satisfer-ne diverses és normal, i que mai bloqueja res. On es veu: badge, filtre, columna d'assistències.
5. **`isXicalla` vs. grup XICALLA** — què és cadascun i quan filtrar per un o per l'altre.
6. **Valor per defecte a l'alta** i com se'n fa el seguiment.
7. **Origen de les dades** — el sync legacy ja no importa etiquetes; el catàleg és propietat de MuixerApp i s'edita a `/config/tags`; referència a la migració `1784700000000-TagCatalog`.

Acaba amb el peu `*Veïns: [[DATA_MODEL]] · [[PINYES_MODULE]] · [[SYNC_ARCHITECTURE]] · [[DASHBOARD_UI]]*`.

- [ ] **Step 2: Registra el doc nou al mapa**

Afegeix una fila a la taula de docs de domini de `docs/MAP.md` (fora dels marcadors `BEGIN:AUTO`/`END:AUTO`) amb l'enllaç `[[TAGS]]` i una descripció d'una línia.

- [ ] **Step 3: Actualitza `CLAUDE.md`**

Substitueix la fila del mòdul `tag` de la taula de mòduls per una que reflectisca els quatre grups i que remeta a `docs/TAGS.md`, i comprova si alguna altra menció d'etiquetes del fitxer ha quedat desfasada.

- [ ] **Step 4: Regenera la documentació automàtica**

Run: `pnpm run docs:map && pnpm run docs:model`
Expected: canvis només dins dels marcadors `BEGIN:AUTO`/`END:AUTO`.

- [ ] **Step 5: Passa la verificació completa**

Run: `pnpm run ci:local`
Expected: PASS — lint, proves i build dels tres projectes.

Run: `nx run api:test-integration`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add docs CLAUDE.md
git commit -m "docs: document the tag groups, the tagging rule and their link to figure positions"
```
