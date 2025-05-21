import React, { useEffect, useState } from 'react';

interface HowToPlayModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const HowToPlayModal: React.FC<HowToPlayModalProps> = ({ isOpen, onClose }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 3;

  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(1); // Reset to first step when modal is closed/reopened
      return;
    }

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscapeKey);
    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isOpen, onClose]);

  // TODO: Implement focus trapping for better accessibility

  if (!isOpen) return null;

  const nextStep = () => setCurrentStep((prev) => Math.min(prev + 1, totalSteps));
  const prevStep = () => setCurrentStep((prev) => Math.max(prev - 1, 1));

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <>
            <h3 className="text-2xl font-bold mb-4 text-center font-mono">The Mission</h3>
            <ul className="list-disc list-inside space-y-2 text-base md:text-lg">
              <li><span className="font-semibold">Team Up:</span> Join Farcaster friends in a collaborative treasure hunt on the Monad network.</li>
              <li><span className="font-semibold">The Goal:</span> Work together to find a hidden treasure on a 10x10 grid and mint a unique NFT map of your adventure.</li>
            </ul>
          </>
        );
      case 2:
        return (
          <>
            <h3 className="text-2xl font-bold mb-4 text-center font-mono">How to Play</h3>
            <ul className="list-disc list-inside space-y-2 text-base md:text-lg">
              <li><span className="font-semibold">The Grid:</span> Navigate the 10x10 map.</li>
              <li><span className="font-semibold">Taking Turns:</span> Move one adjacent square at a time (up, down, left, right). You can&apos;t make two moves consecutively.</li>
              <li><span className="font-semibold">On-Chain Moves:</span> Every move is a secure transaction on Monad.</li>
              <li><span className="font-semibold">Hints:</span> After each move, get a clue (e.g., <span className="italic">“🔥 Warmer. Direction: 🧭 North-East.”</span>). All previous hints are visible to your hunt party.</li>
            </ul>
          </>
        );
      case 3:
        return (
          <>
            <h3 className="text-2xl font-bold mb-4 text-center font-mono">The Challenge &amp; Rewards</h3>
            <ul className="list-disc list-inside space-y-2 text-base md:text-lg">
              <li><span className="font-semibold">Limited Moves:</span> Each hunt has a 10-move limit.</li>
              <li><span className="font-semibold">Turn Timer:</span> You have 75 seconds to make your move when it&apos;s your turn.</li>
              <li><span className="font-semibold">Team Victory:</span> If anyone in your hunt finds the treasure, everyone wins!</li>
              <li><span className="font-semibold">NFT Souvenirs:</span> Win or lose, all participants get to mint a special NFT map.</li>
            </ul>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      role="dialog" 
      aria-modal="true" 
    >
      <div className="bg-[var(--theme-card-bg)] text-[var(--theme-primary-text)] rounded-lg border-4 border-[var(--theme-border-color)] shadow-xl max-w-lg w-full p-6 md:p-8 relative">
        <button 
          onClick={onClose}
          className="absolute top-3 right-3 text-2xl font-bold text-[var(--theme-primary-text)] hover:text-[var(--theme-secondary-accent)] transition-colors"
          aria-label="Close modal"
        >
          &times;
        </button>
        
        <div className="min-h-[200px]">
          {renderStepContent()}
        </div>

        <div className="mt-6 flex justify-between items-center">
          <div>
            {currentStep > 1 && (
              <button
                onClick={prevStep}
                className="px-6 py-2 bg-gray-200 text-gray-700 font-semibold rounded-full border-2 border-black hover:bg-gray-300 transition-colors shadow-sm"
              >
                Previous
              </button>
            )}
          </div>
          <div className="text-sm text-[var(--theme-secondary-text)]">
            Step {currentStep} of {totalSteps}
          </div>
          <div>
            {currentStep < totalSteps ? (
              <button
                onClick={nextStep}
                className="px-6 py-2 bg-[var(--theme-button-primary-bg)] text-[var(--theme-button-primary-text)] font-bold rounded-full border-2 border-black hover:bg-amber-600 transition-colors shadow-sm"
              >
                Next
              </button>
            ) : (
              <button
                onClick={onClose} // Close modal on the last step
                className="px-6 py-2 bg-green-500 text-white font-bold rounded-full border-2 border-black hover:bg-green-600 transition-colors shadow-sm"
              >
                Got it!
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HowToPlayModal; 