/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        'primary-dark': '#1a1a1a',
        'light-bg': '#2c2c2c',
        'violet-deep': '#4A148C',
        'violet-mid': '#6A1B9A',
        'violet-light': '#8E24AA',
        'accent-green': '#2ECC71',
        'accent-blue': '#3498DB',
        'dark-text': '#1a1a1a',
        'light-text': '#E0E0E0',
        'muted-light': '#B0B0B0',
      },
      fontFamily: {
        'inter': ['Inter', 'sans-serif'],
        'poppins': ['Poppins', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
