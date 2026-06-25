import { LUCIDE_ICONS, LucideIconProvider, LucideIcons } from 'lucide-angular';
import * as lucideAll from 'lucide-angular';

// Includes both canonical names and backward-compat aliases (e.g. Home→House, HelpCircle→CircleQuestionMark)
const allIconData = Object.fromEntries(
  Object.entries(lucideAll).filter(([, v]) => Array.isArray(v)),
) as unknown as LucideIcons;

export const allLucideIconsProvider = {
  provide: LUCIDE_ICONS,
  multi: true,
  useFactory: () => new LucideIconProvider(allIconData),
};
