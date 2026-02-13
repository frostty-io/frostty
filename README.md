<h1 align="center">
    <img src="./resources/doggo.png" alt="Logo" width="128">
    <br>Doggo
</h1>
<br />
<p align="center">
  Cross-platform, feature-rich terminal emulator with a modern UI.
  <br />
  <a href="#about">About</a>
  ·
  <a href="#features">Features</a>
  ·
  <a href="#keyboard-shortcuts">Shortcuts</a>
  ·
  <a href="#developing">Developing</a>
  ·
  <a href="#releases">Releases</a>
  ·
  <a href="#roadmap">Roadmap</a>
</p>

## About

Doggo is a GPU-accelerated terminal emulator. It provides a vertical tab layout, split panes, deep git integration and AI-powered command generation.

The goal is a terminal that feels like a modern development tool rather than a legacy utility. Profiles, a command palette, and editor integration (VS Code, Cursor) keep common workflows a keystroke away.

## Features

Doggo ships with a broad set of features out of the box:

| Category | Details |
| :--- | :--- |
| Tabs | Vertical tab bar, drag-and-drop reordering, tab restoration, per-profile colors |
| Split Panes | Horizontal splits, resizable dividers, drag-to-split, pane navigation |
| Command Palette | Fuzzy-searchable palette for all commands and actions |
| Project Palette | Quick-switch between git repositories with recent project history |
| Git Integration | Branch info, ahead/behind counts, staged/unstaged/untracked files, branch switching, fetch, pull |
| AI Mode | Natural language to shell commands via OpenRouter (configurable model) |
| Profiles | Multiple profiles with per-profile shell, working directory, and tab color |
| Session Persistence | Restores tabs, scrollback, splits, and active state on relaunch |
| Editor Integration | Open current directory in VS Code or Cursor |
| Rendering | GPU-accelerated via WebGL, 10,000-line scrollback buffer |
| System Stats | Live CPU and memory usage in the tab bar |

## Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| Cmd/Ctrl + T | New tab |
| Cmd/Ctrl + W | Close tab or pane |
| Cmd/Ctrl + L | Clear tab or pane |
| Cmd/Ctrl + Shift + W | Close window |
| Cmd/Ctrl + Shift + N | New window |
| Cmd/Ctrl + Shift + T | Restore closed tab |
| Cmd/Ctrl + D | Split / unsplit pane |
| Cmd/Ctrl + Up/Down | Navigate panes or tabs |
| Cmd/Ctrl + 1-9 | Switch to tab by index |
| Cmd/Ctrl + Shift + P | Command palette |
| Cmd/Ctrl + P | Project palette |
| Cmd/Ctrl + K | AI command mode |
| Cmd/Ctrl + , | Settings |
| Cmd/Ctrl + Shift + V | Open in VS Code |
| Cmd/Ctrl + Shift + C | Open in Cursor |

## Developing

### Prerequisites

- Node.js 20+
- pnpm 10+

### Quick Start

```bash
pnpm install
pnpm run dev
```

### Building

```bash
# Current platform
pnpm run package

# Specific platforms
pnpm run package:mac
pnpm run package:win
pnpm run package:linux
```

Built artifacts are written to `dist/`.

### Testing & Linting

```bash
pnpm test              # run all tests
pnpm run test:watch    # watch mode
pnpm run test:ui       # UI tests
pnpm run test:main     # main process tests
pnpm run lint          # lint
pnpm run format        # format
```

### Updating App Icons

```bash
pnpm run build-icons
```

Run this only when `resources/doggo.png` changes. Generated icons in `build/` are committed.

## Releases

- Stable releases are created by release-please and use tags like `v1.2.3`.
- Version bumps follow Conventional Commits in PR titles or squash commit messages:
  - `fix:` -> patch
  - `feat:` -> minor
  - `feat!:` or `BREAKING CHANGE:` -> major
- Canary prereleases are created from `main` with tags like `canary-YYYYMMDD-HHMM-<shortsha>`.
- Canary artifacts are currently macOS-only.
- Canary builds do not modify `package.json` version.
- Stable and canary macOS artifacts are code-signed in CI using Apple Developer credentials.
- Stable `v*` releases are notarized by default.
- Canary notarization is optional via manual dispatch input `enable_notarization` (default: off).
- Required GitHub secrets for signing: `APPLE_SIGNING_CERT`, `APPLE_SIGNING_CERT_PASSWORD`, `APPLE_SIGNING_IDENTITY`.
- Required GitHub secrets for notarization: `APPLE_NOTARY_APPLE_ID`, `APPLE_NOTARY_APP_PASSWORD`, `APPLE_NOTARY_TEAM_ID`.
- Build metadata (commit SHA and build date) is logged at startup and shown in About panel credits.

## Roadmap

The high-level plan for the project, roughly in priority order:

|  #  | Feature | Status |
| :-: | :--- | :---: |
| 1 | Multi-window support | Planned |
| 2 | Theming support | Planned |
| 3 | Font ligatures ([xterm-addon-ligatures](https://github.com/xtermjs/xterm.js/tree/master/addons/addon-ligatures)) | Planned |
| 4 | Hotkey remapping settings | Planned |
| 5 | Kitty graphics protocol | Blocked ([xtermjs#5592](https://github.com/xtermjs/xterm.js/issues/5592)) |

## License

MIT
