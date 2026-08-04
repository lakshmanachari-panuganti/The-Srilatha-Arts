# Organisation Automation Plan — `lakshmanachari-panuganti`

Covers machine identities, a standard branch-protection baseline, security policy,
and a centralised PR lifecycle reused by every repository.

**Scope:** 6 repos — `www.srilatha.art`, `OMG.PSUtilities`, `PowerShell`,
`UserStory-Implementation`, `navya-cloud-kitchen`, `PhotoSheet-Maker`. All public,
all owned by the org.

---

## 1. Machine identities — GitHub Apps, not accounts

**Recommendation: two GitHub Apps.** For the reviewer this is not a preference, it is
the only option that meets your requirement.

### Why the reviewer *cannot* be a machine account

You asked for a reviewer that can review, comment and suggest, but has **no write
access**. A user account cannot do this. A collaborator's permission is a single
bundle:

| Role | Can push code | Can submit a review |
|---|---|---|
| `read` | no | yes, but it does **not** count toward required approvals |
| `write` | **yes** | yes, counts |

So a machine *account* is either useless as an approver, or has push access to
every repo. There is no middle setting.

A GitHub App splits them:

```
Contents:      Read      ← cannot push, cannot force-push, cannot touch a branch
Pull requests: Write     ← can review, approve, comment, suggest
```

That is exactly the requirement, and it is only expressible as an App.

### The two Apps

| | **AI Developer** | **AI Reviewer** |
|---|---|---|
| Contents | **Read & write** | **Read** |
| Pull requests | Read & write | **Read & write** |
| Issues | Read & write | Read |
| Metadata | Read | Read |
| Checks | Read & write | Read |
| Commit statuses | Read & write | Read |
| Actions | Read | Read |
| Administration | **none** | **none** |
| Secrets / Variables | **none** | **none** |
| Members / Billing | **none** | **none** |

Install both **org-wide, all repositories** — new repos are covered automatically,
which is the "all repositories" part of your requirement.

### Why Apps beat machine accounts generally

| | Machine account | GitHub App |
|---|---|---|
| Credential | PAT, long-lived | Installation token, **expires in 1 hour** |
| Blast radius if leaked | until you notice | ≤ 1 hour |
| Permission granularity | one role bundle | per-resource |
| Covers new repos | invite each time | automatic org-wide |
| Consumes a seat | yes | no |
| Revocation | delete account | uninstall, instant |
| Audit trail | looks like a user | clearly attributed to the App |

### Things that will bite you — know them up front

1. **An App cannot be a CODEOWNER.** `CODEOWNERS` accepts users and teams only. Since
   you chose option (A) — approval from *any* approver, not a mandatory reviewer —
   this does not block you. It would have, under option (B).
2. **Commits are attributed to `app-name[bot]`**, not a person.
3. **App commits are not GPG-signed by the App.** If a branch ever requires signed
   commits, merges must be **squash** merges — GitHub's merge bot signs those.
4. **An App cannot approve its own PR either.** Two Apps means developer opens,
   reviewer approves — which is the separation you want.
5. **Private key handling.** Each App has a `.pem` private key. Store as an org secret
   (`AI_DEVELOPER_APP_KEY`, `AI_REVIEWER_APP_KEY`) plus the numeric App IDs as
   variables. **The key is the credential — treat it like the PAT it replaces.**

### Migration path from today's accounts

`omg-ai-developer` and `devilsadvocate-reviewer` keep working while the Apps are
built. Cut over per repo, then remove the accounts. No flag day.

> **Note on today's change:** `devilsadvocate-reviewer` now has `write` on all six
> repos. That is *more* than the reviewer should ultimately hold — it is the
> stopgap until the Reviewer App exists, precisely because a `read` account's
> approval would not satisfy branch protection.

---

## 2. Standard branch-protection baseline

One policy, applied identically everywhere. Two tiers, because two repos carry CI
and deployments and four do not.

### Tier 1 — every repository (the baseline)

Target: **default branch**

| Rule | Setting | Why |
|---|---|---|
| Require a pull request | yes | no direct pushes to the default branch |
| Required approvals | **1** | option (A): one approval from any approver |
| Dismiss stale approvals on push | yes | an approval describes the code that was reviewed |
| Require conversation resolution | yes | review comments cannot be silently ignored |
| Block force-push | yes | history is not rewritable |
| Block deletion | yes | the branch cannot be removed |
| Require code-owner review | **no** | option (A) — approval is not tied to a specific reviewer |
| Bypass list | **empty** | the rules apply to everyone, including you |

### Tier 2 — repos with CI (`www.srilatha.art`, `OMG.PSUtilities`)

Everything in Tier 1, plus:

| Rule | Setting |
|---|---|
| Required status checks | `www.srilatha.art`: `ci/agent-guard` on `develop` · `OMG.PSUtilities`: `Validate, Test, and Build` |
| Protected branches | `main` **and** `develop`, as separate rulesets |

> **Never put a required check on a ruleset covering a branch where that check does
> not run.** A check that cannot report blocks the branch permanently. This exact
> mistake deadlocked `main` on `www.srilatha.art` earlier and had to be undone by
> splitting one ruleset into two.

### Current state after today

| Repo | Ruleset(s) | Approvals |
|---|---|---|
| `www.srilatha.art` | Protect main + Protect develop | 1 |
| `OMG.PSUtilities` | Rule1 (default branch) | 1 |
| `PowerShell` | Protect default branch | 1 |
| `UserStory-Implementation` | Protect default branch | 1 |
| `navya-cloud-kitchen` | Protect default branch | 1 |
| `PhotoSheet-Maker` | Protect default branch | 1 |

Gaps to close: the four Tier-1 repos still lack *dismiss stale approvals* and
*conversation resolution*; `OMG.PSUtilities` `Rule1` sets `require_code_owner_review:
true` with **no CODEOWNERS file**, making it a control that does nothing.

---

## 3. Security policy

Use the org-level `.github` repository. A `SECURITY.md` there becomes the **default
for every repository in the org that does not define its own** — one file, six repos
covered, and every future repo automatically.

```
lakshmanachari-panuganti/.github
├── SECURITY.md          ← org-wide default
├── profile/README.md    ← org landing page (optional)
└── .github/workflows/   ← reusable workflows (§4)
```

Also now enabled on all six: **private vulnerability reporting**, so a researcher
reports privately instead of opening a public issue that discloses the flaw before
you can fix it.

---

## 4. Centralised PR lifecycle

### The shape

One reusable workflow in a central repo; every other repo calls it in ~10 lines.
Logic lives in one place — fix a bug once, all repos get it.

```
lakshmanachari-panuganti/.github
└── .github/workflows/
    ├── pr-lifecycle.yml      on: workflow_call   ← the implementation
    └── agent-guard.yml       on: workflow_call   ← invariant checks
```

Caller, committed once per repo:

```yaml
name: PR Lifecycle
on:
  pull_request:
    types: [opened, synchronize, reopened]
  pull_request_review:
    types: [submitted]

jobs:
  lifecycle:
    uses: lakshmanachari-panuganti/.github/.github/workflows/pr-lifecycle.yml@main
    with:
      language: node          # or: powershell
      test-command: npm test
    secrets: inherit
```

### Why a reusable workflow, not a composite action or a template

- **Reusable workflow** — callers get the whole job graph; updating `@main` updates
  every repo at once. ✅ what you want.
- Composite action — only bundles steps; each repo still owns the job wiring.
- Workflow *template* — copied at creation, then drifts. The opposite of central.

### Pinning

Reference `@main` while iterating, then pin to a tag (`@v1`) once stable. `@main`
means a bad commit reaches every repo instantly; that is the cost of central logic
and the reason to move to tags.

### Per-language variation

Repos differ (Node vs PowerShell). Handle with **inputs**, not with forks of the
workflow:

| Input | Purpose |
|---|---|
| `language` | `node` \| `powershell` — selects setup + test steps |
| `test-command` | override the default |
| `max-changed-lines` | guard threshold, default 400 |
| `max-changed-files` | default 20 |
| `enable-agents` | run the AI developer/reviewer, default `false` |

`enable-agents: false` by default matters: `PowerShell` and `PhotoSheet-Maker` want
the guard rails without an AI writing code.

### Secrets

Org-level secrets, so they exist once:

| Secret | Used by |
|---|---|
| `AI_DEVELOPER_APP_KEY` + var `AI_DEVELOPER_APP_ID` | developer App token minting |
| `AI_REVIEWER_APP_KEY` + var `AI_REVIEWER_APP_ID` | reviewer App token minting |
| `CLAUDE_CODE_OAUTH_TOKEN` | both agents |

> Org secrets on a **Free** plan reach **public repositories only**. All six repos are
> public, so this works today. It would break the moment you make one private.

### Rollout

1. Build `pr-lifecycle.yml` with `enable-agents: false` — guard + tests only.
2. Adopt in `PowerShell` (lowest stakes). Prove the caller pattern.
3. Roll to the other three Tier-1 repos.
4. Adopt in `OMG.PSUtilities`, turn agents on there first — it has real tests and
   an already-green validation gate.
5. Adopt in `www.srilatha.art` last; it has the most moving parts.

---

## 5. Sequenced plan

| # | Task | Owner | Blocked by |
|---|---|---|---|
| 1 | Create the two GitHub Apps, install org-wide | **you** — I cannot create Apps | — |
| 2 | Store App IDs + private keys as org secrets/variables | you | 1 |
| 3 | Create `lakshmanachari-panuganti/.github` repo | me | — |
| 4 | Add org-wide `SECURITY.md` | me | 3 |
| 5 | Bring all six rulesets to the Tier-1 baseline | me | — |
| 6 | Fix `OMG.PSUtilities` vacuous code-owner rule | me | — |
| 7 | Build `pr-lifecycle.yml` reusable workflow | me | 3 |
| 8 | Roll out per §4, repo by repo | me | 7, and 1–2 for the agent steps |
| 9 | Retire `omg-ai-developer` / `devilsadvocate-reviewer` accounts | you | 8 complete |

**Only step 1 requires you.** GitHub Apps must be created through the UI; there is no
API to create one. Everything else I can do.

---

## 6. Deferred

See `TODO.txt` — DNS work (apex domain, DMARC, CAA) needs Namecheap access.

**Outstanding reminder:** `Deploy Backend · PRD` on `www.srilatha.art` has never run
since the migration. It is the only OIDC path still unproven. Its credentials are
updated and verified in configuration, and the identically-configured DEV path passes
— but configured is not the same as proven.
