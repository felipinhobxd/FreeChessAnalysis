# CAPS2-oriented calibration workflow

The Move by Move review cannot reproduce the private Chess.com CAPS2 implementation exactly. Chess.com publishes a game-level accuracy value in the Published Data API for games whose review has been generated, but it does not publish a complete official per-move score/label dataset. This workflow therefore trains a transparent approximation against the published game-level target.

## What the pipeline does

1. **Collect** rated standard Chess.com Blitz/Rapid games with both players' published accuracy values and public PGNs. Games dated before 2023-01-01 are excluded to avoid mixing the previous accuracy regime. Collection is sequential, cached, resumable, and backs off on HTTP 429/5xx responses.
2. **Analyze** every position in each PGN with Stockfish 19 at a fixed depth. The cache records the engine score before and after every move, move color, and whether the move was forced. One thread is used for reproducibility.
3. **Fit** the win-probability slope, per-move decay, offset, aggregation method, and forced-move policy. The optimizer fits on training players only.
4. **Validate** against an untouched player-disjoint holdout. A game is included only when both players belong to the same split. This excludes cross-split games, guarantees that no player appears in both sets, and prevents the same game from leaking across train/test. The report includes MAE, RMSE, median absolute error, signed bias, ±1/±2/±5-point coverage, and Blitz/Rapid breakdowns.
5. **Publish** a new dist/caps2-model.js only if the holdout improves over the provisional baseline by at least 0.3 accuracy points and the minimum training/holdout sample requirements are met. Otherwise the provisional production model is retained.

## Run on Windows

Install the local research dependency once:

~~~powershell
npm install
~~~

Install Stockfish 19 locally and point the environment variable at its executable. Use the full Stockfish 19 build, with one thread:

~~~powershell
$env:STOCKFISH_PATH = "C:\Tools\Stockfish\stockfish-windows-x86-64-avx2.exe"
~~~

Collect a broad sample. The default command aims for 5,000 reviewed games and samples public player accounts across multiple Chess.com country directories and leaderboards:

~~~powershell
npm run calibration:collect
~~~

You can also set your own seed accounts, one username per line:

~~~powershell
node tools/calibrate-caps2.mjs collect --seed-file .\calibration-users.txt --games 5000 --players 1500 --months 3
~~~

Analyze the collected games with the same major engine version as the application. The default review depth is 14:

~~~powershell
npm run calibration:analyze
~~~

The analysis is cached after every ten games, so the command can be restarted. Increase depth only when you intend to recalibrate the production app at that same depth.

Fit and validate:

~~~powershell
npm run calibration:fit
~~~

The tool writes the report to dist/caps2-calibration-report.json. If the independent holdout does not improve enough, the existing provisional model stays active. Review the report before committing the updated dist/caps2-model.js and dist/caps2-calibration-report.json.

## Data and interpretation limits

- The Chess.com API supplies a single accuracy number for each side of a reviewed game, not official accuracy for each move. The engine-derived move scores are training features, not ground-truth Chess.com move labels.
- Game Review availability creates selection bias: the public API does not include an accuracy field for every game.
- Chess.com accuracy is a game-level percentage, so the fit optimizes agreement at the game level. Per-move categories remain separate heuristics.
- Blitz and Rapid are kept separate in the rating reference. Bullet is not estimated from one game.
- The split deliberately excludes games where the two players land in different partitions. This reduces sample size but ensures player identities and game records do not cross the train/holdout boundary.
- Use at least 1,000 training player-sides, 200 holdout player-sides, and 100 holdout players. Larger and more diverse samples are strongly preferred.
- The reported holdout metrics are the quality test. Training error alone must never be presented as evidence of accuracy.
- CAPS2 is proprietary. Even a good fit should be described as "Chess.com-calibrated approximation", never as the official CAPS2 formula.

## Public references

- [Chess.com Published Data API](https://www.chess.com/news/view/published-data-api)
- [Chess.com accuracy methodology](https://support.chess.com/en/articles/8708970-how-is-accuracy-in-analysis-determined)
- [TxClaudes calibration approach](https://github.com/TxClaudes/chess/blob/main/tools/calibrate.py)
- [Ginzoh Chess.com rating curves and 16k-game study](https://github.com/Ginzoh/chess-review/blob/main/public/js/rating.js)
