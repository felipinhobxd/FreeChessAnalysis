# Community dataset validation and trust boundaries

The public ingestion endpoint performs server-side structural and chess-legality checks before writing an opted-in sample to the private dataset.

## What the server validates

- The full mainline UCI sequence contains 8 to 500 plies and can be replayed legally from the standard start position or the supplied, validated FEN.
- The supplied game hash matches the canonical result, start position, engine metadata, and complete UCI sequence.
- The packed per-ply record has valid score flags, classification IDs, accuracy values, and best-move encodings.
- Every encoded best move is legal in the position before the recorded played move.
- Per-side move totals and counts for blunders, mistakes, inaccuracies, and lost chances match the per-ply classification records.
- Consecutive position evaluations remain consistent. The previous ply's post-move score must match the next ply's pre-move score, with a small centipawn tolerance for non-mate scores.
- Checkmate, stalemate, and insufficient-material endings cannot be paired with a contradictory game result.

## What this does not prove

The browser is an untrusted client. A legal move sequence and internally consistent metadata do **not** prove that Stockfish actually ran, that the reported centipawn scores or classifications are truthful, or that player ratings and source metadata came from the original platform.

PGN ratings remain marked `pgn_unverified`. Engine-derived estimates, accuracy values, classifications, and score records are also client-submitted values. The current endpoint validates their shape and consistency, but does not independently recompute them.

Do not treat these rows as authenticated engine ground truth or use them as trusted labels for model training. Stronger verification requires independent server-side engine analysis (or another trusted attestation mechanism) and a separate verified status before a sample is used as ground truth.
