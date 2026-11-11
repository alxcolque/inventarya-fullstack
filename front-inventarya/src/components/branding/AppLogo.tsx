import React, { useState } from 'react';
import { getImageUrl } from '@/utils/image';

interface AppLogoProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src?: string | null;
  alt?: string;
  className?: string;
  fallbackSrc?: string;
}

export const INVENTARYA_LOGO_PATH = '/branding/logo-inventarya.png';
export const INVENTARYA_FAVICON_PATH = '/favicon.png';

export const AppLogo: React.FC<AppLogoProps> = ({
  src,
  alt = 'Inventarya',
  className = 'w-8 h-8 object-contain',
  fallbackSrc = INVENTARYA_LOGO_PATH,
  onError,
  ...props
}) => {
  const [loadStage, setLoadStage] = useState<'primary' | 'fallback' | 'icon'>('primary');
  const [prevSrc, setPrevSrc] = useState(src);

  if (src !== prevSrc) {
    setPrevSrc(src);
    setLoadStage('primary');
  }

  const primaryUrl = src ? getImageUrl(src) : '';
  const fallbackUrl = getImageUrl(fallbackSrc || INVENTARYA_LOGO_PATH);

  // If no initial src provided, immediately use fallback
  const resolvedSrc = (loadStage === 'primary' && primaryUrl) ? primaryUrl : fallbackUrl;

  if (loadStage === 'icon' || !resolvedSrc) {
    return (
      <div
        className={`flex items-center justify-center bg-primary/10 text-primary font-bold rounded-xl select-none ${className}`}
        role="img"
        aria-label={alt}
      >
        <span className="text-xs uppercase tracking-wider font-black">
          {alt.slice(0, 2).toUpperCase() || 'IN'}
        </span>
      </div>
    );
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      className={`object-contain ${className}`}
      onError={(e) => {
        if (loadStage === 'primary') {
          setLoadStage('fallback');
        } else if (loadStage === 'fallback') {
          setLoadStage('icon');
        }
        onError?.(e);
      }}
      {...props}
    />
  );
};

export default AppLogo;
