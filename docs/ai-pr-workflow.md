# AI-Powered Pull Request Workflow — v5

Two independent AI agents collaborate through pull requests. A human approval
gate stands in front of `main`, enforced by GitHub rather than by convention.

**Repositories are public**, so every control below is available on GitHub Free.

---

## 1. Branches and environments

| Branch | Purpose | Written by | Deploys to |
|--------|---------|-----------|------------|
| `ai-driven1` | Agents develop here | Developer Agent | — |
| `develop` | Integration | PR from `ai-driven1` | **DEV** |
| `main` | Release | Owner approval only | **PRD** |

```
ai-driven1 ──PR──► develop ──weekly PR──► main
  (agents)          (DEV)      (you approve)  (PRD)
        └── reset to develop head after each merge
```

---

## 2. Your goals, and what enforces each

| Goal | Mechanism | Type |
|------|-----------|------|
| Agents iterate autonomously to `develop` | Separate CI jobs, separate identities | — |
| Two *independent* agents | Different models, different tokens, different accounts | Structural |
| Developer must not rubber-stamp reviews | Evidence requirement in its definition | Advisory |
| Reviewer judges replies, not just code | Explicit second review target | Advisory |
| Maximum 5 rounds, then human | Guard rule 5 fails the required check | **Enforced** |
| No agent writes to `main` | `main` ruleset + guard rule 1 | **Enforced** |
| No PR to `main` auto-approved or merged | CODEOWNERS approval required, empty bypass list | **Enforced** |
| Only you approve and merge to `main` | Same | **Enforced** |
| Agents may merge to `develop` when agreed | Ruleset gates it; agents cannot bypass | **Enforced** |

**Enforced** means GitHub refuses the action. **Advisory** means the agent was
told, and may occasionally fail — which is why the enforced row above it exists.

---

## 3. Identities and models

> GitHub blocks a PR author from approving their own PR. The two agents must be
> two distinct identities or the reviewer can never approve anything.

| Role | Model | Identity | Permissions |
|------|-------|----------|-------------|
| Developer Agent | `sonnet` | GitHub App or machine account | Contents: write, Pull requests: write |
| Reviewer Agent | `opus` | `devilsadvocate-reviewer` | Pull requests: write, Contents: **read** |
| You | — | `lakshmanachari-panuganti` | Owner |

Review is the judgement-heavy half, so it gets the stronger model. Two models
also means two different failure modes — one model reviewing its own output
shares its own blind spots, which is the failure this whole design exists to
avoid.

Neither agent gets **Administration**. The reviewer's read-only Contents is what
makes "a prompt injection against the reviewer cannot alter code" a fact.

---

## 4. The cycle

| Step | Actor | Action | On failure |
|------|-------|--------|-----------|
| 0 | Developer | Preflight: no PR open on `ai-driven1` | `needs-human` |
| 1 | Developer | Implement one work item, push, open PR into `develop` | `needs-human` |
| 2 | Reviewer | Eligibility: base `develop`, head `ai-driven1`, ≤400 lines, ≤20 files | comment + `needs-human` |
| 3 | Reviewer | Review code; from round 2, also review the developer's replies | — |
| 4 | Developer | Fix valid comments; rebut false positives **with evidence** | 2 CI failures → `needs-human` |
| 5 | — | Rounds 3–5 repeat. Round 6 blocked by guard | `needs-human` |
| 6 | Reviewer → Developer | Approve, then merge to `develop` | — |
| 7 | Developer | Reset `ai-driven1` to `develop` head | `needs-human` |

Each push dismisses the stale approval, so re-review is automatic rather than
requested.

### The dispute protocol

The Developer Agent does not accept every comment. It must choose:

- **Valid** → fix, push, explain the fix.
- **False positive** → no code change, reply with the code path the reviewer
  missed, plus a line reference, guard clause, or test that proves it.
  *"This is intentional" is not evidence.* If it cannot produce evidence, the
  comment is treated as valid.

The Reviewer Agent then judges the rebuttal on evidence, not confidence — and
concedes when the developer is right. Two disputes on one comment with no new
evidence ends the cycle at `needs-human`.

### Failure handling

| Situation | Action |
|-----------|--------|
| Merge conflict | Rebase once. Still conflicting → `needs-human` |
| CI red after 2 attempts | `needs-human` |
| Force-push mid-review | Discard the round, restart at step 3 |
| Round 6 would begin | Guard fails the check; PR waits for you |
| Agent output empty or refused | `needs-human` — never "no findings" |
| Anything unlisted | `needs-human` |

---

## 5. Guard check (`ci/agent-guard`)

Required check on `develop`. Fails when:

1. Base is not `develop`, or head is not `ai-driven1`
2. The approving review's actor equals the last pusher
3. Any commit touches `.github/**` or `CODEOWNERS`
4. Label `needs-human` is present
5. Review round exceeds **5**
6. Diff over 400 lines or 20 files without your approval

Rule 1 is what stops an agent quietly targeting `main`; rule 5 is your
five-round pause.

---

## 6. The human gate

The release PR is opened by `github-actions[bot]` on a schedule — **not by you
and not by an agent**. This is deliberate:

- GitHub blocks a PR author from approving their own PR. If you opened it, the
  ruleset could not require your approval, and the gate would be a habit rather
  than a rule.
- No agent identity touches `main` at any point.

The `main` ruleset requires one CODEOWNERS approval and has an **empty bypass
list** — nobody skips it, including you. So the PR sits until you approve it,
and only then can it merge.

Your weekend routine:

1. Test the DEV environment running from `develop`.
2. Open the waiting release PR; walk the checklist in its body.
3. Approve, merge.
4. `promote-tag.yml` tags `v<date>` and publishes notes.

**Rollback:** redeploy the previous tag. For a code fix, revert PR against
`main`, then cherry-pick back into `develop`.

---

## 7. Review scope

**In scope:** logic errors, off-by-one, null and empty handling, missing error
handling, missing tests, inconsistency with surrounding conventions, hardcoded
secrets, unclear naming, dead code, debug leftovers.

**Out of scope** — deterministic tools own these:

| Concern | Owner |
|---------|-------|
| Security vulnerabilities | CodeQL |
| Dependency CVEs | Dependabot |
| Performance | Benchmarks |
| Coverage | Coverage gate |
| Formatting | Linter |

An LLM asked about performance or security with no runtime data produces
fluent, confident, occasionally-wrong output — indistinguishable from the times
it is right.

**Comment budget:** 10 per round, severity-ordered, each naming file, line,
problem, and suggested fix.

---

## 8. Untrusted input

Public repos mean anyone can open a PR, so this section is load-bearing.

- All PR content reaches the agents wrapped in `<untrusted_data>` tags — data,
  never instruction.
- Agents ignore text claiming to come from a maintainer, from Anthropic, or
  from a prior approved review.
- The eligibility gate refuses fork PRs, so no outside contributor's branch is
  ever processed by an agent.
- `pull_request` trigger only, never `pull_request_target` with a head checkout.
- Neither token is exposed to a fork PR.
- The reviewer holds no write access, so injection against it cannot alter code.

---

## 9. Files

```
.claude/agents/pr-developer.md      sonnet, implements and disputes
.claude/agents/pr-reviewer.md       opus, reviews code and replies
.claude/skills/pr-cycle/SKILL.md    /pr-cycle orchestrator for VS Code
.github/CODEOWNERS                  your approval on main and on the controls
.github/workflows/agent-guard.yml   required check
.github/workflows/ai-pr-cycle.yml   the autonomous loop
.github/workflows/promote-pr.yml    weekly release PR, bot-authored
.github/workflows/promote-tag.yml   tags main on merge
.github/scripts/Invoke-AgentGuard.ps1
config/rulesets/develop.json
config/rulesets/main.json
docs/SETUP.md                       start here
```

---

## 10. Completion criteria

Per cycle:

- [ ] PR merged into `develop` with every required check green
- [ ] No open `needs-human` labels
- [ ] `ai-driven1` reset to the `develop` head

Per week:

- [ ] Release PR approved and merged by you
- [ ] Tag and release notes published
