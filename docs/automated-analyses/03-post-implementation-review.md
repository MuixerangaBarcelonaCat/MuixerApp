# Post-Implementation Review — Audit 02 Fixes

> Revisió de la implementació dels 4 plans derivats de [02-pwa-branch-review.md](02-pwa-branch-review.md). Data: 2026-07-08. Severitat: 🔴 Trenca CI · 🟠 Bug introduït · 🟡 Millora pendent.

## Resum executiu

**63 de 66 troballes implementades correctament.** La implementació és sòlida i cobreix totes les àrees crítiques de l'auditoria. Tanmateix, **3 regressions en tests** impedeixen que CI passi: els specs de `me.service`, `node-assignment.service` i `person-panel` no s'han actualitzat per reflectir els canvis d'implementació (B5 upsert, B8 transacció, AC7 debounce).

| Suite | Resultat |
|-------|----------|
| `nx test pwa` | ✅ 16 fitxers, 103 tests — tot passa |
| `nx test api` | ❌ 2 suites fallen, 6 tests — **568 passen** |
| `nx test dashboard` | ❌ 1 suite falla, 19 tests — **940 passen** |

---

## 🔴 Regressions que trenquen CI (3 ítems)

### R1 — `me.service.spec.ts`: mock sense `upsert` ni `findOneOrFail` (3 tests)

**Causa arrel:** El fix B5 va canviar l'atenció de `find → create → save` a `repository.upsert()` + `findOneOrFail()`, però el mock del repositori `Attendance` (línia 66-70) només té `findOne`, `create`, `save`.

**Tests afectats:**
- "should create new attendance record"
- "should update existing attendance record"
- "should call recalculateSummary after upsert"

**Fix:**
1. Afegir `upsert: jest.fn().mockResolvedValue(undefined)` i `findOneOrFail: jest.fn()` al mock del repositori
2. Reescriure els 3 tests per verificar que `upsert` es crida amb els paràmetres correctes i que `findOneOrFail` retorna l'attendance

```typescript
// Al mock del repositori Attendance:
{
  provide: getRepositoryToken(Attendance),
  useValue: {
    findOne: jest.fn(),
    findOneOrFail: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    upsert: jest.fn().mockResolvedValue(undefined),
  },
},
```

---

### R2 — `node-assignment.service.spec.ts`: bulkImport ad-hoc no mocka `transaction` (3 tests)

**Causa arrel:** El fix B8 va embolicar el clonatge de nodes ad-hoc dins de `dataSource.transaction()`, però els 3 tests de clonatge ad-hoc no configuren `mockDataSource.transaction` amb `mockImplementation`.

**Tests afectats:**
- "clones ad-hoc nodes from source to target"
- "clones DECORATION nodes without attempting assignment"
- "clones ad-hoc FIGURE_DIRECTION node normally during import"

**Fix:** Afegir `mockDataSource.transaction.mockImplementation((cb) => cb(manager))` amb un manager que tingui `save: jest.fn()` abans de cada test de clonatge:

```typescript
const cloneManager = { save: jest.fn().mockImplementation((_, entities) => entities) };
mockDataSource.transaction.mockImplementation((cb: any) => cb(cloneManager));
```

---

### R3 — `person-panel.component.spec.ts`: 19 tests fallen pel `debounceTime(250)` (19 tests)

**Causa arrel:** El fix AC7 va substituir les crides síncrones a `getAvailablePersons` per un `Subject` + `debounceTime(250)` + `switchMap`. Tots els tests que comproven que `getAvailablePersons` es crida immediatament fallen perquè la crida es retarda 250ms.

**Tests afectats:** Inicialització, filtres (xicalla, alçada, etiqueta, cerca), agrupació (isPast), interacció ("Refrescar"). Total: 19 tests.

**Fix:** Usar `fakeAsync` + `tick(250)` per avançar el debounce:

```typescript
it('filters by xicalla checkbox', fakeAsync(() => {
  component.onXicallaChange(false);
  tick(250); // avança el debounce
  fixture.detectChanges();
  expect(assignmentService.getAvailablePersons).toHaveBeenCalledWith(
    expect.anything(), expect.anything(),
    expect.objectContaining({ isXicalla: false }),
  );
}));
```

Per a l'`initialization`, enviar el `loadPersons$.next()` inicial al `beforeEach` i fer `tick(250)` + `flush()` per garantir que la subscripció inicial s'ha processat.

---

## 🟡 Millores pendents (no bloquegen)

### M1 — PWA-B1: Calendari sense indicador de truncament

El fix de B1 va afegir un indicador de truncament a la vista de llista (`isTruncated` signal + missatge), però la vista de calendari (limit 200) no té cap indicador equivalent. Si una temporada té >200 events, el calendari mostraria mesos "buits" sense avisar l'usuari.

**Recomanació:** Afegir `isTruncated` també a la càrrega del calendari, o pujar el limit a un valor suficient (p.ex. 365).

---

### M2 — B8: Les assignacions ad-hoc del `bulkImport` queden fora de la transacció

El fix B8 va embolicar el `save` de nodes clonats dins d'una transacció, però les crides posteriors d'`assign()` per a cada node clonat segueixen fent-se fora de la transacció (lines 932-956 de `node-assignment.service.ts`). Si una assignació falla a mig camí, els nodes clonats existeixen però les assignacions són parcials.

**Impacte:** Baix — la idempotència via `originNodeId` mitiga el reintent. Però l'atomicitat completa demanaria embolicar tot el bloc (clone + assign) dins una sola transacció.

---

## ✅ Verificació completa per pla

### Plan 1 — CI + Backend Data Integrity: **8/8 PASS**

| # | Troballa | Estat |
|---|----------|-------|
| CI spec fix (`noShow` → `childrenAttended`) | ✅ |
| API-M1 color hex corrupte | ✅ |
| API-M3 backfill migració `attendanceSummary` | ✅ |
| API-M4 SEC-7 complet (TECHNICAL no pot tocar ADMIN) | ✅ |
| DB-EV1 recompte d'adults (`childrenAttended`) | ✅ |
| S11 `@Roles` a `MeController` | ✅ |
| S12 eliminat stub `assertNotComposition` | ✅ |
| S13 `@IsNotEmpty()` a tag DTO | ✅ |

### Plan 2 — PWA Core Bugs: **11/12 PASS, 1 PARTIAL**

| # | Troballa | Estat |
|---|----------|-------|
| PWA-A1 `ASSISTIT` al botó + lock | ✅ |
| PWA-M5 `linkedSignal` reemplaça `effect` | ✅ |
| PWA-M1/M2 interceptor scoping + logout | ✅ |
| PWA-M3 `(attendanceChanged)` a totes les instàncies | ✅ |
| PWA-M4 roles guard sense bucle | ✅ |
| PWA-B2 `startTime | slice:0:5` | ✅ |
| PWA-B3 `[disabled]="isPast()"` | ✅ |
| PWA-B4 `touchcancel` listener | ✅ |
| PWA-B5 `returnUrl` als guards | ✅ |
| PWA-B6 `logoMuixe.png` al splash | ✅ |
| PWA-B7 deduplicació toasts 401 | ✅ |
| PWA-B1 paginació / truncament | 🟡 PARTIAL (llista ok, calendari pendent) |

### Plan 3 — Dashboard Events/Segments + Shared: **16/16 PASS**

| # | Troballa | Estat |
|---|----------|-------|
| EV2 navegació confirmació | ✅ |
| EV3 `concatMap` en lloc de `forkJoin` | ✅ |
| PR1 `console.log` eliminats | ✅ |
| PR2 drecera redo `.toLowerCase()` | ✅ |
| PR3 sticky + `table-zebra` | ✅ |
| PR4 scroll amb `capture: true` | ✅ |
| PR5 `fullscreenElement` check | ✅ |
| EV4 revert visual del mode | ✅ |
| EV5 camps opcionals envien `null` | ✅ |
| EV6 rename `position` → `tag` | ✅ |
| EV7 codi mort eliminat | ✅ |
| EV8 error handler a `preselectCurrentSeason` | ✅ |
| EV9 computed → mètodes | ✅ |
| PR6 columna tronc condicional | ✅ |
| PR8 referència d'ítem al menú | ✅ |
| PR9 `projectionAngle: number | null` | ✅ |

### Plan 4+5 — Assignment + PWA Foundations + Backend: **19/19 PASS**

| # | Troballa | Estat |
|---|----------|-------|
| DB-AC1 `ellipse` a `DECORATION_POSITION_TYPES` | ✅ |
| DB-AC2 `untracked()` al person-panel effect | ✅ |
| AC3 `snapshotted` no forçat a `true` | ✅ |
| AC5 single write owner (pare) | ✅ |
| AC6 rollback granular | ✅ |
| AC7 `Subject` + `debounceTime` + `switchMap` | ✅ |
| AC8 refresh en error de `forkJoin` | ✅ |
| AC9 cursor `default` en cancel·lar placement | ✅ |
| AC10 panell col·lapsable vestigial eliminat | ✅ |
| AC11 `addEventListener` dinàmic per drag | ✅ |
| AC4 serveis morts eliminats | ✅ |
| P1 service worker + `ngsw-config.json` | ✅ |
| P2 meta iOS | ✅ |
| P3 Google Fonts eliminat | ✅ |
| P4 manifest `description` + `orientation: any` | ✅ |
| B5 upsert atòmic | ✅ (specs pendents → R1) |
| B6 `getLocalToday()` compartit | ✅ |
| B7 `EXCLUDE` constraint per solapament | ✅ |
| B8 transacció al clonatge bulkImport | ✅ (specs pendents → R2, assignacions fora → M2) |

---

## Acció requerida

| Prioritat | Ítem | Esforç |
|-----------|------|--------|
| 🔴 Immediat | R1: Actualitzar mock + tests de `me.service.spec.ts` | ~15 min |
| 🔴 Immediat | R2: Afegir `transaction.mockImplementation` als 3 tests de `node-assignment.service.spec.ts` | ~10 min |
| 🔴 Immediat | R3: Afegir `fakeAsync` + `tick(250)` als 19 tests de `person-panel.component.spec.ts` | ~30 min |
| 🟡 Seguiment | M1: Indicador de truncament al calendari PWA | ~5 min |
| 🟡 Seguiment | M2: Assignacions ad-hoc dins transacció al bulkImport | ~20 min |

**Total estimat per desbloquejar CI: ~55 minuts.**
