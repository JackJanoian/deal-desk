import type { Request, Response } from "express";
import { z } from "zod";
import type { GmailClientConfig } from "../gmail/client-config.js";
import { localGmailOAuthRedirectUriAlternates } from "../gmail/redirect-uri.js";

export interface GmailClientConfigDeps {
  loadConfig(args: { companyId: string }): Promise<GmailClientConfig | null>;
  saveConfig(args: { companyId: string; clientId: string; clientSecret: string }): Promise<void>;
  deleteConfig(args: { companyId: string }): Promise<void>;
  resolveRedirectUri(req: Request): string;
}

export function gmailClientConfigGetHandler(deps: GmailClientConfigDeps) {
  return async (req: Request, res: Response) => {
    const companyId = req.params.companyId as string;
    const existing = await deps.loadConfig({ companyId });
    const redirectUri = deps.resolveRedirectUri(req);
    const redirectUriAlternates = localGmailOAuthRedirectUriAlternates(redirectUri);
    res.status(200).json({
      configured: existing !== null,
      redirectUri,
      ...(redirectUriAlternates.length > 0 ? { redirectUriAlternates } : {}),
    });
  };
}

const postBodySchema = z.object({
  clientId: z.string().min(10),
  clientSecret: z.string().min(10),
});

export function gmailClientConfigPostHandler(deps: GmailClientConfigDeps) {
  return async (req: Request, res: Response) => {
    const parsed = postBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, reason: "Invalid input", details: parsed.error.flatten() });
      return;
    }
    const companyId = req.params.companyId as string;
    await deps.saveConfig({
      companyId,
      clientId: parsed.data.clientId,
      clientSecret: parsed.data.clientSecret,
    });
    res.status(200).json({ ok: true });
  };
}

export function gmailClientConfigDeleteHandler(deps: GmailClientConfigDeps) {
  return async (req: Request, res: Response) => {
    const companyId = req.params.companyId as string;
    await deps.deleteConfig({ companyId });
    res.status(200).json({ ok: true });
  };
}
