import React from 'react';

export type BrandLogoLayout = 'horizontal' | 'stacked' | 'mark' | 'micro';
export type BrandLogoSurface = 'dark' | 'light';
export type BrandLogoColor = 'color' | 'indigo' | 'blue' | 'white' | 'black';
export type BrandLogoSize = 'desktopWordmark' | 'drawerWordmark' | 'mobileMark';

export const BRAND_LOGO_DIMENSIONS: Record<BrandLogoSize, { width: number; height: number }> = {
  desktopWordmark: { width: 208, height: 50 },
  drawerWordmark: { width: 184, height: 44 },
  mobileMark: { width: 40, height: 40 },
};

interface BrandLogoProps {
  layout?: BrandLogoLayout;
  surface?: BrandLogoSurface;
  markColor?: BrandLogoColor;
  className?: string;
  decorative?: boolean;
  size?: BrandLogoSize;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  layout = 'horizontal',
  surface = 'dark',
  markColor = 'color',
  className = '',
  decorative = false,
  size,
}) => {
  let src = '';
  const basePath = '/brand/connect/v2/01_master_vector';

  if (layout === 'horizontal') {
    src = `${basePath}/connect-logo-horizontal-on-${surface}.svg`;
  } else if (layout === 'stacked') {
    src = `${basePath}/connect-logo-stacked-on-${surface}.svg`;
  } else if (layout === 'micro') {
    if (markColor === 'white' || markColor === 'black') {
      src = `${basePath}/connect-mark-micro-${markColor}.svg`;
    } else {
      src = `${basePath}/connect-mark-micro.svg`;
    }
  } else {
    // layout === 'mark'
    if (markColor === 'color') {
      src = `${basePath}/connect-mark-color.svg`;
    } else {
      src = `${basePath}/connect-mark-${markColor}.svg`;
    }
  }

  const style: React.CSSProperties = size ? {
    display: 'block',
    objectFit: 'contain',
    flexShrink: 0,
    maxWidth: 'none',
    width: BRAND_LOGO_DIMENSIONS[size].width,
    height: BRAND_LOGO_DIMENSIONS[size].height,
  } : {};

  return (
    <img
      src={src}
      alt={decorative ? '' : 'MillionsNest Connect'}
      aria-hidden={decorative ? 'true' : undefined}
      className={className}
      style={size ? style : undefined}
      width={size ? BRAND_LOGO_DIMENSIONS[size].width : undefined}
      height={size ? BRAND_LOGO_DIMENSIONS[size].height : undefined}
    />
  );
};
