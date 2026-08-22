import React from 'react';

interface Signal87LogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
  textClassName?: string;
}

export const Signal87Logo: React.FC<Signal87LogoProps> = ({
  className = '',
  size = 36,
  showText = false,
  textClassName = 'text-[var(--ink)] font-extrabold text-lg'
}) => {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Authentic Signal87 Icon - 4 Diagonal Sky-Blue Signal Bars in Dark Squircle */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0 rounded-2xl"
      >
        {/* Ink squircle */}
        <rect width="100" height="100" rx="24" fill="var(--ink)" />
        
        {/* Four diagonal oxblood signal bars */}
        <g fill="var(--accent-ink)">
          {/* Top Bar */}
          <path d="M 28 44.5 L 71 22.5 L 71 31 L 28 53 Z" />
          
          {/* Second Bar */}
          <path d="M 22 57.5 L 77 29.5 L 77 38 L 22 66 Z" />
          
          {/* Third Bar */}
          <path d="M 28 70.5 L 77 45.5 L 77 54 L 28 79 Z" />
          
          {/* Bottom Bar */}
          <path d="M 36 83.5 L 71 65.5 L 71 74 L 36 92 Z" />
        </g>
      </svg>

      {showText && (
        <span className={`tracking-tight flex items-center gap-1 ${textClassName}`}>
          <span className="font-semibold text-[var(--ink)]">Signal87</span>
        </span>
      )}
    </div>
  );
};
