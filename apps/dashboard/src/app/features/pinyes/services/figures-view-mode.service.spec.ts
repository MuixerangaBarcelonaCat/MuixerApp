import { TestBed } from '@angular/core/testing';
import { describe, it, expect, afterEach } from 'vitest';
import { FiguresViewModeService } from './figures-view-mode.service';

describe('FiguresViewModeService', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('defaults to pinyes when nothing is stored', () => {
    const service = TestBed.inject(FiguresViewModeService);
    expect(service.mode()).toBe('pinyes');
  });

  it('restores a previously stored mode', () => {
    localStorage.setItem('muixer.pinyes.viewMode', 'troncs');
    const service = TestBed.inject(FiguresViewModeService);
    expect(service.mode()).toBe('troncs');
  });

  it('ignores an invalid stored value', () => {
    localStorage.setItem('muixer.pinyes.viewMode', 'nope');
    const service = TestBed.inject(FiguresViewModeService);
    expect(service.mode()).toBe('pinyes');
  });

  it('updates the signal and persists the new mode', () => {
    const service = TestBed.inject(FiguresViewModeService);
    service.set('troncs');
    expect(service.mode()).toBe('troncs');
    expect(localStorage.getItem('muixer.pinyes.viewMode')).toBe('troncs');
  });
});
