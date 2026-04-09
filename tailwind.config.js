/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './apps/dashboard/src/**/*.{html,ts}',
    './apps/pwa/src/**/*.{html,ts}',
    './libs/**/*.{html,ts}',
  ],
  theme: {
    extend: {
      colors: {
        colla: {
          primary: 'var(--colla-primary)',
          secondary: 'var(--colla-secondary)',
          'text-on-primary': 'var(--colla-text-on-primary)',
        },
      },
    },
  },
  plugins: [
    require('daisyui'),
  ],
  daisyui: {
    themes: [
      {
        'colla-barcelona': {
          "primary": "#1E3A8A",      // Blau profund (botons principals, links)
          "secondary": "#111827",    // Negre suau (navbar, sidebar)
          "accent": "#DC2626",       // Roig viu (CTA, highlights)

          "neutral": "#374151",      // gris fosc per textos secundaris

          "base-100": "#ffffff",     // fons principal
          "base-200": "#F3F4F6",     // fons cards
          "base-300": "#E5E7EB",     // separadors

          "info": "#2563EB",         // blau més viu (alerts info)
          "success": "#16A34A",
          "warning": "#F59E0B",
          "error": "#DC2626"
        },
      },
      'light',
      // 'dark',
    ],
  },
};
