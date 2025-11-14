# Safari compatibility options

Safari relies on native app extensions that wrap a standard browser WebExtension, so you can reuse the Mem0 BTS code by
converting the Chromium build into an Xcode project and distributing it through the App Store (or via a signed `.app`).
Use the steps below to convert, iterate, and test the extension when targeting Safari 17 or newer.

## 1. Prepare a release-ready build
1. Run `npm install` (once) and `npm run build` to populate the `dist/` folder with the production assets referenced by
   `manifest.json`.
2. Copy the Chromium manifest into a Safari-specific directory so you can edit fields (bundle identifier, permissions,
   icons) without touching the Chrome build.
3. Ensure every icon listed in the manifest exists at the required dimensions. Safari validates these during conversion.

## 2. Convert with Apple's toolchain
1. Install the latest Xcode and enable the associated command-line tools.
2. Execute the converter from the project root:
   ```bash
   xcrun safari-web-extension-converter dist \
     --project-location safari-mem0 \
     --app-name "Mem0 BTS" \
     --bundle-identifier ai.mem0.bts.extension \
     --copy-resources
   ```
3. When prompted, allow the tool to update the manifest with Safari-only fields (e.g., `browser_specific_settings` with
   a `safari` block) and to create an Xcode workspace containing both the wrapper app and the WebExtension target.
4. Open the generated project (`safari-mem0/Mem0 BTS.xcodeproj`) and enable "Allow unsigned extensions" during local testing.

## 3. Wire up background scripts and permissions
- Safari still supports the `service_worker` background field, but you must enable the WebExtension target capability
  **Background Modes > Location updates** if your worker performs long-running network calls.
- If you rely on `browser` namespaces (through `webextension-polyfill`), keep them in place—Safari implements those APIs
  directly, so no extra shims are required beyond the converter's output.
- Review each permission under **Signing & Capabilities → App Sandbox** and toggle networking/automation entitlements to
  match the APIs declared in `manifest.json`.

## 4. Build, run, and test
1. In Xcode, select the "Mem0 BTS" (macOS) scheme and choose **My Mac (Designed for iPad)** or an attached device.
2. Press **Run** to build and sideload the wrapper app; Safari automatically registers the packaged extension.
3. Open Safari → Preferences → Extensions, enable "Mem0 BTS", and grant requested permissions.
4. Visit ChatGPT, Claude, or another supported site to confirm sidebar buttons, the BTS dashboard, and storage sync behave
   the same as Chrome/Firefox.
5. Capture at least one memory and verify it appears in the dashboard to ensure authenticated network calls succeed.

## 5. Package for distribution
1. In Xcode, set the **Bundle Identifier** and **Team** to your Apple Developer account.
2. Increment the `CFBundleShortVersionString` and `CFBundleVersion` fields before each submission.
3. Use **Product → Archive** to produce a signed `.app`. Distribute it via TestFlight or upload it to App Store Connect for
   review (Safari WebExtensions must ship inside a signed app bundle).
4. Provide a README or onboarding modal inside the wrapper app that explains how to enable the extension after installation.

## Limitations & tips
- Push messaging, Chrome-only APIs, and Manifest V3 `chrome.declarativeNetRequest` rules must be polyfilled or avoided.
- Inline installs are not supported—users must install the macOS app and toggle the extension manually in Safari.
- Keep parity tests scripted: run `npm run build`, load Chrome/Firefox manually, then open the Xcode project so every
  release candidate verifies across all browsers before tagging a version.
