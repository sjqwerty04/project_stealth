# How to ship Selects to TestFlight

Friends install the iOS app from a TestFlight link and create an account.

This Linux cloud VM cannot archive the IPA. GitHub Actions `macos-latest` runs `.github/workflows/ios-testflight.yml`.

`workflow_dispatch` only appears under Actions after this file is on `main`. Until then, a push to `brranchh-testflight-ios-13e6` runs the same workflow. The `require-secrets` job exits if the three API secrets are missing, so a macOS archive does not start.

## 1. Create an App Store Connect API key

You need a paid Apple Developer Program membership on team `L37YSKFC5X`.

1. Open [App Store Connect](https://appstoreconnect.apple.com) and sign in.
2. Open Users and Access.
3. Open Integrations, then App Store Connect API.
4. Click Generate API Key. Name it `selects-testflight`. Access: Admin, so Fastlane can create the Selects app record if it does not exist.
5. Copy the Issuer ID at the top of the keys list.
6. Copy the Key ID on the new row.
7. Download the `.p8` file. Apple lets you download it once. Open it in a text editor and copy the whole PEM, including `BEGIN` and `END` lines.

You do not need to click New App first. The Fastlane `produce` step creates bundle id `com.moviecally.app` and SKU `selects-ios` when they are missing. `get_certificates` and `get_provisioning_profile` then create an Apple Distribution certificate and an App Store profile on team `L37YSKFC5X`. The macos runner has an empty keychain, so those two steps have to run before `build_app`. Apple allows two distribution certificates. If a later run fails because the limit is full, revoke unused certificates in the Apple Developer portal and re-run.

## 2. Add GitHub Actions secrets

In this GitHub repo, open Settings, Secrets and variables, Actions. Create three secrets:

- `APP_STORE_CONNECT_API_KEY_ID` is the Key ID.
- `APP_STORE_CONNECT_ISSUER_ID` is the Issuer ID.
- `APP_STORE_CONNECT_API_KEY` is the full `.p8` text.

## 3. Run the workflow

After the secrets exist, push to this branch or open Actions, iOS TestFlight, Run workflow (once the file is on `main`).

A green macOS job uploaded a build. The ubuntu `require-secrets` job failing with missing `APP_STORE_CONNECT_*` means step 2 is incomplete. `check-app-icon` failing means `AppIcon-512@2x.png` is not 1024x1024 RGB. Apple rejects marketing icons that still have an alpha channel. Re-run `scripts/generate-selects-icons.py` so the iOS icon is opaque RGB, then confirm with `python3 scripts/check-app-icon.py`.

## 4. Invite friends

Internal testers (people you add under Users and Access) can install as soon as processing finishes. No Beta App Review.

External testers need a group:

1. Open the Selects app in App Store Connect, then TestFlight.
2. Create an external group. Enable a public link.
3. Submit the first build for Beta App Review. Fill the required contact and demo notes. Signup is open, so reviewers can create an account with email and password.
4. After approval, send the public link.

Friends open the link on iPhone, install TestFlight if needed, then install Selects. They create an account on the login screen.
