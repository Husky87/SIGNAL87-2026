import React from 'react';

/**
 * Decorative instrument dial for the marketing homepage hero. Purely
 * ornamental — carries no content, so it's hidden from assistive tech.
 */
export const SignalDial: React.FC = () => (
  <svg viewBox="0 0 300 300" aria-hidden="true" className="h-full w-full">
    <g transform="translate(150,150)">
      {Array.from({ length: 16 }).map((_, i) => (
        <line
          key={i}
          x1="150"
          y1="0"
          x2="162"
          y2="0"
          transform={`rotate(${i * 22.5})`}
          stroke="rgba(32,33,30,0.22)"
          strokeWidth="1.2"
        />
      ))}

      <g className="s87-dial-ring-1">
        <circle r="40" fill="none" stroke="rgba(32,33,30,0.22)" strokeWidth="1.3" strokeDasharray="2 7" />
      </g>
      <g className="s87-dial-ring-2">
        <circle r="65" fill="none" stroke="rgba(32,33,30,0.19)" strokeWidth="1.3" strokeDasharray="9 5" />
      </g>
      <g className="s87-dial-ring-3">
        <circle r="90" fill="none" stroke="#69b9c5" strokeWidth="1.6" opacity="0.9" />
      </g>
      <g className="s87-dial-ring-4">
        <circle r="115" fill="none" stroke="rgba(32,33,30,0.16)" strokeWidth="1.3" strokeDasharray="1 6" />
      </g>
      <g className="s87-dial-ring-5">
        <circle r="140" fill="none" stroke="rgba(32,33,30,0.13)" strokeWidth="1.3" strokeDasharray="16 7" />
      </g>

      <g className="s87-dial-particle-1">
        <circle cx="40" cy="0" r="2.6" fill="#69b9c5" />
      </g>
      <g className="s87-dial-particle-2">
        <circle cx="65" cy="0" r="3" fill="#20211e" />
      </g>
      <g className="s87-dial-particle-3">
        <circle cx="90" cy="0" r="3.4" fill="#69b9c5" />
      </g>
      <g className="s87-dial-particle-4">
        <circle cx="115" cy="0" r="2.4" fill="#20211e" />
      </g>

      <circle r="7" fill="#20211e" className="s87-dial-core" />
    </g>
  </svg>
);
