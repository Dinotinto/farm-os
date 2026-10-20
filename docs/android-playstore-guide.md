# Publishing Dinotinto Farm OS to the Google Play Store

The Android app is a **Trusted Web Activity (TWA)** — a thin native wrapper around the live
site at `https://farm.dtinto.com`. The app shows the site full-screen (no browser bar) and
**auto-updates whenever you deploy the website**. You only re-publish the Android app when the
icon, name, or package changes — not for normal feature/content updates.

## What is already done (in this repo)

- ✅ Installable PWA: `public/manifest.webmanifest`, app icons in `public/icons/`, service
  worker `public/sw.js` (offline support), registered via `src/components/PwaRegister.tsx`.
- ✅ Theme colour, maskable icon, Apple touch icon, viewport-fit for safe areas.
- ✅ Domain-verification placeholder: `public/.well-known/assetlinks.json` (served at
  `https://farm.dtinto.com/.well-known/assetlinks.json`).
- ✅ TWA build config: `twa-manifest.json` (package id `com.dtinto.farmos`).
- ✅ Play Store assets: `public/icons/playstore-512.png` (app icon) and
  `public/icons/playstore-feature-1024x500.png` (feature graphic).

## Prerequisites (you)

- A **Google Play Console** account — one-time **$25** (https://play.google.com/console).
- Nothing else needs installing if you use PWABuilder (recommended). For the CLI route you
  need Node 18+ and a JDK (both already on this machine).

---

## Recommended path — PWABuilder (no local Android tooling)

1. Go to **https://www.pwabuilder.com** and enter `https://farm.dtinto.com`, click **Start**.
   It will score the PWA (manifest/SW/icons are already in place).
2. Click **Package For Stores → Android**.
3. Set **Package ID** to `com.dtinto.farmos`, App name **Dinotinto Farm OS**, Launcher name
   **Farm OS**. Leave "Signing key" as **Create new** (PWABuilder generates one).
4. **Download** the zip. It contains:
   - `app-release-signed.aab` — upload this to Play.
   - `signing.keystore` + `signing-key-info.txt` — **back these up safely; you need the same
     key for every future update**.
   - `assetlinks.json` — the verified version with your real SHA-256 fingerprint.
5. **Copy the `sha256_cert_fingerprints` value** from the downloaded `assetlinks.json` into
   this repo's `public/.well-known/assetlinks.json` (replace
   `REPLACE_WITH_YOUR_APP_SIGNING_SHA256_FINGERPRINT`), commit and deploy. This is what makes
   the app open without the browser address bar.
   > If you use Google Play App Signing (default), also add the **App signing key** SHA-256
   > from Play Console → your app → Setup → App integrity → into the same array (you can list
   > multiple fingerprints).
6. In **Play Console**: Create app → upload the `.aab` to **Internal testing** first → fill the
   store listing (see assets below) → roll out to testing, then Production.

---

## Alternative path — Bubblewrap CLI

```bash
npm i -g @bubblewrap/cli
bubblewrap init --manifest https://farm.dtinto.com/manifest.webmanifest
# Accept defaults; set packageId com.dtinto.farmos when prompted (or reuse twa-manifest.json)
bubblewrap build      # produces app-release-signed.aab and a keystore
```

Get the SHA-256 fingerprint of your keystore for `assetlinks.json`:

```bash
keytool -list -v -keystore android.keystore -alias android | findstr SHA256
```

Put that fingerprint into `public/.well-known/assetlinks.json`, deploy, then upload the `.aab`
to Play Console.

---

## Store listing assets

| Asset | File / size |
|-------|-------------|
| App icon (512×512) | `public/icons/playstore-512.png` |
| Feature graphic (1024×500) | `public/icons/playstore-feature-1024x500.png` |
| Phone screenshots (min 2) | Take from `farm.dtinto.com` on a phone (Dashboard, Ask AI) |
| Short description | "Run your farm: land, irrigation, labour, crops, costs and an AI assistant." |
| Privacy policy URL | Required by Play — add a simple privacy page/URL |

## After publishing

- **Content/feature updates**: just deploy the website — the app updates automatically.
- **App updates** (new icon/name/version): bump `appVersionCode` in `twa-manifest.json`,
  rebuild with the **same keystore**, upload the new `.aab`.
- **Keep the keystore safe** — losing it means you can never update the same app listing.
