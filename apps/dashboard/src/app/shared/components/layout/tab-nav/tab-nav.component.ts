import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { RouterModule } from '@angular/router';
import { LucideAngularModule, Home, Users, Calendar, Star, Layers, Settings } from 'lucide-angular';

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

  readonly icons = { Home, Users, Calendar, Star, Layers, Settings };

  readonly tabs = [
    { path: '/home', label: 'Inici', icon: 'Home' },
    { path: '/persons', label: 'Persones', icon: 'Users' },
    { path: '/rehearsals', label: 'Assajos', icon: 'Calendar' },
    { path: '/performances', label: 'Actuacions', icon: 'Star' },
    { path: '/pinyes', label: 'Pinyes', icon: 'Layers' },
    { path: '/config', label: 'Configuració', icon: 'Settings' },
  ];
}
