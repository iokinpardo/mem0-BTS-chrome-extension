# OpenMemory Chrome Extension – Memory Capture & Management

This document summarizes every entry point that produces memories, the storage knobs that influence them, and the tools available to review what has been saved. Use it as a quick presentation-ready overview when onboarding teammates or preparing product walkthroughs.

## Capture triggers

| Flow | Where it lives | When it fires | Metadata attached |
| --- | --- | --- | --- |
| **Sidebar toggle** | Background service worker | The extension enables memory capture on install so existing integrations start working immediately. | Provider = `extension_init` |
| **ChatGPT / Claude / Gemini / Grok / Perplexity / DeepSeek / Replit** | Site-specific content scripts inside `src/<provider>/content.ts` | When the user submits a prompt, the last conversational turns are packaged and sent to Mem0. | Provider name, inferred category list, page URL where available |
| **Context menu “Save to OpenMemory”** | `src/context-menu-memory.ts` | The user highlights text and picks the custom context-menu item. | Provider = `ContextMenu`, category = `BOOKMARK`, current tab URL |
| **Typed URLs & search tracking** | `src/direct-url-tracker.ts` and `src/search_tracker.ts` | When the user manually types a URL or performs a search (only when tracking is enabled). | Provider = `DirectURL`, category = `NAVIGATION`, URL + timestamp |
| **Manual sync (sidebar)** | `src/sidebar.ts` | “Open Dashboard” and copy actions expose recent memories. Copying a memory does not create new content but helps share it across assistants. | Uses latest API data |

All flows respect the **Memory Suggestions** toggle plus the new **Domain controls** described below.

## Storage & configuration levers

The sidebar settings (persisted via `chrome.storage.sync`) govern how memories are created:

- **Credentials**: Either an API key or an access token must be present; without one, capture is suspended.
- **Identity**: `user_id`, `selected_org`, and `selected_project` route memories to the right user and workspace.
- **Retrieval preferences**: `similarity_threshold`, `top_k`, and `track_searches` tune when memories should appear as suggestions.
- **Per-domain capture rules**: Two new lists—_Allowed domains_ and _Blocked domains_—determine if the extension runs on a given site. Blocked entries always win. When the allow list is empty, every domain except those blocked is permitted. Patterns match both root domains and their subdomains (e.g., `example.com` covers `app.example.com`).

## Dashboard capabilities

Opening **Open Dashboard** in the sidebar launches the new internal dashboard (`src/dashboard.html`). It provides:

- **Full-text search & category filtering** over the 100 most recent memories.
- **Inline deletion** with optimistic UI refresh.
- **Read-only settings snapshot** that mirrors the values stored in `chrome.storage.sync`, including domain allow/block lists.
- **Deep links** via `chrome.runtime.getURL('src/dashboard.html?memoryId=123')` which highlight a specific memory.

## Safeguards & tracking

- **Error handling**: All network calls include conservative timeouts and surface toast/status messages when something fails.
- **Analytics hooks**: The sidebar and login flows emit PostHog events through `sendExtensionEvent` to track activation, logout, and usage.
- **Extensibility**: The new `utils/domain_rules.ts` helper centralizes domain evaluation so future integrations only need to call `isMemoryAllowedForUrl()`.

## Quick reference

- Toggle the sidebar with `Ctrl + M` (Mac: `⌃ + M`).
- Use the context-menu entry for one-off highlights.
- Keep developer mode enabled to reload the unpacked extension after local changes (`npm run build` → refresh at `chrome://extensions`).
- Need to demo? Start with the dashboard to show saved memories, then jump into a supported assistant to capture new ones.
