import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LucideAngularModule, Home, Calendar, User, LucideIconData } from 'lucide-angular';

interface Tab {
  path: string;
  label: string;
  icon: LucideIconData;
}

@Component({
  selector: 'app-bottom-tab-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, LucideAngularModule],
  template: `
    <nav
      class="fixed bottom-0 inset-x-0 bg-base-100 border-t border-base-300 z-50"
      style="padding-bottom: env(safe-area-inset-bottom, 0px)"
      role="tablist"
      aria-label="Navegació principal"
    >
      <div class="flex justify-around items-center h-14">
        @for (tab of tabs; track tab.path) {
          <a
            [routerLink]="tab.path"
            routerLinkActive="text-primary"
            #rla="routerLinkActive"
            class="flex flex-col items-center justify-center w-full h-full
                   text-base-content/60 transition-colors duration-200"
            role="tab"
            [attr.aria-selected]="rla.isActive"
          >
            <lucide-icon [img]="tab.icon" [size]="22" />
            <span class="text-xs mt-0.5 font-medium">{{ tab.label }}</span>
          </a>
        }
      </div>
    </nav>
  `,
})
export class BottomTabBarComponent {
  readonly tabs: Tab[] = [
    { path: '/home', label: 'Inici', icon: Home },
    { path: '/events', label: 'Events', icon: Calendar },
    { path: '/profile', label: 'Perfil', icon: User },
  ];
}
