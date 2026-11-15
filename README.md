# Classic Doom Touch

Classic Doom Touch brings the classic Doom engine to web browsers and Android using DoomGeneric. It includes Freedoom Phase 1, plus mobile touch controls, an always-visible minimap, adjustable browser resolution, and local Doom-family IWAD import.

**[Play Classic Doom Touch in your browser](https://nitinvyasr.github.io/Classic-Doom-Touch/)** on a computer, phone, or tablet.

## Play

On a computer, use **WASD** to move, move the **mouse** to aim, and **left click** to fire. Click the game during play to capture the cursor for continuous turning, and press **Esc** to release it. Use **Space** to jump, **right click** or **E** to interact, **Tab** for the map, **]** to cycle weapons, and **arrow keys + Enter** in Doom's menus. The game switches between desktop and touch controls as you use them.

Install `Classic_Doom_Touch.apk` on Android 7.0 or later with an up-to-date Android System WebView. Choose **Play Freedoom**, or choose **Open Doom WAD** and select your own `DOOM.WAD`, `DOOM2.WAD`, or compatible base-game IWAD. Choose **New Game** in the classic game menu.

| Control | Action |
| --- | --- |
| Left joystick | Move forward/back or strafe. Push to the edge to run. |
| Right-side drag | Turn horizontally with increased, screen-width-normalized sensitivity. |
| FIRE | Shoot. Hold to keep firing. |
| USE | Open doors and operate switches. |
| JUMP | Jump from the ground in the current browser build. |
| SWAP | Cycle owned weapons. |
| Minimap | Shows explored walls and your heading throughout a level. Tap for the full automap. |
| MENU | Open or close Doom's menu. |
| OK and joystick | Confirm and navigate menu options. |

Doom's menu can save and load a game. On touch, select an empty slot and tap **OK** again to accept the default save name. Save slots are separate for each IWAD. Reopen the same WAD to continue an imported game. The port supports single-player and in-game sound effects. The current build has no soundtrack playback.

The display supports native output and edge-aware scaling for smoother diagonal edges. The classic engine renders at 320 × 200 internally.

## Build and test

On Debian 13, install `clang-19`, `lld-19`, `wasi-libc`, `libclang-rt-19-dev-wasm32`, `aapt`, `android-framework-res`, `zipalign`, `libsmali-java`, `apksigner`, and a Java runtime with `keytool`. Run from the repository root:

```sh
./scripts/fetch-freedoom.sh
./engine/build.sh
./android/build.sh
```

The APK is written to `out/Classic_Doom_Touch.apk`. The packaging script verifies its signature and ZIP alignment. It generates a local test key on first use. Keep the same key for updates. Set `SIGNING_KEY`, `KEYSTORE_PASS`, and `KEY_ALIAS` to use a different key.

```sh
node tests/engine.mjs
npm install --no-save playwright
CHROMIUM_BIN=/usr/bin/chromium-headless-shell node tests/smoke.cjs
```

The tests also accept a path to the assets extracted from the APK. The engine test accepts an optional second argument pointing to a Freedoom Phase 2 WAD to exercise Doom II-format maps.

## Third-party code and game data

- [DoomGeneric](https://github.com/ozkl/doomgeneric/tree/e257a09527062bfb986b6e5e0780839b6cbd5b71) is based on id Software's Doom and Chocolate Doom. The engine source and Android/browser integration are distributed under GPL-2.0-or-later. See [the GPL](licenses/LICENSE) and the [original engine readme](licenses/README.TXT).
- [Freedoom Phase 1](https://freedoom.github.io/) 0.13.0 was sourced from Debian. See [Freedoom copyright and license](licenses/FREEDOOM.txt). Commercial Doom IWADs are supplied by the player.
- [browser_wasi_shim](https://github.com/bjorn3/browser_wasi_shim) 0.4.2 is dual licensed [MIT](licenses/LICENSE-MIT) or [Apache-2.0](licenses/LICENSE-APACHE).

## License and credits

Classic Doom Touch is open source under [GPL-2.0-or-later](LICENSE). The bundled third-party components and game data retain their respective licenses listed above.

- Original Doom engine by id Software. DoomGeneric and Chocolate Doom contributors made the portable engine possible.
- Game data by the Freedoom contributors.
- Android packaging, touch controls, minimap, display scaling, and automated tests implemented with OpenAI Codex.

## Play in a browser

To run locally, use `./scripts/fetch-freedoom.sh` once to fetch and verify Freedoom. Then run `python3 -m http.server 8000 --bind 127.0.0.1 --directory assets` from the project root and open [localhost:8000](http://localhost:8000/).

The **Resolution** control is available on the launch screen and during play. **Auto** fits the browser and accounts for display pixel density. The four fixed choices set the canvas output from 320 × 200 to 1280 × 800. The classic engine renders at 320 × 200 internally and the browser scales its output. The selected setting is remembered on the same browser origin.

For GitHub Pages, push the project to a GitHub repository, choose **Settings → Pages → Build and deployment → Source → GitHub Actions**, then run **Deploy browser game** from the Actions tab. The workflow publishes the static browser files and license notices.
