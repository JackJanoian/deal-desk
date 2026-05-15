import { useState } from "react";

export interface GmailSetupWizardProps {
  redirectUri: string;
  onSave: (creds: { clientId: string; clientSecret: string }) => void;
  saving: boolean;
}

export function GmailSetupWizard(props: GmailSetupWizardProps) {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    props.onSave({ clientId: clientId.trim(), clientSecret: clientSecret.trim() });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <section>
        <h2 className="text-lg font-semibold mb-2">1. Create a Google Cloud project</h2>
        <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700">
          <li>
            Open{" "}
            <a
              className="text-blue-600 underline"
              href="https://console.cloud.google.com/"
              target="_blank"
              rel="noreferrer"
            >
              console.cloud.google.com
            </a>{" "}
            and create a new project (or pick an existing one).
          </li>
          <li>
            Enable the Gmail API: <em>APIs &amp; Services → Library</em> → search "Gmail API" →
            Enable.
          </li>
          <li>
            Configure the OAuth consent screen: User type <strong>External</strong>, add scope{" "}
            <code className="px-1 bg-gray-100 rounded">
              https://www.googleapis.com/auth/gmail.send
            </code>
            , add yourself as a test user.
          </li>
        </ol>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">2. Create the OAuth client</h2>
        <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700">
          <li>
            <em>APIs &amp; Services → Credentials → Create Credentials → OAuth client ID</em>.
          </li>
          <li>
            Application type: <strong>Web application</strong>.
          </li>
          <li>
            Under <em>Authorized redirect URIs</em>, paste this exact value:
            <div className="mt-2 p-3 bg-gray-100 rounded font-mono text-xs break-all">
              {props.redirectUri}
            </div>
          </li>
          <li>Save and copy the Client ID and Client Secret into the form below.</li>
        </ol>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">3. Paste your credentials</h2>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label htmlFor="gmail-client-id" className="block text-sm font-medium mb-1">
              Client ID
            </label>
            <input
              id="gmail-client-id"
              type="text"
              className="w-full border rounded px-3 py-2 font-mono text-sm"
              placeholder="123456789-xxx.apps.googleusercontent.com"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="gmail-client-secret" className="block text-sm font-medium mb-1">
              Client Secret
            </label>
            <input
              id="gmail-client-secret"
              type="password"
              className="w-full border rounded px-3 py-2 font-mono text-sm"
              placeholder="GOCSPX-..."
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            disabled={props.saving}
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
          >
            {props.saving ? "Saving…" : "Save credentials"}
          </button>
        </form>
      </section>
    </div>
  );
}
