import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  interpolateExpectedQuality,
  validateRatingReference,
  ratingReferenceAcceptance,
} from '../tools/rating-reference-validation.mjs';

function row(speed, rating, quality, name) {
  return {
    game: { timeClass: speed },
    player: { rating, username: name },
    names: [name, name + '-opponent'],
    evidence: { quality },
  };
}

function reliableFixture() {
  const train = [];
  const holdout = [];
  const bands = { rapid: [], blitz: [] };
  for (const speed of ['rapid', 'blitz']) {
    bands[speed] = [[1000, 51, 2], [2000, 71, 2]];
    for (let index = 0; index < 130; index++) {
      const rating = index % 2 ? 2000 : 1000;
      const quality = rating === 2000 ? 71 : 51;
      train.push(row(speed, rating, quality + (index % 3 - 1) * 0.2,
        speed + '-train-' + index));
    }
    for (let index = 0; index < 60; index++) {
      const rating = index % 2 ? 2000 : 1000;
      const quality = rating === 2000 ? 71 : 51;
      holdout.push(row(speed, rating, quality + (index % 3 - 1) * 0.2,
        speed + '-holdout-' + index));
    }
  }
  return { train, holdout, bands };
}

test('quality interpolation clamps outside the sample and interpolates inside it', () => {
  const bands = [[2000, 70, 8], [1000, 50, 10], [3000, 80, 6]];
  assert.equal(interpolateExpectedQuality(bands, 500), 50);
  assert.equal(interpolateExpectedQuality(bands, 1500), 60);
  assert.equal(interpolateExpectedQuality(bands, 4000), 80);
  assert.equal(interpolateExpectedQuality([], 1500), null);
});

test('rating-reference validation scores held-out quality against a time-control baseline', () => {
  const fixture = reliableFixture();
  const report = validateRatingReference(fixture.train, fixture.holdout, fixture.bands);
  assert.equal(report.holdoutSides, 120);
  assert.equal(report.byTimeClass.rapid.model.n, 60);
  assert.equal(report.byTimeClass.blitz.model.n, 60);
  assert.ok(report.overall.model.mae < report.overall.baseline.mae);
});

test('rating-reference publishing requires enough independent players and both speeds', () => {
  const fixture = reliableFixture();
  const report = validateRatingReference(fixture.train, fixture.holdout, fixture.bands);
  const acceptance = ratingReferenceAcceptance(report, {
    minTrainingSides: 100,
    minTrainingPlayers: 50,
    minHoldoutSides: 100,
    minHoldoutPlayers: 50,
    minHoldoutPerTimeClass: 30,
  });
  assert.equal(acceptance.accepted, true);
  assert.equal(ratingReferenceAcceptance(report).accepted, false);
});

test('rating-reference publishing rejects curves that fail to beat the baseline', () => {
  const train = [];
  const holdout = [];
  const bands = { rapid: [[1000, 50], [2000, 50]], blitz: [[1000, 50], [2000, 50]] };
  for (const speed of ['rapid', 'blitz']) {
    for (let index = 0; index < 300; index++) {
      train.push(row(speed, 1000 + index % 2 * 1000, 60, speed + '-train-' + index));
    }
    for (let index = 0; index < 60; index++) {
      holdout.push(row(speed, 1000 + index % 2 * 1000, 60, speed + '-holdout-' + index));
    }
  }
  const report = validateRatingReference(train, holdout, bands);
  assert.equal(ratingReferenceAcceptance(report).improved, false);
  assert.equal(ratingReferenceAcceptance(report).accepted, false);
});
