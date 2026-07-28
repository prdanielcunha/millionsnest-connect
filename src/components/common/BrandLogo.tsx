import React from 'react';

export type BrandLogoLayout = 'horizontal' | 'stacked' | 'mark' | 'micro';
export type BrandLogoSurface = 'dark' | 'light';
export type BrandLogoColor = 'color' | 'indigo' | 'blue' | 'white' | 'black';

interface BrandLogoProps {
  layout?: BrandLogoLayout;
  surface?: BrandLogoSurface;
  markColor?: BrandLogoColor;
  className?: string;
  decorative?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  layout = 'horizontal',
  surface = 'dark',
  markColor = 'color',
  className = '',
  decorative = false,
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

  return (
    <img
      src={src}
      alt={decorative ? '' : 'MillionsNest Connect'}
      aria-hidden={decorative ? 'true' : undefined}
      className={className}
      // To ensure no layout shift, we could set typical heights. We'll use Tailwind classes passed via className.
    />
  );
};
