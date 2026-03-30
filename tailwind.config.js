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
  plugins: [],
};
