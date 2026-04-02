# Angular Component Patterns

**IMPORTANT**: All components MUST use the three-file structure (`.ts`, `.html`, `.scss`). See `angular-component-structure.mdc` for details.

## Table of Contents
- [Model Inputs (Two-Way Binding)](#model-inputs-two-way-binding)
- [View Queries](#view-queries)
- [Content Queries](#content-queries)
- [Dependency Injection in Components](#dependency-injection-in-components)
- [Component Communication Patterns](#component-communication-patterns)
- [Dynamic Components](#dynamic-components)

## Model Inputs (Two-Way Binding)

For two-way binding with `[(value)]` syntax:

```typescript
// slider.component.ts
import { Component, ChangeDetectionStrategy, model, input } from '@angular/core';

@Component({
  selector: 'app-slider',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './slider.component.html',
  styleUrls: ['./slider.component.scss'],
  host: {
    '(input)': 'onInput($event)',
  },
})
export class Slider {
  // Model creates both input and output
  value = model(0);
  min = input(0);
  max = input(100);
  
  onInput(event: Event) {
    const target = event.target as HTMLInputElement;
    this.value.set(Number(target.value));
  }
}
```

```html
<!-- slider.component.html -->
<input 
  type="range" 
  [value]="value()" 
  [min]="min()" 
  [max]="max()"
  class="range range-primary"
/>
<span class="text-sm">{{ value() }}</span>
```

```typescript
// Usage: <app-slider [(value)]="sliderValue" />

// Required model:
value = model.required<number>();
```

## View Queries

Query elements and components in the template:

```typescript
// gallery.component.ts
import { Component, ChangeDetectionStrategy, viewChild, viewChildren, ElementRef, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ImageCard } from './image-card.component';

@Component({
  selector: 'app-gallery',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ImageCard],
  templateUrl: './gallery.component.html',
  styleUrls: ['./gallery.component.scss'],
})
export class Gallery {
  images = input.required<Image[]>();

  // Query single element
  container = viewChild.required<ElementRef<HTMLDivElement>>('container');

  // Query single component (optional)
  firstCard = viewChild(ImageCard);

  // Query all matching components
  allCards = viewChildren(ImageCard);
}
```

```html
<!-- gallery.component.html -->
<div #container class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  @for (image of images(); track image.id) {
    <app-image-card [image]="image" />
  }
</div>
```

## Content Queries

Query projected content:

```typescript
// tabs.component.ts
import { Component, ChangeDetectionStrategy, contentChild, contentChildren, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Tab } from './tab.component';

@Component({
  selector: 'app-tabs',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './tabs.component.html',
  styleUrls: ['./tabs.component.scss'],
})
export class Tabs {
  // Query all projected Tab children
  tabs = contentChildren(Tab);

  // Query single projected element
  header = contentChild('tabHeader');

  activeTab = signal<Tab | undefined>(undefined);

  constructor() {
    // Set first tab as active when tabs are available
    effect(() => {
      const firstTab = this.tabs()[0];
      if (firstTab && !this.activeTab()) {
        this.activeTab.set(firstTab);
      }
    });
  }

  selectTab(tab: Tab) {
    this.activeTab.set(tab);
  }
}
```

```html
<!-- tabs.component.html -->
<div class="tabs tabs-bordered">
  @for (tab of tabs(); track tab.label()) {
    <button
      class="tab"
      [class.tab-active]="tab === activeTab()"
      (click)="selectTab(tab)"
    >
      {{ tab.label() }}
    </button>
  }
</div>
<div class="tab-content p-4">
  <ng-content />
</div>
```

```typescript
// tab.component.ts
import { Component, ChangeDetectionStrategy, input } from '@angular/core';

@Component({
  selector: 'app-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tab.component.html',
  styleUrls: ['./tab.component.scss'],
  host: {
    '[class.active]': 'isActive()',
    '[style.display]': 'isActive() ? "block" : "none"',
  },
})
export class Tab {
  label = input.required<string>();
  isActive = input(false);
}
```

```html
<!-- tab.component.html -->
<ng-content />
```

## Dependency Injection in Components

Use `inject()` function instead of constructor injection:

```typescript
// dashboard.component.ts
import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { Router } from '@angular/router';
import { UserService } from '@core/services/user.service';
import { Analytics } from '@core/services/analytics.service';
import { APP_CONFIG } from '@core/config/app.config';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class Dashboard {
  private router = inject(Router);
  private userService = inject(UserService);
  private config = inject(APP_CONFIG);
  
  // Optional injection
  private analytics = inject(Analytics, { optional: true });
  
  // Self-only injection
  private localService = inject(LocalService, { self: true });
  
  navigateToProfile() {
    this.router.navigate(['/profile']);
  }
}
```

## Component Communication Patterns

### Parent to Child (Inputs)

```typescript
// parent.component.ts
import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { Child } from './child.component';

@Component({
  selector: 'app-parent',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Child],
  templateUrl: './parent.component.html',
  styleUrls: ['./parent.component.scss'],
})
export class Parent {
  parentData = signal({ name: 'Test' });
  config = { theme: 'light' };
}
```

```html
<!-- parent.component.html -->
<app-child [data]="parentData()" [config]="config" />
```

```typescript
// child.component.ts
import { Component, ChangeDetectionStrategy, input } from '@angular/core';

@Component({
  selector: 'app-child',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './child.component.html',
  styleUrls: ['./child.component.scss'],
})
export class Child {
  data = input.required<Data>();
  config = input<Config>();
}
```

### Child to Parent (Outputs)

```typescript
// child.component.ts
import { Component, ChangeDetectionStrategy, output } from '@angular/core';

@Component({
  selector: 'app-child',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './child.component.html',
  styleUrls: ['./child.component.scss'],
})
export class Child {
  saved = output<Data>();
  
  save() {
    this.saved.emit({ id: 1, name: 'Item' });
  }
}
```

```html
<!-- child.component.html -->
<button class="btn btn-primary" (click)="save()">Desar</button>
```

```typescript
// parent.component.ts
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { Child } from './child.component';

@Component({
  selector: 'app-parent',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Child],
  templateUrl: './parent.component.html',
  styleUrls: ['./parent.component.scss'],
})
export class Parent {
  onSaved(data: Data) {
    console.log('Saved:', data);
  }
}
```

```html
<!-- parent.component.html -->
<app-child (saved)="onSaved($event)" />
```

### Shared Service Pattern

```typescript
// cart.service.ts
import { Injectable, signal, computed } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class CartService {
  private items = signal<CartItem[]>([]);
  
  readonly items$ = this.items.asReadonly();
  readonly total = computed(() => 
    this.items().reduce((sum, item) => sum + item.price, 0)
  );
  
  addItem(item: CartItem) {
    this.items.update(items => [...items, item]);
  }
  
  removeItem(id: string) {
    this.items.update(items => items.filter(i => i.id !== id));
  }
}
```

```typescript
// product.component.ts
import { Component, ChangeDetectionStrategy, inject, input } from '@angular/core';
import { CartService } from '@core/services/cart.service';

@Component({
  selector: 'app-product',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product.component.html',
  styleUrls: ['./product.component.scss'],
})
export class Product {
  private cart = inject(CartService);
  product = input.required<Product>();
  
  add() {
    this.cart.addItem({ ...this.product(), quantity: 1 });
  }
}
```

```html
<!-- product.component.html -->
<button class="btn btn-primary" (click)="add()">Afegir al carret</button>
```

```typescript
// cart-summary.component.ts
import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CartService } from '@core/services/cart.service';

@Component({
  selector: 'app-cart-summary',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cart-summary.component.html',
  styleUrls: ['./cart-summary.component.scss'],
})
export class CartSummary {
  cart = inject(CartService);
}
```

```html
<!-- cart-summary.component.html -->
<span class="text-lg font-bold">Total: {{ cart.total() }}€</span>
```

## Dynamic Components

Using `@defer` for lazy loading:

```typescript
// dashboard.component.ts
import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { HeavyChart } from './heavy-chart.component';
import { Spinner } from '@shared/components/spinner.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HeavyChart, Spinner],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class Dashboard {
  chartData = input.required<ChartData>();
}
```

```html
<!-- dashboard.component.html -->
@defer (on viewport) {
  <app-heavy-chart [data]="chartData()" />
} @placeholder {
  <div class="skeleton h-96 w-full"></div>
} @loading (minimum 500ms) {
  <app-spinner />
} @error {
  <div class="alert alert-error">
    <span>Error carregant el gràfic</span>
  </div>
}
```

**Defer triggers:**
- `on viewport` - When element enters viewport
- `on idle` - When browser is idle
- `on interaction` - On user interaction (click, focus)
- `on hover` - On mouse hover
- `on immediate` - Immediately after non-deferred content
- `on timer(500ms)` - After specified delay
- `when condition` - When expression becomes true

```typescript
// post.component.ts
import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { Comments } from './comments.component';

@Component({
  selector: 'app-post',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Comments],
  templateUrl: './post.component.html',
  styleUrls: ['./post.component.scss'],
})
export class Post {
  postId = input.required<string>();
}
```

```html
<!-- post.component.html -->
@defer (on interaction; prefetch on idle) {
  <app-comments [postId]="postId()" />
} @placeholder {
  <button class="btn btn-outline">Carregar comentaris</button>
}
```

## Attribute Directives on Components

```typescript
// highlight.directive.ts
import { Directive, input } from '@angular/core';

@Directive({
  selector: '[appHighlight]',
  standalone: true,
  host: {
    '[style.backgroundColor]': 'color()',
  },
})
export class Highlight {
  color = input('yellow', { alias: 'appHighlight' });
}
```

```typescript
// page.component.ts
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { Card } from './card.component';
import { Highlight } from '@shared/directives/highlight.directive';

@Component({
  selector: 'app-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Card, Highlight],
  templateUrl: './page.component.html',
  styleUrls: ['./page.component.scss'],
})
export class Page {}
```

```html
<!-- page.component.html -->
<app-card appHighlight="lightblue" />
```

## Error Boundaries

```typescript
// error-boundary.component.ts
import { Component, ChangeDetectionStrategy, signal, inject } from '@angular/core';
import { ErrorHandler } from '@angular/core';

@Component({
  selector: 'app-error-boundary',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './error-boundary.component.html',
  styleUrls: ['./error-boundary.component.scss'],
})
export class ErrorBoundary {
  hasError = signal(false);
  private errorHandler = inject(ErrorHandler);
  
  retry() {
    this.hasError.set(false);
  }
}
```

```html
<!-- error-boundary.component.html -->
@if (hasError()) {
  <div class="alert alert-error">
    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 shrink-0 stroke-current" fill="none" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
    <div>
      <h3 class="font-bold">Alguna cosa ha anat malament</h3>
      <button class="btn btn-sm btn-outline" (click)="retry()">Tornar a intentar</button>
    </div>
  </div>
} @else {
  <ng-content />
}
```

---

## Summary

**Remember**: ALL components MUST follow the three-file structure:
1. `*.component.ts` — Logic, signals, and component metadata
2. `*.component.html` — Template with DaisyUI/Tailwind classes
3. `*.component.scss` — Custom styles (minimal or empty, supports SCSS features)

This ensures:
- ✅ Clean separation of concerns
- ✅ Better IDE support and syntax highlighting
- ✅ Easier code review and collaboration
- ✅ Consistent codebase structure
- ✅ Maintainable and scalable code
- ✅ SCSS features available (nesting, variables, mixins) when needed
