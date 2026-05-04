# Project Rules

## Pull requests — always use `/stacked-git-workflow`

When creating, updating, or pushing a PR, **strictly follow the `/stacked-git-workflow` skill** so the Graphite CLI (`gt`) is used end-to-end.

- ✅ `git add` to stage
- ✅ `gt create` for new PRs
- ✅ `gt modify` to update an existing PR (never `git commit --amend`)
- ✅ `gt submit` / `gt submit --stack` to push (never `git push` directly)
- ✅ `gt sync` before starting new work

If `gt submit` fails, surface the error and stop — do not fall back to raw `git push` without explicit user approval.
