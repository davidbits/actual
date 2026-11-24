export const MIN_REFRESH_MINUTES = 5;
export const MAX_REFRESH_MINUTES = 24 * 60;
export const DEFAULT_REFRESH_MINUTES = 15;

/** Keep legacy settings within the supported daily refresh window. */
export function refreshInterval(minutes: number) {
  return Number.isInteger(minutes)
    ? Math.max(MIN_REFRESH_MINUTES, Math.min(MAX_REFRESH_MINUTES, minutes))
    : DEFAULT_REFRESH_MINUTES;
}
