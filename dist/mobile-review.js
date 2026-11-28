export function isMobileReviewDevice(environment = globalThis) {
  const navigator = environment?.navigator || {};
  const userAgent = String(navigator.userAgent || '');
  if (/Android|iPhone|iPad|iPod/i.test(userAgent)) return true;

  const width = Number(environment?.innerWidth ?? environment?.screen?.width);
  const narrow = Number.isFinite(width) && width <= 900;
  const touch = Number(navigator.maxTouchPoints) > 0;
  let coarsePointer = false;
  try {
    coarsePointer = environment?.matchMedia?.('(pointer: coarse)')?.matches === true;
  } catch {
    // A missing or restricted matchMedia implementation is not fatal.
  }
  return narrow && (touch || coarsePointer);
}

// Stockfish Lite is single-threaded. A second instance helps when the device
// can run it without starving the browser UI. deviceMemory is unavailable in
// Safari, so use a conservative CPU/platform fallback rather than disabling
// parallel review on every iPhone and iPad.
export function mobileReviewWorkerCount(environment = globalThis) {
  if (!isMobileReviewDevice(environment)) return 1;

  const navigator = environment?.navigator || {};
  const userAgent = String(navigator.userAgent || '');
  const cores = Number(navigator.hardwareConcurrency);
  const reportedMemory = Number(navigator.deviceMemory);
  const hasMemoryEstimate = Number.isFinite(reportedMemory) && reportedMemory > 0;
  const appleMobile = /iPhone|iPad|iPod/i.test(userAgent);

  if (!Number.isFinite(cores) || cores < 6) return 1;
  if (hasMemoryEstimate && reportedMemory < 4) return 1;

  // With no memory estimate, require 8 logical cores on Android/other browsers.
  // Apple mobile browsers commonly omit deviceMemory, so 6+ cores is enough.
  if (!hasMemoryEstimate && cores < 8 && !appleMobile) return 1;

  return 2;
}
