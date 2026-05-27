# Publish Darshan's Calorie Tracker (free, with Google login + cloud sync)

This makes the tracker a real website people can visit, with **Sign in with Google** and data
that **syncs across devices**. The stack is all free-tier:

- **GitHub Pages** — hosts the page and gives you a free URL like `https://<you>.github.io/<repo>/`
- **Firebase** (Google) — handles Google login (Auth) + the cloud database (Firestore)

The app already works in **guest mode** before any of this. Cloud sync turns on once you paste
your Firebase config (Part A) and publish (Part C).

Total time: ~20 minutes. You'll do three parts.

---

## Part A — Create a free Firebase project (login + database)

1. Go to https://console.firebase.google.com and click **Add project**. Give it a name
   (e.g. `darshan-calorie-tracker`). You can skip Google Analytics. Click **Create project**.

2. **Enable Google sign-in:**
   - Left menu → **Build → Authentication → Get started**.
   - Open the **Sign-in method** tab → click **Google** → toggle **Enable** → pick a support
     email → **Save**.

3. **Create the database:**
   - Left menu → **Build → Firestore Database → Create database**.
   - Choose **Start in production mode** → pick a location near you → **Enable**.

4. **Set security rules** so each person only sees their own data:
   - In Firestore → **Rules** tab, replace everything with the block below and click **Publish**:
     ```
     rules_version = '2';
     service cloud.firestore {
       match /databases/{database}/documents {
         match /users/{uid}/{document=**} {
           allow read, write: if request.auth != null && request.auth.uid == uid;
         }
       }
     }
     ```

5. **Get your config:**
   - Click the gear icon (top-left) → **Project settings**.
   - Scroll to **Your apps** → click the **Web** icon `</>` → register an app (any nickname,
     you do NOT need "Firebase Hosting").
   - It shows a `firebaseConfig = { ... }` object. Keep this open for the next step.

## Part B — Paste the config into the file

> NOTE: `index.html` is now the marketing **landing page**. The actual tracker app
> lives in **`app.html`**, so the Firebase config goes there.

1. Open `app.html` in a text editor (Notepad/TextEdit/VS Code).
2. Near the top of the `<script>` section, find:
   ```js
   const firebaseConfig = {
     apiKey: "PASTE_YOUR_API_KEY",
     ...
   };
   ```
3. Replace the whole object with the one from Firebase (the real values). Save the file.

> Note: these Firebase web keys are **safe to publish** — they're meant to be in client code.
> Your data is protected by the security rules in Part A4, not by hiding the keys.

## Part C — Publish on GitHub Pages

1. Create a free account at https://github.com if you don't have one. Your username becomes part
   of the URL.
2. Click **+ → New repository**. Name it something clean — this becomes your web address:
   - Repo name `darshans-calorie-tracker` → site at
     `https://<username>.github.io/darshans-calorie-tracker/`
   - (Tip: if you name the repo exactly `<username>.github.io`, the site lives at the root
     `https://<username>.github.io/`.)
   - Set it **Public** → **Create repository**.
3. On the new repo page, click **uploading an existing file** and drag in your site files —
   **`index.html`** (landing page), **`app.html`** (the tracker), **`calorie-tracker.html`**,
   and **`CNAME`**. Click **Commit changes**.
4. Go to repo **Settings → Pages**. Under **Build and deployment → Source** pick
   **Deploy from a branch**, branch **main**, folder **/ (root)** → **Save**.
5. Wait ~1 minute, refresh the Pages settings page — it shows your live URL. That's your site. 🎉

## Part D — Tell Firebase your site is allowed

Google login will be blocked on a new domain until you authorize it:

1. Firebase Console → **Authentication → Settings → Authorized domains → Add domain**.
2. Add your GitHub Pages domain: `<username>.github.io`
   (the `github.io` host, not the full path).
3. Save. Now open your live URL and **Sign in with Google** will work, with data syncing per account.

---

## Naming ideas (free `.github.io` URL)

The repo name is your URL, so pick one that reads well:

- `darshans-calorie-tracker` → `<you>.github.io/darshans-calorie-tracker/`
- `kcal-by-darshan`
- `plate-tracker`
- `macromate`
- `fuel-log`

Want a custom domain later (e.g. `darshanscalories.com`)? Buy one (~$10-15/yr), then in repo
**Settings → Pages → Custom domain** add it, and add that domain to Firebase Authorized domains too.

## How data works now

- **Signed in with Google:** meals, goals, and macros are stored in Firestore under your account
  and sync to any device where you sign in. Each user only sees their own data.
- **Guest mode:** still available; data stays in that one browser only.
- **Export / Import** buttons remain as a manual backup option.

## Costs

GitHub Pages and the Firebase **Spark (free) plan** cover personal and small-scale use at no cost
(Firestore free tier ≈ 50k reads & 20k writes per day, 1 GiB storage). You only pay if usage grows
well beyond that, and Firebase won't charge unless you explicitly upgrade to a paid plan.

## Troubleshooting

- **"auth/unauthorized-domain"** → finish Part D (add your domain in Firebase).
- **Login popup blocked** → allow popups for your site, or try again.
- **Nothing saves / "Missing or insufficient permissions"** → re-check the Firestore rules in Part A4.
- **Page is blank / config error** → make sure you pasted the full `firebaseConfig` and saved.
