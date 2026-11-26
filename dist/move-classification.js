// Loss thresholds for move review, measured in win-percentage points.
export const LOSS_THRESHOLDS = Object.freeze({
  accepted: 1,
  excellent: 2,
  good: 5,
  inaccuracy: 10,
  mistake: 20,
});

export function classifyByLoss({ loss, exactBest = false, accepted = false }) {
  if (!Number.isFinite(loss) || loss < 0) throw new TypeError('loss must be a finite non-negative number');
  const { accepted: acceptedThreshold, excellent, good, inaccuracy, mistake } = LOSS_THRESHOLDS;
  const consideredAccepted = accepted || loss <= acceptedThreshold;
  if (exactBest) return 'best';
  if (consideredAccepted || loss <= excellent) return 'excellent';
  if (loss <= good) return 'good';
  if (loss <= inaccuracy) return 'inaccuracy';
  if (loss <= mistake) return 'mistake';
  return 'blunder';
}
