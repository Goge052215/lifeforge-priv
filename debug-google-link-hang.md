# Debug Session: google-link-hang [OPEN]

- **Status**: [OPEN]
- **Debug Server**: http://127.0.0.1:7777/event
- **Log File**: `.dbg/trae-debug-log-google-link-hang.ndjson`

## Symptom
- After Google OAuth verification, the app shows no response for more than 1 minute.

## Expected
- The callback should complete within a few seconds and return the user to `Account Settings` with linked Google status.

## Hypotheses
- H1: The client callback page triggers `verifyGoogleLink`, but the encrypted request/response bridge is hanging before the server receives or returns data.
- H2: The server receives `verifyGoogleLink`, but the Google token exchange or userinfo fetch blocks or stalls.
- H3: The server completes the Google calls, but PocketBase auth/update during token persistence blocks indefinitely.
- H4: The server returns successfully, but the client follow-up `getUserData()` request hangs, making the UI appear stuck after linking.
- H5: The callback route is working, but an exception path is swallowed and the UI remains on the loading screen without surfacing the failure promptly.

## Status
- Created session file.
- Started debug collector at `http://127.0.0.1:7777/event`.
- Added instrumentation to the client callback page and server Google link path.
- Pending: reproduce, collect logs, analyze.
