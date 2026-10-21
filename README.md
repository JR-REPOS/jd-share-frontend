# jd-share V1.2.2

Public browser frontend for JD Share, created by Jamie Reddin.

The `frontend-pages` branch is deployed with GitHub Actions to https://jr-repos.github.io/jd-share-frontend/ . This repository contains browser assets only. It does not run the Python backend or include account credentials, uploads, runtime data or private project records.

Run your JD Share backend on your PC at a trusted HTTPS address. Allow the browser origin `https://jr-repos.github.io` in that backend's ALLOWED_ORIGINS setting, then restart it. Open Settings → Browser connection on the site and save your backend address and access token. My.JDownloader account details are configured on the backend machine. Never commit passwords or tokens here.

GitHub visibility applies to the whole repository: there are no private branches inside this public repository. Keep all server code and private project records in a separate private repository.

## Pending features

- Redacted diagnostics export.
- Recurring quiet hours and repeating schedules.
- Background push alerts while the page is closed.
- Credential-free preferences and preset backup/import.
- Signed Siri Shortcut and published iCloud installation.
- Real iPhone/Safari and backend/multi-PC acceptance.
- Priority readback (BUG-003) and missing selected download (BUG-004) investigations.

The private app repository maintains the full task records and a separate 50-idea backlog. Server history and statistics start when the updated backend is installed. Logs are disabled by default. Storage reports the backend upload disk. Masked/revealable settings require the updated backend; .env edits require restart.

[GitHub / website](https://jayreddin.github.io) · [Discord](https://discord.com/users/210066853354143744) · [X](https://x.com/jayreddin) · [Reddit](https://www.reddit.com/u/Jayreddin)
