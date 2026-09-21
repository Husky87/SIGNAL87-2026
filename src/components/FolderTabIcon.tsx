import React from 'react';

interface FolderTabIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
}

/**
 * Signal87 folder icon — option D.
 *
 * The blue tab is the brand cue; the folder body deliberately inherits the
 * surrounding text color so it stays quiet in dense lists and menus.
 */
export const FolderTabIcon: React.FC<FolderTabIconProps> = ({
  size = 18,
  className,
  ...props
}) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    className={className}
    {...props}
  >
    <path
      d="M3.25 7.25V5.9c0-.91.74-1.65 1.65-1.65h3.52c.5 0 .98.23 1.29.62l1.9 2.38h7.49c.91 0 1.65.74 1.65 1.65v9.2c0 .91-.74 1.65-1.65 1.65H4.9c-.91 0-1.65-.74-1.65-1.65V7.25Z"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M4.75 5.75h3.34c.26 0 .51.12.67.33l.94 1.17H4.75v-1.5Z"
      fill="var(--accent)"
    />
  </svg>
);
