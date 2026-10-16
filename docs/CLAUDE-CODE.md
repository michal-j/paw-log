# Running PawLog in Claude Code

**Quick start:** open this folder in Claude Code and type `/pm`. The PM session runs Linear, reviews and the Developer, QA and Designer subagents itself. See `docs/PM.md`. The sections below are the manual fallback.

PawLog is built by several agents. The **PM** is a Claude chat (planning, Linear, reviews, design). The **Developer** and **QA** run as Claude Code sessions opened on this folder. Linear, GitHub and `docs/` carry the context between them; no agent relies on another's chat history.

## Setup (once)
1. Open the Claude desktop app, choose Code, and open the folder `~/Documents/Projects/paw-log`.
2. In a terminal inside the folder, check the remote and node:

```
git remote -v
```

```
node --version
```

Remote must be `https://github.com/michal-j/paw-log`; Node 20 or newer.
3. Make sure the Linear connector is available in Claude Code so the Developer can read its issue and update status. Never paste keys into chat; secrets go in a local `.env` (git-ignored).

## Starting the Developer on an issue
Open a new Claude Code session in this folder and paste:

> You are the Developer on PawLog. Read CLAUDE.md and docs/AGENTS.md, then work on Linear issue JCB-28 only. Follow its acceptance criteria, work on a branch named after the issue, open a pull request to main, and finish with a report of at most 10 lines (what changed, paths, how you checked, PR link, open questions). Do not create Vercel or Supabase resources and do not touch real data.

Replace JCB-28 with the issue number. The agent definition is in `.claude/agents/developer.md`.

## Starting QA
Same, with `You are QA on PawLog`, the issue number, and `.claude/agents/qa.md`. QA reports findings and does not fix them.

## After a session
Tell the PM in the chat that the issue is ready for review. The PM reads the pull request, checks it against the acceptance criteria, updates Linear and `docs/DECISIONS.md`, and gives you the next prompt.

## Rules that never change
- The repo is public: no real data, names, photos or keys in commits.
- One issue per session, one branch per issue, pull request into main, no direct pushes to main.
- Demo mode is the default until Supabase exists. Real data lives only in Supabase.
- Ask the PM (in chat) before creating any account, service or project not already listed in `docs/DECISIONS.md`.

## Decisions already made for slice 1
Default to demo mode; extra strings outside the reviewed CSV allowed if flagged unreviewed; generated tokens and i18n catalogues are committed; follow the CSV where Polish differs from the prototype; hand-written service worker; `vercel.json` SPA rewrite so `/demo` works. Vercel project `paw-log` already exists and is linked to the repo (builds on push); Supabase is not created yet.
