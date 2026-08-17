import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { RouterModule } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { ICON_TEMPLATE, ICON_ASSAIG, ICON_ACTUACIO, ICON_PERSONA, ICON_COMUNICACIO } from '../../../constants/domain-icons';

@Component({
  selector: 'app-tab-nav',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterModule, LucideAngularModule],
  host: { class: 'block' },
  templateUrl: './tab-nav.component.html',
})
export class TabNavComponent {
  mobileMenuOpen = input(false);
  mobileMenuToggle = output<void>();

  readonly tabs = [
    { path: '/home', label: 'Inici', icon: 'Home' },
    { path: '/persons', label: 'Persones', icon: ICON_PERSONA },
    { path: '/rehearsals', label: 'Assajos', icon: ICON_ASSAIG },
    { path: '/performances', label: 'Actuacions', icon: ICON_ACTUACIO },
    { path: '/pinyes', label: 'Plantilles', icon: ICON_TEMPLATE },
    { path: '/communication', label: 'Comunicació', icon: ICON_COMUNICACIO },
    { path: '/config', label: 'Configuració', icon: 'Settings' },
  ];
}
