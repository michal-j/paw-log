# PawLog

A health timeline for our dog: what she ate, which medication she got, symptoms and vet events, day by day. Two household users, iPhone first, English and Polish. Delivered as a PWA (add to home screen) with a shared cloud database.

You are working inside a multi-agent setup. Read `docs/AGENTS.md` first to see which role you are, then the document for that role.

## Read in this order
1. `docs/AGENTS.md`: roles, hand-offs, rules for every agent.
2. `docs/PRODUCT.md`: what the app is, requirements, sample data, decisions so far.
3. `docs/DESIGN.md` and `docs/design-system/`: the look, the tokens, the components. The README there is binding.
4. `docs/ENGINEERING.md`: proposed stack, data model draft, build slices, conventions.
5. `docs/DECISIONS.md`: what is decided. What is open, next or waiting on the CEO lives in Linear (latest project update). Check both before asking the CEO anything.

## This repo is PUBLIC (a showcase)
- Never commit real data about the household or the dog: no real medication, food or clinic names, vet notes, photos, PDFs, dates of real visits, keys or URLs of the real Supabase project. Sample data in docs, prototype and tests is fictional.
- Real data lives only in Supabase. Secrets live in environment variables (Vercel, local `.env` that is git-ignored). The anon key may be public; the service key never.
- The app has a **demo mode** (see `docs/ENGINEERING.md`): fictional frozen data, fully client-side, changes kept in the visitor's `localStorage`, no sign-in, no backend calls.

## Ground rules (all agents)
- The CEO (Michał) decides product and look. The PM agent is his single point of contact. Other agents report to the PM, not to him, unless he opens a thread with you directly.
- No unauthorised access: never touch accounts, services, credentials or data outside this repo and the services the CEO has explicitly connected for this project. Confirm with the CEO before using any new one.
- Little autonomy: do the task you were given, report, stop. No scope creep, no surprise refactors, no deleting data.
- Quality over quantity. Short explanations. Ask a clarifying question before a long answer when the request is ambiguous.
- Every user-facing string exists in EN and PL (`docs/copy/pawlog-copy-en-pl.csv` is the reviewed source). Polish runs about 20% longer; check fit.
- Never hard-code a colour, radius or shadow: use design tokens from `docs/design-system/tokens.json`.
- Track work in Linear (team JCBK, project "PawLog"). One issue per unit of work; update status as you go.
