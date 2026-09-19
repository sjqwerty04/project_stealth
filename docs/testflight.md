# How to ship Selects to TestFlight

Friends install the iOS app from a TestFlight link and create an account.

This Linux cloud VM cannot archive the IPA. GitHub Actions `macos-latest` runs `.github/workflows/ios-testflight.yml`.

## 1. Create the App Store Connect app

You need a paid Apple Developer Program membership on team `L37YSKFC5X`.

1. Open [App Store Connect](https://appstoreconnect.apple.com) and sign in.
2. Go to My Apps.
3. Click the plus button, then New App.
4. Platform: iOS.
5. Name: Selects.
6. Primary language: English.
7. Bundle ID: `com.moviecally.app`. Create that identifier first under Certificates, Identifiers & Profiles if it is missing.
8. SKU: `selects-ios`.
9. User access: Full Access.

## 2. Create an App Store Connect API key

1. In App Store Connect, open Users and Access.
2. Open Integrations, then App Store Connect API.
3. Click Generate API Key. Name it `selects-testflight`. Access: Developer (Admin also works).
4. Copy the Issuer ID at the top of the keys list.
5. Copy the Key ID on the new row.
6. Download the `.p8` file. Apple lets you download it once. Open it in a text editor and copy the whole PEM, including `BEGIN` and `END` lines.

## 3. Add GitHub Actions secrets

In this GitHub repo, open Settings, Secrets and variables, Actions. Create three secrets:

- `APP_STORE_CONNECT_API_KEY_ID` is the Key ID.
- `APP_STORE_CONNECT_ISSUER_ID` is the Issuer ID.
- `APP_STORE_CONNECT_API_KEY` is the full `.p8` text.

## 4. Run the workflow

1. Open Actions, iOS TestFlight, Run workflow.
2. Use the branch that contains the iOS workflow, then run.
3. A green job uploaded a build. A signing or "app not found" error means step 1 or 3 is incomplete.

## 5. Invite friends

Internal testers (people you add under Users and Access) can install as soon as processing finishes. No Beta App Review.

External testers need a group:

1. Open the Selects app in App Store Connect, then TestFlight.
2. Create an external group. Enable a public link.
3. Submit the first build for Beta App Review. Fill the required contact and demo notes. Signup is open, so reviewers can create an account with email and password.
4. After approval, send the public link.

Friends open the link on iPhone, install TestFlight if needed, then install Selects. They create an account on the login screen.
