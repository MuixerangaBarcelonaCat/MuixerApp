import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';
import { LiveUpdateBannerComponent } from './live-update-banner.component';
import { SegmentWorkspaceStateService } from '../../services/segment-workspace-state.service';

describe('LiveUpdateBannerComponent', () => {
  let fixture: ComponentFixture<LiveUpdateBannerComponent>;
  let ws: SegmentWorkspaceStateService;

  const setup = async () => {
    await TestBed.configureTestingModule({
      imports: [LiveUpdateBannerComponent],
      providers: [allLucideIconsProvider, SegmentWorkspaceStateService],
    }).compileComponents();

    ws = TestBed.inject(SegmentWorkspaceStateService);
    fixture = TestBed.createComponent(LiveUpdateBannerComponent);
    fixture.detectChanges();
  };

  it('renders nothing when there is no pending remote change', async () => {
    await setup();
    expect(fixture.nativeElement.textContent.trim()).toBe('');
  });

  it('shows the banner once a remote change is pending', async () => {
    await setup();
    ws.pendingRemoteChange.set(true);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Algú ha fet canvis en este segment');
  });

  it('applies the pending change and the banner disappears when the button is clicked', async () => {
    await setup();
    ws.pendingRemoteChange.set(true);
    fixture.detectChanges();

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    button.click();
    fixture.detectChanges();

    expect(ws.pendingRemoteChange()).toBe(false);
    expect(fixture.nativeElement.textContent.trim()).toBe('');
  });
});
