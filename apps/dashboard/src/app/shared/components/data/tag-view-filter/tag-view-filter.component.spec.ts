import { TestBed } from '@angular/core/testing';
import { TagCategory } from '@muixer/shared';
import { TagViewFilterComponent } from './tag-view-filter.component';

describe('TagViewFilterComponent', () => {
  const create = (selected: TagCategory[] = []) => {
    const fixture = TestBed.createComponent(TagViewFilterComponent);
    fixture.componentRef.setInput('selected', selected);
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TagViewFilterComponent],
    }).compileComponents();
  });

  it('activar un grup no seleccionat lafig', () => {
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
