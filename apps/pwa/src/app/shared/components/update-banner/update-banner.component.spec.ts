import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AppUpdateService } from '../../../core/services/app-update.service';
import { UpdateBannerComponent } from './update-banner.component';

describe('UpdateBannerComponent', () => {
  function render(updateReady: boolean) {
    const appUpdate = { updateReady: signal(updateReady), update: vi.fn() };
    TestBed.configureTestingModule({
      imports: [UpdateBannerComponent],
      providers: [{ provide: AppUpdateService, useValue: appUpdate }],
    });
    const fixture = TestBed.createComponent(UpdateBannerComponent);
    fixture.detectChanges();
    return { el: fixture.nativeElement as HTMLElement, appUpdate };
  }

  it('stays hidden while no new version is ready', () => {
    expect(render(false).el.textContent?.trim()).toBe('');
  });

  it('offers to switch to the new version', () => {
    const { el, appUpdate } = render(true);
    expect(el.textContent).toContain('Hi ha una versió nova');

    el.querySelector('button')?.click();
    expect(appUpdate.update).toHaveBeenCalled();
  });
});
