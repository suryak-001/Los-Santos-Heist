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
                // Loot and HUD accents: glows, rank badges, money figures
                'heist-gold': '#FFD400',
                'heist-money': '#3DDC84',
                'heist-purple': '#A855F7',
                'heist-cyan': '#22D3EE',
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
                display: ['"Bowlby One"', 'Impact', 'sans-serif'],
                // Numbers, timers and crew IDs
                mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
            },
            boxShadow: {
                'glow-gold': '0 0 15px rgba(255, 212, 0, 0.5)',
                'glow-pink': '0 0 15px rgba(255, 45, 138, 0.5)',
                'glow-money': '0 0 15px rgba(61, 220, 132, 0.45)',
                'glow-cyan': '0 0 15px rgba(34, 211, 238, 0.45)',
                'glow-purple': '0 0 15px rgba(168, 85, 247, 0.45)',
                'hud': '0 20px 50px -12px rgba(0, 0, 0, 0.65)',
            },
            keyframes: {
                // Panels and cards rising into place on load
                'fade-up': {
                    '0%': { opacity: '0', transform: 'translateY(16px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                // Chat bubbles: translate-y-4 opacity-0 -> translate-y-0 opacity-100
                'slide-up': {
                    '0%': { opacity: '0', transform: 'translateY(1rem)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                // Radar ring around districts you can hand loot to
                'district-ping': {
                    '0%': { opacity: '0.7', transform: 'scale(1)' },
                    '70%, 100%': { opacity: '0', transform: 'scale(1.35)' },
                },
                'district-glow': {
                    '0%, 100%': { boxShadow: '0 0 8px rgba(255, 45, 138, 0.35)' },
                    '50%': { boxShadow: '0 0 22px rgba(255, 45, 138, 0.8)' },
                },
                'gradient-shift': {
                    '0%, 100%': { backgroundPosition: '50% 0%' },
                    '50%': { backgroundPosition: '50% 100%' },
                },
                'road-flow': {
                    to: { strokeDashoffset: '-36' },
                },
                // Bonus figure bumping when it drops by 50
                'tick-pop': {
                    '0%': { transform: 'scale(1.25)', color: '#ff2d8a' },
                    '100%': { transform: 'scale(1)' },
                },
                'float': {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-4px)' },
                },
            },
            animation: {
                'fade-up': 'fade-up 0.55s cubic-bezier(0.22, 1, 0.36, 1) both',
                'slide-up': 'slide-up 0.35s cubic-bezier(0.22, 1, 0.36, 1) both',
                'district-ping': 'district-ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
                'district-glow': 'district-glow 2s ease-in-out infinite',
                'gradient-shift': 'gradient-shift 6s ease-in-out infinite',
                'road-flow': 'road-flow 1.2s linear infinite',
                'tick-pop': 'tick-pop 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
                'float': 'float 3s ease-in-out infinite',
            },
        },
    },
    plugins: [],
}
