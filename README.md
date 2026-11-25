# Move by Move

**Move by Move** is a browser-based chess analysis workspace powered by Stockfish 19. Import a game, explore engine variations, review critical decisions, and turn mistakes into interactive training positions.

[![Live demo](https://img.shields.io/badge/Live%20demo-Open%20Move%20by%20Move-78945b?style=for-the-badge)](https://freechessanalysis.vercel.app/analysis)
[![Stockfish](https://img.shields.io/badge/Engine-Stockfish%2019-779556)](https://github.com/official-stockfish/Stockfish)
[![Node.js](https://img.shields.io/badge/Node.js-24.x-3c873a?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Languages](https://img.shields.io/badge/Languages-14-426b50)](#internationalization)

## Try the live application

Open the [Move by Move live demo](https://freechessanalysis.vercel.app/analysis) to start analyzing in your browser. No account or installation is required.

The first-visit setup lets players choose one of 14 languages and save a Chess.com, Lichess, FIDE, or other chess profile. Chess.com and Lichess usernames are prefilled in the matching game-import source. Language changes are applied immediately.

## Product overview

Move by Move is designed for focused post-game analysis. The chess rules, board interaction, and Stockfish analysis run in the browser. Games can be imported, reviewed move by move, edited into side variations, and converted into training puzzles.

## Review methodology

**Move accuracy** uses Stockfish's expected-score change and a Chess.com-oriented exponential scoring curve. The current in-app parameters are explicitly marked provisional: CAPS2 is proprietary, and Chess.com publishes game-level accuracy but not a complete per-move CAPS2 label/evaluation dataset. The repository includes a reproducible collector, Stockfish analysis pipeline, player-disjoint fitter, and held-out error report so the curve can be fitted locally against a broad sample of reviewed Chess.com games. It never labels the provisional defaults as an official CAPS2 implementation.

**Game rating** uses the recorded PGN rating as a baseline for Chess.com Blitz and Rapid. It compares move quality against public games from the same rating and time control and discounts forced moves and already decided positions. Lichess games use a separate model and scale. The review shows the recorded rating, estimated game rating, and supporting range. **Move labels** follow the requested order: Brilliant, Excellent, Book/Theory, Best, Great, Good, Inaccuracy, Mistake, Missed Chance, and Blunder. "Missed Chance" is reserved for a concrete opportunity that was missed, such as a forced mate, a clearly winning capture, or a forcing attack. The labels are engine-backed heuristics, not a claim to reproduce Chess.com's private category model.

References: [Chess.com accuracy methodology](https://support.chess.com/en/articles/8708970-how-is-accuracy-in-analysis-determined), [Chess.com Game Rating explanation](https://support.chess.com/en/articles/10773754-how-is-game-rating-calculated-in-game-review), [Ginzoh's rating curves](https://github.com/Ginzoh/chess-review/blob/main/public/js/rating.js) and [accuracy calibration](https://github.com/Ginzoh/chess-review/blob/main/public/js/analysis.js), [Maia3 human-move model](https://github.com/CSSLab/maia3), [single-game Maia rating research](https://github.com/arasarkan/chess-rating-estimator), and [TxClaudes' public calibration method](https://github.com/TxClaudes/chess/blob/main/tools/calibrate.py).

### Core capabilities

| Area | Capabilities |
| --- | --- |
| Game import | Load PGN files or text, inspect FEN positions, and retrieve public games from Chess.com or Lichess by username. |
| Engine analysis | Stockfish 19 Lite by default, optional Full profile, configurable search depth, and multi-variation analysis. |
| Game review | Engine-backed move classifications, volatility-aware accuracy, key moments, and an opening/tactics/strategy/endgame breakdown. |
| Variations | Explore candidate lines, edit a continuation, and analyze the resulting position without replacing the original game line. |
| Training | Generate puzzles from inaccuracies, mistakes, blunders, and clearly identified missed opportunities. |
| Board interaction | Drag and drop, legal-move highlights, move navigation, board flipping, fullscreen mode, and colored arrow annotations. |
| Export and archive | Copy PGN or FEN, download PGN, create a shareable game link, and store games locally in the browser. |
| Personalization | Piece sets, engine settings, sound controls, animation speed, board coordinates, and 14 interface languages. |

## Study and storage

Paste a finished Chess.com game or public Lichess game URL using the Link input. A Chess.com player name can help the importer find the game in public monthly archives when game metadata is unavailable.

In the review, filter highlights to one side, replay the move and the engine response on the board, and practice alternatives with progressively available hints. Completed reviews, the last position, and puzzle attempts are saved in IndexedDB. Older archive items are still accessible.

The archive can optionally sync across devices with a private code. The Vercel app uses a Supabase publishable key. The migration in supabase/migrations provisions a locked table and an RPC restricted to records matching the supplied code's hash. Only explicit sync sends archive data. Each cloud archive supports up to 40 entries and about 1.6 MB.

## Getting started

### Requirements

- Node.js **24.x**.
- A modern browser with ES modules, WebAssembly, and Web Worker support.
- An internet connection for loading Stockfish and retrieving public games.

### Run locally

Clone the repository and enter the project directory:

~~~bash
git clone https://github.com/felipinhobxd/FreeChessAnalysis.git
cd FreeChessAnalysis
~~~

Start the local development server:

~~~bash
npm start
~~~

Open [http://127.0.0.1:8787/analysis](http://127.0.0.1:8787/analysis).

The project has no required npm dependencies to install. The static application is served directly from the **dist/** directory.

### Validate the project

~~~bash
npm run build
~~~

The validation command checks JavaScript syntax and runs the Node test suite. It does not bundle or regenerate the static files in **dist/**.

## Engine profiles

The application loads the chess engine on demand:

- **Lite** is the default profile and is intended for everyday analysis with a smaller download.
- **Full** is available in **Settings → Stockfish mode** for deeper analysis. It downloads approximately 95 MB on first use.

The application is configured with the cross-origin isolation headers needed for supported multithreaded Stockfish builds.

## Import and analysis workflow

1. Open **Import** and choose PGN, FEN, Chess.com, or Lichess.
2. Paste a game or position, upload a PGN file, or enter a public username.
3. Open **Lines** to inspect Stockfish evaluations and candidate continuations.
4. Run **Review** to classify moves and inspect turning points in the game.
5. Select any move in the history to inspect its evaluation and recommended continuation.
6. Open **Puzzles** to practice positions identified during the review.

### Board controls

| Input | Action |
| --- | --- |
| **Left / Right arrow** | Previous / next move |
| **Home / End** | First / last move |
| **Space** | Start or pause autoplay |
| **F** | Flip the board |
| **G** | Toggle fullscreen |
| **Right-click + drag** | Draw an arrow between squares |
| **Right-click** | Toggle a circle on a square |
| **Shift / Ctrl / Alt + right-click** | Blue / green / yellow arrow (red is the default) |
| **Left-click** | Clear board annotations |
| **Click or drag a piece** | Select and move a piece |

Keyboard shortcuts are disabled while focus is inside text fields, selects, and other interactive controls.

## Internationalization

The language selection screen is displayed before the analysis workspace on first visit. The selected language is saved locally and can be changed at any time from the navigation rail.

Available interface languages:

- English
- Brazilian Portuguese
- Spanish
- French
- German
- Italian
- Dutch
- Russian
- Simplified Chinese
- Japanese
- Korean
- Turkish
- Arabic
- Hindi

## Privacy and local data

- Board interaction, move validation, game review, and Stockfish analysis run in the browser.
- The application does not require an account, application backend, or database for its core features.
- Public game lookup communicates directly with Chess.com and Lichess APIs.
- Preferences, language selection, the optional chess profile, and locally archived games are stored in browser localStorage.
- The local archive keeps up to 50 games.
- Shareable links encode the selected game or position in the URL fragment. Share them only when you intend to make that game data available to the recipient.
- Stockfish assets are downloaded from external CDNs when needed.

## Project structure

~~~text
.
├── dist/
│   ├── index.html          # Application shell and language entry screen
│   ├── style.css           # Application styles
│   ├── app.js              # Application state and interaction flows
│   ├── i18n.js             # Language catalog and translation runtime
│   ├── board-ui.js         # Board icons, audio, and visual effects
│   ├── coach.js            # Move explanations and training logic
│   ├── engine.js           # Stockfish integration
│   ├── pieces/             # Piece sets and associated licenses
│   ├── sounds/sharechess/  # Curated CC0 board sound effects
│   └── notices.html        # Third-party credits and license notices
├── serve.mjs               # Local development server
├── package.json            # Project metadata and scripts
└── vercel.json             # Hosting configuration
~~~

## Audio credits

The board audio uses a curated subset of sound effects from [ShareChess](https://github.com/sharechess/sharechess), selected from its [official credits list](https://github.com/sharechess/sharechess/blob/main/public/CREDITS.md).

Every recording included in this project is identified as **CC0 1.0** in the upstream credits. Files with CC BY or CC BY-NC terms were excluded. Individual authors, source links, event mappings, and license details are documented in [the audio credits](dist/sounds/sharechess/README.md).

## Third-party components

- [Stockfish.js 19.0.1](https://github.com/nmrugg/stockfish.js): GNU GPLv3.
- [chess.js 1.4.0](https://github.com/jhlywa/chess.js): BSD 2-Clause.
- [Cburnett chess pieces](https://github.com/lichess-org/lila/tree/master/public/piece/cburnett): GPLv2 or later.
- [Chessnut pieces](https://github.com/LexLuengas/chessnut-pieces): Apache License 2.0.
- ShareChess audio recordings: individually licensed CC0 1.0, with attribution information retained in this repository.

See [Credits and Licenses](dist/notices.html) for more information.

---

<div align="center">
  <sub>Built for clearer analysis, better decisions, and stronger chess.</sub>
</div>


## Chess.com accuracy calibration

The runtime keeps a clearly marked provisional score curve until it has been fitted against a broad Chess.com sample. The repository includes a reproducible local collector, Stockfish analysis runner, and player-disjoint fitter. See [CAPS2 calibration workflow](tools/CAPS2-CALIBRATION.md). The fit is an approximation to Chess.com's published game-level accuracy, not a reverse-engineering of the proprietary CAPS2 formula.
