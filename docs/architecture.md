# Architecture

## Design Principles

### Separation of Concerns

Each component in the system has a single responsibility:

- **Agents** own the task logic: what to do, in what order, and how to format the result
- **MCP server** owns external integrations: how to call GitHub, how to run git commands
- **Rules** own coding standards: style, conventions, and patterns
- **Evals** own quality measurement: what "good" looks like and how to grade it

No component reaches into another's domain. An agent doesn't hardcode API calls; the MCP server doesn't know about agent prompts; evals don't depend on agent internals.

### Composability

Agents compose tools rather than reimplementing them. The `bug-triager` agent uses `get_file_blame` and `get_recent_contributors` from the MCP server rather than running raw git commands. This means:

- Tool improvements benefit all agents automatically
- Tools can be tested independently
- New agents can be built from existing tools without new infrastructure

### Eval-Driven Development

Every agent ships with a baseline eval. The development cycle is:

1. **Define criteria** — what does "good output" look like for this agent?
2. **Build the dataset** — create test cases with known expected outputs
3. **Implement the agent** — write the prompt, tools, and guardrails
4. **Measure** — run evals and record baseline scores
5. **Iterate** — improve the agent and re-measure until thresholds are met

This prevents the common failure mode where an agent "looks right" in manual testing but performs inconsistently across diverse inputs.

## Agent Design Patterns

### Single Responsibility

Each agent does one thing well. The code reviewer does not also generate tests. The PR description generator does not also review the code. This makes each agent:

- Easier to evaluate (clear success criteria)
- Easier to maintain (changes don't cascade)
- More reliable (narrower scope = fewer failure modes)

### Scoped Tools

Agents declare the minimum set of tools they need. The code reviewer gets read-only access — it cannot modify files. The test generator gets write access to create test files but doesn't need GitHub API access. Scoping tools:

- Reduces the chance of harmful actions
- Limits the decision space for the LLM (fewer options = better choices)
- Makes it clear from the agent definition what it can and cannot do

### Structured Output

Every agent defines a specific output format with labeled sections and severity levels. This serves multiple purposes:

- **Parseability**: downstream tools can extract specific fields
- **Consistency**: users know what to expect regardless of input
- **Evaluability**: structured output is easier to grade automatically
- **Actionability**: structured formats force the agent to provide specific, useful information

### Guardrails as Constraints

Guardrails are not suggestions — they are hard rules that define the agent's operating envelope. Good guardrails:

- **Prevent false positives**: "Don't flag formatting if a linter is configured"
- **Enforce quality**: "Every CRITICAL finding must include a code fix"
- **Limit scope**: "Only review changed code, not the entire codebase"
- **Reduce noise**: "Err on the side of precision over recall for CRITICAL severity"

## Skills vs MCP vs Agents: Decision Framework

This is the key architectural decision when building Claude Code extensions. Each mechanism serves a different purpose.

### Skills (Rules)

**What**: Static context and instructions loaded into the conversation based on file type or project context.

**When to use**:
- Coding standards and conventions (e.g., "use ESM imports in TypeScript files")
- Templates and boilerplate patterns
- Project-specific knowledge that doesn't change at runtime

**Key property**: Skills are **passive** — they inject context but don't take actions. They influence how the LLM behaves but don't execute anything.

**Example**: A TypeScript rule that reminds the LLM to use `strict: true` and avoid `any` types whenever it's working on `.ts` files.

### MCP (Tools)

**What**: Runtime capabilities exposed via the Model Context Protocol. Tools that the LLM can invoke during task execution.

**When to use**:
- Fetching data from external APIs (GitHub, Jira, Slack)
- Executing commands that need structured input/output
- Any operation that requires runtime interaction with external systems

**Key property**: MCP tools are **reactive** — they execute only when the LLM decides to call them. They're building blocks, not complete workflows.

**Example**: A `get_pr_diff` tool that fetches a PR's diff from GitHub and returns structured JSON.

### Agents

**What**: Autonomous task executors that combine a system prompt, scoped tools, and structured output to accomplish a specific goal.

**When to use**:
- Multi-step tasks that require judgment (code review, test generation)
- Tasks that combine multiple tools in a workflow
- Anything that needs guardrails, output formatting, and quality control

**Key property**: Agents are **proactive** — they plan and execute a sequence of steps, making decisions about which tools to use and how to interpret results.

**Example**: A code reviewer agent that reads the diff, checks for security issues, runs a linter, and produces a structured review with severity levels.

### Decision Flowchart

```
Does it need to execute actions at runtime?
├── No → Is it static knowledge or conventions?
│   ├── Yes → SKILL / RULE
│   └── No → Probably doesn't need a Claude Code extension
└── Yes → Does it require multi-step reasoning and judgment?
    ├── No → MCP TOOL (single action, structured I/O)
    └── Yes → AGENT (combines tools, has guardrails, produces structured output)
```

### Composition Example

A complete workflow uses all three:

1. **Rule** (`typescript.md`): tells the LLM about project conventions
2. **MCP Tool** (`get_pr_diff`): fetches the PR diff from GitHub
3. **Agent** (`code-reviewer`): orchestrates the review — calls the tool, applies the conventions from the rule, produces structured output

## Evaluation Strategy

### Why LLM-as-a-Judge?

Agent outputs contain natural language mixed with structured data. Traditional testing approaches don't work well:

- **Unit tests** can't assess "is this review comment actionable?"
- **Regex matching** breaks on rephrased but correct outputs
- **Exact match** is too brittle for any non-trivial output

LLM-as-a-judge evaluates semantic correctness: did the agent find the SQL injection? Is the suggested fix correct? Is the severity appropriate? These are judgment calls that require understanding, not pattern matching.

### Evaluation Dimensions

Each agent is graded on dimensions specific to its task:

| Agent | Key Dimensions |
|-------|---------------|
| Code Reviewer | Detection rate, false positive rate, actionability, severity accuracy |
| Test Generator | Coverage, assertion quality, edge case inclusion, test independence |
| PR Description | Accuracy, completeness, clarity, breaking change detection |
| Bug Triager | Severity accuracy, root cause identification, assignee relevance |

### Baseline → Measure → Iterate

1. **Baseline**: run evals on the first version and record scores
2. **Identify gaps**: which criteria are below threshold?
3. **Targeted improvement**: modify the agent's prompt, guardrails, or examples
4. **Re-measure**: run evals again and compare
5. **Repeat**: until all criteria pass

This is analogous to test-driven development but for LLM behavior: define the expected quality first, then engineer the prompt to meet it.
