const HUB_CONNECT_LAUNCH_URL = 'https://www.millionsnest.com/connect/launch';
const HUB_RECOVERABLE_BOOT_CODES = new Set([
  'HANDOFF_REQUIRED',
  'HANDOFF_INVALID',
  'HANDOFF_EXPIRED',
]);

export function buildHubConnectLaunchUrl(): string {
  return HUB_CONNECT_LAUNCH_URL;
}

export function shouldRedirectToHubConnectLaunch(errorCode: string): boolean {
  return HUB_RECOVERABLE_BOOT_CODES.has(errorCode);
}
