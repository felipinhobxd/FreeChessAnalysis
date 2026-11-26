<div align="center">
  <img src="dist/favicon.svg" width="76" alt="Move by Move">
  <h1>Move by Move</h1>
  <p><strong>Free chess analysis. Understand every move.</strong></p>
  <p><a href="https://freechessanalysis.vercel.app/analysis"><strong>♟ Open the live website</strong></a></p>
  <p>
    <a href="https://github.com/felipinhobxd/FreeChessAnalysis/actions/workflows/browser-integration.yml"><img src="https://github.com/felipinhobxd/FreeChessAnalysis/actions/workflows/browser-integration.yml/badge.svg" alt="Automated tests"></a>
    <a href="https://github.com/official-stockfish/Stockfish"><img src="https://img.shields.io/badge/Engine-Stockfish%2019-779556" alt="Stockfish 19"></a>
    <img src="https://img.shields.io/badge/Languages-14-426b50" alt="14 languages">
  </p>
</div>

---

## About

**Move by Move** is a free, browser-based chess analysis and game review tool. Import a game, explore engine lines, discover critical moments, and learn from your decisions.

## Features

- **Stockfish 19 analysis:** Lite engine by default, with an optional Full profile.
- **Game review:** move classifications, accuracy, and key moments.
- **Missed opportunities:** highlights tactical chances and advantages that slipped away.
- **Performance estimates:** game-level rating estimates for each player.
- **Interactive board:** explore variations, annotate positions, and test alternatives.
- **Game import and export:** PGN, FEN, Chess.com, and Lichess.
- **Study archive:** save games locally, with optional cloud sync.
- **Personalization:** multiple piece sets, settings, and 14 interface languages.

## Get started

Visit **[freechessanalysis.vercel.app/analysis](https://freechessanalysis.vercel.app/analysis)**. No installation or account is required to use the live website.

## Run locally

Requires [Node.js 24](https://nodejs.org/).

```bash
git clone https://github.com/felipinhobxd/FreeChessAnalysis.git
cd FreeChessAnalysis
npm ci
npm run build
npm start
```

Open [http://127.0.0.1:8787/analysis](http://127.0.0.1:8787/analysis).

The build copies `chess.js` into `dist/vendor`, checks syntax, and runs the Node tests. To run the browser suite locally, install its Chromium build with `npx playwright install chromium` and run `npm run test:e2e`. On Linux, `npx playwright install --with-deps chromium` also installs the system libraries. GitHub Actions verifies Chromium and runs the cloud-sync migrations against an isolated PostgreSQL 17 database.

## Local data and cloud sync

Preferences and the optional player profile are stored in the browser's local storage. The study library uses IndexedDB for games, completed reviews, and puzzle progress. Cloud sync sends an archive to Supabase when you explicitly sync with a code. Keep that code private to retain control of access to the synced archive.

## About the estimates

Move classifications, accuracy scores, and game-rating estimates are engine-based project metrics. They are **not official Chess.com ratings or an implementation of its proprietary CAPS2 formula**. Read the [methodology and validation notes](https://freechessanalysis.vercel.app/methodology.html) for details and limitations.

## Documentation and credits

- [Methodology and validation](https://freechessanalysis.vercel.app/methodology.html)
- [Accuracy calibration workflow](tools/CAPS2-CALIBRATION.md)
- [Missed-opportunity benchmark](tools/MISSED-OPPORTUNITIES-BENCHMARK.md)
- [Performance models and validation](tools/PERFORMANCE.md)
- [External service availability and rollout](tools/EXTERNAL-SERVICES.md)
- [Third-party credits and licenses](dist/notices.html)
- [Board sound credits and sources](dist/sounds/sharechess/README.md)

---

<div align="center">
  <sub>Built to help you understand the game, one move at a time.</sub>
</div>
