/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        theme: {
          bg: 'var(--bg-app)',
          surface: 'var(--bg-surface)',
          'surface-elevated': 'var(--bg-surface-elevated)',
          'surface-muted': 'var(--bg-surface-muted)',
          'surface-hover': 'var(--bg-surface-hover)',
          border: 'var(--border-default)',
          'border-subtle': 'var(--border-subtle)',
          'border-strong': 'var(--border-strong)',
          primary: 'var(--primary)',
          'primary-hover': 'var(--primary-hover)',
          'primary-soft': 'var(--primary-soft)',
          'primary-text': 'var(--primary-text)',
          'text-primary': 'var(--text-primary)',
          'text-secondary': 'var(--text-secondary)',
          'text-muted': 'var(--text-muted)',
          'sidebar-bg': 'var(--sidebar-bg)',
          'sidebar-border': 'var(--sidebar-border)',
          'sidebar-text': 'var(--sidebar-text)',
          'sidebar-hover': 'var(--sidebar-hover)',
          'sidebar-active-bg': 'var(--sidebar-active-bg)',
          'sidebar-active-text': 'var(--sidebar-active-text)',
          'header-bg': 'var(--header-bg)',
          'header-border': 'var(--header-border)',
          'input-bg': 'var(--input-bg)',
          'input-border': 'var(--input-border)',
          'input-focus': 'var(--input-focus)'
        }
      },
      boxShadow: {
        'theme-card': 'var(--card-shadow)',
        'theme-card-hover': 'var(--card-shadow-hover)',
        'theme-dropdown': '0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)'
      }
    }
  },
  plugins: []
};
