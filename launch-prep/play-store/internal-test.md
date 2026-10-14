# Google Play internal test — what is ready, what only Kyla can do

The code can now ship as a **free** test build. Founding Member stays Coming soon. Every player can grow their monster to adult. The Tune tab is hidden.

A signed Android file still has to be built and uploaded in Kyla’s accounts. An agent cannot finish those clicks.

---

## Already set up in this repo

- Production EAS profile makes a Play **app bundle** (`.aab`)
- Upload target is Play **internal** testing, as a **draft**
- Store listing copy: `launch-prep/play-store/store-listing.md`
- Data Safety answers: `launch-prep/play-store/data-safety.md`
- Privacy policy page: `website/privacy.html` (also `launch-prep/privacy-policy/privacy-policy.md`)
- App display name on the phone: **Mess Monster**
- Package name: `com.messmonster.app`

---

## Steps only Kyla can do

Do these in order. Plain words, no rush.

### 1. Put the privacy page on the live website

The policy lives in this project as `website/privacy.html`. After Netlify (or whatever hosts the site) publishes this change, open:

`https://YOUR-SITE/privacy.html`

It should show the Mess Monster privacy page, not the homepage. Copy that full link. Play will ask for it.

### 2. Expo / EAS account

1. Make a free account at https://expo.dev if you do not have one.
2. On your computer, in this project folder, run `npx eas login` and sign in.
3. Run `npx eas init` if Expo asks you to link the project. Say yes. It will write an Expo project id into the app config — keep that change.

### 3. First signed Android build

1. In the project folder, run:
   `npx eas build --platform android --profile production`
2. The first time, Expo asks who should hold the signing key. Choose **let Expo generate and store it** unless you already have a Play keystore you meant to use.
3. Wait for the build email. Download the `.aab` file when it finishes.

This is the “signed release” file Play wants. You cannot upload a regular Expo Go build.

### 4. Google Play developer account

1. Open https://play.google.com/console
2. Pay the one-time developer fee if you have not already.
3. Create a new app.
   - Name: **Mess Monster: Cleaning Pet** (or **Mess Monster**)
   - Default language: English (United States) is fine
   - App or game: App
   - Free or paid: **Free**
   - Check the declarations Google shows

### 5. Store listing

On the listing page, paste from `launch-prep/play-store/store-listing.md`:

- Title
- Short description
- Full description

Add:

- App icon (the one in `assets/images/icon.png` is a start)
- At least one phone screenshot (Home, Tasks, and the shop are enough)
- A short feature graphic if Google requires it

### 6. Privacy policy link

In **App content → Privacy policy**, paste the live `https://YOUR-SITE/privacy.html` link from step 1.

### 7. Data Safety

In **App content → Data safety**, follow `launch-prep/play-store/data-safety.md`.

The short version: **the app does not collect user data.** Progress stays on the phone.

### 8. Other Play questions Google will not skip

Fill these honestly. Typical answers for this app:

- **Category:** Lifestyle (or Health & fitness if you prefer)
- **Target age:** 13+ / not for kids
- **Ads:** No
- **In-app purchases:** No (Founding Member is not for sale yet)
- **Photos / camera:** Optional, stays on device
- **Notifications:** Optional local reminders
- **Government / news / COVID:** No

### 9. Internal testing track

1. Go to **Testing → Internal testing**
2. Create a release
3. Upload the `.aab` from step 3
4. Add testers by email (your Gmail, plus anyone you trust)
5. Save and send the tester link to those people
6. Testers open the link on their Android phone, accept, then install from Play

Internal testing is a closed list. It is not the public store yet.

### 10. Try it on a real phone

Install from the tester link, not Expo Go. Walk through:

- Choose a monster
- Finish one chore
- Open the shop
- Confirm there is **no Tune tab**
- Confirm Founding Member still says **Coming soon**
- Leave the purchase flag alone — do not turn it on

---

## What to wait on

Do not turn on `FOUNDING_MEMBER_PURCHASE_ENABLED`.
Do not add a price in Play Console until real billing is built.
Do not submit to production review until you have lived with the internal test for a bit.
