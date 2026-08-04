function Invoke-AgentGuard {
    <#
    .SYNOPSIS
        Enforces the AI PR workflow invariants that GitHub rulesets cannot express.

    .DESCRIPTION
        Runs as the required status check ci/agent-guard. Every rule the agents are
        merely instructed to follow is verified here instead, so a misbehaving or
        prompt-injected agent cannot merge. Writes a column-aligned result table and
        returns false when any rule fails.

    .PARAMETER PullRequestNumber
        The pull request to evaluate.

    .PARAMETER Repository
        Repository in owner/name form.

    .PARAMETER OwnerLogin
        The human owner. Approvals from this login waive the size cap.

    .PARAMETER MaxChangedLines
        Additions plus deletions above which a human approval is required.

    .PARAMETER MaxChangedFile
        File count above which a human approval is required.

    .PARAMETER MaxReviewRound
        Review rounds allowed before the PR must go to a human.

    .EXAMPLE
        Invoke-AgentGuard -PullRequestNumber 42 -Repository 'owner/repo' -OwnerLogin 'owner'

    .NOTES
        Requires the gh CLI authenticated through GH_TOKEN.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [int] $PullRequestNumber,

        [Parameter(Mandatory)]
        [string] $Repository,

        [Parameter(Mandatory)]
        [string] $OwnerLogin,

        [Parameter()]
        [int] $MaxChangedLines = 400,

        [Parameter()]
        [int] $MaxChangedFile = 20,

        [Parameter()]
        [int] $MaxReviewRound = 5
    )

    # Not merely sensitive files - files CI EXECUTES with credentials attached.
    # The Developer App has no workflows:write, so it cannot edit .github/workflows, but
    # package.json scripts run on every npm ci, infra/** holds the deployment definitions
    # and next.config.* runs at build time. Those jobs carry Azure OIDC for both DEV and
    # PRD, so an agent editing any of them reaches production without touching a workflow.
    #
    # Wildcard patterns, matched with -like. Rooted patterns such as 'infra/*' do not match
    # 'docs/infrastructure.md'; the '**/' variants catch nested copies.
    $protectedPath = @(
        '.github/*'
        'CODEOWNERS'
        '**/CODEOWNERS'
        'infra/*'
        'package.json'
        '**/package.json'
        'package-lock.json'
        '**/package-lock.json'
        'next.config.*'
        '**/next.config.*'
        'staticwebapp.config.json'
        '**/staticwebapp.config.json'
    )
    $result = [System.Collections.Generic.List[object]]::new()

    $ghArgument = @(
        'pr', 'view', $PullRequestNumber
        '--repo', $Repository
        '--json', 'author,baseRefName,headRefName,labels,reviews,commits,files,additions,deletions,isDraft'
    )

    try {
        $raw = & gh @ghArgument
        if ($LASTEXITCODE -ne 0) {
            throw "gh pr view failed for PR #$PullRequestNumber in $Repository."
        }
        $pullRequest = $raw | ConvertFrom-Json
    }
    catch {
        $PSCmdlet.ThrowTerminatingError($_)
    }

    function Add-Result {
        param(
            [Parameter(Mandatory)] [string] $Rule,
            [Parameter(Mandatory)] [bool]   $Passed,
            [Parameter(Mandatory)] [string] $Detail
        )

        $result.Add([PSCustomObject]@{
            Rule   = $Rule
            Status = if ($Passed) { 'PASS' } else { 'FAIL' }
            Detail = $Detail
        })
    }

    # These invariants exist to constrain the agents. ci/agent-guard is a required check
    # on develop, so it also judges pull requests nobody intended it to judge — every
    # Dependabot update and every human feature branch failed BranchTopology, which made
    # them permanently unmergeable. Combined with ProtectedPaths, .github/ became
    # unmodifiable: an agent branch fails ProtectedPaths, anything else fails topology.
    #
    # Scope by author rather than by branch. An agent cannot escape the rules by pushing
    # somewhere else, because the identity is what is checked.
    $agentAuthor = @(
        'lakshmanachari-panuganti[bot]'   # AI Developer App
        'devils-advocate-review[bot]'     # AI Reviewer App
        'omg-ai-developer'                # legacy machine account
        'devilsadvocate-reviewer'         # legacy machine account
    )
    $authorLogin = $pullRequest.author.login
    $isAgentPullRequest = $agentAuthor -contains $authorLogin

    if (-not $isAgentPullRequest) {
        Add-Result -Rule 'AgentScope' -Passed $true -Detail "author $authorLogin is not an agent; agent invariants do not apply"
    }

    # Rule 1 - agents may only ever target develop from ai-driven1
    $topologyOk = -not $isAgentPullRequest -or
                  ($pullRequest.baseRefName -eq 'develop' -and $pullRequest.headRefName -eq 'ai-driven1')
    Add-Result -Rule 'BranchTopology' -Passed $topologyOk -Detail "$($pullRequest.headRefName) -> $($pullRequest.baseRefName)"

    # Rule 2 - the approver must not be the last pusher
    $approval = @($pullRequest.reviews | Where-Object { $_.state -eq 'APPROVED' })
    $lastCommit = $pullRequest.commits | Select-Object -Last 1
    $lastPusher = if ($lastCommit.authors) { $lastCommit.authors[0].login } else { 'unknown' }
    $selfApproval = @($approval | Where-Object { $_.author.login -eq $lastPusher })
    Add-Result -Rule 'ApproverNotPusher' -Passed ($selfApproval.Count -eq 0) -Detail "last pusher $lastPusher, approvals $($approval.Count)"

    # Rule 3 - the agents must not edit the controls that watch them
    $touched = @(
        foreach ($file in $pullRequest.files) {
            foreach ($pattern in $protectedPath) {
                if ($file.path -like $pattern) { $file.path; break }
            }
        }
    )
    Add-Result -Rule 'ProtectedPaths' -Passed (-not $isAgentPullRequest -or $touched.Count -eq 0) -Detail $(if ($touched) { $touched -join ', ' } else { 'none touched' })

    # Rule 4 - needs-human halts the PR
    $needsHuman = @($pullRequest.labels | Where-Object { $_.name -eq 'needs-human' })
    Add-Result -Rule 'NoNeedsHumanLabel' -Passed ($needsHuman.Count -eq 0) -Detail $(if ($needsHuman) { 'label present' } else { 'absent' })

    # Rule 5 - five rounds, then a human decides
    $round = @(
        foreach ($review in $pullRequest.reviews) {
            if ($review.body -match 'AI review round\s+(\d+)\s*/') { [int]$Matches[1] }
        }
    )
    $highestRound = if ($round.Count -gt 0) { ($round | Measure-Object -Maximum).Maximum } else { 0 }
    Add-Result -Rule 'ReviewRoundBound' -Passed ($highestRound -le $MaxReviewRound) -Detail "round $highestRound of $MaxReviewRound"

    # Rule 6 - size cap, waived only by the owner
    $ownerApproval = @($approval | Where-Object { $_.author.login -eq $OwnerLogin })
    $changedLine = $pullRequest.additions + $pullRequest.deletions
    $changedFile = @($pullRequest.files).Count
    $oversized = $changedLine -gt $MaxChangedLines -or $changedFile -gt $MaxChangedFile
    # Not applied to non-agent pull requests: a routine Dependabot lockfile bump runs to
    # thousands of lines, which is normal for that tool and says nothing about risk.
    Add-Result -Rule 'SizeCap' -Passed (-not $isAgentPullRequest -or -not $oversized -or $ownerApproval.Count -gt 0) -Detail "$changedLine lines, $changedFile files, owner approvals $($ownerApproval.Count)"

    $result | Format-Table -AutoSize | Out-String | Write-Host

    if ($env:GITHUB_STEP_SUMMARY) {
        $summary = [System.Text.StringBuilder]::new()
        [void]$summary.AppendLine('| Rule | Status | Detail |')
        [void]$summary.AppendLine('|------|--------|--------|')
        foreach ($row in $result) {
            [void]$summary.AppendLine("| $($row.Rule) | $($row.Status) | $($row.Detail) |")
        }
        Add-Content -Path $env:GITHUB_STEP_SUMMARY -Value $summary.ToString()
    }

    $failure = @($result | Where-Object { $_.Status -eq 'FAIL' })
    if ($failure.Count -gt 0) {
        Write-Host "agent-guard FAILED: $($failure.Rule -join ', ')"
        return $false
    }

    Write-Host 'agent-guard passed.'
    return $true
}

$guardParameter = @{
    PullRequestNumber = [int] $env:PR_NUMBER
    Repository        = $env:GITHUB_REPOSITORY
    OwnerLogin        = $env:OWNER_LOGIN
}

if (-not (Invoke-AgentGuard @guardParameter)) {
    exit 1
}
