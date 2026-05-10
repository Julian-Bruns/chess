# Chessfish

Chessfish is a one-board chess app for playing White against local Stockfish.

## What Is Included

- React/Vite shared board UI.
- `chess.js` legal move validation, including castling, en passant, check legality, and promotion.
- Electron macOS app that launches Stockfish through UCI.
- Capacitor Android app with a native Java bridge that launches the packaged Android Stockfish binary.
- Chess launcher icon and visible app name for macOS, Android, and the web shell.
- One-press in-app update button for the app package and Stockfish.
- Official Stockfish 18 binaries downloaded by `npm run update:stockfish`.
- Cburnett SVG chess piece icons downloaded by `npm run update:pieces`.
- A scheduled GitHub Actions workflow that refreshes Stockfish and uploads app artifacts every day.

## Install As Applications

Install dependencies once:

```sh
npm install
```

### macOS DMG

Build the packaged macOS app:

```sh
npm run update:stockfish
npm run electron:pack
```

Open `release/*.dmg`, drag Chessfish into Applications, then launch it like a normal macOS app. Local builds are unsigned, so macOS may require right-clicking the app and choosing Open the first time.

### Android APK

Install a JDK and Android Studio/SDK first, then build an installable debug APK:

```sh
npm run update:stockfish
npm run android:debug
```

Install `android/app/build/outputs/apk/debug/app-debug.apk` on your Android device. On the phone, allow installation from the app you use to open the APK if Android asks.

For a Play Store or long-term distribution build, create a signing key and signing config in Android Studio, then run:

```sh
npm run android:release:aab
```

That writes a release bundle under `android/app/build/outputs/bundle/release/`. Release APK/AAB signing keys are intentionally not committed to the repository.

### GitHub Daily Build Downloads

The workflow in `.github/workflows/daily-app-build.yml` is scheduled daily around 04:17 UTC and can also be started manually from GitHub Actions.

To download builds from GitHub:

1. Open the repository on GitHub.
2. Go to Actions.
3. Open the latest Daily app builds run.
4. Download `chessfish-macos-release-assets` for macOS or `chessfish-android-release-assets` for Android from Artifacts. If Android signing secrets are not configured, download `chessfish-android-debug-apk` for manual testing only.

In a private repository, only people with repository access can run the workflow or download those artifacts.

## Run For Development

Run the macOS Electron shell:

```sh
npm run update:stockfish
npm run electron:dev
```

Open the Android project:

```sh
npm run update:stockfish
npm run android:open
```

## Automatic Updates

Press the download button in the app toolbar to update everything available for the current platform.

On macOS, Chessfish checks the official Stockfish GitHub latest release and refreshes the local engine if needed. It also checks this repository's mutable `latest` GitHub release, downloads the newest macOS DMG into `~/Downloads/Chessfish Updates`, and opens it. Finish the installer window to replace the app.

On Android, Stockfish is packaged inside the APK because modern Android restricts executing newly downloaded files from writable app storage. Pressing the update button downloads the newest signed Android APK from the `latest` GitHub release and opens Android's installer. Android may still ask for install permission or final confirmation; that is enforced by the OS.

The daily workflow publishes macOS and signed Android assets to the `latest` release. For Android one-press updates to work across daily builds, configure these repository secrets so every APK uses the same release key:

- `CHESSFISH_ANDROID_KEYSTORE_BASE64`
- `CHESSFISH_ANDROID_KEYSTORE_PASSWORD`
- `CHESSFISH_ANDROID_KEY_ALIAS`
- `CHESSFISH_ANDROID_KEY_PASSWORD`

Without those secrets, the workflow still builds a debug APK artifact, but it is not published as an in-app update because debug signing keys are not stable for real updates.

You do not need to make the GitHub repository public for scheduled GitHub Actions. A private repo works if Actions are enabled and the account has enough Actions minutes/storage. However, installed apps cannot download private GitHub release assets unless the user authenticates or a token is embedded, which this app intentionally does not do. For one-press in-app updates, publish the `latest` release assets publicly or host them at a public update URL.

## Engine Timing

The slider sends UCI `go movetime <ms>` to Stockfish. Stockfish uses iterative deepening and reaches the best depth the current CPU can cover within that time, so the app does not need a separate CPU benchmark. The app sets Stockfish `Threads` from `navigator.hardwareConcurrency` and uses a larger hash on higher-core machines.

## Sources And Licenses

- Stockfish official downloads: https://stockfishchess.org/download/
- Stockfish official GitHub releases: https://github.com/official-stockfish/Stockfish/releases/latest
- Stockfish is GPL licensed, so this app is marked `GPL-3.0-or-later`.
- Piece icons and the app icon are based on the Cburnett chess set from Wikimedia Commons, licensed CC BY-SA 3.0. See `public/pieces/ATTRIBUTION.md`.
