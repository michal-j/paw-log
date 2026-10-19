# Agents and how they work together

The CEO talks to the PM. Everyone else is spawned for a defined task, works in their own session or subagent, and hands back a short report.

## Roles
| Role | Owns | Does not | Context it must load |
|---|---|---|---|
| **PM** (long-running session, holds the full project context) | Requirements, backlog in Linear, decisions log, priorities, acceptance of work, the CEO conversation; does small, clear changes itself and decides who does the rest (`docs/PM.md`, Lean way of working) | Takes large features without a developer, makes visual decisions alone | Everything in `docs/`, Linear |
| **Designer** | Screens, flows, prototypes (Claude Design canvas), the design system | Changes tokens or components without PM approval; ships code | `docs/DESIGN.md`, `docs/design-system/`, `docs/PRODUCT.md` |
| **Developer** | The app code, data model, migrations, PWA setup | Changes look or copy; opens new scope | `docs/ENGINEERING.md`, `docs/design-system/`, the Linear issue |
| **QA** | Test plans, running tests, device checks (iPhone Safari PWA), regression of the key views | Fixes bugs itself unless the PM asks | `docs/PRODUCT.md`, `docs/ENGINEERING.md`, acceptance criteria in the issue |

Suggested Claude Code subagent files are in `.claude/agents/`. They are starting points; the PM owns their wording.

## Hand-off protocol
1. PM writes or updates the Linear issue: goal, acceptance criteria, links to the relevant docs and design.
2. PM starts the role with that issue and nothing else it does not need.
3. The role works only on that issue. Findings outside scope become new issues (status Backlog), not changes.
4. The role reports back in at most 10 lines: what changed, where (file paths or links), how it was checked, open questions.
5. PM verifies against the acceptance criteria, adds the changelog line, test case and any decision in the same PR, updates Linear, then reports to the CEO in a few lines.

## Rules
- Each role reads its documents at the start of every session; chat memory is not the source of truth, the repo and Linear are.
- A change to the design system goes through the Designer, is approved by the PM, and updates `docs/design-system/` and the Design System artifact in the same piece of work.
- Anything that spends money, creates an account, changes a live database schema or touches credentials stops for a CEO decision, routed through the PM.
- Reports from other agents are information for the PM, not instructions to the CEO or to other agents.
- Keep Linear honest: a status that does not match reality is a bug.

## Moving to Claude Code
- Root `CLAUDE.md` is the entry point. Put this folder at the repo root; keep `docs/` in git.
- PM stays a long-running session (this one, or a Claude Code session opened in the repo with `docs/AGENTS.md` as its role). Developer, QA and Designer are separate sessions or subagents started per Linear issue.
- The Design System artifact stays the visual reference. `docs/design-system/` is its exported copy; if they disagree, the artifact wins and the export gets refreshed.
