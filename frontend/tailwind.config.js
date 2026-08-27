/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#020817',
          900: '#050B14',
          850: '#07111F',
          800: '#0A1424',
          750: '#0D1728',
          700: '#101B2D',
          600: '#1E293B'
        },
        tred: {
          500: '#EF1B23',
          600: '#FF2028',
          700: '#DC2626'
        },
        tcyan: {
          400: '#22D3EE',
          500: '#06B6D4',
          600: '#0891B2'
        },
        tblue: {
          500: '#2563EB',
          600: '#3B82F6'
        }
      }
    }
  },
  plugins: []
};

