import React, { ReactNode } from 'react';

// Define the props for the IconButton
interface IconButtonProps {
  onClick?: () => void;       // Use standard function type syntax
  children: ReactNode;     // Icon or content to display
  ariaLabel: string;       // Accessibility label
  className?: string;      // Optional additional class names
  disabled?: boolean;      // Optional disabled state
}

// Define the IconButton component using styles consistent with STYLES.md
export const IconButton: React.FC<IconButtonProps> = ({ 
  onClick, 
  children, 
  ariaLabel, 
  className = '', 
  disabled = false 
}) => {
  // Base styling for the button (adjust based on STYLES.md if needed)
  const baseStyle = `
    p-1.5 rounded-full 
    bg-purple-800/60 hover:bg-purple-700/80 
    text-cyan-300 hover:text-cyan-100 
    transition-all duration-200 ease-in-out 
    focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-opacity-75 
    backdrop-blur-sm shadow-md 
    disabled:opacity-50 disabled:cursor-not-allowed
  `;

  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      disabled={disabled}
      className={`${baseStyle} ${className}`} // Combine base style with any custom classes
    >
      {children}
    </button>
  );
};

export default IconButton; 