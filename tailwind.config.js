/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        app: {
          bg: 'var(--to-color-bg)',
          surface: 'var(--to-color-surface)',
          'surface-muted': 'var(--to-color-surface-muted)',
          fg: 'var(--to-color-text)',
          muted: 'var(--to-color-text-muted)',
          border: 'var(--to-color-border)',
          primary: 'var(--to-color-primary)',
          danger: 'var(--to-color-danger)',
        },
        shell: {
          bg: 'var(--shell-bg)',
          fg: 'var(--shell-fg)',
          'fg-muted': 'var(--shell-fg-muted)',
          panel: 'var(--shell-panel)',
        },
      },
      maxWidth: {
        content: 'var(--app-content-max-width)',
      },
      boxShadow: {
        dropdown: '0 10px 40px rgba(0, 0, 0, 0.35)',
      },
    },
  },
  plugins: [],
};
