import { Component, ChangeDetectionStrategy, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule, Search } from 'lucide-angular';
import { computeSegmentDisplayName, formatOwnPositionSummary, MeSegment } from '@muixer/shared';
import { MobileHeaderComponent } from '../../../shared/components/mobile-header/mobile-header.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { PersonLookupService, PersonSummaryResult } from '../services/person-lookup.service';
import { EventService } from '../services/event.service';

@Component({
  selector: 'app-watch-as',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, LucideAngularModule, MobileHeaderComponent, EmptyStateComponent],
  templateUrl: './watch-as.component.html',
})
export class WatchAsComponent {
  readonly id = input.required<string>();

  protected readonly Search = Search;

  private readonly personLookupService = inject(PersonLookupService);
  private readonly eventService = inject(EventService);

  protected readonly searchTerm = signal('');
  protected readonly results = signal<PersonSummaryResult[]>([]);
  protected readonly selectedPerson = signal<PersonSummaryResult | null>(null);
  protected readonly segments = signal<MeSegment[]>([]);
  protected readonly isLoadingSegments = signal(false);

  protected onSearchInput(value: string): void {
    this.searchTerm.set(value);
    if (!value.trim()) {
      this.results.set([]);
      return;
    }
    this.personLookupService.search(value.trim()).subscribe((results) => this.results.set(results));
  }

  protected selectPerson(person: PersonSummaryResult): void {
    this.selectedPerson.set(person);
    this.results.set([]);
    this.searchTerm.set('');
    this.isLoadingSegments.set(true);
    this.eventService.findSegments(this.id(), person.id).subscribe({
      next: (segments) => {
        this.segments.set(segments);
        this.isLoadingSegments.set(false);
      },
      error: () => this.isLoadingSegments.set(false),
    });
  }

  protected segmentLabel(segment: MeSegment): string {
    return computeSegmentDisplayName(segment.name, segment.instances);
  }

  protected placementSummary(segment: MeSegment): string | null {
    if (segment.myPlacements.length !== 1) return null;
    const summary = formatOwnPositionSummary(segment.myPlacements[0]);
    return `${summary.nodeLabel}${summary.suffix}`;
  }

  protected segmentLink(segment: MeSegment): unknown[] {
    return ['/events', this.id(), 'segments', segment.id];
  }

  protected queryParamsFor(): Record<string, string> {
    const person = this.selectedPerson();
    return person ? { asPersonId: person.id, asPersonName: person.alias } : {};
  }
}
