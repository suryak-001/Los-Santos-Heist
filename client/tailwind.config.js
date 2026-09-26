/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'scarcity-bg': '#0a0a0a', // Keep for backward compat if needed, or replace usages
                'myth-black': '#000000',
                'myth-dark': '#121212',
                'myth-grey': '#606060',
                'myth-light': '#e5e5e5',
                'myth-white': '#ffffff',
                'myth-red': '#ff3333', // Horror Accent
                'hub-a': '#ff6b6b',
                'hub-b': '#feca57',
                'hub-c': '#54a0ff',
                'myth-gold': '#FFD700',
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
                serif: ['Cinzel', 'serif'],
            }
        },
    },
    plugins: [],
}
