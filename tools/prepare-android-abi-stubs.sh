#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NDK_VERSION="27.2.12479018"
NDK_ROOT="${ANDROID_NDK_HOME:-${ANDROID_HOME:-}/ndk/$NDK_VERSION}"
CLANG="$NDK_ROOT/toolchains/llvm/prebuilt/linux-x86_64/bin/clang"
SOURCE="$ROOT/tools/abi-stub.c"
DEST_ROOT="$ROOT/android/app/src/main/jniLibs"

if [[ ! -x "$CLANG" ]]; then
  echo "Android NDK $NDK_VERSION clang not found: $CLANG" >&2
  exit 1
fi

if [[ ! -s "$SOURCE" ]]; then
  echo "ABI compatibility marker source is missing: $SOURCE" >&2
  exit 1
fi

build_stub() {
  local abi="$1"
  local target="$2"
  local destination="$DEST_ROOT/$abi/libmovebymove_abi_stub.so"

  mkdir -p "$(dirname "$destination")"
  "$CLANG" --target="$target" -shared -fPIC -nostdlib \
    -Wl,-soname,libmovebymove_abi_stub.so \
    "$SOURCE" -o "$destination"

  test -s "$destination"
  readelf -h "$destination" | grep -q 'Machine:'
  echo "Prepared Android ABI fallback marker:"
  file "$destination"
}

# The actual Stockfish executable is ARM64 only. These tiny shared libraries
# are installation markers, allowing 32-bit ARM and x86 devices to install the
# Java/WebView app and use the existing WASM engine instead.
build_stub "armeabi-v7a" "armv7a-linux-androideabi23"
build_stub "x86" "i686-linux-android23"
build_stub "x86_64" "x86_64-linux-android23"
