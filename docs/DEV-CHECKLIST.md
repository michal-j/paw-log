# Developer checklist (run before handing back a PR)

Briefs from the PM point here instead of repeating setup. Do all of it unless the brief says otherwise.

## Setup
- Own git worktree; branch from up-to-date `origin/main`, named after the Linear issue.
- `npm ci --cache <scratchpad>/npm-cache` (the global npm cache has permission errors on this machine).
- Dev server on the port given in the brief, never 5173.
- Never connect to the production Supabase project, real accounts, or Supabase/Vercel MCP tools. Fictional data only.

## Before handing back
1. `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:db`, `npm run build`, `npm run check:secrets` all pass.
2. Test the **real path** in the harness (`/harness.html`, see `tests/harness/`), not only `/demo`.
3. 390x844 first, then 768 and desktop; EN and PL (Polish runs ~20% longer); no horizontal scroll; touch targets ≥ 44px; tokens only.
4. Short log (a few days) and long log (a year+) if the Timeline is involved.
5. New user-facing strings: draft EN/PL in a `docs/copy/copy-proposal-*.csv`; never invent copy silently.
6. Database changes: a **new** migration file; never edit an applied one. RLS on every new table, and explicit grants in the same migration (`revoke all … from anon, authenticated;` then `grant select, insert, update, delete … to authenticated;`): Supabase no longer grants new tables to the API on its own. Extend `supabase/tests/database/rls.test.sql`.
7. Merge `origin/main` into your branch right before pushing, so the PR is mergeable.
8. Close browser tabs and stop your dev server.

## Do not
- Edit `CHANGELOG.md` or `docs/TEST-CASES.md`. Put the changelog line and any new test cases in the PR description; the PM adds them at merge (this avoids merge conflicts between parallel PRs).
- `git add -A` (the folder is iCloud-synced and can contain "* 2" copies). Stage explicit paths.
- Commit to `main`, merge your own PR, or change scope.

## Git
- Push: `git -c credential.helper= -c credential.helper='!gh auth git-credential' push -u origin HEAD`
- PR: `gh pr create --repo michal-j/paw-log --head <branch> --base main`; body ends with the Claude Code line.

## Report (≤ 5 lines)
PR URL, root cause (for bugs), what changed, what you checked, open questions.
