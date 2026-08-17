import { TestBed } from '@angular/core/testing';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ToastService);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('starts with no toasts', () => {
    expect(service.toasts()).toEqual([]);
  });

  it('adds a success toast', () => {
    service.success('Desat correctament.');
    expect(service.toasts()).toEqual([{ id: expect.any(Number), message: 'Desat correctament.', type: 'success' }]);
  });

  it('adds an error toast', () => {
    service.error('No s’ha pogut desar.');
    expect(service.toasts()[0]).toMatchObject({ message: 'No s’ha pogut desar.', type: 'error' });
  });

  it('adds a warning toast', () => {
    service.warning('Compte, hi ha un conflicte.');
    expect(service.toasts()[0]).toMatchObject({ type: 'warning' });
  });

  it('adds an info toast', () => {
    service.info('Sincronitzant...');
    expect(service.toasts()[0]).toMatchObject({ type: 'info' });
  });

  it('assigns increasing unique ids across calls', () => {
    service.success('Un');
    service.error('Dos');
    const [first, second] = service.toasts();
    expect(first.id).not.toBe(second.id);
  });

  it('keeps multiple toasts simultaneously, in call order', () => {
    service.success('Un');
    service.error('Dos');
    expect(service.toasts().map((t) => t.message)).toEqual(['Un', 'Dos']);
  });

  it('dismiss removes only the targeted toast', () => {
    service.success('Un');
    service.error('Dos');
    const [first] = service.toasts();

    service.dismiss(first.id);

    expect(service.toasts().map((t) => t.message)).toEqual(['Dos']);
  });

  it('auto-dismisses a toast after 4000ms', () => {
    jest.useFakeTimers();
    service.success('Un');
    expect(service.toasts().length).toBe(1);

    jest.advanceTimersByTime(4000);

    expect(service.toasts().length).toBe(0);
  });

  it('does not auto-dismiss before 4000ms has elapsed', () => {
    jest.useFakeTimers();
    service.success('Un');

    jest.advanceTimersByTime(3999);

    expect(service.toasts().length).toBe(1);
  });
});
