import { Injectable } from '@angular/core';
import type { QuadreColumnDef } from '../utils/quadre-troncs.util';

export const QUADRE_COLUMNS_STORAGE_KEY = 'muixer.quadreTroncs.columns';

/** The columns of the technicians' old spreadsheet, by tag slug (names can be renamed, slugs can't). */
export const QUADRE_DEFAULT_SLUGS = ['mans', 'baix', 'segona', 'alcadora', 'terca', 'persona-nova', 'xicalla'] as const;

interface CatalogTag {
  id: string;
  name: string;
  slug: string;
}

/**
 * Which tags the quadre de persones shows as columns, and in what order. Per device: stored in
 * `localStorage`, which may be missing, blocked or hold junk — any of those means the defaults.
 */
@Injectable({ providedIn: 'root' })
export class QuadreColumnsService {
  resolve(tags: CatalogTag[]): QuadreColumnDef[] {
    const byId = new Map(tags.map((t) => [t.id, t]));
    const stored = (this.readStored() ?? []).map((id) => byId.get(id)).filter((t): t is CatalogTag => !!t);
    const chosen =
      stored.length > 0
        ? stored
        : QUADRE_DEFAULT_SLUGS.map((slug) => tags.find((t) => t.slug === slug)).filter((t): t is CatalogTag => !!t);
    return chosen.map(({ id, name }) => ({ id, name }));
  }

  save(tagIds: string[]): void {
    try {
      localStorage.setItem(QUADRE_COLUMNS_STORAGE_KEY, JSON.stringify(tagIds));
    } catch {
      // Blocked storage: the choice just lasts until the modal closes.
    }
  }

  reset(): void {
    try {
      localStorage.removeItem(QUADRE_COLUMNS_STORAGE_KEY);
    } catch {
      // Nothing stored that we could reach anyway.
    }
  }

  private readStored(): string[] | null {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(QUADRE_COLUMNS_STORAGE_KEY) ?? 'null');
      return Array.isArray(parsed) && parsed.every((v) => typeof v === 'string') ? parsed : null;
    } catch {
      return null;
    }
  }
}
