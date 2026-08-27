import { TestBed } from '@angular/core/testing';
import { TagCategory } from '@muixer/shared';
import { TagViewFilterComponent } from './tag-view-filter.component';

describe('TagViewFilterComponent', () => {
  const create = (selected: TagCategory[] = [], groups?: TagCategory[]) => {
    const fixture = TestBed.createComponent(TagViewFilterComponent);
    fixture.componentRef.setInput('selected', selected);
    if (groups) fixture.componentRef.setInput('groups', groups);
    fixture.detectChanges();
    return fixture;
  };

  const chipTexts = (fixture: ReturnType<typeof create>): string[] =>
    Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLElement>)
      .map((button) => button.textContent!.trim());

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TagViewFilterComponent],
    }).compileComponents();
  });

  it('ofereix els quatre grups per defecte, en l\'ordre del catàleg', () => {
    expect(chipTexts(create())).toEqual(['Pinya', 'Tronc', 'Xicalla', 'Altres']);
  });

  it('ofereix només els grups indicats quan se li passen', () => {
    const fixture = create([], [TagCategory.PINYA, TagCategory.TRONC]);
    expect(chipTexts(fixture)).toEqual(['Pinya', 'Tronc']);
  });

  it('activar un grup no seleccionat l\'afig', () => {
    const fixture = create();
    const emitted: TagCategory[][] = [];
    fixture.componentInstance.selectedChange.subscribe((v) => emitted.push(v));

    fixture.componentInstance.toggleGroup(TagCategory.PINYA);

    expect(emitted).toEqual([[TagCategory.PINYA]]);
  });

  it('activar un grup ja seleccionat el lleva', () => {
    const fixture = create([TagCategory.PINYA, TagCategory.TRONC]);
    const emitted: TagCategory[][] = [];
    fixture.componentInstance.selectedChange.subscribe((v) => emitted.push(v));

    fixture.componentInstance.toggleGroup(TagCategory.PINYA);

    expect(emitted).toEqual([[TagCategory.TRONC]]);
  });
});
