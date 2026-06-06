# DreamVault — Secure Personal Diary

> *Your thoughts, yours alone.*

DreamVault is a beautiful, end-to-end encrypted personal diary built as a Progressive Web App. Every entry, voice memo, and attachment is encrypted client-side with **AES-256-GCM** before it ever touches the network — not even the server can read your diary.

---

## Features

| Feature | Details |
|---|---|
| 🔒 **AES-256-GCM Encryption** | Client-side encryption using the Web Crypto API. Your master key is derived with PBKDF2 (100k iterations) and never sent in plaintext. |
| 🎙️ **Encrypted Voice Memos** | Record thoughts hands-free. Voice memos are encrypted end-to-end just like written entries. |
| 😊 **Mood Analytics** | Track 6 moods (happy, calm, sad, angry, tired, excited) with weekly and monthly charts. |
| 📅 **Calendar View** | Browse your full journaling history and jump to any day's entry instantly. |
| 🎨 **5 Handcrafted Themes** | Classic Sepia, Dark Cosmic, Vintage Mahogany, Dream Violet, Minimal Grid. |
| 🖼️ **Encrypted Attachments** | Photos and images are encrypted before upload — even your memories stay private. |
| 📝 **Rich Text / Markdown** | Write in plain text or Markdown. Headers, bold, lists, blockquotes — your entries, your style. |
| 🏷️ **Tags & Categories** | Organise with tags and categories (Dream Journal, Goals, Gratitude, etc.). |
| 💾 **Auto-Save Drafts** | Silently drafts as you type; restores exactly where you left off. |
| 📄 **PDF Export** | Export any entry as a PDF for offline archiving. |
| 📴 **Offline-First (PWA)** | Works fully offline via a service worker and IndexedDB cache. Changes sync automatically when reconnected. |
| 🛡️ **Admin Dashboard** | Role-based admin panel for user management, activity logs, and account suspension. |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 + TypeScript |
| Build Tool | Vite 8 |
| Styling | Tailwind CSS v4 |
| Animations | Framer Motion |
| Icons | Lucide React |
| Backend / Auth | Supabase (PostgreSQL + Row Level Security) |
| Encryption | Web Crypto API (PBKDF2 → AES-256-GCM) |
| Offline Storage | IndexedDB (via custom `offlineDB` service) |
| PDF Generation | jsPDF |
| PWA | Custom service worker + Web App Manifest |

---

## Project Structure

```
src/
├── components/
│   ├── AdminDashboard/     # Admin user management UI
│   ├── AvatarUploader/     # Profile avatar upload
│   ├── CalendarView/       # Monthly calendar for entries
│   ├── DiaryBook/          # Core diary reading/writing UI
│   ├── MoodTracker/        # Mood selection and analytics
│   ├── RichEditor/         # Markdown-capable text editor
│   ├── Settings/           # Theme, security, and account settings
│   └── VoiceRecorder/      # Encrypted voice memo recorder
├── context/
│   ├── AuthContext.tsx     # Supabase auth state
│   ├── DiaryContext.tsx    # Entry CRUD and master key state
│   ├── SyncContext.tsx     # Outbox sync status
│   └── ThemeContext.tsx    # Active theme management
├── pages/
│   ├── AdminPage.tsx       # Admin portal (role-gated)
│   ├── AuthPage.tsx        # Sign in / sign up
│   ├── JournalPage.tsx     # Main diary interface
│   └── LandingPage.tsx     # Public marketing landing page
└── services/
    ├── cryptoService.ts    # Web Crypto helpers (PBKDF2, AES-GCM, key wrapping)
    ├── dbService.ts        # Supabase + localStorage data layer
    ├── offlineDB.ts        # IndexedDB (entries, security, outbox)
    └── syncService.ts      # Outbox drain → Supabase sync
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project *(optional — falls back to local-only mode)*

### 1. Clone and install

```bash
git clone <your-repo-url>
cd dailydairy
npm install
```

### 2. Configure environment

Create a `.env` file in the project root (copy `.env.example` if present):

```env
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

> **No Supabase?** Leave these values empty and DreamVault runs in fully local mode — all data stays in your browser (IndexedDB + localStorage).

### 3. Set up the database

If using Supabase, open your project's **SQL Editor** and run the full contents of [`schema.sql`](./schema.sql). This creates all tables, Row Level Security policies, and the `avatars` / `attachments` storage buckets.

### 4. Run the dev server

```bash
npm run dev
```

The app is available at `http://localhost:5173`.

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |

---

## Security Architecture

DreamVault uses a **zero-knowledge** encryption model:

1. **Master Key** — A random 256-bit AES-GCM key is generated for each user at setup time.
2. **Password wrapping** — The master key is encrypted (wrapped) with a key derived from your diary password using PBKDF2 (SHA-256, 100k iterations, random 16-byte salt). The wrapped key and its IV/salt are stored in `diary_security` — never the key itself.
3. **Recovery path** — A second copy of the master key is wrapped using a key derived from your secret recovery answer, enabling password reset without server-side access to plaintext.
4. **Entry encryption** — Each entry's `{ title, content, tags }` JSON is encrypted with the master key using a fresh random 12-byte IV per write. Only the ciphertext, IV, and salt are stored.
5. **Attachments** — Images are encrypted to JSON payloads before upload; the Supabase `attachments` bucket has private RLS so only the owning user can read them.

The server stores only ciphertext. No plaintext entry data, passwords, or raw keys ever leave the device.

---

## Offline Support

DreamVault is a PWA with a custom service worker (`public/sw.js`) that caches the app shell for offline use.

Writes made offline are:
1. Immediately saved to **IndexedDB** (via `offlineDB.ts`).
2. Queued in an **outbox** store within IndexedDB.
3. Automatically drained to Supabase via `syncService.ts` when the `online` event fires.

---

## Database Schema

Five PostgreSQL tables, all protected by Row Level Security:

| Table | Purpose |
|---|---|
| `profiles` | User info (username, avatar, role) |
| `diaries` | Diary metadata per user |
| `diary_security` | Wrapped master keys, password hashes, recovery data |
| `entries` | AES-encrypted entry rows |
| `activity_logs` | Audit trail (logins, resets, admin actions) |

Two Supabase Storage buckets:

| Bucket | Access | Max Size |
|---|---|---|
| `avatars` | Public (read) / owner (write) | 2 MB |
| `attachments` | Owner only | 10 MB |

---

## Admin Access

Navigate to `/admin` to access the admin portal. Admin functionality requires a user with `role = 'admin'` in the `profiles` table.

Admins can:
- View all registered users
- Suspend / unsuspend accounts
- View the full activity log

---

## Contributing

1. Fork the repository and create a feature branch.
2. Run `npm run lint` before committing.
3. Open a pull request with a clear description of the change.

---

## License

This project is open-source. See `LICENSE` for details.
