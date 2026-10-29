# Observed workflow examples

These are captured outputs from a temporary, synthetic ParcelKit project. The named agents were simulated by local code edits and manually supplied notes; no model produced the changes. Git IDs refer only to that disposable fixture.

- `before-CLAUDE.md`: the initial MVP's approved sync removed a pre-existing team instruction.
- `after-CLAUDE.md`: revised sync preserves the original CRLF team section and appends one managed section with the Codex → Claude handoff.
- `after-GEMINI.md`: the subsequent Claude → Gemini handoff after actual Unicode parser tests passed.
- `reverse-AGENTS.md`: the final Claude → Codex handoff, subsequently loaded by the real Codex CLI's offline prompt inspector.
- `before-handoff.md` / `after-handoff.md`: saved notes before and after optional direction labels and readable Git status descriptions were added.

These are review artifacts, not an initialized example checkout. Existing initial-MVP files under `../generated/` were left intact. Run `pnpm validate:workflow` to create a fresh disposable project and inspect every direction's source, tests, previews and instruction outputs.
