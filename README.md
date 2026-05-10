# Local Stockfish Chess

Minimal one-board chess app for playing White against local Stockfish.

## What Is Included

- React/Vite shared board UI.
- `chess.js` legal move validation, including castling, en passant, check legality, and promotion.
- Electron macOS shell that launches Stockfish through UCI.
- Capacitor Android shell with a native Java bridge that launches the packaged Android Stockfish binary.
- Official Stockfish 18 binaries downloaded by `npm run update:stockfish`.
- Cburnett SVG chess piece icons downloaded by `npm run update:pieces`.

## Run On macOS

```sh
npm install
npm run update:stockfish
npm run electron:dev
```

Package a macOS app:

```sh
npm run electron:pack
```

The Electron shell checks the official Stockfish GitHub latest release at startup. If a newer compatible macOS binary is available, it downloads it into the app user-data directory and uses that before the bundled engine.

## Run On Android

Install a JDK and Android Studio/SDK first, then:

```sh
npm install
npm run update:stockfish
npm run cap:sync
npm run android:open
```

Android uses the Stockfish executable packaged in `jniLibs` and launched from `nativeLibraryDir`. Re-run `npm run update:stockfish` before building a new APK/AAB to refresh the packaged engine. Runtime replacement of the Android executable is intentionally avoided because modern Android restricts executing newly downloaded files from writable app storage.

## Engine Timing

The slider sends UCI `go movetime <ms>` to Stockfish. Stockfish uses iterative deepening and reaches the best depth the current CPU can cover within that time, so the app does not need a separate CPU benchmark. The app sets Stockfish `Threads` from `navigator.hardwareConcurrency` and uses a larger hash on higher-core machines.

## Sources And Licenses

- Stockfish official downloads: https://stockfishchess.org/download/
- Stockfish official GitHub releases: https://github.com/official-stockfish/Stockfish/releases/latest
- Stockfish is GPL licensed, so this app is marked `GPL-3.0-or-later`.
- Piece icons are the Cburnett chess set from Wikimedia Commons, licensed CC BY-SA 3.0. See `public/pieces/ATTRIBUTION.md`.
