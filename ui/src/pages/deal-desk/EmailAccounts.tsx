// DEAL DESK: Task 12 — Email Accounts page (connect / disconnect Gmail).
import { useEffect, useState } from "react";
import { useCompany } from "../../context/CompanyContext";
import { GmailSetupWizard } from "./GmailSetupWizard";

export interface EmailAccount {
  id: string;
  emailAddress: string;
  provider: "gmail";
  revokedAt: string | null;
}

export interface ClientConfigStatus {
  configured: boolean;
  redirectUri: string;
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

export function EmailAccounts(props: EmailAccountsProps) {
  const active = props.accounts.filter((a) => !a.revokedAt);

  if (!props.clientConfigStatus.configured) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-2">Email Accounts</h1>
        <p className="text-sm text-gray-600 mb-6">
          To use the Outreach Analyst, this company needs its own Google OAuth client.
          Follow the 3 steps below.
        </p>
        <GmailSetupWizard
          redirectUri={props.clientConfigStatus.redirectUri}
          onSave={props.onSaveClientConfig}
          saving={props.savingClientConfig}
        />
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Email Accounts</h1>
      <div className="mb-4 text-xs text-gray-500">
        Google OAuth client connected.{" "}
        <button
          type="button"
          className="underline text-red-600"
          onClick={props.onResetClientConfig}
        >
          Reset
        </button>
      </div>
      <p className="text-sm text-gray-600 mb-4">
        Connect a Gmail account so the Outreach Analyst can send messages on your behalf.
        Each send still requires your approval.
      </p>
      <a
        href={`/api/oauth/gmail/start?companyId=${encodeURIComponent(props.companyId)}`}
        className="inline-block px-4 py-2 bg-blue-600 text-white rounded"
        onClick={props.onConnect}
      >
        Connect Gmail
      </a>
      <ul className="mt-6 divide-y">
        {active.map((a) => (
          <li key={a.id} className="py-3 flex items-center justify-between">
            <span>{a.emailAddress}</span>
            <button
              type="button"
              className="text-sm text-red-600"
              onClick={() => props.onDisconnect(a.id)}
            >
              Disconnect
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function EmailAccountsPage() {
  const { selectedCompanyId: companyId } = useCompany();
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [clientConfigStatus, setClientConfigStatus] = useState<ClientConfigStatus>({
    configured: false,
    redirectUri: "",
  });
  const [savingClientConfig, setSavingClientConfig] = useState(false);

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
