import { Component, ChangeDetectionStrategy, computed, input, output } from '@angular/core';
import { LucideAngularModule, ChevronDown } from 'lucide-angular';
import { ManagedPerson } from '@muixer/shared';

@Component({
  selector: 'app-person-switcher',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  templateUrl: './person-switcher.component.html',
  styleUrls: ['./person-switcher.component.scss'],
})
export class PersonSwitcherComponent {
  items = input.required<ManagedPerson[]>();
  selectedId = input.required<string | null>();

  selectionChange = output<string>();

  protected readonly ChevronDown = ChevronDown;

  protected readonly selectedLabel = computed(
    () => this.items().find((item) => item.personId === this.selectedId())?.displayName ?? '',
  );

  select(personId: string): void {
    this.selectionChange.emit(personId);
    (document.activeElement as HTMLElement | null)?.blur();
  }
}
