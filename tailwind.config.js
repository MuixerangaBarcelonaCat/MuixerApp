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
          'primary': '#1B5E20',
          'secondary': '#FDD835',
          'accent': '#37cdbe',
          'neutral': '#3d4451',
          'base-100': '#ffffff',
          'base-200': '#f9fafb',
          'base-300': '#e5e7eb',
          'info': '#3abff8',
          'success': '#36d399',
          'warning': '#fbbd23',
          'error': '#f87272',
        },
      },
      'light',
      'dark',
    ],
  },
};
