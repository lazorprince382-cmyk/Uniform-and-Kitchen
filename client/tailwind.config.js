/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        school: {
          navy: '#152a5e',
          'navy-dark': '#0c1840',
          'navy-light': '#1e4080',
          red: '#c41e3a',
          'red-dark': '#9e1830',
          'red-light': '#e8354f',
        },
        sidebar: '#152a5e',
        'sidebar-hover': '#1e4080',
        'sidebar-active': '#c41e3a',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  safelist: [
    'bg-school-red',
    'text-school-red',
    'text-school-red-dark',
    'text-school-red-light',
    'text-school-navy',
    'bg-school-navy/5',
    'border-school-navy/10',
    'border-school-red/20',
    'border-l-school-red',
    'hover:bg-school-red-dark',
  ],
  plugins: [],
};
