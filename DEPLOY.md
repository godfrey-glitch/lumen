# 🚀 Lumen — Complete Deployment Guide
## Version 3 — Full Stack: Vercel + Firebase + AI + Email + Admin

---

## 📁 Full Project Structure

```
lumen2/
├── api/
│   ├── chat.js       ← AI (Groq → Gemini → Anthropic fallback)
│   ├── auth.js       ← Firebase token verifier
│   ├── email.js      ← Email notifications (Resend)
│   ├── share.js      ← Shareable decision links
│   └── admin.js      ← Secure admin API
├── public/
│   ├── index.html    ← Marketing landing page
│   ├── login.html    ← Sign in / Create account / Google auth
│   ├── app.html      ← Main app (mobile + desktop)
│   ├── dashboard.html← Decision patterns & charts
│   ├── profile.html  ← User profile & settings
│   ├── share.html    ← Public shareable summary page
│   └── admin.html    ← Admin panel (protected)
├── vercel.json       ← Routing config
└── package.json
```

---

## STEP 1 — Firebase Setup

### 1a. Create project
- https://console.firebase.google.com → Add project → name: `lumen-app`
- Disable Analytics → Create

### 1b. Enable Authentication
- Authentication → Get started
- Enable: **Email/Password** and **Google**

### 1c. Create Firestore Database
- Firestore → Create database → Production mode
- Pick region closest to your users (e.g. `europe-west1`)

### 1d. Firestore Security Rules
Firestore → Rules tab → paste exactly:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /decisions/{docId} {
      allow read, write: if request.auth != null
        && request.auth.uid == resource.data.uid;
      allow create: if request.auth != null
        && request.auth.uid == request.resource.data.uid;
    }

    match /shares/{shareId} {
      allow read: if true;
      allow create: if request.auth != null;
    }
  }
}
```

Click **Publish**.

### 1e. Get your Firebase config
Project Settings (gear icon) → General → Your apps → Web icon → Register app as `lumen-web` → copy the `firebaseConfig` object.

### 1f. Paste Firebase config into these 5 files
Each file has a clearly marked section at the top:
- `public/login.html`
- `public/app.html`
- `public/dashboard.html`
- `public/profile.html`
- `public/admin.html`

---

## STEP 2 — Get Your Admin UID

1. Sign in to your app at `/login.html`
2. Open browser DevTools → Console → type:

```js
firebase.auth().currentUser.uid
```

Or: Firebase Console → Authentication → Users → copy your UID from the table.

3. Paste your UID into `public/admin.html` in the `ADMIN_UIDS` array:

```js
const ADMIN_UIDS = ['paste-your-uid-here'];
```

4. Save the `ADMIN_UIDS` env var in Vercel too (same UID, comma-separated for multiple admins).

---

## STEP 3 — Set up Resend (Email)

1. https://resend.com → Create account (free tier: 3,000 emails/month)
2. Add your domain OR use their sandbox domain for testing
3. Create an API Key → copy it
4. Update `from` address in `api/email.js`:
   ```js
   from: 'Lumen <hello@yourdomain.com>'
   ```

---

## STEP 4 — Get All API Keys

| Key | Where |
|-----|-------|
| `GROQ_API_KEY` | https://console.groq.com → API Keys |
| `GEMINI_API_KEY` | https://aistudio.google.com → Get API Key |
| `ANTHROPIC_API_KEY` | https://console.anthropic.com → API Keys |
| `FIREBASE_WEB_API_KEY` | Firebase → Project Settings → `apiKey` field |
| `FIREBASE_PROJECT_ID` | Firebase → Project Settings → Project ID |
| `RESEND_API_KEY` | https://resend.com → API Keys |
| `ADMIN_UIDS` | Your Firebase UID (step 2 above) |

---

## STEP 5 — Push to GitHub

Open terminal in your `lumen2/` folder:

```bash
git init
git add .
git commit -m "Lumen v3 — complete app"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/lumen-app.git
git push -u origin main
```

---

## STEP 6 — Deploy to Vercel

1. Go to https://vercel.com → **Add New Project**
2. Import your `lumen-app` GitHub repo
3. Leave all build settings as-is (vercel.json handles it)
4. Click **Deploy** (it will fail without env vars — that's expected)

---

## STEP 7 — Add Environment Variables

Vercel Dashboard → your project → **Settings** → **Environment Variables**

Add ALL of these:

| Name | Value | Environments |
|------|-------|-------------|
| `GROQ_API_KEY` | your Groq key | ✅ All |
| `GEMINI_API_KEY` | your Gemini key | ✅ All |
| `ANTHROPIC_API_KEY` | your Anthropic key | ✅ All |
| `FIREBASE_WEB_API_KEY` | your Firebase web API key | ✅ All |
| `FIREBASE_PROJECT_ID` | your Firebase project ID | ✅ All |
| `RESEND_API_KEY` | your Resend key | ✅ All |
| `ADMIN_UIDS` | your Firebase UID | ✅ All |

Then: **Deployments** → three dots on latest deploy → **Redeploy**

---

## STEP 8 — You're Live! 🎉

| Page | URL | Who can access |
|------|-----|----------------|
| Landing | `your-app.vercel.app/` | Everyone |
| Login | `your-app.vercel.app/login.html` | Everyone |
| App | `your-app.vercel.app/app.html` | Signed-in users |
| Dashboard | `your-app.vercel.app/dashboard.html` | Signed-in users |
| Profile | `your-app.vercel.app/profile.html` | Signed-in users |
| Share | `your-app.vercel.app/share.html?id=xxx` | Everyone (public) |
| Admin | `your-app.vercel.app/admin.html` | Admin UIDs only |

---

## Custom Domain (Optional)

Vercel → Project → **Settings** → **Domains** → Add your domain (e.g. `uselumen.com`)
Follow the DNS instructions. Takes ~5 minutes to propagate.

---

## Admin Panel Features

Access: `your-app.vercel.app/admin.html`

- 📊 **Dashboard** — KPIs, 14-day decision chart, emotion/framework breakdowns, ratings chart
- 👥 **Users** — All users from Firestore, searchable, with decision counts and patterns
- 💭 **Decisions** — All decisions, searchable, filterable, with delete action
- 📧 **Broadcast Email** — Send to any list of users via Resend, with live preview
- ⚙️ **Settings** — Your admin UID, env variable checklist, quick links

Security: Admin panel checks your Firebase UID client-side AND server-side. Non-admins see "Access Denied".

---

## Mobile Experience

All pages are fully responsive:
- **Phone**: bottom navigation bar with 5 tabs (Home, Decisions, Decide, Insights, Profile)
- **Tablet**: condensed sidebar nav
- **Desktop**: full sidebar + expanded layout

Safe area insets supported for iPhone notch/home bar.

---

## AI Fallback Chain

```
Request → Groq llama-3.3-70b  (fastest, free tier)
        ↓ fails
        Gemini 1.5-flash       (reliable fallback)
        ↓ fails
        Claude Sonnet 4        (final fallback)
        ↓ all fail
        Friendly error message to user
```

---

## Updating the App

```bash
git add .
git commit -m "describe your change"
git push
```

Vercel auto-deploys every push to `main`. Takes ~30 seconds. ✅

---

## Quick Troubleshooting

| Problem | Fix |
|---------|-----|
| App shows blank page | Check Firebase config is pasted correctly in all 5 files |
| AI doesn't respond | Check `GROQ_API_KEY` is set in Vercel env vars |
| Emails not sending | Check `RESEND_API_KEY` and `from` domain in `api/email.js` |
| Admin says "Access Denied" | Make sure your UID is in both `admin.html` AND `ADMIN_UIDS` env var |
| Share links 404 | Check `FIREBASE_PROJECT_ID` env var is set |
| Login fails | Check Firebase Auth has Email/Password and Google enabled |
