import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ToastService } from '@muixer/ui';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';
import { PersonService } from '../../services/person.service';
import { InviteLinkPanelComponent } from './invite-link-panel.component';

const LINK = {
  inviteUrl: 'https://pwa.test/activate?token=abc123',
  // 18:42 in Valencia (CET, UTC+1).
  expiresAt: '2026-10-27T17:42:00.000Z',
};

describe('InviteLinkPanelComponent', () => {
  let fixture: ComponentFixture<InviteLinkPanelComponent>;
  let personService: { createInviteLink: ReturnType<typeof vi.fn> };
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  const originalShare = navigator.share;
  const originalClipboard = navigator.clipboard;

  const setNavigator = (key: 'share' | 'clipboard', value: unknown) =>
    Object.defineProperty(navigator, key, { value, configurable: true, writable: true });

  const create = (inputs: { autoGenerate?: boolean } = {}) => {
    fixture = TestBed.createComponent(InviteLinkPanelComponent);
    fixture.componentRef.setInput('personId', 'person-1');
    fixture.componentRef.setInput('alias', 'Pepa');
    if (inputs.autoGenerate !== undefined) fixture.componentRef.setInput('autoGenerate', inputs.autoGenerate);
    fixture.detectChanges();
  };
  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const button = (label: string) =>
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find((b) =>
      b.textContent?.includes(label),
    );

  beforeEach(async () => {
    personService = { createInviteLink: vi.fn().mockReturnValue(of(LINK)) };
    toast = { success: vi.fn(), error: vi.fn() };
    setNavigator('share', undefined);
    await TestBed.configureTestingModule({
      imports: [InviteLinkPanelComponent],
      providers: [
        { provide: PersonService, useValue: personService },
        { provide: ToastService, useValue: toast },
        allLucideIconsProvider,
      ],
    }).compileComponents();
  });

  afterEach(() => {
    setNavigator('share', originalShare);
    setNavigator('clipboard', originalClipboard);
  });

  it('waits for the button before creating the link', () => {
    create();

    expect(personService.createInviteLink).not.toHaveBeenCalled();
    button("Crea l'enllaç d'invitació")!.click();

    expect(personService.createInviteLink).toHaveBeenCalledWith('person-1');
  });

  it('leaves the button to its parent with withButton false, which drives generate()', () => {
    fixture = TestBed.createComponent(InviteLinkPanelComponent);
    fixture.componentRef.setInput('personId', 'person-1');
    fixture.componentRef.setInput('alias', 'Pepa');
    fixture.componentRef.setInput('withButton', false);
    fixture.detectChanges();

    expect(button("Crea l'enllaç d'invitació")).toBeUndefined();

    fixture.componentInstance.generate();
    fixture.detectChanges();

    expect(personService.createInviteLink).toHaveBeenCalledWith('person-1');
    expect(fixture.componentInstance.link()).toEqual(LINK);
  });

  it('creates the link straight away with autoGenerate', () => {
    create({ autoGenerate: true });

    expect(personService.createInviteLink).toHaveBeenCalledWith('person-1');
  });

  it('shows the link, who to send it to and when it expires, in Valencia time', async () => {
    create({ autoGenerate: true });
    // ngModel writes the input's value asynchronously.
    await fixture.whenStable();
    fixture.detectChanges();

    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    expect(input.value).toBe(LINK.inviteUrl);
    expect(input.readOnly).toBe(true);
    expect(text()).toContain('Envieu este enllaç a Pepa');
    expect(text()).toContain("L'enllaç venç el 27/10/2026 a les 18:42.");
    expect(text()).toContain('Només es mostra ara.');
  });

  it('emits the created link', () => {
    create();
    const emitted = vi.fn();
    fixture.componentInstance.generated.subscribe(emitted);

    button("Crea l'enllaç d'invitació")!.click();

    expect(emitted).toHaveBeenCalledWith(LINK);
  });

  it('copies the link and confirms it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setNavigator('clipboard', { writeText });
    create({ autoGenerate: true });

    button('Copia')!.click();
    await fixture.whenStable();

    expect(writeText).toHaveBeenCalledWith(LINK.inviteUrl);
    expect(toast.success).toHaveBeenCalledWith("S'ha copiat l'enllaç.");
  });

  it('says so when the copy fails, so the link can be copied by hand', async () => {
    setNavigator('clipboard', { writeText: vi.fn().mockRejectedValue(new Error('denied')) });
    create({ autoGenerate: true });

    button('Copia')!.click();
    await fixture.whenStable();

    expect(toast.error).toHaveBeenCalledWith("No s'ha pogut copiar l'enllaç. Seleccioneu-lo i copieu-lo a mà.");
  });

  it('hides «Comparteix» where the browser cannot share', () => {
    create({ autoGenerate: true });

    expect(button('Comparteix')).toBeUndefined();
  });

  it('shares the link where the browser can', () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setNavigator('share', share);
    create({ autoGenerate: true });

    button('Comparteix')!.click();

    expect(share).toHaveBeenCalledWith(expect.objectContaining({ url: LINK.inviteUrl }));
  });

  it('shows the API message when the link cannot be created', () => {
    personService.createInviteLink.mockReturnValue(
      throwError(() => ({ error: { message: "La xicalla accedeix a l'app a través de la persona responsable." } })),
    );
    create({ autoGenerate: true });

    expect(text()).toContain("La xicalla accedeix a l'app a través de la persona responsable.");
    expect(fixture.nativeElement.querySelector('input')).toBeNull();
  });
});
