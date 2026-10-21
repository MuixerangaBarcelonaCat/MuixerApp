import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { ButtonComponent, EmptyStateComponent, SelectComponent } from '@muixer/ui';
import { MarkdownService } from '@muixer/ui/markdown';
import { MANUAL_ASSET_BASE, manualSlugFromHref, rewriteManualImages } from './manual-links.util';
import { MANUAL_DEFAULT_SLUG, MANUAL_PAGES, ManualPage } from './manual-pages';

interface ManualGroup {
  name: string;
  pages: ManualPage[];
}

/** Configuració → Manual: renders the end-user manual bundled from `docs/manual/`. */
@Component({
  selector: 'app-manual',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, FormsModule, ButtonComponent, EmptyStateComponent, SelectComponent],
  templateUrl: './manual.component.html',
  // Links inside the rendered page come from MarkdownService with target="_blank"; links between
  // manual pages must route inside the SPA instead, so clicks are intercepted here.
  host: { '(click)': 'onClick($event)' },
})
export class ManualComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  private readonly markdown = inject(MarkdownService);

  protected readonly defaultSlug = MANUAL_DEFAULT_SLUG;
  protected readonly groups: ManualGroup[] = MANUAL_PAGES.reduce<ManualGroup[]>((groups, page) => {
    const last = groups.at(-1);
    if (last?.name === page.group) last.pages.push(page);
    else groups.push({ name: page.group, pages: [page] });
    return groups;
  }, []);

  protected readonly slug = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('slug') ?? MANUAL_DEFAULT_SLUG)),
    { initialValue: MANUAL_DEFAULT_SLUG },
  );
  protected readonly page = computed(() => MANUAL_PAGES.find((p) => p.slug === this.slug()) ?? null);

  protected readonly content = rxResource({
    params: () => this.page()?.slug,
    stream: ({ params: slug }) =>
      this.http.get(`${MANUAL_ASSET_BASE}/${slug}.md`, { responseType: 'text' }),
  });

  protected readonly html = computed(() =>
    this.content.hasValue() ? rewriteManualImages(this.markdown.render(this.content.value())) : '',
  );

  constructor() {
    effect(() => {
      this.slug();
      window.scrollTo(0, 0);
    });
  }

  protected goTo(slug: string): void {
    this.router.navigate(['/config/manual', slug]);
  }

  protected goBack(): void {
    this.router.navigate(['/config']);
  }

  protected onClick(event: MouseEvent): void {
    const anchor = (event.target as HTMLElement | null)?.closest('a');
    const slug = manualSlugFromHref(anchor?.getAttribute('href') ?? null);
    if (!slug) return;
    event.preventDefault();
    this.goTo(slug);
  }
}
