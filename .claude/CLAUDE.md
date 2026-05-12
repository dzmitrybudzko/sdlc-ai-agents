# SDLC AI Agents

A collection of AI agents that optimize the software development lifecycle using Claude Code.

## Project Overview

This repository provides production-ready SDLC agents distributed as markdown configurations for Claude Code. Each agent is a self-contained task executor with a defined role, scoped tools, structured output format, and guardrails. The agents are supported by an MCP server for external integrations and an evaluation framework for quality assurance.

## Repository Structure

```
.claude/agents/    — Agent definitions (markdown)
.claude/commands/  — Reusable slash commands
.claude/rules/     — Context-triggered rules
mcp-server/        — TypeScript MCP server for GitHub and git tools
evals/             — LLM-as-a-judge evaluation framework
docs/              — Architecture and design documentation
```

## Coding Conventions

- **Language**: TypeScript with strict mode enabled
- **Module system**: ESM (`import`/`export`, not `require`)
- **No `any` types** — use `unknown` and narrow, or define proper interfaces
- **Error handling**: throw typed errors; never swallow exceptions silently
- **Naming**: camelCase for variables/functions, PascalCase for types/classes, kebab-case for files
- **Formatting**: Prettier defaults (no custom config needed)

## Agent Development Guidelines

Each agent file in `.claude/agents/` follows this structure:

1. **Role definition** — a clear system-level identity (e.g., "You are a senior code reviewer")
2. **Allowed tools** — explicit list of tools the agent may use
3. **Input specification** — what the agent receives
4. **Output format** — structured output with defined fields
5. **Guardrails** — what to avoid, quality thresholds, scope limits
6. **Examples** — few-shot demonstrations of expected behavior

Naming convention: `<verb>-<noun>.md` (e.g., `code-reviewer.md`, `test-generator.md`).

When adding a new agent, also create a corresponding eval dataset in `evals/<agent-name>/`.

## MCP Server Guidelines

Tools are defined in `mcp-server/src/tools/`. Each tool module exports functions that are registered in `index.ts`. Every tool must:

- Have a clear `description` for LLM consumption
- Define input parameters with Zod schemas
- Return structured JSON (not free text)
- Handle errors gracefully and return meaningful error messages

## Testing and Evaluation

Run evals with the `/evaluate` command. The evaluation framework uses LLM-as-a-judge (Claude API) to grade agent outputs against defined criteria. See `evals/README.md` for details on adding test cases and criteria.

## Rules

Rules in `.claude/rules/` activate based on file context:
- `typescript.md` — active when working with `.ts` files
- `testing.md` — active when working with test files
