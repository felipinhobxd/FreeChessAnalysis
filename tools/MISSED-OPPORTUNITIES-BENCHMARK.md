# Missed-opportunity detector benchmark

This small regression benchmark checks the current detector against a curated fixture set. It is **not** a large-scale or engine-authored gold-standard dataset: score/PV evidence in the fixtures is manually specified. The numbers are regression indicators only, not accuracy claims.

## Run
`node tools/benchmark-missed-opportunities.mjs`

## Scope
- Positive cases: mate, faster mate, queen attack, durable material gain.
- Negative cases: recapture invalidates the gain, near-equivalent MultiPV, insufficient depth.
- Reports TP/FN/FP, precision and recall, and each fixture result.
- Exact expected labels are checked on positives. Negative cases must abstain.

## Limitations / next dataset expansion
The fixture corpus is small and biased toward patterns already covered by the detector. It does not yet cover broad tactical motif diversity (forks, pins, deflection, discovered attacks other than the queen, promotion, quiet moves, defensive resources, zugzwang, complex multi-move tactics), and synthetic score/PV evidence does not substitute for independently engine-verified positions. Do not use the current metrics as a claim of detector quality. Add fixtures only after independently verifying their best moves, alternatives, depths, and expected outcomes.
