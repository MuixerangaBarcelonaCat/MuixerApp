import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MobileHeaderComponent } from '../../../shared/components/mobile-header/mobile-header.component';
import { EventFeedComponent } from '../components/event-feed/event-feed.component';

@Component({
  selector: 'app-past-events',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MobileHeaderComponent, EventFeedComponent],
  templateUrl: './past-events.component.html',
})
export class PastEventsComponent {}
