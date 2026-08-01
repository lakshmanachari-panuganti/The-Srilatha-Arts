# Setup

Steps 1–4 must be finished before any agent runs. The workflow is not safe
without them — the markdown is explanation; the rulesets are the control.

---

## 1. Before making anything public

A public repo exposes its **entire history**, not just current files. A
connection string committed a year ago and deleted since is still in the log,
and public repos are scraped continuously for exactly that.

```bash
docker run --rm -v "$PWD:/repo" zricethezav/gitleaks:latest detect --source /repo -v
```

Rotate anything it finds. Deleting the file now does not help — the commit
remains.

---

## 2. Three identities

| Identity | Role | Access |
|----------|------|--------|
| `lakshmanachari-panuganti` | You — approve and merge to `main` | Owner |
| Developer Agent | Pushes, opens PRs, merges to `develop` | GitHub App or machine account |
| `devilsadvocate-reviewer` | Reviews, approves | Collaborator |

**Your own token must never be an agent token.** It carries admin rights: an
agent holding it could delete the rulesets, reach `main`, and act under your
name. No setting prevents this — GitHub cannot distinguish you from a script
holding your credentials.

For the Developer Agent, a **GitHub App** is cleanest: it is not an account, so
GitHub's one-machine-account limit does not apply, and it shows as a bot in the
log. Its installation tokens expire hourly, so mint them per run with
`actions/create-github-app-token@v2` rather than storing one as a secret.

### Token permissions

Fine-grained tokens, scoped to this repository only. Never classic PATs —
`repo` scope includes administration, which would let an agent delete the checks
watching it.

| Token | Permissions | Deliberately withheld |
|-------|-------------|----------------------|
| Developer | Contents: Read and write, Pull requests: Read and write, Metadata: Read | Administration |
| Reviewer | Pull requests: Read and write, Contents: **Read**, Metadata: Read | Administration, Contents: write |

The reviewer's read-only Contents is not a formality. It is what makes "a prompt
injection against the reviewer cannot alter code" true rather than hoped for.

---

## 3. Claude authentication

No API key needed — a Pro subscription works:

```bash
claude setup-token
```

A browser opens, you log in, a long-lived token prints. Store it as a repo
secret.

> **Watch this space.** In May 2026 Anthropic announced that programmatic usage
> (`claude -p`, Agent SDK, Claude Code GitHub Actions) would move to a separate
> metered credit pool from June 15. On June 15 the change was cancelled, and
> those surfaces still draw from subscription limits. Anthropic said it is
> reworking the plan and will give notice first. Keep the auth swap a one-liner.

### Secrets

**Settings → Secrets and variables → Actions**, or `gh secret set NAME`. A shell
variable on your own machine is not visible to a GitHub runner.

| Secret | Value |
|--------|-------|
| `CLAUDE_CODE_OAUTH_TOKEN` | From `claude setup-token` |
| `GITHUB_DEVELOPER_TOKEN` | Developer identity token |
| `GITHUB_REVIEWER_TOKEN` | Reviewer account token |

---

## 4. Branches, rulesets, CODEOWNERS

```bash
git checkout -b develop main && git push -u origin develop
git checkout -b ai-driven1 develop && git push -u origin ai-driven1
gh label create needs-human --color B60205 --description "Agents must stop; human required"
```

Copy `.github/CODEOWNERS` into the repo and edit the username if needed. It is
what makes your approval *required* on `main` rather than merely expected.

Import the rulesets:

```bash
gh api repos/:owner/:repo/rulesets --method POST --input config/rulesets/develop.json
gh api repos/:owner/:repo/rulesets --method POST --input config/rulesets/main.json
```

Both ship with **empty bypass lists**. Do not add anyone, including yourself.
The `main` gate works through CODEOWNERS approval, and the release PR is opened
by `github-actions[bot]` precisely so you are free to approve it.

Leave `ai-driven1` unprotected — the cycle force-pushes it on reset.

Set `develop` as the default branch: **Settings → General → Default branch**.

---

## 5. Agent files

Copy `.claude/` to the repo root and commit to `develop`. Both the VS Code
extension and the CI jobs read the same definitions, so the two surfaces cannot
drift.

Update `OWNER_LOGIN` handling if your username differs — the guard reads it from
`github.repository_owner`, so it is correct automatically.

---

## 6. Run it supervised first

In VS Code: `/pr-cycle`. Watch one full cycle before enabling the loop.

Confirm on that first run:

- reviewer findings land as inline comments, not one wall of text
- `AI review round 1/5` appears in the review body
- the developer *rebuts* at least one weak comment rather than fixing everything
- pushing a fix dismisses the approval automatically
- `ci/agent-guard` shows PASS on all six rules
- `ai-driven1` ends at the `develop` head

The third one matters most. An agent that fixes every comment is not
collaborating — it is complying, and you have lost the independent judgement the
two-agent design was for.

---

## 7. Enable the loop

```bash
gh variable set ENABLE_UNATTENDED_AGENTS --body true
```

Kill switch, worth knowing before you need it:

```bash
gh variable set ENABLE_UNATTENDED_AGENTS --body false
```

Optional model overrides if your Claude usage runs hot:

```bash
gh variable set REVIEWER_MODEL --body sonnet
```

Know what that costs: two roles on one model share blind spots. Prefer fewer
cycles on Opus over more cycles on one model.

**Public repos get unlimited Actions minutes**, so the only budget to watch is
your Claude Pro quota — shared with your chat and IDE sessions. If you start
hitting limits during your own afternoon work, the loop is running too often.

---

## 8. Verify the gate before you trust it

Two tests, five minutes, once:

**The guard blocks.** On a scratch PR into `develop`, add `needs-human`. The
merge button should go red.

**`main` is sealed.** From the developer identity, try to merge anything into
`main`. It must be refused. If it succeeds, stop and re-check the ruleset and
CODEOWNERS before running anything else.

A control you have never watched fail is a control you have not tested.

---

## 9. Weekly

`promote-pr.yml` opens the release PR on Saturday mornings, or on demand:

```bash
gh workflow run promote-pr.yml
```

Test DEV, walk the checklist in the PR body, approve, merge. `promote-tag.yml`
tags it so rollback is a redeploy rather than an investigation.

---

## Troubleshooting

| Symptom | Cause |
|---------|-------|
| Reviewer cannot approve | Both identities are the same account |
| Both agents on one model | `CLAUDE_CODE_SUBAGENT_MODEL` is set; unset it |
| You cannot approve the release PR | You authored it — let the scheduled workflow open it |
| Agents never run | `ENABLE_UNATTENDED_AGENTS` is not `true` |
| Developer agrees with everything | Weak evidence requirement; check its definition survived copying |
| Guard passes when it should fail | `OWNER_LOGIN` mismatch |
| Agent modified a workflow file | Working as designed — guard rule 3 blocks the merge |
| Force-push rejected on reset | `ai-driven1` is protected; unprotect it |
