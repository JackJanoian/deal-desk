import { BANNER_WORDMARK, DEALDESK_ASCII_ART, TAGLINE } from "./branding.js";

const ESC = "\x1b";

/** Dark-blue terminal palette for DealDesk banners (256-color ANSI). */
export const terminalBannerTheme = {
  reset: `${ESC}[0m`,
  bold: `${ESC}[1m`,
  dim: `${ESC}[2m`,
  navy: `${ESC}[38;5;17m`,
  blueDark: `${ESC}[38;5;18m`,
  blue: `${ESC}[38;5;24m`,
  blueAccent: `${ESC}[38;5;33m`,
  blueBright: `${ESC}[38;5;39m`,
  slate: `${ESC}[38;5;59m`,
  slateDim: `${ESC}[38;5;238m`,
  white: `${ESC}[97m`,
  green: `${ESC}[32m`,
  yellow: `${ESC}[33m`,
  magenta: `${ESC}[35m`,
  cyan: `${ESC}[36m`,
} as const;

export type TerminalBannerStyle = keyof typeof terminalBannerTheme;

/** Single blue color used across the entire terminal banner. */
export const BANNER_COLOR: TerminalBannerStyle = "blue";

export function tb(text: string, ...styles: TerminalBannerStyle[]): string {
  const prefix = styles.map((style) => terminalBannerTheme[style]).join("");
  return `${prefix}${text}${terminalBannerTheme.reset}`;
}

function banner(text: string, bold = false): string {
  return bold ? tb(text, "bold", BANNER_COLOR) : tb(text, BANNER_COLOR);
}

function bannerArtWidth(): number {
  return Math.max(...DEALDESK_ASCII_ART.map((line) => line.length));
}

export type TerminalBannerHeaderOptions = {
  includeTagline?: boolean;
};

/** Renders the framed DealDesk logo block for CLI and server startup output. */
export function renderTerminalBannerHeader(
  options: TerminalBannerHeaderOptions = {},
): string[] {
  const includeTagline = options.includeTagline ?? true;
  const artWidth = bannerArtWidth();
  const innerWidth = artWidth + 2;
  const rule = "─".repeat(innerWidth);

  const frameLine = (content: string) => banner(`  ${content}`);
  const innerLine = (content: string, bold = false) =>
    banner("  │ ", false) + banner(content.padEnd(artWidth), bold) + banner(" │");

  const lines: string[] = [
    "",
    frameLine(`╭${rule}╮`),
  ];

  for (const artLine of DEALDESK_ASCII_ART) {
    lines.push(innerLine(artLine));
  }

  lines.push(frameLine(`├${rule}┤`));
  lines.push(innerLine(BANNER_WORDMARK, true));

  if (includeTagline) {
    const tagline =
      TAGLINE.length > artWidth ? `${TAGLINE.slice(0, artWidth - 1)}…` : TAGLINE;
    lines.push(innerLine(tagline));
  }

  lines.push(frameLine(`╰${rule}╯`));
  return lines;
}

/** Divider between banner sections. */
export function renderTerminalBannerDivider(width = 64): string {
  return banner(`  ${"━".repeat(width)}`);
}

/** Label/value row in the banner color. */
export function renderTerminalBannerRow(label: string, value: string): string {
  return `${banner(label.padEnd(16))} ${banner(value)}`;
}
