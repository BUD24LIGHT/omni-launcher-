# Repository Guidelines

## Project Structure & Module Organization
This repository is an Electron desktop app. `main.js` owns startup, window lifecycle, and IPC wiring. `preload.js` is the only renderer bridge and exposes `window.omniAPI`. Frontend files live in `src/` (`index.html`, `renderer.js`, `styles.css`). Main-process support code lives in `src/main/`, with feature services in `src/main/services/` for ADB, filesystem, automation, and settings. Prefer adding new behavior in a focused service module instead of growing `main.js`.

## Build, Test, and Development Commands
- `npm install`: install Electron and local dependencies.
- `npm start`: launch the app locally.
- `npm run dev`: local development entry point; currently the same as `npm start`.

There is no packaging or lint script yet. If you add one, wire it into `package.json` and update this guide in the same change.

## Coding Style & Naming Conventions
Match the existing code style: CommonJS modules, 2-space indentation, double quotes, and semicolons. Use `camelCase` for functions and variables, `PascalCase` for classes like `SettingsService`, and kebab-case for service filenames such as `automation-service.js`. Keep renderer code DOM-focused; filesystem, process, and shell access belong in the main process behind IPC.

## Testing Guidelines
No automated test suite is configured yet. Until one exists, every change should be manually verified with `npm start`. Cover the flows you touched, especially:
- window controls and navigation
- file explorer actions
- settings persistence
- automation and ADB-related actions

If you add automated tests, use `*.test.js`, keep them in `tests/` or next to the module they cover, and add an `npm test` script in the same PR.

## Commit & Pull Request Guidelines
Use short, imperative commit subjects such as `Add automation task cancellation` or `Harden settings validation`. Keep pull requests focused and easy to review. PR descriptions should explain what changed, note any risk areas, include manual verification steps, and attach screenshots for UI changes.

## Security & Configuration Tips
Preserve Electron security defaults already in place: `contextIsolation`, `sandbox`, and the preload bridge pattern. Do not expose raw Node APIs directly to renderer code. Persist local settings through `SettingsService`, and never commit machine-specific paths, credentials, or tool secrets.

## Do / Don't
Do keep privileged operations in the main process and expose narrow IPC methods through `preload.js`.
Do add new long-running or OS-facing behavior as a service in `src/main/services/`.
Do keep renderer changes focused on presentation, DOM state, and invoking `window.omniAPI`.

Don't call Node, shell, or filesystem APIs directly from renderer code.
Don't expand `window.omniAPI` with broad pass-through methods when a task-specific IPC handler will do.
Don't mix unrelated features into `main.js`; extract them once IPC setup starts getting noisy.
