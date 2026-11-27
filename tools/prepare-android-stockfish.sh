#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ASSET_URL="https://github.com/official-stockfish/Stockfish/releases/download/sf_19/stockfish-android-arm64-universal.tar.gz"
ASSET_SHA256="ebb24051aa4a222b4daaf049b882ecf1163d370c128fe02316602643f4d5e426"
DESTINATION="$ROOT/android/app/src/main/jniLibs/arm64-v8a/libstockfish.so"
TEMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TEMP_DIR"' EXIT

ARCHIVE="$TEMP_DIR/stockfish-android-arm64-universal.tar.gz"
echo "Downloading the official Stockfish 19 ARM64 universal Android build..."
curl --fail --location --retry 3 --retry-delay 2 "$ASSET_URL" --output "$ARCHIVE"

echo "$ASSET_SHA256  $ARCHIVE" | sha256sum --check -
tar -xzf "$ARCHIVE" -C "$TEMP_DIR"

STOCKFISH_BINARY=""
while IFS= read -r -d '' candidate; do
  description="$(file -b "$candidate")"
  if [[ "$description" == *"ELF 64-bit"* && "$description" == *"ARM aarch64"* ]]; then
    STOCKFISH_BINARY="$candidate"
    break
  fi
done < <(find "$TEMP_DIR" -type f -print0)

if [[ -z "$STOCKFISH_BINARY" ]]; then
  echo "The verified Stockfish archive did not contain an ARM64 ELF executable." >&2
  exit 1
fi

readelf -h "$STOCKFISH_BINARY" | grep -q 'Machine:.*AArch64'
mkdir -p "$(dirname "$DESTINATION")"
install -m 0755 "$STOCKFISH_BINARY" "$DESTINATION"
test -x "$DESTINATION"

echo "Prepared native Stockfish:"
file "$DESTINATION"
sha256sum "$DESTINATION"
