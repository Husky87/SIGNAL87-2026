import React from 'react';

/**
 * Decorative radial burst for the marketing homepage's "One intelligence
 * layer" section. Purely ornamental — carries no content, so it's hidden
 * from assistive tech.
 */
export const RadialAperture: React.FC = () => (
  <svg viewBox="0 0 300 300" aria-hidden="true" className="h-full w-full">
    <g transform="translate(150,150)">
      <circle r="20" fill="none" stroke="#69b9c5" strokeWidth="1.4" className="s87-aperture-ping s87-aperture-ping-1" />
      <circle r="20" fill="none" stroke="rgba(32,33,30,0.3)" strokeWidth="1.4" className="s87-aperture-ping s87-aperture-ping-2" />

      <g className="s87-aperture-spokes">
        {Array.from({ length: 18 }).map((_, i) => {
          const accent = i % 3 === 0;
          return (
            <line
              key={i}
              x1="16"
              y1="0"
              x2={accent ? 95 : 60}
              y2="0"
              transform={`rotate(${i * 20})`}
              stroke={accent ? '#69b9c5' : 'rgba(32,33,30,0.22)'}
              strokeWidth={accent ? 2.2 : 1.4}
              opacity={accent ? 0.95 : 1}
            />
          );
        })}
      </g>

      <circle r="10" fill="#20211e" />
    </g>
  </svg>
);
