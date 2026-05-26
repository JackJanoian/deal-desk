import { useState } from "react";
import { ExternalLink, TriangleAlert } from "lucide-react";
import { CopyText } from "@/components/CopyText";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface GmailSetupWizardProps {
  redirectUri: string;
  redirectUriAlternates?: string[];
  onSave: (creds: { clientId: string; clientSecret: string }) => void;
  saving: boolean;
}

export function GmailSetupWizard(props: GmailSetupWizardProps) {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const redirectPort = getRedirectUriPort(props.redirectUri);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    props.onSave({ clientId: clientId.trim(), clientSecret: clientSecret.trim() });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="border-b pb-4">
          <CardTitle className="text-base">1. Create a Google Cloud project</CardTitle>
          <CardDescription>
            Enable Gmail send access and configure the OAuth consent screen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            <li>
              Open{" "}
              <a
                className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                href="https://console.cloud.google.com/"
                target="_blank"
                rel="noreferrer"
              >
                Google Cloud Console
                <ExternalLink className="size-3.5 shrink-0" aria-hidden />
              </a>{" "}
              and create or select a project.
            </li>
            <li>
              Enable the Gmail API: <span className="text-foreground">APIs &amp; Services → Library</span> →
              search &quot;Gmail API&quot; → Enable.
            </li>
            <li>
              Configure OAuth consent: user type <strong className="text-foreground">External</strong>,
              add scope{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
                https://www.googleapis.com/auth/gmail.send
              </code>
              , and add yourself as a test user.
            </li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b pb-4">
          <CardTitle className="text-base">2. Create the OAuth client</CardTitle>
          <CardDescription>
            Use a web application client and register the redirect URI below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            <li>
              <span className="text-foreground">APIs &amp; Services → Credentials → Create Credentials → OAuth client ID</span>.
            </li>
            <li>
              Application type: <strong className="text-foreground">Web application</strong>.
            </li>
            <li>
              Under <em>Authorized redirect URIs</em>, add every URI shown below (all must match exactly):
              <div className="mt-2 space-y-2">
                <RedirectUriBlock label="Primary" uri={props.redirectUri} />
                {props.redirectUriAlternates?.map((uri) => (
                  <RedirectUriBlock key={uri} label="Also add" uri={uri} />
                ))}
              </div>
              {(props.redirectUriAlternates?.length ?? 0) > 0 && (
                <p className="mt-2 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
                  <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  <span>
                    Google treats <code className="font-mono">localhost</code> and{" "}
                    <code className="font-mono">127.0.0.1</code> as different hosts, and
                    the port must match too
                    {redirectPort ? (
                      <>
                        {" "}
                        (currently <code className="font-mono">{redirectPort}</code>)
                      </>
                    ) : null}
                    . Add every URI shown here to avoid{" "}
                    <strong>redirect_uri_mismatch</strong> errors.
                  </span>
                </p>
              )}
            </li>
            <li>Save and copy the Client ID and Client Secret into the form below.</li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b pb-4">
          <CardTitle className="text-base">3. Paste your credentials</CardTitle>
          <CardDescription>
            These credentials are stored per company and used only for Gmail OAuth.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="gmail-client-id">Client ID</Label>
              <Input
                id="gmail-client-id"
                type="text"
                className="font-mono text-sm"
                placeholder="123456789-xxx.apps.googleusercontent.com"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                required
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gmail-client-secret">Client Secret</Label>
              <Input
                id="gmail-client-secret"
                type="password"
                className="font-mono text-sm"
                placeholder="GOCSPX-..."
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                required
                autoComplete="off"
              />
            </div>
            <Button type="submit" disabled={props.saving}>
              {props.saving ? "Saving…" : "Save credentials"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function RedirectUriBlock({ label, uri }: { label: string; uri: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/50 p-3">
      <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
      <CopyText
        text={uri}
        className="block w-full break-all text-left font-mono text-xs text-foreground"
        ariaLabel={`Copy ${label.toLowerCase()} redirect URI`}
        title="Click to copy redirect URI"
      />
    </div>
  );
}

export function GmailOAuthRedirectHelp({
  redirectUri,
  redirectUriAlternates,
}: {
  redirectUri: string;
  redirectUriAlternates?: string[];
}) {
  if (!redirectUri) return null;
  const redirectPort = getRedirectUriPort(redirectUri);

  return (
    <details className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm">
      <summary className="cursor-pointer font-medium text-foreground">
        OAuth redirect URI (for Google Cloud Console)
      </summary>
      <div className="mt-3 space-y-2">
        <p className="text-xs text-muted-foreground">
          If Google shows <strong>redirect_uri_mismatch</strong>, add every URI below to
          your OAuth client&apos;s Authorized redirect URIs. The port must match exactly
          {redirectPort ? (
            <>
              {" "}
              (this instance is using <code className="font-mono">{redirectPort}</code>)
            </>
          ) : null}
          .
        </p>
        <RedirectUriBlock label="Primary" uri={redirectUri} />
        {redirectUriAlternates?.map((uri) => (
          <RedirectUriBlock key={uri} label="Also add" uri={uri} />
        ))}
      </div>
    </details>
  );
}

function getRedirectUriPort(uri: string): string | null {
  try {
    const url = new URL(uri);
    if (url.port) return url.port;
    return url.protocol === "https:" ? "443" : url.protocol === "http:" ? "80" : null;
  } catch {
    return null;
  }
}
