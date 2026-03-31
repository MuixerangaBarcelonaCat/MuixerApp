import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from './shared/components/layout/sidebar/sidebar.component';
import { HeaderComponent } from './shared/components/layout/header/header.component';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterModule,
    SidebarComponent,
    HeaderComponent,
  ],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrls: ['./app.scss'],
})
export class App {
  mobileMenuOpen = signal(false);
}
