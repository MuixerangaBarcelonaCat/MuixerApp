/** @type {import('tailwindcss').Config} */

/**
 * Converts a hex color to HSL components.
 * Returns { h, s, l } where h is 0-360, s and l are 0-100.
 */
function hexToHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

/**
 * Converts HSL to a hex color string.
 */
function hslToHex(h, s, l) {
  const hNorm = h / 360;
  const sNorm = s / 100;
  const lNorm = l / 100;

  let r, g, b;

  if (sNorm === 0) {
    r = g = b = lNorm;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = lNorm < 0.5 ? lNorm * (1 + sNorm) : lNorm + sNorm - lNorm * sNorm;
    const p = 2 * lNorm - q;
    r = hue2rgb(p, q, hNorm + 1/3);
    g = hue2rgb(p, q, hNorm);
    b = hue2rgb(p, q, hNorm - 1/3);
  }

  const toHex = (x) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Determines whether white or black provides better WCAG contrast against a given hex color.
 */
function getContrastContent(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  // Relative luminance formula (WCAG)
  const luminance = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const L = 0.2126 * luminance(r) + 0.7152 * luminance(g) + 0.0722 * luminance(b);
  return L > 0.179 ? '#000000' : '#ffffff';
}

/**
 * Generates a full DaisyUI-compatible theme from a single primary color.
 * secondary: desaturated tonal variant (+20% lightness, -40% saturation)
 * accent: complementary hue (180° rotation)
 */
function generateCollaTheme(primaryHex) {
  const { h, s, l } = hexToHsl(primaryHex);

  const secondary = hslToHex(h, Math.max(0, s - 40), Math.min(95, l + 25));
  const accent = hslToHex((h + 180) % 360, s, l);

  return {
    'primary': primaryHex,
    'primary-content': getContrastContent(primaryHex),
    'secondary': secondary,
    'secondary-content': getContrastContent(secondary),
    'accent': accent,
    'accent-content': getContrastContent(accent),
    'neutral': '#1f2937',
    'neutral-content': '#ffffff',
    'base-100': '#ffffff',
    'base-200': '#f8fafc',
    'base-300': '#f1f5f9',
    'base-content': '#1e293b',
    'info': '#3b82f6',
    'info-content': '#ffffff',
    'success': '#22c55e',
    'success-content': '#ffffff',
    'warning': '#f59e0b',
    'warning-content': '#1e293b',
    'error': '#ef4444',
    'error-content': '#ffffff',
  };
}

module.exports = {
  content: [
    './apps/dashboard/src/**/*.{html,ts}',
    './apps/pwa/src/**/*.{html,ts}',
    './libs/**/*.{html,ts}',
  ],
  theme: {
    extend: {},
  },
  plugins: [
    require('daisyui'),
  ],
  daisyui: {
    themes: [
      {
        'colla-barcelona': generateCollaTheme('#1E3A8A'),
      },
    ],
    darkTheme: false,
    base: true,
    styled: true,
    utils: true,
    logs: false,
  },
};
