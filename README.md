<!-- Move by Move | GitHub README -->

<div align="center">
  <img src="dist/favicon.svg" width="88" height="88" alt="Move by Move logo">

  <h1>Move by Move</h1>
  <p><strong>See the game differently. Understand every move.</strong></p>
  <p>A free, browser-based chess analysis and review workspace powered by Stockfish 19.</p>

  <p>
    <a href="https://freechessanalysis.vercel.app/analysis">
      <img src="https://img.shields.io/badge/♟_OPEN_MOVE_BY_MOVE-779556?style=for-the-badge&labelColor=232620" alt="Open Move by Move">
    </a>
  </p>

  <p>
    <a href="https://github.com/felipinhobxd/FreeChessAnalysis/actions/workflows/browser-integration.yml">
      <img src="https://github.com/felipinhobxd/FreeChessAnalysis/actions/workflows/browser-integration.yml/badge.svg" alt="Browser integration tests">
    </a>
    <a href="https://github.com/official-stockfish/Stockfish">
      <img src="https://img.shields.io/badge/Engine-Stockfish_19-779556?style=flat-square" alt="Stockfish 19">
    </a>
    <img src="https://img.shields.io/badge/Languages-14-426b50?style=flat-square" alt="14 languages">
    <img src="https://img.shields.io/badge/Platform-Web-426b50?style=flat-square" alt="Web app">
  </p>
</div>

---

## ♟ What you can do

Import a game or explore a position. Review the decisions, find missed chances, compare variations and learn from the moments that changed the game.

| Analysis | Learning | Your workspace |
|:--|:--|:--|
| Stockfish 19 engine analysis | Move classifications and accuracy | Interactive analysis board |
| Missed tactical opportunities | Game performance estimates | PGN and FEN import/export |
| Evaluation graph and engine lines | Guided game review and puzzles | Local study archive and optional cloud sync |

## ⚙ Choose your engine

Select a profile when you first open the site, then change it any time in **Settings**.

| Engine | Best for | What to expect |
|:--|:--|:--|
| **Stockfish 19 Full** | Maximum analysis strength | Larger download and higher resource usage. Uses multiple threads when supported by the browser. |
| **Stockfish 19 Lite** | Everyday analysis | Recommended balance of strength, loading time and resource use. |
| **Stockfish 19 Lite Economy** | Lower-resource computers | Smaller hash and capped analysis depth to reduce memory use and search workload. |

All engines run locally in your browser. The Full build is approximately 95 MB; Lite and Economy use the compact Lite build.

## 🚀 Get started

**[Open the live website](https://freechessanalysis.vercel.app/analysis)**. No installation or account is needed.

### Run locally

Requires [Node.js 24](https://nodejs.org/).

```bash
git clone https://github.com/felipinhobxd/FreeChessAnalysis.git
cd FreeChessAnalysis
npm ci
npm run build
npm start
```

Then open **http://127.0.0.1:8787/analysis**.

## 🧪 Tests

Run the automated checks:

```bash
npm test
npm run test:e2e
```

The browser suite uses Playwright and Chromium. Install the browser first with `npx playwright install chromium`. GitHub Actions also tests the cloud-sync database migrations against PostgreSQL.

## 🔎 Method and transparency

Accuracy, move classifications and game-rating estimates are project metrics derived from engine evaluations. They are **not official Chess.com ratings** and do not reproduce Chess.com's proprietary CAPS2 formula.

See the [methodology and validation notes](https://freechessanalysis.vercel.app/methodology.html) for how estimates are produced and their current limitations.

## 📚 Project resources

- [Methodology and validation](https://freechessanalysis.vercel.app/methodology.html)
- [Accuracy calibration workflow](tools/CAPS2-CALIBRATION.md)
- [Missed-opportunity benchmark](tools/MISSED-OPPORTUNITIES-BENCHMARK.md)
- [Performance models and validation](tools/PERFORMANCE.md)
- [External services and rollout](tools/EXTERNAL-SERVICES.md)
- [Third-party credits and licenses](dist/notices.html)
- [Board sound credits](dist/sounds/sharechess/README.md)

---

<div align="center">
  <sub>Made for curious players who want to understand every move.</sub>
</div>
