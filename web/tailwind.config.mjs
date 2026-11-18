/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        paper: '#F7F1E5',
        card: '#FFFBF3',
        coffee: '#3B2A1E',
        brown: '#7A5C48',
        leather: {
          DEFAULT: '#8B5A2B',
          hover: '#6F4420',
        },
        gold: '#C9A227',
        'border-paper': '#E6D8C3',
        badge: {
          digital: {
            bg: '#EFE3D0',
            text: '#6F4420',
          },
          physical: {
            bg: '#DDE7DB',
            text: '#3E5B3A',
          },
        },
      },
      fontFamily: {
        serif: ['Georgia', 'Cambria', '"Times New Roman"', 'Times', 'serif'],
        sans: ['system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
