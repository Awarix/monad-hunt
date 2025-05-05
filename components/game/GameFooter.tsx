import React, { ReactNode } from 'react';
import { useRouter } from 'next/navigation'; 

interface FooterButtonProps {
  label: string;
  icon: ReactNode;
  onClick?: () => void;
}

const FooterButton: React.FC<FooterButtonProps> = ({ label, icon, onClick }) => (
  <button
    onClick={onClick}
    aria-label={label}
    className={`
      flex flex-col items-center p-2 rounded-lg 
      text-cyan-300 
      bg-purple-800/60 hover:bg-purple-700/70 
      transition-all duration-200 ease-in-out 
      focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-opacity-75 
      backdrop-blur-sm text-xs w-16 h-14 justify-center shadow-md 
      hover:text-cyan-100
    `}
  >
    <div className="w-5 h-5 mb-0.5 flex items-center justify-center text-cyan-400">{icon}</div>
    <span className='text-center leading-tight'>{label}</span>
  </button>
);

const GameFooter: React.FC = () => {
  const router = useRouter();

  const handleBack = () => {
    // Navigate back to the hunts list or previous page
    router.push('/hunts'); // Or use router.back() if preferred
  };

  const handleShare = () => {
    // Placeholder for share functionality (e.g., copy link, web share API)
    alert('Share button clicked! (Functionality TBD)');
  };

  return (
    <footer className="w-full p-2 bg-black/30 backdrop-blur-sm border-t border-purple-800/50 flex justify-around items-center flex-shrink-0 space-x-1">
      {/* Back Button */} 
      <FooterButton 
        label="Back" 
        icon={
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
        } 
        onClick={handleBack} 
       />
      {/* Share Button */} 
      <FooterButton 
        label="Share" 
        icon={
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12s-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6.001l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
            </svg>
        } 
        onClick={handleShare} 
      />
    </footer>
  );
};

export default GameFooter; 