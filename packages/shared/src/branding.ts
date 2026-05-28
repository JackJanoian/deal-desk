/** Central DealDesk product branding constants. */

export const PRODUCT_NAME = "DealDesk";
export const PRODUCT_DISPLAY_NAME = "DealDesk";
export const CLI_NAME = "dealdesk";
export const TAGLINE = "AI-powered deal sourcing for private equity";

/** All-caps wordmark shown under the terminal ASCII banner. */
export const BANNER_WORDMARK = "DEALDESK";

/**
 * Unicode block-letter ASCII art for terminal banners (6 lines).
 * ANSI-shadow font; each letter is exactly 8 columns wide so every row has
 * the same length (66 chars: 4-letter DEAL + 2-space gap + 4-letter DESK).
 */
export const DEALDESK_ASCII_ART = [
  "██████╗ ███████╗ █████╗ ██╗       ██████╗ ███████╗███████╗██╗  ██╗",
  "██╔══██╗██╔════╝██╔══██╗██║       ██╔══██╗██╔════╝██╔════╝██║ ██╔╝",
  "██║  ██║█████╗  ███████║██║       ██║  ██║█████╗  ███████╗█████╔╝ ",
  "██║  ██║██╔══╝  ██╔══██║██║       ██║  ██║██╔══╝  ╚════██║██╔═██╗ ",
  "██████╔╝███████╗██║  ██║███████╗  ██████╔╝███████╗███████║██║  ██╗",
  "╚═════╝ ╚══════╝╚═╝  ╚═╝╚══════╝  ╚═════╝ ╚══════╝╚══════╝╚═╝  ╚═╝",
] as const;

export const LEGACY_HOME_DIR = ".dealdesk";
export const HOME_DIR = ".dealdesk";
