import React from 'react';

interface TheiakshiLogoProps {
  variant?: 'full' | 'emblem';
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const TheiakshiLogo: React.FC<TheiakshiLogoProps> = ({
  variant = 'full',
  className = '',
  size = 'md'
}) => {
  const heights = {
    sm: variant === 'full' ? 'h-7' : 'h-7 w-7',
    md: variant === 'full' ? 'h-9' : 'h-9 w-9',
    lg: variant === 'full' ? 'h-12' : 'h-12 w-12',
    xl: variant === 'full' ? 'h-16' : 'h-16 w-16'
  };

  if (variant === 'emblem') {
    return (
      <svg
        viewBox="0 0 100 100"
        className={`${heights[size]} shrink-0 ${className}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="emblemRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3A3E45" />
            <stop offset="50%" stopColor="#181B20" />
            <stop offset="100%" stopColor="#080A0C" />
          </linearGradient>
          <linearGradient id="emblemRedFill" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FF383F" />
            <stop offset="50%" stopColor="#EF1B23" />
            <stop offset="100%" stopColor="#B91C1C" />
          </linearGradient>
          <filter id="redGlowFilter" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* 3D Black Outer Metallic Ring */}
        <ellipse cx="50" cy="50" rx="46" ry="38" fill="url(#emblemRingGrad)" stroke="#2D323C" strokeWidth="2" />
        <ellipse cx="50" cy="50" rx="43" ry="35" fill="none" stroke="#EF1B23" strokeWidth="1.5" opacity="0.9" />
        <ellipse cx="50" cy="50" rx="38" ry="30" fill="#020817" />

        {/* Correct Right-Facing 't' Mark */}
        {/* Horizontal Crossbar (Extending to the RIGHT) */}
        <path
          d="M 16,42 C 35,39 65,39 88,44 C 88,50 65,49 16,50 Z"
          fill="url(#emblemRedFill)"
          filter="url(#redGlowFilter)"
        />

        {/* Vertical Stem (Sweeping to the RIGHT at the bottom) */}
        <path
          d="M 24,20 L 33,20 L 33,58 C 33,72 45,78 62,68 C 64,63 56,60 48,60 C 37,60 33,54 33,46 L 33,20 Z"
          fill="url(#emblemRedFill)"
          filter="url(#redGlowFilter)"
        />
      </svg>
    );
  }

  return (
    <div className={`inline-flex items-center gap-3 select-none ${className}`}>
      {/* Emblem SVG (Correct Right-Facing Orientation) */}
      <svg
        viewBox="0 0 100 100"
        className={`${heights[size]} shrink-0`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="fullRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3A3E45" />
            <stop offset="50%" stopColor="#181B20" />
            <stop offset="100%" stopColor="#080A0C" />
          </linearGradient>
          <linearGradient id="fullRedFill" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FF383F" />
            <stop offset="50%" stopColor="#EF1B23" />
            <stop offset="100%" stopColor="#C51118" />
          </linearGradient>
        </defs>

        {/* Outer 3D Metallic Ring */}
        <ellipse cx="50" cy="50" rx="46" ry="38" fill="url(#fullRingGrad)" stroke="#2D323C" strokeWidth="2" />
        <ellipse cx="50" cy="50" rx="43" ry="35" fill="none" stroke="#EF1B23" strokeWidth="1.8" opacity="0.95" />
        <ellipse cx="50" cy="50" rx="38" ry="30" fill="#020817" />

        {/* Correct Right-Facing 't' Mark */}
        {/* Horizontal Crossbar (Extending to the RIGHT) */}
        <path d="M 16,42 C 35,39 65,39 88,44 C 88,50 65,49 16,50 Z" fill="url(#fullRedFill)" />

        {/* Vertical Stem (Sweeping to the RIGHT at the bottom) */}
        <path d="M 24,20 L 33,20 L 33,58 C 33,72 45,78 62,68 C 64,63 56,60 48,60 C 37,60 33,54 33,46 L 33,20 Z" fill="url(#fullRedFill)" />
      </svg>

      {/* Typography */}
      <div className="flex flex-col justify-center leading-none">
        <span
          className="font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-[#EF1B23] to-red-600"
          style={{
            fontSize: size === 'sm' ? '1.15rem' : size === 'md' ? '1.45rem' : size === 'lg' ? '1.85rem' : '2.3rem',
            fontFamily: 'Inter, system-ui, sans-serif',
            letterSpacing: '-0.02em'
          }}
        >
          Theiakshi
        </span>
        <div className="flex items-center gap-1 mt-0.5">
          <span className="h-[1.5px] w-3 bg-red-600 rounded-full opacity-90"></span>
          <span
            className="font-bold text-slate-100 uppercase tracking-[0.28em]"
            style={{
              fontSize: size === 'sm' ? '7px' : size === 'md' ? '9px' : size === 'lg' ? '11px' : '13px'
            }}
          >
            ENTERPRISES
          </span>
          <span className="h-[1.5px] w-3 bg-red-600 rounded-full opacity-90"></span>
        </div>
      </div>
    </div>
  );
};
