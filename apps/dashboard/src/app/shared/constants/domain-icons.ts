import {
  Baby,
  Bell,
  Calendar,
  ChessRook,
  CircleAlert,
  CirclePile,
  DraftingCompass,
  Flower,
  GitCommitHorizontal,
  LayoutGrid,
  Newspaper,
  Sparkles,
  Star,
  Users,
  UserX,
} from 'lucide-angular';

// Pinyes domain
export const ICON_FIGURA = 'CirclePile' as const;
export const ICON_PINYA = 'Flower' as const;
export const ICON_TRONC = 'ChessRook' as const;
export const ICON_RENGLA = 'GitCommitHorizontal' as const;
export const ICON_FIGURA_NETA = 'Sparkles' as const;
export const ICON_COMPOSITION = 'LayoutGrid' as const;
export const ICON_TEMPLATE = 'DraftingCompass' as const;

// Event types
export const ICON_ASSAIG = 'Calendar' as const;
export const ICON_ACTUACIO = 'Star' as const;

// Comunicació domain
export const ICON_COMUNICACIO = 'Megaphone' as const;
export const ICON_NOTICIA = 'Newspaper' as const;

// People
export const ICON_PERSONA = 'Users' as const;
export const ICON_XICALLA = 'Baby' as const;

export const DOMAIN_ICONS = {
  FIGURA: CirclePile,
  PINYA: Flower,
  TRONC: ChessRook,
  RENGLA: GitCommitHorizontal,
  FIGURA_NETA: Sparkles,
  COMPOSITION: LayoutGrid,
  TEMPLATE: DraftingCompass,
  ASSAIG: Calendar,
  ACTUACIO: Star,
  PERSONA: Users,
  XICALLA: Baby,
  OBSERVACIONS: CircleAlert,
  NOTICIA: Newspaper,
  BELL: Bell,
  USER_X: UserX,
} as const;
