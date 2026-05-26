# Gmail OAuth Setup for Outreach Analyst

The Outreach Analyst role sends email through the connected user's Gmail account.
Each company configures its own Google Cloud OAuth client on the **Email Accounts**
page (`/deal-desk/email-accounts`).

## Steps

1. Go to https://console.cloud.google.com/ and create a new project (or pick existing).
2. Enable the Gmail API: APIs & Services → Library → search "Gmail API" → Enable.
3. Configure the OAuth consent screen: APIs & Services → OAuth consent screen.
   - User type: **External** (or Internal if you have a Workspace and only your org will use it).
   - App name, support email, developer email: fill in.
   - Scopes: add `https://www.googleapis.com/auth/gmail.send` (sensitive scope).
   - Test users: add the email addresses that will connect Gmail accounts during development.
   - Publishing status: leave in **Testing** for development (max 100 test users, no verification needed).
     For production with >100 users, submit for verification (4–6 weeks).
4. Create the OAuth client: APIs & Services → Credentials → Create Credentials → OAuth client ID.
   - Application type: **Web application**.
   - Authorized redirect URIs: copy the exact value(s) shown on the Email Accounts setup wizard.
     - Local dev usually uses `http://127.0.0.1:3100/api/oauth/gmail/callback`, but the port can change if another DealDesk server is already running.
     - Also add the matching `localhost` variant shown by the wizard. Google treats `localhost` and `127.0.0.1` as different hosts.
     - Production: `https://YOUR_HOST/api/oauth/gmail/callback`
5. Paste the **Client ID** and **Client secret** into the Email Accounts wizard and save.
6. Click **Connect Gmail** on the Email Accounts page.

## Troubleshooting `redirect_uri_mismatch`

Google returns this error when the redirect URI in your OAuth request does not exactly match
one of the URIs registered in Google Cloud Console.

1. Open Email Accounts and copy the **Primary** redirect URI from step 2 of the wizard.
2. In Google Cloud Console → Credentials → your OAuth client → **Authorized redirect URIs**,
   ensure that URI is listed character-for-character (scheme, host, port, path).
3. For local dev, add **both** loopback variants if the wizard shows them. If Google says
   `redirect_uri=http://127.0.0.1:3101/api/oauth/gmail/callback`, then Google Cloud Console
   must include both:
   - `http://127.0.0.1:3101/api/oauth/gmail/callback`
   - `http://localhost:3101/api/oauth/gmail/callback`
4. Do **not** use port `3000` unless your DealDesk server is actually listening on 3000.
   Default dev port is **3100** (`pnpm dev`), but DealDesk may use the next free port
   (for example `3101`) when another instance is already running.
5. Optional: set `DEALDESK_PUBLIC_URL` (or `GMAIL_OAUTH_REDIRECT_URI`) in `~/.dealdesk/.env`
   to pin the canonical callback URL for deployments behind a reverse proxy:

   ```
   DEALDESK_PUBLIC_URL=https://YOUR_HOST
   # or override the full callback path:
   GMAIL_OAUTH_REDIRECT_URI=https://YOUR_HOST/api/oauth/gmail/callback
   ```

6. Restart the server after changing env vars, then reset and re-save OAuth credentials if needed.

## Legacy env-based setup (deprecated)

Older deployments used instance-wide env vars instead of the per-company wizard:

```
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
GOOGLE_OAUTH_REDIRECT_URI=https://YOUR_HOST/api/oauth/gmail/callback
```

Prefer the Email Accounts wizard for new setups. `GMAIL_OAUTH_REDIRECT_URI` still overrides
the computed callback URL when set.
