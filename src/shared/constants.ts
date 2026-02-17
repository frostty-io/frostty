// ---------------------------------------------------------------------------
// Polling Intervals (milliseconds)
// ---------------------------------------------------------------------------

/** How often to poll system stats (CPU/memory) in the TabBar */
export const SYSTEM_STATS_POLL_INTERVAL = 2000

/** How often to poll git status in the GitBar */
export const GIT_STATUS_POLL_INTERVAL = 3000

/** Fallback CWD poll interval (only used when OSC 7 is unavailable) */
export const CWD_POLL_INTERVAL = 10000

// ---------------------------------------------------------------------------
// Timeouts
// ---------------------------------------------------------------------------

/** Timeout for session save during quit flow */
export const SESSION_SAVE_TIMEOUT = 3000

/** Timeout for session save during reload flow */
export const SESSION_RELOAD_TIMEOUT = 3000

/** Timeout for fetching shell environment at startup */
export const SHELL_ENV_TIMEOUT = 5000

/** Delay before fetching initial CWD for a new tab (fallback) */
export const INITIAL_CWD_DELAY = 500

/** Delay before fitting terminal after mount */
export const TERMINAL_FIT_DELAY = 150

// ---------------------------------------------------------------------------
// Buffers & Limits
// ---------------------------------------------------------------------------

/** Maximum buffer size for git commands */
export const GIT_MAX_BUFFER = 1024 * 1024 * 10

/** Maximum scrollback lines for xterm */
export const TERMINAL_SCROLLBACK = 10000

/** Default terminal shell font size */
export const TERMINAL_FONT_SIZE_DEFAULT = 12

/** Minimum terminal shell font size */
export const TERMINAL_FONT_SIZE_MIN = 8

/** Maximum terminal shell font size */
export const TERMINAL_FONT_SIZE_MAX = 32

/** Terminal shell font size zoom step */
export const TERMINAL_FONT_SIZE_STEP = 1

/** Clamp a shell font size to the supported range */
export function clampShellFontSize(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return TERMINAL_FONT_SIZE_DEFAULT
  const rounded = Math.round(parsed)
  return Math.min(TERMINAL_FONT_SIZE_MAX, Math.max(TERMINAL_FONT_SIZE_MIN, rounded))
}

/** Maximum recent items to keep */
export const MAX_RECENT_ITEMS = 3

// ---------------------------------------------------------------------------
// Split Pane
// ---------------------------------------------------------------------------

/** Minimum width percentage for a split pane */
export const SPLIT_PANE_MIN_PCT = 20

/** Maximum width percentage for a split pane */
export const SPLIT_PANE_MAX_PCT = 80

/** Default split pane width percentage */
export const SPLIT_PANE_DEFAULT_PCT = 50

// ---------------------------------------------------------------------------
// DnD
// ---------------------------------------------------------------------------

/** Minimum drag distance in pixels to activate drag (distinguishes click from drag) */
export const DND_ACTIVATION_DISTANCE = 8

// ---------------------------------------------------------------------------
// AI Mode
// ---------------------------------------------------------------------------

/** Spinner frame interval for AI loading animation */
export const AI_SPINNER_INTERVAL = 80

/** How long to show AI error messages before auto-dismissing */
export const AI_ERROR_DISPLAY_DURATION = 2000

/** Spinner animation frames */
export const AI_SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
