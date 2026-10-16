# Runbook: set up the real Supabase backend (JCB-35)

For the CEO. Takes about 30 minutes. Nothing here has been done yet: the code is ready, the project does not exist.
Run the steps in order. Do not paste real names, e-mails, passwords, keys or URLs into the repo, into Linear or into chat with agents; they belong only in Supabase and Vercel.

What you end up with: a Supabase project in the EU, two accounts (yours and the other household member's), no way for anyone else to sign up, the database schema with row-level security, your household, dog and starting items, and Vercel serving the real app at the production URL (the demo stays at `/demo`).

## 1. Create the project
1. Sign in at supabase.com (create an organisation if asked; the free plan is enough).
2. New project: name `pawlog`, a strong database password (keep it in your password manager; the app never needs it), region **Central EU (Frankfurt)** or another EU region, plan **Free**.
3. Wait until the project is ready.

Note: free projects pause after about a week with no requests. Daily logging keeps it awake; if it does pause, "Restore" in the dashboard brings it back with the data intact.

## 2. Turn off sign-ups, keep e-mail + password
Authentication > Sign In / Providers (the names differ slightly between dashboard versions):
1. **Allow new users to sign up: off.** Only the two accounts you create in step 3 can ever sign in.
2. Email provider: **enabled** (this is what allows e-mail + password). "Confirm email" can stay on: accounts you create by hand are confirmed already.
3. Minimum password length: **12** or more.
4. Leave every other provider (Google, Apple, phone, anonymous, magic link) off.

PawLog never sends e-mails (no codes, no links, no reset mails), so no e-mail template or SMTP setup is needed.

## 3. Create the two accounts
Authentication > Users > Add user > **Create new user**, once per person:
- E-mail: the person's address.
- Password: a long password (12+ characters; a password manager can generate one). Give it to the person privately, not by chat with an agent.
- **Auto Confirm User: on.**

On the iPhone, after the first sign-in Safari / Keychain offers to save the password, so it fills in next time.

### Resetting a forgotten password
There is no reset in the app (the sign-in screen says to ask you). Either:
- Authentication > Users > the user > **Edit / Update user** (if your dashboard version offers it) and set a new password; or
- SQL Editor, run (fill in, run once, do not save the query):
  ```sql
  update auth.users
  set encrypted_password = extensions.crypt('<NEW PASSWORD>', extensions.gen_salt('bf'))
  where email = '<EMAIL>';
  ```
  It should say "1 row affected". Other devices of that person stay signed in until they sign out.

To remove someone's access: Authentication > Users > the user > Delete user (their logged data stays; it belongs to the household).

## 4. Create the database schema
SQL Editor > New query. Paste and run each file from `supabase/migrations/` **in filename order**, one at a time:
1. `20261016120000_core_schema.sql` (tables)
2. `20261016120100_row_level_security.sql` (who may see and change what)

Each should end with "Success. No rows returned". If one fails, stop and send the error text (it contains no personal data) to the PM.

Check: Table Editor shows `household`, `member`, `dog`, `item`, `schedule_slot`, `entry`, `event`, each marked "RLS enabled". Database > Advisors > Security Advisor shows no errors for these tables.

(Developers with the Supabase CLI can use `npx supabase link` and `npx supabase db push` instead; same files.)

## 5. Add your household, dog and starting items
1. Open `supabase/bootstrap.example.sql` in the repo and copy all of it into a new SQL Editor query. Do not save a filled-in copy in the repo.
2. Replace every `<PLACEHOLDER>`: household name, dog name, the two e-mails from step 3, the first day you want to log, and the item rows (food, medication, treats). The comments list the allowed kinds, colours and day parts. Delete item rows you do not need, copy a row for more.
3. Run it. You should see "Created household …, dog …, 2 members, N items, N schedule slots".
   - "Fill in every <PLACEHOLDER>": something is still in angle brackets.
   - "Expected 2 members but found 1": an e-mail does not match a user from step 3 exactly.
   Either error means nothing was saved; fix and run again. Run it successfully only once.

Items and the plan (schedule slots, doses) can be changed later in the Table Editor until the app has screens for it.

## 6. Connect Vercel
1. Supabase: Project Settings > API (or "API Keys"). Copy the **Project URL** and the **anon public** key (newer dashboards call it the **publishable** key, `sb_publishable_…`). Never copy the `service_role` or **secret** key anywhere; the app does not need it.
2. Vercel > the PawLog project > Settings > Environment Variables, for Production (and Preview if you want previews to use real data):
   - `VITE_SUPABASE_URL` = the Project URL
   - `VITE_SUPABASE_ANON_KEY` = the anon / publishable key
   - make sure `VITE_DEMO_MODE` is **not** set to `true` for Production.
3. Redeploy (Deployments > … > Redeploy). Environment variables are baked in at build time.

Without these variables the production URL shows "PawLog is not connected" with a link to the demo, instead of crashing.

## 7. First sign-in
1. On the iPhone, open the production URL in Safari, Share > Add to Home Screen, open PawLog from the home screen.
2. Enter the e-mail and password from step 3, tap "Sign in" (let Keychain save the password). You land on the timeline.
3. Repeat on the other person's phone.

The session is stored on the device and refreshed automatically, so you stay signed in after closing the app. "Sign out" in the top bar signs out only that device.

## Troubleshooting
| Symptom | Cause and fix |
|---|---|
| "Wrong e-mail or password." | The address is not in Authentication > Users (step 3), has a typo, or the password is wrong. Reset it (step 3). |
| "Too many tries. Wait a minute…" | Supabase rate limit on sign-in attempts. Wait a few minutes. |
| "This account is not linked to a dog yet." | The bootstrap (step 5) did not run, or used a different e-mail. Check `member` in the Table Editor. |
| "PawLog is not connected" on the production URL | Vercel variables missing or a redeploy is needed (step 6). |
| Empty timeline after sign-in | No entries logged yet, or the device is offline. |

## How the security works (for reference)
- Every table has row-level security. A signed-in user can read and write only rows of a household they are a member of; signed-out visitors can read nothing. Households, members and dogs are read-only from the app; only the SQL Editor (step 5) creates them.
- Proven by `supabase/tests/database/rls.test.sql` (48 checks), run locally with `npm run test:db`.
- The anon / publishable key in the app is public by design; the database rules above, sign-ups being off and strong passwords are what protect the data.
