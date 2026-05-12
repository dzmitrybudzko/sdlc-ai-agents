# Evaluation Framework

LLM-as-a-judge evaluation framework for SDLC agents. Each agent has a dedicated eval directory with test cases and grading criteria.

## Prerequisites

- Node.js >= 18
- `ANTHROPIC_API_KEY` environment variable set

## Quick Start

```bash
cd evals
npm install

# Run evals for a specific agent
npx tsx code-reviewer/run.ts

# Run evals using the generic framework
npx tsx framework/judge.ts --agent code-reviewer
```

## Structure

```
evals/
├── framework/
│   └── judge.ts           # Core LLM-as-a-judge implementation
├── code-reviewer/
│   ├── dataset.jsonl      # Test cases with known issues
│   ├── criteria.md        # Grading rubric
│   └── run.ts             # Agent-specific eval runner
└── package.json
```

## Adding a New Eval

1. Create a directory: `evals/<agent-name>/`
2. Add `dataset.jsonl` — one JSON object per line with `input`, `expected_issues`, and `severity`
3. Add `criteria.md` — grading dimensions with `### Name` headers and `Threshold: N` values
4. Optionally add `run.ts` for custom agent invocation logic

## Dataset Format

Each line in `dataset.jsonl`:

```json
{
  "input": "code or text to evaluate",
  "expected_issues": ["issue the agent should find"],
  "severity": "critical|warning|info"
}
```

## Criteria Format

Use `### Heading` for each criterion and include `Threshold: N` (0-10 scale):

```markdown
### Detection Rate
Did the agent find the known issues?
Threshold: 7
```

## Scoring

The judge (Claude) grades agent output on each criterion from 0-10. A criterion passes if the average score across all test cases meets or exceeds the threshold. The overall eval passes only if all criteria pass.
