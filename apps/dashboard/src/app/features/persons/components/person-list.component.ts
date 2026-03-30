import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bg-white rounded-lg shadow p-6">
      <h2 class="text-2xl font-bold mb-4">Persones</h2>
      <p class="text-gray-600">
        Person list will be implemented here with Spartan UI table + filters.
      </p>
      <p class="text-sm text-gray-500 mt-4">
        Backend API is ready at <code class="bg-gray-100 px-2 py-1 rounded">GET /api/persons</code>
      </p>
    </div>
  `,
})
export class PersonListComponent {}
