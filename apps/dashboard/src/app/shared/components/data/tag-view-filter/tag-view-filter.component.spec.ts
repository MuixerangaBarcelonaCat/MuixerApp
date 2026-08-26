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

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TagViewFilterComponent],
    }).compileComponents();
  });

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
