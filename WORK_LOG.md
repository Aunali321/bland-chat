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
| `src/routes/+page.svelte` | Main chat UI. All state management, message handling, streaming loop, metrics tracking, image handling. Single page app. |
| `src/routes/+layout.svelte` | Layout wrapper. Loads fonts (Inter, JetBrains Mono), sets favicon and title. |
| `src/routes/api/chat/+server.ts` | Server-side SSE proxy. Receives chat request, forwards to upstream API, streams response back. Solves CORS. |
| `src/lib/api.ts` | Client-side streaming. Calls `/api/chat`, parses SSE, yields typed events (`text`, `reasoning`, `usage`). |
| `src/lib/types.ts` | TypeScript types: Message (with reasoning + metrics), ResponseMetrics, Conversation, Settings, etc. |
| `src/lib/storage.ts` | localStorage persistence for conversations and settings. Default parameter values live here. |
| `src/lib/markdown.ts` | Markdown rendering via marked with highlight.js code highlighting. |
| `src/app.css` | Tailwind v4 config, custom color theme (warm earthy palette), dark mode vars, prose/markdown styles, scrollbar styles. |
| `.env.example` | Template for env vars: `VITE_API_URL`, `VITE_API_KEY`, `VITE_MODEL`. |
| `vite.config.ts` | Vite config with Tailwind v4 plugin. |

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
- conversation history in sidebar, persisted to localStorage
- double-click conversation title to rename
- delete individual messages
- system prompt field
- dark mode toggle
- markdown rendering with syntax-highlighted code blocks

## gotchas for future self
1. **LSP is always stale.** It reports errors on `metrics`, `reasoning`, `topK`, `minP`, `presencePenalty`, `repetitionPenalty` etc — but the build passes fine. The types ARE defined correctly in `src/lib/types.ts`. Don't chase phantom LSP errors, just run `bun run build` to verify.
2. **The adapter warning on build** (`Could not detect a supported production environment`) is because we're using `@sveltejs/adapter-auto`. For deployment, switch to `adapter-node` or `adapter-static`.
3. **sglang's `reasoning_tokens: 0`** in the usage response is a bug — it doesn't correctly report reasoning tokens. We count them ourselves from the stream.
4. **RunPod proxy URL** for the user's sglang: `https://grai07z1pqkaig-8000.proxy.runpod.net/v1` — this is ephemeral and will change when the pod restarts.
5. **The server proxy at `/api/chat`** passes `apiUrl` and `apiKey` in the request body. This means these values are sent to the SvelteKit server, not directly to the upstream. Fine for local dev, but for production deployment you'd want to handle secrets differently.
6. **Bun** is the package manager. Use `bun run dev`, `bun run build`, etc.
7. **Tailwind v4** uses `@tailwindcss/vite` plugin (not PostCSS). CSS custom properties for theming are in `@theme` block in `app.css`. Dark mode uses `@custom-variant dark`.
