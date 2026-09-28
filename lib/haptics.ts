/** A short buzz to confirm an action. Android only; silently ignored elsewhere. */
export function haptic(ms = 15) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* not supported */
  }
}
