# Privacy

What EIDOS sends, what it keeps and where. This describes the code in this repository; a deployment can only be
stricter.

## What is sent to the Claude API

| Input mode | Sent to Anthropic | How long it lives there |
|---|---|---|
| PDF | The file, uploaded through the Files API | Requested with a 24-hour expiry (`expires_in_seconds: 86400`) |
| Photo | The image, inline (base64) in the Reader request | Not stored as a file |
| Link | The URL; Claude's `web_fetch` tool reads the page | Not stored as a file |
| Question | The question; Claude's `web_search` tool finds sources | — |
| Text | The pasted text, inline as a document | Not stored as a file |

Questions to the Tutor, check answers, "¿Y si…?" questions and lens changes send the learner's text plus the
world's ledger (and, for the Tutor and Skeptic, the source documents by `file_id`).

## What the EIDOS server keeps

- **No documents and no worlds.** The server forwards requests to the API and streams results back; it does not
  write uploads, ledgers or worlds to disk or a database.
- **The session token** that lets later questions reach your uploaded PDF is sealed with AES-256-GCM and kept in
  your browser. It holds the `file_id`s and expires after 24 hours. The client never sends a raw `file_id`; the
  server only accepts ones it can decrypt from its own token.
- **Rate limits** are counted per IP address in memory (or in Upstash Redis when configured), with no content.
- **Logs** contain operational metadata only: route, duration, error codes, token counts and cost. Never keys,
  document content, questions or answers. `EIDOS_DEBUG=1` dumps SSE events to `./.debug/` for development only;
  the folder is git-ignored.

## What your browser keeps

- Worlds you forge are saved in IndexedDB on your device (`idb-keyval`). Delete them from the Atlas or by clearing
  site data.
- Settings (language, sound, voice, quality, motion) live in `localStorage`.
- When a deployment enables bring-your-own-key (`ALLOW_BYOK=true`), a key you paste in Settings is kept in
  `sessionStorage` only (gone when the tab closes), sent in a request header to this deployment's API routes, used
  for your own requests and never logged.

## Sharing

- Without a KV store, a shared link carries the whole world compressed in the URL fragment (`/s/#z=…`). Fragments
  are not sent to servers, so nothing is stored anywhere.
- With Upstash Redis configured, "Share" stores the shareable world (without the session token) under a random id
  for 30 days and returns a short `/s/<id>` link.
- Shared worlds never include source files; filament panels show only the cited passages already in the ledger.

## Third parties

- Anthropic (Claude API) — model calls, Files API, web search and fetch.
- Upstash (optional) — short share links and distributed rate limits.
- Fonts are self-hosted at build time; there are no analytics, trackers or external scripts. The Content Security
  Policy allows scripts, workers, images, fonts and connections from the app's own origin only.
