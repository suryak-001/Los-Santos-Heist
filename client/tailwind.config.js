/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // GTA 6 / Vice City sunset palette
                'heist-black': '#0a0514',   // night sky
                'heist-dark': '#160c28',    // panels
                'heist-grey': '#8a80a6',    // muted text and borders
                'heist-light': '#f1e9ff',
                'heist-white': '#ffffff',
                'heist-pink': '#ff2d8a',    // primary accent (neon pink)
                'heist-sun': '#ffb13d',     // sunset gold: own district, highlights
                'heist-orange': '#ff6a3d',
                'heist-violet': '#8c3cff',
                'heist-teal': '#1ee3cf',
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
                display: ['"Bowlby One"', 'Impact', 'sans-serif'],
            }
        },
    },
    plugins: [],
}
