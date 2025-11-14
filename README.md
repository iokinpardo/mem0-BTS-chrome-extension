# Mem0 Chrome Extension — Cross-LLM Memory

Mem0 brings ChatGPT-style memory to all your favorite AI assistants. Share context seamlessly across ChatGPT, Claude, Perplexity, and more, making your AI interactions more personalized and efficient.

<a href="https://chromewebstore.google.com/detail/claude-memory/onihkkbipkfeijkadecaafbgagkhglop?hl=en-GB&utm_source=ext_sidebar" style="display: inline-block; padding: 8px 12px; background-color: white; color: #3c4043; text-decoration: none; font-family: 'Roboto', Arial, sans-serif; font-size: 14px; font-weight: 500; border-radius: 4px; border: 1px solid #dadce0; box-shadow: 0 1px 2px rgba(60,64,67,0.3), 0 1px 3px 1px rgba(60,64,67,0.15);">
  <img src="https://www.google.com/chrome/static/images/chrome-logo.svg" alt="Chrome logo" style="height: 24px; vertical-align: middle; margin-right: 8px;">
  Add to Chrome, It's Free
</a>
<br>
<br>

Built using [Mem0](https://www.mem0.ai) ❤️


## Demo

Watch the Mem0 Chrome Extension in action (full-resolution video available [here](https://www.youtube.com/watch?v=cByzXztn-YY)):

https://github.com/user-attachments/assets/a069a178-631e-4b35-a182-9f4fef7735c4


## Features

- **Universal Memory Layer:** Share context across ChatGPT, Claude, Perplexity, and more
- **Smart Context Detection:** Automatically captures relevant information from your conversations
- **Intelligent Memory Retrieval:** Surfaces relevant memories at the right time
- **One-click sync** with existing ChatGPT memories
- **Built-in memory dashboard:** Filter, search, and delete memories without leaving the extension
- **Per-domain capture rules:** Allow or block OpenMemory on specific domains and subdomains directly from the sidebar
- **Dashboard build integration:** Production builds now bundle the dashboard script so the Memories and Settings tabs load correctly from the `dist/` package after `npm run build`
- **Dashboard pagination controls:** Navigate large memory sets with page counters, accurate totals, and adjustable per-page views directly in the dashboard
- **BTS-branded experience:** Lighter BTS styling with refreshed typography and logo treatment throughout the dashboard, sidebar, and sign-in popup
- **Firefox-ready build pipeline:** Ship the same BTS Me-mory experience to Firefox via a dedicated manifest, compatibility shim, and packaging scripts
- **Bulk memory management:** Select multiple memories at once and remove them from BTS in a single action while staying synced with the cloud API
- **Category-aware filtering:** Review how many memories belong to each category right from the dashboard dropdown to pick the right filter faster
- **Memory query assistant:** Run quick prompts against your saved memories from the BTS dashboard with OpenAI-powered summaries

### Dashboard pagination controls
- **Feature name:** Dashboard pagination controls
- **Purpose:** Keep the dashboard responsive while browsing large memory collections by navigating with clear page indicators and totals.
- **Usage example:** Open the dashboard from the sidebar, adjust the **Page size** dropdown to 50 to show more items at once, and use the **Previous/Next** buttons to move between pages.

### Bulk memory management
- **Feature name:** Bulk memory management
- **Purpose:** Speed up moderation by selecting several memories at once and permanently deleting them from BTS in one streamlined action.
- **Usage example:** From the BTS Me-mory dashboard, select a few rows (or click **Select page**) and press **Delete selected** to remove them from both the dashboard and the hosted BTS memory store.
- **Dependencies / breaking changes:** Requires an authenticated session; no breaking changes.

### BTS interface refresh
- **Feature name:** BTS interface refresh
- **Purpose:** Deliver a cohesive, on-brand BTS Me-mory experience across the dashboard, in-page sidebar, and extension popup with bright palettes and updated logos.
- **Usage example:** Open the BTS Me-mory dashboard, toggle the in-page sidebar, or click the extension icon to view the BTS-styled interfaces featuring the refreshed logo and copy.
- **Dependencies / breaking changes:** No new dependencies; purely visual update.

### BTS extension card branding
- **Feature name:** BTS extension card branding
- **Purpose:** Keep the Chrome extensions page in sync with the in-product experience by renaming the extension card and using the BTS Me-mory isotipo as the toolbar and listing icon.
- **Usage example:** Visit `chrome://extensions`, locate the BTS Me-mory card, and notice the new "BTS Me-mory 1.0.0" title, descriptive copy, and BTS-branded icon that now match the popup and sidebar UI.
- **Dependencies / breaking changes:** No additional dependencies; relies on the bundled `icons/Logo-BTS-01_isotipo-1.png` asset for every icon size.

### BTS ChatGPT overlay polish
- **Feature name:** BTS ChatGPT overlay polish
- **Purpose:** Align the ChatGPT memory overlay and floating insertion button with the BTS Me-mory palette by swapping the legacy Mem0 icons for the BTS isotipo and recoloring the modal, cards, and controls.
- **Usage example:** While chatting in ChatGPT, click the BTS circular button beside the input to open the refreshed overlay—note the BTS logo in the header, accent "Add to Prompt" CTA, and lilac cards that match the dashboard.
- **Dependencies / breaking changes:** Uses the shared `icons/Logo-BTS-01_isotipo-1.png` asset across content scripts; purely visual with no breaking changes.

### Firefox-ready build pipeline
- **Feature name:** Firefox-ready build pipeline
- **Purpose:** Generate a Firefox-compatible package (with gecko metadata, background script fallback, and API shims) so teams can test BTS Me-mory outside of Chromium browsers.
- **Usage example:** Run `npm run build:firefox` to compile using the Firefox manifest, then execute `npm run dev:firefox` to launch a temporary Firefox profile via `web-ext run` for smoke testing the popup, sidebar, and dashboard.
- **Dependencies / breaking changes:** Requires Node.js plus the new `webextension-polyfill`, `web-ext`, and `cross-env` dependencies; no breaking changes for Chrome users.

### Category-aware filtering
- **Feature name:** Category-aware filtering
- **Purpose:** Surface the total number of memories within each category so BTS teams can immediately gauge relevance before switching filters.
- **Usage example:** Open the **Category** dropdown on the BTS Me-mory dashboard to see options such as `family (15)` or `food (12)` and choose the most helpful category for review.
- **Dependencies / breaking changes:** No additional dependencies; compatible with existing filtering workflows.

### Memory query assistant
- **Feature name:** Memory query assistant
- **Purpose:** Ask natural-language questions about your stored memories directly from the BTS Me-mory Dashboard and receive concise answers generated with a lightweight OpenAI model.
- **Usage example:** Open the BTS Me-mory Dashboard, type “What did I plan for the product launch?” into the **Ask your memories** panel, and press **Run query** (or hit **Cmd/Ctrl + Enter**) to see an answer plus supporting memory snippets.
- **Dependencies / breaking changes:** Uses the existing Mem0 API credentials; no additional configuration or breaking changes required.

## Installation

> **Note:** Make sure you have [Node.js](https://nodejs.org/) installed before proceeding.

1. Clone this repository and open the project directory in your terminal.
2. Install dependencies with `npm install`.
3. Build the production bundle by running `npm run build` (add `npm run lint:check && npm run type-check` beforehand if you want to verify the codebase).
4. Confirm that the compiled assets now live in the `dist/` folder.
5. In Chrome, navigate to `chrome://extensions` and toggle **Developer mode** in the top-right corner.
6. Click **Load unpacked** and pick the generated `dist/` directory.
7. Pin the OpenMemory icon in your toolbar, click it, and complete sign-in to start capturing memories.

### Firefox build & validation

1. Install Firefox (version 115 or newer) locally.
2. Run `npm run build:firefox` to generate the Firefox-specific bundle with the Gecko manifest.
3. For rapid iteration, execute `npm run dev:firefox` to build and immediately launch `web-ext run`, which sideloads the extension into a temporary Firefox profile.
4. To package an `.xpi`, run `npm run package:firefox` and upload the artifact inside `web-ext-artifacts/` to AMO.


## Usage

1. After installation, look for the Mem0 icon in your Chrome toolbar
2. Sign in with Google
3. Start chatting with any supported AI assistant
4. For ChatGPT and Perplexity, just press enter while chatting as you would normally
5. On Claude, click the Mem0 button or use shortcut ^ + M
6. Open the sidebar settings to configure organization/project, retrieval thresholds, and per-domain allow/block lists
7. Click **Open Dashboard** in the sidebar to filter, search, and delete memories directly inside Chrome

## ❤️ Free to Use

Mem0 is completely free with:

- No usage limits
- No ads
- All features included

## Configuration

- API Key: Required for connecting to the Mem0 API. Obtain this from your Mem0 Dashboard.
- User ID: Your unique identifier in the Mem0 system. If not provided, it defaults to 'chrome-extension-user'.

## Troubleshooting

If you encounter any issues:

- Check your internet connection
- Verify you're signed in correctly
- Clear your browser cache if needed
- Contact support if issues persist

## Privacy and Data Security

Your messages are sent to the Mem0 API for extracting and retrieving memories.

## Contributing

Contributions to improve Mem0 Chrome Extension are welcome. Please feel free to submit pull requests or open issues for bugs and feature requests.

## License
MIT License
