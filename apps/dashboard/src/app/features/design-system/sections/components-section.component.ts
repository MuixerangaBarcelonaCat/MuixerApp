import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Search, Star, Users } from 'lucide-angular';
import {
  ButtonComponent,
  ButtonGroupComponent,
  BadgeComponent,
  CardComponent,
  FormFieldComponent,
  InputComponent,
  SelectComponent,
  ModalComponent,
  TabsComponent,
  ToastContainerComponent,
  ToastService,
  EmptyStateComponent,
  type ButtonVariant,
  type BadgeVariant,
  type CardTone,
  type TabDef,
} from '@muixer/ui';

const VARIANTS: ButtonVariant[] = ['primary', 'secondary', 'accent', 'neutral', 'ghost', 'info', 'success', 'warning', 'error'];
const BADGE_VARIANTS: BadgeVariant[] = ['primary', 'secondary', 'accent', 'neutral', 'ghost', 'info', 'success', 'warning', 'error'];
const CARD_TONES: CardTone[] = ['primary', 'secondary', 'accent', 'neutral', 'info', 'success', 'warning', 'error'];

interface DemoTag {
  id: string;
  name: string;
  color: string;
}

const DEMO_TAGS: DemoTag[] = [
  { id: 'vent', name: 'Vent', color: '#009bd1' },
  { id: 'baix', name: 'Baix', color: '#71bad2' },
  { id: 'segon', name: 'Segon', color: '#e07a5f' },
  { id: 'terc', name: 'Terç', color: '#81b29a' },
];

const DEMO_TABS: TabDef[] = [
  { id: 'resum', label: 'Resum', icon: Star },
  { id: 'pinyes', label: 'Pinyes', icon: Users },
  { id: 'assistencia', label: 'Assistència' },
];

@Component({
  selector: 'app-components-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    ButtonComponent,
    ButtonGroupComponent,
    BadgeComponent,
    CardComponent,
    FormFieldComponent,
    InputComponent,
    SelectComponent,
    ModalComponent,
    TabsComponent,
    ToastContainerComponent,
    EmptyStateComponent,
  ],
  templateUrl: './components-section.component.html',
})
export class ComponentsSectionComponent {
  protected readonly SearchIcon = Search;
  protected readonly StarIcon = Star;
  protected readonly UsersIcon = Users;

  protected readonly variants = VARIANTS;
  protected readonly badgeVariants = BADGE_VARIANTS;
  protected readonly cardTones = CARD_TONES;

  protected readonly dismissibleModalOpen = signal(false);
  protected readonly nonDismissibleModalOpen = signal(false);

  protected readonly groupTab = signal<'a' | 'b'>('a');
  protected readonly yesNo = signal<'yes' | 'no'>('yes');
  protected readonly threeWay = signal<'a' | 'b' | 'c'>('a');

  protected readonly demoTabs = DEMO_TABS;
  protected readonly activeDemoTab = signal('resum');

  protected readonly demoTags = DEMO_TAGS;
  protected readonly selectedTagIds = signal<string[]>(['vent']);
  protected readonly selectedTagIdsMulti = signal<string[]>(['vent']);

  protected toggleDemoTag(id: string): void {
    this.selectedTagIds.update((ids) => (ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id]));
  }

  protected isDemoTagSelected(id: string): boolean {
    return this.selectedTagIds().includes(id);
  }

  private readonly toast = inject(ToastService);

  protected fireToast(type: 'success' | 'error' | 'warning' | 'info'): void {
    this.toast[type](`Exemple de missatge ${type}.`);
  }
}
