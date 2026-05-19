# WTF

A static, browser-only multi-purpose app:

- **Messaging** — local chats and groups. Add contacts, pick who you're sending as, edit/delete messages. Lives entirely in your browser.
- **Chatbot** — connect Anthropic Claude, OpenAI, or Ollama Cloud by pasting your API key in Settings. Streaming responses, multiple conversations, regenerate.
- **Private mode** — a toggle in the top bar. When on, everything (chats, contacts, API keys) is stored in `sessionStorage` only and is wiped when you close the tab.

## Run

It's a static SPA — no build step.

```bash
# Any static server, e.g.
python3 -m http.server 8000
# then open http://localhost:8000
```

Or just open `index.html` directly in a browser (file:// works for most things, but a local server is recommended for fetch CORS).

## Files

- `index.html` — shell + dialogs
- `css/styles.css`
- `js/app.js` — entry, tabs, private-mode toggle
- `js/storage.js` — storage adapter (localStorage vs sessionStorage)
- `js/state.js` — in-memory state + persist
- `js/providers.js` — Anthropic / OpenAI / Ollama Cloud adapters with streaming
- `js/messaging.js` — chats, groups, contacts, composer
- `js/chatbot.js` — AI conversations, streaming, regenerate
- `js/settings.js` — provider keys, models, test connection, export/import/wipe
- `js/ui.js` — small DOM helpers

## Notes on API calls

All AI calls go directly from your browser to the provider:

- **Anthropic** sends `anthropic-dangerous-direct-browser-access: true`.
- **OpenAI** uses `Authorization: Bearer <key>`.
- **Ollama Cloud** uses `https://ollama.com/api/chat` with `Authorization: Bearer <key>`.

Keys are stored in this browser only. Anyone with access to your browser can read them from storage, so keep them per-device.
