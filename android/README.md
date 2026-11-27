# Move by Move for Android

The Android app wraps the production Move by Move website:

- https://freechessanalysis.vercel.app/analysis

## Analysis engines

The **Full** profile prefers the official Stockfish 19 ARM64 universal Android executable on compatible devices:

- Android 10 (API 29) or newer
- 64-bit ARM (\`arm64-v8a\`)
- The verified native executable must be present in the APK's extracted native-library directory

The native engine uses the phone's CPU directly, supports multiple UCI threads, and receives an adaptive Hash size based on the device's reported memory. It is packaged as \`libstockfish.so\` and executed from Android's read-only native library directory. The app does not copy an executable into its writable files directory, which would be blocked by Android's app-data execution policy on modern Android versions.

On older Android versions, 32-bit devices, and browsers, the app falls back to the existing SHA-256-verified Stockfish 19 WebAssembly engine. **Lite** and **Economy** remain WebAssembly profiles. The site continues to use WebAssembly and has no dependency on Android code.

Stockfish 19 native ARM64 universal binary provenance:

- Official release: https://github.com/official-stockfish/Stockfish/releases/tag/sf_19
- Corresponding source: https://github.com/official-stockfish/Stockfish/tree/sf_19
- Download: \`stockfish-android-arm64-universal.tar.gz\`
- SHA-256: \`ebb24051aa4a222b4daaf049b882ecf1163d370c128fe02316602643f4d5e426\`

The binary is not modified. The build script verifies the upstream archive digest and checks the extracted ELF architecture before packaging it.

An internet connection is still required to load the website and download the WebAssembly fallback. The native executable itself is bundled in the APK. Local studies and preferences live in the app's WebView storage and are separate from Chrome's browser storage.

## Build

Requirements: JDK 17, Android SDK Platform 35, Android Build Tools 35.0.0 and Gradle 8.9.

Prepare the verified native engine, then build:

\`\`\`sh
bash tools/prepare-android-stockfish.sh
cd android
gradle --no-daemon :app:assembleRelease
\`\`\`

The APK is written to \`app/build/outputs/apk/release/app-release.apk\`.

## Versioning and releases

Update \`version.txt\` for each Android release using \`MAJOR.MINOR.PATCH\`. The Gradle build derives Android's version code from those three numbers. Merging Android changes into \`main\` runs the Android workflow, verifies the pinned Stockfish archive, builds and verifies the APK, and publishes it to GitHub Releases.

The current workflow still uses the GitHub runner's temporary debug signing key. This is only suitable for direct sideload testing and does not provide a stable update-signing identity. Before a future release can update an installed app in place, configure a private, persistent Android release keystore in GitHub Actions secrets and switch the Gradle signing configuration to it. Never commit a release keystore or its password to this public repository.

Stockfish is free software distributed under GPLv3. The corresponding upstream source is linked above; see \`THIRD_PARTY_NOTICES.md\` for third-party attribution.

This sideloaded APK is not a Google Play release.
