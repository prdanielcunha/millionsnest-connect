const MUSIC_SCALE_ORIGIN = 'https://musicscale.millionsnest.com';

export function toTrustedMusicScaleUrl(deepLink: string | undefined): string | null {
  const value = typeof deepLink === 'string' ? deepLink.trim() : '';
  if (!value || value.length > 512 || !value.startsWith('/') || value.startsWith('//')) return null;

  try {
    const url = new URL(value, MUSIC_SCALE_ORIGIN);
    if (url.origin !== MUSIC_SCALE_ORIGIN) return null;
    return url.toString();
  } catch {
    return null;
  }
}
