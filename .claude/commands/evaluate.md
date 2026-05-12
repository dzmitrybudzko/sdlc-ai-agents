# Evaluate Agent

Run the evaluation suite for a specified agent to measure its output quality.

## Usage

```
/evaluate <agent-name>
```

## Instructions

1. **Validate input**: check that `$ARGUMENTS` specifies a valid agent name. Available agents can be found in `.claude/agents/`. If no agent is specified, list available agents and ask.

2. **Locate eval assets**: look for the eval directory at `evals/<agent-name>/`. It should contain:
   - `dataset.jsonl` — test cases with inputs and expected outputs
   - `criteria.md` — grading rubric
   - `run.ts` — eval runner script (optional, for custom logic)

3. **Check dependencies**: verify that `evals/node_modules` exists. If not, run:
   ```bash
   cd evals && npm install
   ```

4. **Run evals**: execute the eval runner:
   ```bash
   cd evals && npx tsx <agent-name>/run.ts
   ```
   If no custom `run.ts` exists, use the default framework:
   ```bash
   cd evals && npx tsx framework/judge.ts --agent <agent-name>
   ```

5. **Report results**: display the evaluation summary including:
   - Per-criterion scores (0-10)
   - Overall pass/fail status
   - Specific failures with details
   - Comparison to previous runs if available

## Example Output

```
## Evaluation Results: code-reviewer

| Criterion        | Score | Threshold | Status |
|-----------------|-------|-----------|--------|
| Detection rate   | 8.5   | 7.0       | PASS   |
| False positives  | 9.0   | 8.0       | PASS   |
| Actionability    | 7.2   | 7.0       | PASS   |
| Severity accuracy| 6.8   | 7.0       | FAIL   |

Overall: 3/4 criteria passed — NEEDS IMPROVEMENT
Failed criteria: severity accuracy (6.8 < 7.0 threshold)
```

## Notes

- Evals require a valid `ANTHROPIC_API_KEY` environment variable for the LLM-as-a-judge
- Each eval run is logged to `evals/results/` with a timestamp
- Add `--verbose` to the command for detailed per-case output
