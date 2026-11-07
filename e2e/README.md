# e2e

## iOS parity

`ios-parity.spec.ts` checks what a person sees in the TestFlight app against the live site, in WebKit on an iPhone 15:

- home Selects are real films, not the offline fallback set (`src/lib/fallbackCatalog.ts`)
- a trailer reaches YouTube state playing and fades in
- Orbit shows the film and its Select score
- Ask AI answers
- Library and Hunt load
- no `/api` call fails, errors, or comes back as the HTML app shell
- sign out and back in

It signs in as the shared QA account and never signs up a new one.

### Run it (macOS or Linux)

```bash
npm ci
npx playwright install webkit
export SELECTS_TEST_EMAIL=selects.qa@example.com
export SELECTS_TEST_PASSWORD='...'            # or SELECTS_TEST_CREDS_FILE=<file with both lines>
npx playwright test --project=ios-webkit
```

- Production is the default. Point it elsewhere with `SELECTS_BASE_URL=https://<preview>.vercel.app`.
- No dev server starts for `ios-webkit` projects.
- Report: `npx playwright show-report`. Each test attaches screenshots, a video, and notes (Selects titles, Orbit score, Ask AI reply, `/api` failures).
- If YouTube shows "Sign in to confirm you're not a bot" (cloud and datacenter IPs), the trailer test is skipped with that reason. Run it from a home network to get a real result.

The existing smokes and flows run on the same iPhone in WebKit against the deployed site with `npx playwright test --project=ios-webkit-smokes`. Flows that sign up an account (F2, F15, F16, F17) are excluded. They need `e2e/.auth/creds.json` holding the QA account as `{"email": ..., "password": ...}`. Without that file, `ensureAuthed` signs up a new account.

### Inside the iOS simulator

`ios-sim/parity-check.js` runs the same checks inside the app's own web view (a Capacitor debug build loading production).

1. Build and boot: `npx cap sync ios`, then `npx cap run ios --target <simulator udid>` (find one with `xcrun simctl list devices booted`), or Run from Xcode.
2. Sign in to the app as the QA account.
3. In Safari on the Mac, turn on Settings → Advanced → Show features for web developers. Then open Develop → *Simulator* → *selects-film.vercel.app*.
4. Copy the checker with `pbcopy < e2e/ios-sim/parity-check.js`, paste it into the console, and press Enter. It taps through home, a Select, its trailer, Ask AI, Orbit, Library and Hunt. Then it prints one PASS/FAIL row per check, plus every failed `/api` call.
5. Record proof: `xcrun simctl io booted recordVideo parity.mov` (Ctrl-C to stop).

The checker cannot read inside the YouTube iframe. When the trailer row fails, look at the simulator screen: a YouTube "Error 15x" means the embed got no valid referrer. A "not a bot" page is YouTube blocking the network. The app has no sign-out control yet, so that row is manual.
