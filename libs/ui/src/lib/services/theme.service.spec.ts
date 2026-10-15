import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';
import { THEME_NAMES, THEME_STORAGE_KEY } from '../tokens/theme-names';

type ChangeListener = (event: { matches: boolean }) => void;

/** jsdom has no matchMedia — a controllable stand-in for the OS color-scheme query. */
function mockSystemDark(initial: boolean) {
  const listeners: ChangeListener[] = [];
  const query = {
    matches: initial,
    addEventListener: (_: string, listener: ChangeListener) => listeners.push(listener),
    removeEventListener: jest.fn(),
  };
  window.matchMedia = jest.fn().mockReturnValue(query) as unknown as typeof window.matchMedia;
  return {
    change(matches: boolean) {
      query.matches = matches;
      listeners.forEach((listener) => listener({ matches }));
    },
  };
}

function createService(): ThemeService {
  TestBed.configureTestingModule({});
  return TestBed.inject(ThemeService);
}

const root = () => document.documentElement;

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    delete root().dataset['theme'];
    mockSystemDark(false);
  });

  afterEach(() => jest.restoreAllMocks());

  it('defaults to the system preference when nothing is stored, leaving the root theme to CSS', () => {
    const service = createService();
    expect(service.preference()).toBe('system');
    expect(root().dataset['theme']).toBeUndefined();
  });

  it('follows the OS setting while on system', () => {
    const system = mockSystemDark(true);
    const service = createService();
    expect(service.mode()).toBe('dark');
    system.change(false);
    expect(service.mode()).toBe('light');
  });

  it('restores a stored explicit choice and applies its theme to the root element', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    const service = createService();
    expect(service.preference()).toBe('dark');
    expect(service.mode()).toBe('dark');
    expect(root().dataset['theme']).toBe(THEME_NAMES.dark);
  });

  it('ignores an unknown stored value', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'sepia');
    expect(createService().preference()).toBe('system');
  });

  it('an explicit choice wins over the OS setting', () => {
    mockSystemDark(true);
    const service = createService();
    service.setPreference('light');
    expect(service.mode()).toBe('light');
    expect(root().dataset['theme']).toBe(THEME_NAMES.light);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('going back to system clears both the stored choice and the root theme', () => {
    const service = createService();
    service.setPreference('dark');
    service.setPreference('system');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(root().dataset['theme']).toBeUndefined();
  });

  it('still switches the theme when storage is unavailable', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const service = createService();
    expect(service.preference()).toBe('system');
    service.setPreference('dark');
    expect(service.mode()).toBe('dark');
    expect(root().dataset['theme']).toBe(THEME_NAMES.dark);
  });
});
