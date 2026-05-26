// DEAL DESK: Task 12 — Email Accounts page (connect / disconnect Gmail).
import { useEffect, useState } from "react";
import { CheckCircle2, Inbox, Mail, Plus, Unplug } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useBreadcrumbs } from "../../context/BreadcrumbContext";
import { useCompany } from "../../context/CompanyContext";
import { GmailSetupWizard, GmailOAuthRedirectHelp } from "./GmailSetupWizard";
import ApolloSetupSection from "./ApolloSetupSection";

export interface EmailAccount {
  id: string;
  emailAddress: string;
  provider: "gmail";
  revokedAt: string | null;
}

export interface ClientConfigStatus {
  configured: boolean;
  redirectUri: string;
  redirectUriAlternates?: string[];
}

export interface EmailAccountsProps {
  companyId: string;
  accounts: EmailAccount[];
  onConnect: () => void;
  onDisconnect: (id: string) => void;
  clientConfigStatus: ClientConfigStatus;
  onSaveClientConfig: (creds: { clientId: string; clientSecret: string }) => void;
  savingClientConfig: boolean;
  onResetClientConfig: () => void;
}

function PageIntro() {
  return (
    <div className="space-y-1">
      <h1 className="text-2xl font-semibold tracking-tight">Email Accounts</h1>
      <p className="max-w-2xl text-sm text-muted-foreground">
        Connect Gmail for outreach and Apollo for contact enrichment. Each outbound
        message still requires your approval before send.
      </p>
    </div>
  );
}

export function EmailAccounts(props: EmailAccountsProps) {
  const active = props.accounts.filter((a) => !a.revokedAt);

  if (!props.clientConfigStatus.configured) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <PageIntro />
        <Card className="max-w-3xl">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="size-4 text-muted-foreground" aria-hidden />
              Set up Google OAuth
            </CardTitle>
            <CardDescription>
              The Outreach Analyst needs a company-owned Google OAuth client before
              you can connect Gmail. Follow the three steps below.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <GmailSetupWizard
              redirectUri={props.clientConfigStatus.redirectUri}
              redirectUriAlternates={props.clientConfigStatus.redirectUriAlternates}
              onSave={props.onSaveClientConfig}
              saving={props.savingClientConfig}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageIntro />

      <div className="grid max-w-3xl gap-6">
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="size-4 text-muted-foreground" aria-hidden />
              Gmail for Outreach
            </CardTitle>
            <CardDescription>
              Connect a Gmail inbox so the Outreach Analyst can draft and queue
              messages on your behalf.
            </CardDescription>
            <CardAction>
              <Badge variant="secondary" className="gap-1">
                <CheckCircle2 className="size-3" aria-hidden />
                OAuth configured
              </Badge>
            </CardAction>
          </CardHeader>

          <CardContent className="space-y-4">
            {active.length === 0 ? (
              <div className="flex flex-col items-center rounded-lg border border-dashed border-border bg-muted/20 px-6 py-10 text-center">
                <div className="mb-3 rounded-full bg-muted p-3">
                  <Inbox className="size-6 text-muted-foreground/70" aria-hidden />
                </div>
                <p className="text-sm font-medium">No Gmail accounts connected</p>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Connect an inbox to let the Outreach Analyst send approved messages
                  from your address.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {active.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                        <Mail className="size-4 text-muted-foreground" aria-hidden />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{a.emailAddress}</p>
                        <p className="text-xs text-muted-foreground">Gmail · Connected</p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0 text-destructive hover:text-destructive"
                      onClick={() => props.onDisconnect(a.id)}
                    >
                      <Unplug className="size-3.5" aria-hidden />
                      Disconnect
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button asChild onClick={props.onConnect}>
                <a
                  href={`/api/oauth/gmail/start?companyId=${encodeURIComponent(props.companyId)}`}
                >
                  <Plus aria-hidden />
                  Connect Gmail
                </a>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive"
                onClick={props.onResetClientConfig}
              >
                Reset OAuth client
              </Button>
            </div>

            <GmailOAuthRedirectHelp
              redirectUri={props.clientConfigStatus.redirectUri}
              redirectUriAlternates={props.clientConfigStatus.redirectUriAlternates}
            />
          </CardContent>
        </Card>

        <ApolloSetupSection companyId={props.companyId} />
      </div>
    </div>
  );
}

export function EmailAccountsPage() {
  const { selectedCompanyId: companyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [clientConfigStatus, setClientConfigStatus] = useState<ClientConfigStatus>({
    configured: false,
    redirectUri: "",
  });
  const [savingClientConfig, setSavingClientConfig] = useState(false);

  useEffect(() => {
    setBreadcrumbs([{ label: "Deal Sourcing" }, { label: "Email Accounts" }]);
  }, [setBreadcrumbs]);

  const refreshClientConfig = () => {
    if (!companyId) return;
    fetch(`/api/companies/${companyId}/deal-desk/tools/gmail-oauth-client`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then(setClientConfigStatus);
  };

  const refreshAccounts = () => {
    if (!companyId) return;
    fetch(`/api/companies/${companyId}/deal-desk/tools/email-accounts`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((j) => setAccounts(j.accounts ?? []));
  };

  useEffect(() => {
    refreshClientConfig();
    refreshAccounts();
  }, [companyId]);

  const onSaveClientConfig = async (creds: { clientId: string; clientSecret: string }) => {
    if (!companyId) return;
    setSavingClientConfig(true);
    try {
      await fetch(`/api/companies/${companyId}/deal-desk/tools/gmail-oauth-client`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(creds),
      });
      refreshClientConfig();
    } finally {
      setSavingClientConfig(false);
    }
  };

  const onResetClientConfig = async () => {
    if (!companyId) return;
    if (
      !window.confirm(
        "Reset Gmail OAuth client credentials for this company? You'll need to re-enter them.",
      )
    ) {
      return;
    }
    await fetch(`/api/companies/${companyId}/deal-desk/tools/gmail-oauth-client`, {
      method: "DELETE",
      credentials: "include",
    });
    refreshClientConfig();
  };

  const onDisconnect = async (id: string) => {
    if (!companyId) return;
    await fetch(`/api/companies/${companyId}/deal-desk/tools/email-accounts/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    setAccounts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, revokedAt: new Date().toISOString() } : a)),
    );
  };

  if (!companyId) return null;

  return (
    <EmailAccounts
      companyId={companyId}
      accounts={accounts}
      onConnect={() => {}}
      onDisconnect={onDisconnect}
      clientConfigStatus={clientConfigStatus}
      onSaveClientConfig={onSaveClientConfig}
      savingClientConfig={savingClientConfig}
      onResetClientConfig={onResetClientConfig}
    />
  );
}
