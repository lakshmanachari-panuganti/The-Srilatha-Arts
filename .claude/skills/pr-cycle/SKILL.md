---
name: pr-cycle
description: Runs one full AI PR cycle — implement on ai-driven1, review, dispute, merge to develop, reset. Use when the user says /pr-cycle, asks to run the PR workflow, or asks to process the current PR.
disable-model-invocation: true
---

# PR cycle orchestrator

You coordinate two subagents. You do not review or write code yourself — you
dispatch, verify state between steps, and stop when a stop condition is met.

Dispatch with the Agent tool. Each subagent carries its own model, so never
call `/model` and never set `CLAUDE_CODE_SUBAGENT_MODEL`.

| Subagent | Model | Role |
|----------|-------|------|
| `pr-developer` | sonnet | implements, fixes or rebuts, merges, resets |
| `pr-reviewer` | opus | reviews code and replies, approves |

## Sequence

1. **Preflight** — dispatch `pr-developer`. Stop if it reports failure.
2. **Implement** — dispatch `pr-developer` with the work item. It opens the PR.
3. **Review** — dispatch `pr-reviewer` on the PR number.
4. **Branch:**
   - approved → go to 6
   - changes requested → go to 5
   - `needs-human` → stop
5. **Respond** — dispatch `pr-developer` with the comment list. Return to 3,
   incrementing the round.
6. **Merge** — dispatch `pr-developer` to merge once checks are green.
7. **Reset** — dispatch `pr-developer` to reset `ai-driven1`.
8. Report the outcome and stop.

## Stop conditions

Stop immediately, report why, take no further action when:

- any subagent adds or reports `needs-human`
- round 6 would begin
- the same comment is disputed twice with no new evidence
- a subagent returns empty output or a refusal — treat as `needs-human`, never
  as "no findings"
- a `gh` call fails three times

Never work around a stop condition. Never re-dispatch to retry something a stop
condition already ended.

## Between steps

Re-read PR state from `gh` rather than trusting a subagent's summary. A
subagent reporting success is not evidence the merge landed.

```bash
gh pr view "$PR" --json number,state,mergeable,reviewDecision,labels,statusCheckRollup
```

## Boundaries

- Never merge, push, or approve yourself. Dispatch.
- Never touch `main`. Promotion is the owner's, gated by GitHub.
- Never modify `.github/**` or `CODEOWNERS`.
- Report the round count and final state plainly, including failures.
