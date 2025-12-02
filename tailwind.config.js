/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'brand-primary': '#332f78',
        'brand-secondary': '#20A070',
        'neutral': {
          0: '#FFFFFF',
          100: '#F5F6F7',
          200: '#E0E0E0',
          300: '#CCCCCC',
          500: '#888888',
          700: '#555555',
          900: '#111111',
        },
        'success': '#28A745',
        'warning': '#FFC107',
        'error': '#DC3545',
        'info': '#17A2B8',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      fontSize: {
        'xs': '0.75rem',
        'sm': '0.875rem',
        'base': '1rem',
        'lg': '1.25rem',
        'xl': '1.5rem',
        '2xl': '2rem',
      },
      spacing: {
        '1': '4px',
        '2': '8px',
        '3': '12px',
        '4': '16px',
        '5': '24px',
        '6': '32px',
        '7': '48px',
        '8': '64px',
      },
      borderRadius: {
        'sm': '2px',
        'DEFAULT': '4px',
        'md': '4px',
        'lg': '8px',
        'full': '9999px',
      },
      boxShadow: {
        'level-1': '0 1px 3px rgba(0,0,0,0.1)',
        'level-2': '0 4px 8px rgba(0,0,0,0.15)',
        'level-3': '0 8px 16px rgba(0,0,0,0.15)',
        'focus': '0 0 0 3px rgba(51,47,120,0.4)',
      },
      screens: {
        'xs': '480px',
        'sm': '576px',
        'md': '768px',
        'lg': '992px',
        'xl': '1200px',
        '2xl': '1400px',
      },
    },
  },
  plugins: [],
};
