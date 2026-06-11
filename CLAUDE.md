# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Vite dev server + Electron main/preload hot reload (via `vite-plugin-electron`). DevTools auto-open.
- `npm run build` — `tsc && vite build && electron-builder`. Produces a packaged installer under `release/`.
- `npm run lint` — ESLint over `.ts`/`.tsx`. Zero warnings allowed (`--max-warnings 0`).
- No test runner is configured.

## Architecture

BalloonWall is an Electron + React + TypeScript app (Vite-bundled) that renders a transparent, frameless 1920×1080 overlay window for stream donation visuals. It also doubles as a local server so OBS can consume the same rendering via Browser Source.

### Process topology (`electron/main.ts`)

The main process does three concurrent jobs beyond window management:

1. **WebSocket server** (default port 3005) — accepts external donation events. Raw string protocol: `Type/Nickname/Amount` where `Type ∈ {Normal, Ad, Challenge, Battle}` (defaults to `Normal` if only `Nickname/Amount` is sent). Parsed messages are forwarded to the renderer via `ipcMain → win.webContents.send('new-donation', …)`. JSON messages with a `type` field are ignored (reserved for state broadcasts back out).
2. **HTTP server** (default port 3006) — serves the built renderer (or proxies to the Vite dev server in dev) so OBS Browser Source can load the same UI at `http://localhost:<httpPort>`.
3. **State sync bridge** — the renderer debounces `state-sync` IPCs (50ms) with the full Zustand state. Main caches it in `currentState` and broadcasts `{type:'state-update', payload}` to every connected WS client. New WS clients immediately receive a `full-state` snapshot on connect. This is how OBS instances stay mirrored with the control window.

Settings persist via `electron-store` (`Settings` interface). Changing `wsPort`/`httpPort` through `set-settings` restarts the respective server. Auto-updates use `electron-updater` against the GitHub releases of `dinoosaur726/BalloonWall`.

### Renderer state (`src/store.ts`)

A single Zustand store holds `cards`, `stacks`, `settings`, `history`. Key invariants:

- **Cards never exist free** — every card is owned by exactly one stack. A single-card stack is the "loose card" representation.
- **Stack geometry** is computed from `CARD_WIDTH_REM`, `STEP_REM`, `BASE_HEIGHT_REM` (in `src/constants.ts`) × `REM` × `stack.scale`. When cards are added/removed, `y` is shifted by `STEP_REM * REM * scale` so the visual bottom of the stack stays anchored.
- **Vertical collision resolution** (`resolveVerticalCollisions`) runs after any stack grows: horizontally-overlapping stacks above the source are pushed upward so they don't visually overlap. BFS with a 1000-iteration cap.
- **`addCard` stacking rule** — a new card merges into an existing stack only if `amount` AND `type` match the stack's top card and the resulting stack top would not go above y=50. Otherwise a new stack is spawned at a random position.
- **`handleDonation`** is the single entry point for incoming donations; it records history unconditionally, then honors per-type `autoAdd*` + `minAmount*` gates before calling `addCard`.

### Balloon image resolution (`src/utils/BalloonGenerator.ts`)

Amount → image lookup is layered (highest priority first):
1. User `customBalloons` (per-type `useForNormal/Ad/Challenge/Battle` flags).
2. Streamer-signature balloons — when `streamerId` + `signatureBalloons` (space-separated amounts) are set, the amount is matched against that list and a remote asset is fetched.
3. Tier presets: `default / bronze / silver / gold` from `STANDARD_RANGES` in `store.ts`.

`refreshCardImages` re-runs the resolver over all existing cards and is auto-invoked from `setSettings` whenever `streamerId`, `signatureBalloons`, or `customBalloons` change.

#### Image crop / fit pipeline

External SOOP assets are bottom-cropped to remove the balloon string (top is cut off), then stretched onto a `480 × 285` (16:9.5) canvas that matches the card display size. Crops preserve the image's **native width** — only the height is reduced — so differently-sized source images all produce the same final aspect ratio.

| Source | Crop (bottom-aligned, native width preserved) | Final |
|---|---|---|
| Signature (`story_m/<streamerId>_<amount>.png`) | height → `163` | stretched to `480 × 285` |
| Standard (`m_balloon_<amount>.png`) | height → `174` | stretched to `480 × 285` |
| Ad (`adballoon/ceremony/mobile_<amount>.png`) | height → `174` (treated as external) | stretched to `480 × 285` |
| Local templates (`normaltemplate*.png`) + ad fallback | `293 × 162` (after amount text is drawn) | stretched to `480 × 285` |
| User custom balloons | no crop | stretched to `480 × 285` |
| Challenge/Battle (mission) | local/custom no crop; signature height → `163` | stretched to `480 × 285` |

The crop only runs when the source image's height exceeds the target crop height; otherwise the image passes through untouched. Earlier versions gated the crop on an exact `293 × 248` dimension match, which caused higher-tier SOOP balloons (e.g. `m_balloon_5000.png`) to skip cropping entirely — that guard has been removed.

Amount text is drawn only on local (non-external, non-ad) balloons *before* the crop: 50px `NanumGothicExtraBold`, centered at `(balloonWidth/2, 120)`, 8px white stroke + `#ff2f00` fill. External assets ship with their own amount text baked in, so the renderer never overlays text on them.


### Electron ↔ renderer bridge

- `isElectron()` (`src/utils/env.ts`) gates Electron-only code paths so the same bundle works when loaded over HTTP in OBS.
- In Electron: the store subscribes to its own updates and pushes `state-sync` IPCs.
- In OBS (HTTP): the app connects to `ws://localhost:<wsPort>` itself and applies `full-state` / `state-update` messages to mirror the control window — do not break this by sending renderer-originated messages without a `type` field (the main server treats plain strings as donations).

## Conventions worth knowing

- Port changes take effect immediately (servers restart inside `set-settings`); no app relaunch.
- Special nickname `NULL12345` is remapped in `handleDonation` to a type-specific label (`미션성공` / `대결미션정산`) for mission-type donations.
- The main window is transparent + frameless + non-resizable by design — don't add window-chrome features without coordinating with the overlay use case.
- Versioning is surfaced in-app via `PatchNotesModal`; `settings.lastSeenPatchNotes` gates the popup, so bumping `package.json` version alone is enough to trigger the modal if patch notes are keyed to it.
