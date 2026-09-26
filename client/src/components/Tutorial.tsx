import React, { useState, useEffect } from 'react';
import { X, ArrowRight } from 'lucide-react';

interface TutorialStep {
    title: string;
    content: string;
    targetId?: string;
    position?: 'top' | 'bottom' | 'left' | 'right';
}

const TUTORIAL_STEPS: TutorialStep[] = [
    {
        title: 'Welcome to Los Santos',
        content: 'You run one district of the city. Your crew has a job to pull off and 20 minutes to do it. This quick briefing covers the rules; you can skip it at any time.',
    },
    {
        title: 'Your Heist Order',
        content: 'This is your secret job: the 3 items you must collect. Every matching item you hold is worth +100. Nobody else can see your order, so tell people what you need.',
        targetId: 'contract-section',
        position: 'right',
    },
    {
        title: 'Your Loot',
        content: 'You start with loot you mostly DON\'T need: Cash 💵, Artwork 🖼️, Gold 🪙 and Diamonds 💎. Someone else in the city needs it. Drag an item onto a district to hand it over.',
        targetId: 'inventory-section',
        position: 'right',
    },
    {
        title: 'The City Map',
        content: 'All 12 districts and the roads between them. Yours is highlighted. Districts that glow are your neighbours: in Turf War you can hand loot only to them.',
        targetId: 'city-map-section',
        position: 'bottom',
    },
    {
        title: 'Call Anyone, Deliver Through Your Turf',
        content: 'Tap any district to phone that player, even across the city. To get loot across town, set up a chain: hand it to a neighbour, who hands it to theirs, until it reaches the player who needs it. Use the paperclip to attach loot in a call.',
        targetId: 'city-map-section',
        position: 'bottom',
    },
    {
        title: 'Fixer\'s Cut',
        content: 'Every middleman in a delivery chain earns +100 when the item reaches someone who needs it. Relaying for other crews is a real way to score, even after your own job is done.',
    },
    {
        title: 'Time Is Money',
        content: 'Completing your Heist Order pays a Mission Passed bonus of 1,000, but it drops by 50 every minute (down to 200). The live bonus is shown under your order. Fast deals beat slow perfect ones.',
        targetId: 'contract-section',
        position: 'right',
    },
    {
        title: 'Watch Out for the LSPD',
        content: 'At some point the police will raid the 3 players holding the most loot they don\'t need, and seize 1 item each. A completed heist is safe. Late in the game the city opens up and anyone can hand loot to anyone. Highest score wins.',
    },
];

interface TutorialProps {
    onComplete: () => void;
}

const Tutorial: React.FC<TutorialProps> = ({ onComplete }) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const [isMobile, setIsMobile] = useState(globalThis.innerWidth < 768);

    // Mobile detection
    useEffect(() => {
        const handleResize = () => setIsMobile(globalThis.innerWidth < 768);
        globalThis.addEventListener('resize', handleResize);
        return () => globalThis.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const step = TUTORIAL_STEPS[currentStep];

        if (isMobile) {
            // On mobile, always use bottom-sheet style positioning
            // eslint-disable-next-line
            setPosition({
                top: globalThis.innerHeight - 300, // Bottom sheet style
                left: 16, // Padding from edges
            });
        } else if (step.targetId) {
            const element = document.getElementById(step.targetId);
            if (element) {
                const rect = element.getBoundingClientRect();
                let top = 0;
                let left = 0;

                switch (step.position) {
                    case 'right':
                        top = rect.top + rect.height / 2;
                        left = rect.right + 20;
                        break;
                    case 'left':
                        top = rect.top + rect.height / 2;
                        left = rect.left - 320;
                        break;
                    case 'bottom':
                        top = rect.bottom + 20;
                        left = rect.left + rect.width / 2 - 150;
                        break;
                    case 'top':
                        top = rect.top - 200;
                        left = rect.left + rect.width / 2 - 150;
                        break;
                    default:
                        top = globalThis.innerHeight / 2 - 100;
                        left = globalThis.innerWidth / 2 - 150;
                }

                setPosition({ top, left });
            }
        } else {
            // Center for steps without target
            setPosition({
                top: globalThis.innerHeight / 2 - 100,
                left: globalThis.innerWidth / 2 - 200,
            });
        }
    }, [currentStep, isMobile]);

    const handleNext = () => {
        if (currentStep < TUTORIAL_STEPS.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            onComplete();
        }
    };

    const handleSkip = () => {
        onComplete();
    };

    const step = TUTORIAL_STEPS[currentStep];

    return (
        <>
            {/* Optional spotlight/highlight for target element */}
            {step.targetId && (
                <div className="fixed inset-0 pointer-events-none z-40">
                    <div className="absolute inset-0 bg-black/60" />
                    {(() => {
                        const element = document.getElementById(step.targetId);
                        if (!element) return null;
                        const rect = element.getBoundingClientRect();
                        return (
                            <div
                                className="absolute border-2 border-heist-sun shadow-[0_0_20px_rgba(255,215,0,0.5)] pointer-events-none"
                                style={{
                                    top: rect.top - 4,
                                    left: rect.left - 4,
                                    width: rect.width + 8,
                                    height: rect.height + 8,
                                }}
                            />
                        );
                    })()}
                </div>
            )}

            {/* Tutorial Tooltip */}
            <div
                className={`fixed z-50 bg-heist-dark border-2 border-heist-sun p-6 shadow-2xl max-h-[80vh] overflow-y-auto ${isMobile ? 'w-[calc(100vw-2rem)] left-4' : 'max-w-sm'
                    }`}
                style={{
                    top: `${position.top}px`,
                    ...(isMobile ? {} : { left: `${position.left}px` })
                }}
            >
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="text-xl font-black uppercase text-heist-sun tracking-wider">
                            {step.title}
                        </h3>
                        <div className="text-xs text-heist-grey font-mono mt-1">
                            STEP {currentStep + 1}/{TUTORIAL_STEPS.length}
                        </div>
                    </div>
                    <button
                        onClick={handleSkip}
                        className="text-heist-grey hover:text-heist-white transition-colors p-2 touch-target"
                    >
                        <X size={20} />
                    </button>
                </div>

                <p className="text-heist-white text-sm leading-relaxed mb-6">
                    {step.content}
                </p>

                <div className="flex justify-between items-center gap-4">
                    <button
                        onClick={handleSkip}
                        className="text-xs text-heist-grey hover:text-heist-white uppercase font-bold tracking-widest transition-colors touch-target"
                    >
                        Skip Tutorial
                    </button>
                    <button
                        onClick={handleNext}
                        className="flex items-center gap-2 bg-heist-sun text-heist-black px-6 py-3 font-bold uppercase text-sm hover:bg-heist-white transition-colors touch-target"
                    >
                        {currentStep < TUTORIAL_STEPS.length - 1 ? 'Next' : 'Finish'}
                        <ArrowRight size={16} />
                    </button>
                </div>
            </div>
        </>
    );
};

export default Tutorial;
