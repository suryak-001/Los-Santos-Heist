import React, { useEffect, useRef } from 'react';

// Furthest the backdrop drifts from centre, in px, as the mouse crosses the screen
const MAX_SHIFT = 12;

// Los Santos behind every screen: the sunset photo, a subtle parallax drift that
// follows the mouse, and a dark overlay so the glass panels on top stay readable.
// A fixed layer rather than background-attachment: fixed, which iOS ignores.
const CityBackdrop: React.FC = () => {
    const imageRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // No drift on touch screens or for players who asked for less motion
        const still = globalThis.matchMedia('(prefers-reduced-motion: reduce), (hover: none)');
        if (still.matches) return;

        let frame = 0;
        const onMove = (e: PointerEvent) => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                const x = (0.5 - e.clientX / globalThis.innerWidth) * 2 * MAX_SHIFT;
                const y = (0.5 - e.clientY / globalThis.innerHeight) * 2 * MAX_SHIFT;
                imageRef.current?.style.setProperty('transform', `translate3d(${x}px, ${y}px, 0) scale(1.05)`);
            });
        };
        globalThis.addEventListener('pointermove', onMove);
        return () => {
            globalThis.removeEventListener('pointermove', onMove);
            cancelAnimationFrame(frame);
        };
    }, []);

    return (
        <>
            <div className="fixed inset-0 z-0 overflow-hidden bg-heist-black pointer-events-none" aria-hidden="true">
                <div
                    ref={imageRef}
                    className="absolute inset-0 bg-[url('/assets/realistic-los-santos-bg.webp')] bg-cover bg-center bg-no-repeat scale-105 transition-transform duration-700 ease-out will-change-transform"
                />
            </div>
            {/* Legibility overlay: above the photo, below the game UI */}
            <div className="fixed inset-0 bg-black/40 z-0 pointer-events-none" aria-hidden="true"></div>
        </>
    );
};

export default CityBackdrop;
