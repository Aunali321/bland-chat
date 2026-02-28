# bland-chat work log

## what this is
A dead simple chat UI for testing models via OpenAI-compatible APIs (specifically targeting sglang). Built with SvelteKit + Svelte 5, Tailwind CSS v4, marked + highlight.js.

## architecture decisions

### why SvelteKit instead of plain Svelte+Vite
`sv create` scaffolded SvelteKit. Kept it because it gave us server-side endpoints for free, which solved the CORS problem (see below).

### CORS problem and the server proxy
The sglang server runs on a different origin (RunPod proxy: `https://grai07z1pqkaig-8000.proxy.runpod.net/v1`). Browser fetch from the SvelteKit dev server to sglang gets blocked by CORS. The second message always threw `NetworkError when attempting to fetch resource`.

Fix: Created `src/routes/api/chat/+server.ts` — a SvelteKit server endpoint that receives the chat request, forwards it to the upstream API server-side, and streams the SSE response back. The client-side code in `src/lib/api.ts` now calls `/api/chat` instead of the external URL directly. The `apiUrl` and `apiKey` are passed in the request body, extracted server-side, and used to build the upstream request.

### token counting: removed estimation, using chunk counts + API usage
Originally had `estimateTokens()` that guessed ~4 chars/token. This was wildly inaccurate (reported 1394 t/s when real was ~80 t/s, and overcounted tokens 3x).

Removed it entirely. Now:
- During streaming: count SSE chunks (1 chunk = 1 token, which is how sglang sends them)
- After streaming: if sglang returns `usage` in the final chunk (via `stream_options: { include_usage: true }`), those exact numbers replace the chunk counts

sglang DOES return usage. The final SSE chunk has `choices: []` and `usage: { prompt_tokens, completion_tokens, total_tokens }`. Note: `completion_tokens` includes both reasoning and visible tokens. sglang reports `reasoning_tokens: 0` which is wrong — we count reasoning tokens ourselves from the stream.

### reasoning/thinking token support
Qwen3 with `--reasoning-parser qwen3` sends thinking tokens as `delta.reasoning_content` (not `delta.content`). These are separate SSE events with `content: null, reasoning_content: "some thinking text"`.

The code:
- `src/lib/api.ts` yields `{ type: 'reasoning', text }` events for reasoning and `{ type: 'text', text }` for visible content
- `src/routes/+page.svelte` tracks both separately with independent timing (TTFRT vs TTFT)
- Reasoning content stored in `msg.reasoning` field on the Message type
- Displayed in a collapsible `<details>` element above the visible response

### metrics tracked per assistant message
- **ttfrt**: time to first reasoning token (ms) — only shown when reasoning occurred
- **ttft**: time to first visible token (ms) — the actual user-perceived latency
- **t/s**: total tokens per second (reasoning + visible)
- **think**: reasoning token count
- **out**: visible output token count
- **in**: prompt tokens (from API usage)
- **total time**: wall clock generation time

Metrics update live during streaming and finalize with API usage data when the stream ends.

## file inventory

| file | what it does |
|---|---|
| `src/routes/+page.svelte` | Main chat UI. State management, streaming loop, metrics tracking, image handling. Composes child components. |
| `src/routes/+page.server.ts` | Server-side load function and form actions. All DB reads/writes go through here. |
| `src/routes/+layout.svelte` | Layout wrapper. Loads fonts (Inter, JetBrains Mono), sets favicon and title. |
| `src/routes/api/chat/+server.ts` | Server-side SSE proxy. Receives chat request, forwards to upstream API, streams response back. Solves CORS. |
| `src/lib/api.ts` | Client-side streaming. Calls `/api/chat`, parses SSE, yields typed events (`text`, `reasoning`, `usage`). |
| `src/lib/types.ts` | TypeScript types: Message, ResponseMetrics, Conversation, ApiSettings, UiPreferences, Settings. |
| `src/lib/storage.ts` | Client-side localStorage for UI preferences (darkMode only). Migration helpers for old localStorage data. |
| `src/lib/markdown.ts` | Markdown rendering via marked with highlight.js code highlighting. |
| `src/lib/server/schema.ts` | Drizzle ORM schema: conversations, messages, settings tables. |
| `src/lib/server/db.ts` | Database connection using bun:sqlite + drizzle-orm. Auto-runs migrations on import. |
| `src/lib/components/Sidebar.svelte` | Conversation list sidebar with new/delete/rename/select actions. |
| `src/lib/components/ChatMessage.svelte` | Single message bubble with reasoning display, metrics, and delete button. |
| `src/lib/components/SettingsPanel.svelte` | API config and model parameter controls. |
| `src/lib/components/MessageInput.svelte` | Chat input textarea with image upload/paste/drop support. |
| `src/lib/components/TopBar.svelte` | Header bar with sidebar toggle, conversation title, model badge. |
| `src/app.css` | Tailwind v4 config, custom color theme (warm earthy palette), dark mode vars, prose/markdown styles, scrollbar styles. |
| `drizzle.config.ts` | Drizzle Kit config for migration generation. |
| `drizzle/` | SQL migration files (auto-generated by drizzle-kit). |
| `.env.example` | Template for env vars: `VITE_API_URL`, `VITE_API_KEY`, `VITE_MODEL`. |
| `vite.config.ts` | Vite config with Tailwind v4 plugin, bun:sqlite externalized for SSR. |

## config

### env vars (optional defaults)
- `VITE_API_URL` — base URL for the API (e.g. `https://...runpod.net/v1`)
- `VITE_API_KEY` — API key
- `VITE_MODEL` — model name (e.g. `qwen/qwen3.5-122B`)

These are loaded on mount and used as defaults. User can override in the settings panel.

### model parameters (in settings panel)
Default values chosen by user for their Qwen3.5 setup:
```
temperature: 1.0
top_p: 0.95
top_k: 20
min_p: 0.0
presence_penalty: 1.5
repetition_penalty: 1.0
max_tokens: 4096
```

All sent in the API request body. The API request also includes `stream_options: { include_usage: true }`.

## features
- streaming chat with real-time token display
- reasoning/thinking token display (collapsible, separate from visible output)
- per-message metrics (TTFRT, TTFT, t/s, token counts, total time)
- image upload (file picker, paste, drag & drop) — sent as base64 in vision API format
- conversation history in sidebar, persisted to SQLite via Drizzle ORM
- double-click conversation title to rename
- delete individual messages
- system prompt field
- dark mode toggle
- markdown rendering with syntax-highlighted code blocks

## gotchas for future self
1. **LSP is always stale.** It reports errors on `metrics`, `reasoning`, `topK`, `minP`, `presencePenalty`, `repetitionPenalty` etc — but the build passes fine. The types ARE defined correctly in `src/lib/types.ts`. Don't chase phantom LSP errors, just run `bun run build` to verify.
2. **The bun:sqlite warning on build** (`Could not resolve 'bun:sqlite'`) is expected — it's a Bun built-in resolved at runtime, not during Vite's bundling step. The build succeeds fine.
3. **svelte-adapter-bun** is used instead of adapter-auto. All scripts use `bun --bun` flag to ensure Bun runtime (not Node) is used.
4. **sglang's `reasoning_tokens: 0`** in the usage response is a bug — it doesn't correctly report reasoning tokens. We count them ourselves from the stream.
4. **RunPod proxy URL** for the user's sglang: `https://grai07z1pqkaig-8000.proxy.runpod.net/v1` — this is ephemeral and will change when the pod restarts.
5. **The server proxy at `/api/chat`** passes `apiUrl` and `apiKey` in the request body. This means these values are sent to the SvelteKit server, not directly to the upstream. Fine for local dev, but for production deployment you'd want to handle secrets differently.
6. **Bun** is the package manager. Use `bun run dev`, `bun run build`, etc.
7. **Tailwind v4** uses `@tailwindcss/vite` plugin (not PostCSS). CSS custom properties for theming are in `@theme` block in `app.css`. Dark mode uses `@custom-variant dark`.

### storage migration: localStorage -> SQLite + Drizzle ORM
Conversations and API settings moved from browser localStorage to server-side SQLite database via Drizzle ORM.

**Why:** localStorage is per-browser, has size limits (~5MB), and can't be shared across devices. SQLite via the server makes data persistent and portable.

**What changed:**
- `src/lib/server/schema.ts` — Drizzle schema with three tables: `conversations`, `messages`, `settings`
- `src/lib/server/db.ts` — Database connection using `bun:sqlite` (Bun's built-in SQLite driver) + `drizzle-orm/bun-sqlite` adapter. Auto-runs migrations on import via `drizzle-orm/bun-sqlite/migrator`.
- `src/routes/+page.server.ts` — SvelteKit server load function returns all conversations + settings from DB. Form actions handle CRUD: `createConversation`, `deleteConversation`, `renameConversation`, `addMessage`, `updateMessage`, `deleteMessage`, `saveSettings`.
- `src/lib/types.ts` — Settings split into `ApiSettings` (server-persisted) and `UiPreferences` (client-only). `Settings = ApiSettings & UiPreferences`.
- `src/lib/storage.ts` — Stripped down. Only handles `UiPreferences` (darkMode) in localStorage.
- `+page.svelte` — Broken into components. Uses `data` prop from server load. Mutations call form actions via `fetch('?/actionName')`. During streaming, state is kept in memory and persisted to DB when stream finishes.

**Data flow:**
1. Page loads -> `+page.server.ts` load() reads all conversations + settings from SQLite
2. User creates/deletes/renames conversations -> form action fires, DB updates, `$effect` syncs new `data` into state
3. User sends message -> user message saved to DB immediately, assistant message saved after stream completes
4. Settings changes -> form action `saveSettings` upserts into settings table. darkMode stays in localStorage.

**DB location:** `data/bland-chat.sqlite` (gitignored). Override with `DATABASE_PATH` env var.

**Messages table:** Messages are normalized (own table, FK to conversations, position-indexed). `content` column stores JSON string (either a plain string or `MessageContent[]` for image messages). `metrics` and `reasoning` are nullable text columns.

### component extraction
The monolithic `+page.svelte` (935 lines) was broken into five components:
- `Sidebar.svelte` — conversation list + controls
- `ChatMessage.svelte` — single message bubble with all rendering (reasoning, metrics, images)
- `SettingsPanel.svelte` — API config and model parameter sliders
- `MessageInput.svelte` — textarea + image upload/paste/drop
- `TopBar.svelte` — header bar with sidebar toggle and model badge

The main `+page.svelte` now composes these and handles streaming/state management.

### further refactoring
- `defaultApiSettings` moved from `+page.svelte` to `src/lib/types.ts` as an exported const
- Streaming + metrics logic extracted into `src/lib/chat.ts`:
  - `runStreamingChat()` — runs the streaming loop, tracks token counts, computes live and final metrics
  - Called from `+page.svelte` with UI callbacks (`onUpdate`, `onToken`) to trigger reactivity and scrolling
- `+page.svelte` down to ~320 lines from original 935

### bug fix: empty LLM responses (three issues)

Three separate bugs were causing assistant messages to appear as empty bubbles after the refactoring.

**1. FOREIGN KEY constraint failure — conversation ID mismatch**
- `newConversation()` called `fetch('?/createConversation')` and tried to parse the response with `JSON.parse(result.data).id`
- SvelteKit form actions serialize return values with devalue (not plain JSON), so parsing failed silently
- Fallback was `crypto.randomUUID()` — a client-only ID that never existed in the database
- When `saveMessage()` tried to insert a message referencing that conversation ID → `FOREIGN KEY constraint failed`
- **Fix:** Generate UUID client-side and pass it to the server action via FormData. Both sides use the same ID. Same pattern applied to `saveMessage()` / `addMessage` action.

**2. OpenRouter SSE delta format differs from sglang**
- sglang sends reasoning as `delta.reasoning_content`; OpenRouter sends it as `delta.reasoning`
- The old parser only checked `delta.reasoning_content` → missed reasoning from OpenRouter
- Also, `if (delta.content)` used truthiness — OpenRouter sends `delta.content: ""` (empty string) during reasoning chunks, which is falsy but shouldn't trigger text events. The real issue was that the same truthiness check would also skip legitimate empty strings if they somehow appeared. Changed to `typeof delta.content === 'string' && delta.content.length > 0`.
- **Fix:** Check both `delta.reasoning_content || delta.reasoning` for reasoning. Use explicit string length check for content.

**3. Svelte 5 reactivity — in-place mutation not detected**
- `chat.ts` mutates `assistantMsg` in-place (appending to `.content`, `.reasoning`, setting `.metrics`)
- `onUpdate` callback created a new array `[...activeConversation.messages]` but the message objects inside were the same references
- Svelte 5's fine-grained reactivity didn't detect property changes on the same object reference passed as a prop to `ChatMessage.svelte`
- **Fix:** `onUpdate` now copies `{ ...assistantMsg }` into the messages array position, creating a new object reference that Svelte 5 detects as changed.

## next steps
