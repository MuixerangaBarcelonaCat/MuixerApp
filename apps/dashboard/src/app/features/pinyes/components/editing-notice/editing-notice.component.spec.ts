import { TestBed } from '@angular/core/testing';
import { EditingNoticeComponent } from './editing-notice.component';

describe('EditingNoticeComponent', () => {
  const EXPLANATION =
    "Podeu editar el segment alhora sense problemes. Si canvieu les mateixes posicions, els canvis d'un poden desfer els de l'altre.";

  const render = (aliases: string[]) => {
    const fixture = TestBed.createComponent(EditingNoticeComponent);
    fixture.componentRef.setInput('aliases', aliases);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };
  const text = (el: HTMLElement) =>
    (el.querySelector('[data-testid="editing-badge"]')?.textContent ?? '').replace(/\s+/g, ' ').trim();

  it('renders nothing when nobody else is editing', () => {
    expect(render([]).querySelector('[data-testid="editing-badge"]')).toBeNull();
  });

  it('joins one, two and three aliases', () => {
    expect(text(render(['Pere']))).toBe('Pere està editant este segment');
    expect(text(render(['Pere', 'Anna']))).toBe('Pere i Anna estan editant este segment');
    expect(text(render(['Pere', 'Anna', 'Joan']))).toBe('Pere, Anna i Joan estan editant este segment');
  });

  it('uses the warning colour and never wraps the text', () => {
    const badge = render(['Pere']).querySelector('[data-testid="editing-badge"]') as HTMLElement;
    expect(badge.querySelector('.badge')?.classList).toContain('badge-warning');
    expect(badge.classList).toContain('whitespace-nowrap');
  });

  it('the info icon carries the concurrent-editing explanation in ariaLabel and tooltip', () => {
    const tooltip = render(['Pere']).querySelector('[data-testid="editing-info"]') as HTMLElement;
    expect(tooltip.classList).toContain('tooltip');
    expect(tooltip.getAttribute('data-tip')).toBe(EXPLANATION);
    expect(tooltip.querySelector('button')?.getAttribute('aria-label')).toBe(EXPLANATION);
  });
});
