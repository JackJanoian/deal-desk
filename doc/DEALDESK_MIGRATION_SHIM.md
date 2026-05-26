# DealDesk migration shim spec

One-release compatibility layer for users upgrading from Paperclip-branded installs.

## Config home directory

1. `DEALDESK_HOME` env var (preferred)
2. Deprecated `PAPERCLIP_HOME` env var (stderr warning)
3. `~/.dealdesk` if it exists
4. Legacy `~/.paperclip` if it exists (stderr one-time migration hint)
5. Default: `~/.dealdesk` for fresh installs

## Instance ID

1. `DEALDESK_INSTANCE_ID` (preferred)
2. Deprecated `PAPERCLIP_INSTANCE_ID` (stderr warning)
3. Default: `default`

## HTTP headers (one release)

Server accepts both old and new header names:

| Legacy | New |
|--------|-----|
| `X-Paperclip-Run-Id` | `X-DealDesk-Run-Id` |
| `X-Paperclip-Dev-Server-Status-Token` | `X-DealDesk-Dev-Server-Status-Token` |
| `X-Paperclip-Signature` | `X-DealDesk-Signature` |

Adapters emit new names only.

## Plugin manifests

Accept both `paperclipPlugin` and `dealDeskPlugin` keys during transition.

## Browser localStorage

On boot, copy `paperclip.theme` → `dealdesk.theme` if new key absent.

## CLI migration

`dealdesk doctor` detects legacy `~/.paperclip` and offers copy/symlink to `~/.dealdesk`.
