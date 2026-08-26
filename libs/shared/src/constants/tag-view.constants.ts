import { TagCategory } from '../enums/tag-category.enum';

export interface TagView {
  id: 'guio' | 'pinyes';
  label: string;
  groups: TagCategory[];
}

/** Les dues combinacions de grups amb què treballa la tècnica, segons la fase de la feina. */
export const TAG_VIEWS: readonly TagView[] = [
  { id: 'guio', label: 'Guió', groups: [TagCategory.XICALLA, TagCategory.TRONC] },
  { id: 'pinyes', label: 'Pinyes', groups: [TagCategory.PINYA, TagCategory.ALTRES] },
] as const;
