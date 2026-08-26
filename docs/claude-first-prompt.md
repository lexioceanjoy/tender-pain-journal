# First prompt for Claude Code

Copy this into Claude Code after opening the Tender Iteration B folder:

```text
You are taking over Tender, a phone-first, local-first pain journal. Start by reading CLAUDE.md and docs/claude-code-handoff.md completely. Do not change code yet.

First, verify the repository path, branch, remote, and working-tree status. Then run npm install, npm run check, and npm run test:e2e. Summarize the results and identify any discrepancy between main and feat/iteration-b.

Important: Tender's basic check-in must remain under 30 seconds; optional details stay optional; body-map interaction must remain visual and granular; health entries are local by default; the app must not diagnose, triage, prescribe, or make causal claims. Never expose or commit .env.local, API keys, backups, or diary data.

The current task is planning only: propose a small provider-adapter design that would let the optional AI narrative support Anthropic locally while preserving the existing consent, minimized-payload, server-only-secret, non-diagnostic, and rule-based fallback contract. Do not implement or merge anything until I approve the plan.
```

