import React from 'react';
import fullLogoImg from '../assets/theiakshi-full-logo.png';
import emblemImg from '../assets/theiakshi-emblem.png';

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
    sm: variant === 'full' ? 'h-8' : 'h-8 w-8',
    md: variant === 'full' ? 'h-10' : 'h-10 w-10',
    lg: variant === 'full' ? 'h-14' : 'h-14 w-14',
    xl: variant === 'full' ? 'h-20' : 'h-20 w-20'
  };

  if (variant === 'emblem') {
    return (
      <img
        src={emblemImg}
        alt="Theiakshi Emblem"
        className={`${heights[size]} shrink-0 object-contain select-none ${className}`}
      />
    );
  }

  return (
    <img
      src={fullLogoImg}
      alt="Theiakshi"
      className={`${heights[size]} shrink-0 object-contain select-none ${className}`}
    />
  );
};
