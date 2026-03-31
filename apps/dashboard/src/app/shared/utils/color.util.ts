/**
 * Color utility functions
 */

/**
 * Calcula el color de text (blanc o negre) que té millor contrast amb un color de fons
 * @param bgColor Color de fons en format hexadecimal (#RRGGBB)
 * @returns '#000000' per a fons clars, '#FFFFFF' per a fons foscos
 */
export function getContrastColor(bgColor: string): string {
  const hex = bgColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  // Càlcul de luminància relativa (ITU-R BT.709)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
}
