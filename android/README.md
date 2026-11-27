# Move by Move for Android

This is a lightweight Android WebView shell for the production Move by Move website:

- https://freechessanalysis.vercel.app/analysis

## Where the analysis runs

Stockfish 19 is still executed locally on the Android device by the website's WebAssembly worker. The APK does not send chess positions to a remote engine. The Android WebView uses the device CPU, device storage, hardware-accelerated rendering and the website's existing engine settings.

Choose **Stockfish 19 Full** in the app for the strongest profile. The website enables multiple engine threads only when the WebView reports both `crossOriginIsolated` and `SharedArrayBuffer`. If that browser capability is unavailable, the engine falls back to one thread and the app displays a notice. Updating Android System WebView may improve compatibility.

The app needs an internet connection to load the website and download/verify the selected Stockfish build. It is not an offline copy of the website. Local studies and preferences are stored in the app's WebView data and are separate from Chrome's browser storage.

## Build

Requirements: JDK 17, Android SDK Platform 35, Android Build Tools 35.0.0 and Gradle 8.9.

From this directory:

```sh
gradle --no-daemon :app:assembleRelease
```

The APK is written to `app/build/outputs/apk/release/app-release.apk`.

## Versioning and releases

Update `version.txt` for each Android release using `MAJOR.MINOR.PATCH`. The Gradle build derives Android's version code from those three numbers. Merging Android changes into `main` runs the Android workflow, builds and verifies the APK, and publishes it to GitHub Releases.

The initial workflow uses the runner's debug signing key only to make the APK installable for direct testing. It is not a permanent release-signing identity. Before publishing future updates intended to install over an existing copy, configure a private, persistent Android release keystore in GitHub Actions secrets and switch the Gradle signing configuration to it. Never commit a release keystore or its password to this public repository.

This sideloaded APK is not a Google Play release.
