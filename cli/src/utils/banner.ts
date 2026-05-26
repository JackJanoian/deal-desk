import { renderTerminalBannerHeader } from "@dealdesk/shared/terminal-banner";

export function printDealDeskCliBanner(): void {
  console.log(renderTerminalBannerHeader({ includeTagline: true }).join("\n"));
}
