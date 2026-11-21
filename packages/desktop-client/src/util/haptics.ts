function vibrate(durationMs: number) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(durationMs);
  }
}

/** A key on an on-screen keypad was pressed. */
export function hapticKeyPress() {
  vibrate(3);
}

/** A swipe or pull crossed the threshold at which releasing takes effect. */
export function hapticThresholdCrossed() {
  vibrate(10);
}
