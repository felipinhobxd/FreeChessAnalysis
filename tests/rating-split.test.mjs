import { test } from 'node:test';
import assert from 'node:assert/strict';
import { playerSplit, splitGamesByPlayer } from '../tools/rating-split.mjs';

function usernameFor(partition, prefix) {
  for (let index = 0; index < 10000; index++) {
    const name = prefix + index;
    if (playerSplit(name) === partition) return name;
  }
  throw new Error('Could not find deterministic ' + partition + ' fixture name');
}

test('rating holdout is deterministic and case-insensitive', () => {
  assert.equal(playerSplit('PlayerOne'), playerSplit('playerone'));
  assert.equal(playerSplit(''), null);
  assert.throws(() => playerSplit('player', 0), RangeError);
});

test('rating validation keeps every player entirely on one side of the split', () => {
  const trainA = usernameFor('train', 'trainA');
  const trainB = usernameFor('train', 'trainB');
  const holdoutA = usernameFor('holdout', 'holdoutA');
  const holdoutB = usernameFor('holdout', 'holdoutB');
  const games = [
    { id: 'train-game', white: { username: trainA }, black: { username: trainB } },
    { id: 'holdout-game', white: { username: holdoutA }, black: { username: holdoutB } },
    { id: 'cross-game', white: { username: trainA }, black: { username: holdoutA } },
  ];
  const split = splitGamesByPlayer(games);
  assert.deepEqual(split.train.map(game => game.id), ['train-game']);
  assert.deepEqual(split.holdout.map(game => game.id), ['holdout-game']);
  assert.deepEqual(split.excluded.map(game => game.id), ['cross-game']);

  const trainingPlayers = new Set(split.train.flatMap(game => [game.white.username, game.black.username]));
  const holdoutPlayers = new Set(split.holdout.flatMap(game => [game.white.username, game.black.username]));
  assert.equal([...trainingPlayers].some(name => holdoutPlayers.has(name)), false);
});
