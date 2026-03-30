import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  standalone: true,
  imports: [CommonModule, RouterModule],
  selector: 'app-root',
  template: `
    <div class="flex h-screen bg-gray-50">
      <!-- Sidebar -->
      <aside class="hidden lg:flex lg:w-64 lg:flex-col bg-white border-r">
        <div class="p-4 border-b">
          <h1 class="text-xl font-bold" style="color: var(--colla-primary)">MuixerApp</h1>
        </div>
        <nav class="flex-1 p-4">
          <a 
            routerLink="/persons" 
            routerLinkActive="bg-colla-primary/10" 
            class="block px-4 py-2 rounded hover:bg-gray-100 min-h-[44px] flex items-center"
          >
            Persones
          </a>
          <div class="block px-4 py-2 text-gray-400 opacity-50 pointer-events-none">
            Esdeveniments
          </div>
          <div class="block px-4 py-2 text-gray-400 opacity-50 pointer-events-none">
            Reports
          </div>
        </nav>
      </aside>

      <!-- Main content -->
      <div class="flex flex-1 flex-col overflow-hidden">
        <!-- Header -->
        <header class="flex items-center justify-between h-16 px-4 bg-white border-b">
          <div class="flex items-center gap-4">
            <h2 class="text-lg font-semibold">Dashboard</h2>
          </div>
        </header>

        <!-- Content -->
        <main class="flex-1 overflow-y-auto p-4 lg:p-6">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
})
export class App {}
