import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { PinyesOnboardingModalComponent } from '../pinyes-onboarding-modal/pinyes-onboarding-modal.component';
import { TemplateEditorHelpModalComponent } from '../template-editor-help-modal/template-editor-help-modal.component';
import { FamilyListTabComponent } from './family-list-tab/family-list-tab.component';
import { FigureGridTabComponent } from './figure-grid-tab/figure-grid-tab.component';
import { CompositionGridTabComponent } from './composition-grid-tab/composition-grid-tab.component';

type ActiveTab = 'families' | 'figures' | 'compositions';

@Component({
  selector: 'app-template-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LucideAngularModule,
    PinyesOnboardingModalComponent,
    TemplateEditorHelpModalComponent,
    FamilyListTabComponent,
    FigureGridTabComponent,
    CompositionGridTabComponent,
  ],
  templateUrl: './template-list.component.html',
  styleUrl: './template-list.component.scss',
})
export class TemplateListComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);

  private readonly editorHelpModal = viewChild.required(TemplateEditorHelpModalComponent);

  readonly activeTab = signal<ActiveTab>('families');

  ngOnInit(): void {
    const tab = this.route.snapshot.queryParamMap.get('tab') as ActiveTab | null;
    if (tab === 'figures' || tab === 'compositions') {
      this.activeTab.set(tab);
    }
  }

  setTab(tab: ActiveTab): void {
    this.activeTab.set(tab);
  }

  openEditorHelpModal(): void {
    this.editorHelpModal().open();
  }
}
