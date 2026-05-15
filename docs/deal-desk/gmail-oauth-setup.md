# Gmail OAuth Setup for Outreach Analyst

The Outreach Analyst role sends email through the connected user's Gmail account.
You (the operator) must create your own Google Cloud project + OAuth client. Each
deployment of Deal Desk uses its own credentials.

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
   - Authorized redirect URIs: `https://YOUR_HOST/api/oauth/gmail/callback`
     (for local dev: `http://localhost:3000/api/oauth/gmail/callback`).
   - Save and copy the **Client ID** and **Client secret**.
5. Set env vars in `~/.paperclip/.env` (or your deployment's env file):

   ```
   GOOGLE_OAUTH_CLIENT_ID=<from step 4>
   GOOGLE_OAUTH_CLIENT_SECRET=<from step 4>
   GOOGLE_OAUTH_REDIRECT_URI=https://YOUR_HOST/api/oauth/gmail/callback
   ```

6. Restart the server. The "Connect Gmail" button on the Email Accounts page will now work.
