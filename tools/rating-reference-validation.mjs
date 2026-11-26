const mean = values => values.length
  ? values.reduce((sum, value) => sum + value, 0) / values.length
  : null;

function median(values) {
  if (!values.length) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function summarize(errors) {
  if (!errors.length) {
    return { n: 0, mae: null, rmse: null, bias: null, medianAbsoluteError: null };
  }
  const absolute = errors.map(Math.abs);
  return {
    n: errors.length,
    mae: Number(mean(absolute).toFixed(3)),
    rmse: Number(Math.sqrt(mean(errors.map(value => value * value))).toFixed(3)),
    bias: Number(mean(errors).toFixed(3)),
    medianAbsoluteError: Number(median(absolute).toFixed(3)),
  };
}

export function interpolateExpectedQuality(bands, rating) {
  if (!Array.isArray(bands) || !bands.length || !Number.isFinite(rating)) return null;
  if (bands.some(row => !Array.isArray(row) || row.length < 2 ||
      !Number.isFinite(row[0]) || !Number.isFinite(row[1]))) return null;
  const sorted = bands.slice().sort((a, b) => a[0] - b[0]);
  if (rating <= sorted[0][0]) return sorted[0][1];
  for (let index = 1; index < sorted.length; index++) {
    const lower = sorted[index - 1];
    const upper = sorted[index];
    if (rating <= upper[0]) {
      const span = upper[0] - lower[0];
      if (span <= 0) return upper[1];
      const fraction = (rating - lower[0]) / span;
      return lower[1] + (upper[1] - lower[1]) * fraction;
    }
  }
  return sorted.at(-1)[1];
}

/**
 * Evaluates the rating-conditioned quality curve on players that were not used
 * to build it. Target is Stockfish-derived move quality, never official
 * Chess.com Game Review performance rating.
 */
export function validateRatingReference(trainRows, holdoutRows, trainBands) {
  const baselineBySpeed = {};
  for (const speed of ['rapid', 'blitz']) {
    baselineBySpeed[speed] = median(trainRows
      .filter(row => row.game?.timeClass === speed && Number.isFinite(row.evidence?.quality))
      .map(row => row.evidence.quality));
  }

  const scored = holdoutRows.flatMap(row => {
    const speed = row.game?.timeClass;
    const quality = row.evidence?.quality;
    const rating = row.player?.rating;
    if (!['rapid', 'blitz'].includes(speed) || !Number.isFinite(quality) ||
        !Number.isFinite(rating) || !Number.isFinite(baselineBySpeed[speed])) return [];
    const predicted = interpolateExpectedQuality(trainBands[speed], rating);
    if (!Number.isFinite(predicted)) return [];
    return [{
      speed,
      playerName: row.player?.username,
      names: row.names ?? [],
      quality,
      modelError: predicted - quality,
      baselineError: baselineBySpeed[speed] - quality,
    }];
  });

  const byTimeClass = {};
  for (const speed of ['rapid', 'blitz']) {
    const rows = scored.filter(row => row.speed === speed);
    byTimeClass[speed] = {
      model: summarize(rows.map(row => row.modelError)),
      baseline: summarize(rows.map(row => row.baselineError)),
    };
  }
  const playerNames = rows => new Set(rows.flatMap(row => [
    row.player?.username,
    ...(row.names ?? []),
  ]).filter(name => typeof name === 'string' && name.trim()));
  return {
    trainingSides: trainRows.length,
    trainingPlayers: playerNames(trainRows).size,
    holdoutSides: scored.length,
    holdoutPlayers: playerNames(scored).size,
    overall: {
      model: summarize(scored.map(row => row.modelError)),
      baseline: summarize(scored.map(row => row.baselineError)),
    },
    byTimeClass,
  };
}

export function ratingReferenceAcceptance(validation, requirements = {}) {
  const limits = {
    minTrainingSides: requirements.minTrainingSides ?? 500,
    minTrainingPlayers: requirements.minTrainingPlayers ?? 100,
    minHoldoutSides: requirements.minHoldoutSides ?? 120,
    minHoldoutPlayers: requirements.minHoldoutPlayers ?? 60,
    minHoldoutPerTimeClass: requirements.minHoldoutPerTimeClass ?? 30,
    minMaeImprovement: requirements.minMaeImprovement ?? 0.25,
    maxClassRegression: requirements.maxClassRegression ?? 0.1,
  };
  const enoughData = validation.trainingSides >= limits.minTrainingSides &&
    validation.trainingPlayers >= limits.minTrainingPlayers &&
    validation.holdoutSides >= limits.minHoldoutSides &&
    validation.holdoutPlayers >= limits.minHoldoutPlayers &&
    ['rapid', 'blitz'].every(speed =>
      validation.byTimeClass[speed]?.model?.n >= limits.minHoldoutPerTimeClass &&
      Number.isFinite(validation.byTimeClass[speed]?.model?.mae) &&
      Number.isFinite(validation.byTimeClass[speed]?.baseline?.mae)
    );
  const overallImprovement = validation.overall.baseline.mae - validation.overall.model.mae;
  const improved = Number.isFinite(overallImprovement) &&
    overallImprovement >= limits.minMaeImprovement &&
    ['rapid', 'blitz'].every(speed =>
      validation.byTimeClass[speed].model.mae <=
        validation.byTimeClass[speed].baseline.mae + limits.maxClassRegression
    );
  return {
    accepted: enoughData && improved,
    enoughData,
    improved,
    overallMaeImprovement: Number.isFinite(overallImprovement)
      ? Number(overallImprovement.toFixed(3))
      : null,
    requirements: limits,
    reason: !enoughData
      ? 'Insufficient independent player-side observations for a safe rating-reference update.'
      : !improved
        ? 'The rating-conditioned quality curve did not beat the per-time-control baseline without material regression in either speed.'
        : 'The curve improves held-out quality prediction and meets both sample-size and per-speed safeguards.',
  };
}
