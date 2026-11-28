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

// Two single-thread Lite engines are used only when the phone reports enough
// CPU and memory to run both workers while keeping resources for the UI.
export function mobileReviewWorkerCount(environment = globalThis) {
  if (!isMobileReviewDevice(environment)) return 1;
  const navigator = environment?.navigator || {};
  const cores = Number(navigator.hardwareConcurrency);
  const memory = Number(navigator.deviceMemory);
  return Number.isFinite(cores) && cores >= 8 &&
    Number.isFinite(memory) && memory >= 4 ? 2 : 1;
}