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
        title: 'Welcome to LOKAH',
        content: 'Welcome to the mythical trading game! This tutorial will guide you through the basics. You can skip at any time.',
    },
    {
        title: 'Your Inventory',
        content: 'These are your Mythical Artifacts. You can drag them to trade with other countries. Each artifact has a unique type and ID.',
        targetId: 'inventory-section',
        position: 'right',
    },
    {
        title: 'Trading Mechanism',
        content: 'Drag artifacts from your inventory to country cards to transfer them. You can also use the attach button in chat.',
        targetId: 'inventory-section',
        position: 'right',
    },
    {
        title: 'Sacred Contract',
        content: 'This is your goal! Collect the specified artifacts to fulfill your contract and achieve ascension.',
        targetId: 'contract-section',
        position: 'right',
    },
    {
        title: 'Connected Countries',
        content: 'These are the countries you can communicate and trade with. Click on a country to open the chat.',
        targetId: 'lokah-map-section',
        position: 'bottom',
    },
    {
        title: 'Chat System',
        content: 'Select a country to open a secure communication link. Send messages and trade artifacts here.',
        targetId: 'lokah-map-section',
        position: 'bottom',
    },
    {
        title: 'Attach Resources',
        content: 'Click the paperclip icon to attach an artifact to your message. This will transfer it to the recipient.',
        targetId: 'lokah-map-section',
        position: 'bottom',
    },
    {
        title: 'Game Objective',
        content: 'The objective is to fulfill your contract by collecting the required items. You MUST barter with other countries using the chat system to exchange artifacts. Remember: your contract only includes items you DON\'T have, so trading is essential! BONUS: Facilitating deals between countries (acting as a middleman) earns you extra points!',
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
                                className="absolute border-2 border-myth-gold shadow-[0_0_20px_rgba(255,215,0,0.5)] pointer-events-none"
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
                className={`fixed z-50 bg-myth-dark border-2 border-myth-gold p-6 shadow-2xl max-h-[80vh] overflow-y-auto ${isMobile ? 'w-[calc(100vw-2rem)] left-4' : 'max-w-sm'
                    }`}
                style={{
                    top: `${position.top}px`,
                    ...(isMobile ? {} : { left: `${position.left}px` })
                }}
            >
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="text-xl font-black uppercase text-myth-gold tracking-wider">
                            {step.title}
                        </h3>
                        <div className="text-xs text-myth-grey font-mono mt-1">
                            STEP {currentStep + 1}/{TUTORIAL_STEPS.length}
                        </div>
                    </div>
                    <button
                        onClick={handleSkip}
                        className="text-myth-grey hover:text-myth-white transition-colors p-2 touch-target"
                    >
                        <X size={20} />
                    </button>
                </div>

                <p className="text-myth-white text-sm leading-relaxed mb-6">
                    {step.content}
                </p>

                <div className="flex justify-between items-center gap-4">
                    <button
                        onClick={handleSkip}
                        className="text-xs text-myth-grey hover:text-myth-white uppercase font-bold tracking-widest transition-colors touch-target"
                    >
                        Skip Tutorial
                    </button>
                    <button
                        onClick={handleNext}
                        className="flex items-center gap-2 bg-myth-gold text-myth-black px-6 py-3 font-bold uppercase text-sm hover:bg-myth-white transition-colors touch-target"
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
