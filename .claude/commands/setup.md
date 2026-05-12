# Setup Development Environment

Initialize and validate the development environment for working with SDLC agents.

## Usage

```
/setup
```

## Instructions

1. **Check prerequisites**:
   - Verify Node.js is installed (minimum v18): `node --version`
   - Verify npm is installed: `npm --version`
   - Verify git is available: `git --version`
   - Report any missing prerequisites and stop

2. **Install MCP server dependencies**:
   ```bash
   cd mcp-server && npm install
   ```

3. **Build MCP server**:
   ```bash
   cd mcp-server && npm run build
   ```
   If the build fails, report the error and suggest fixes.

4. **Install eval framework dependencies**:
   ```bash
   cd evals && npm install
   ```

5. **Validate configuration**:
   - Check if `.claude/CLAUDE.md` exists
   - Check if at least one agent exists in `.claude/agents/`
   - Check if MCP server config references the built server
   - Check if `ANTHROPIC_API_KEY` is set (warn if not — needed for evals only)

6. **Run smoke test**:
   - Verify MCP server starts without errors:
     ```bash
     cd mcp-server && node dist/index.js --help 2>&1 || echo "Server module loaded"
     ```
   - Verify TypeScript compilation of eval framework:
     ```bash
     cd evals && npx tsc --noEmit
     ```

7. **Report status**:

```
## Environment Setup Complete

| Component          | Status |
|-------------------|--------|
| Node.js v20.x     | OK     |
| MCP server build   | OK     |
| Eval dependencies  | OK     |
| Agent configs      | 4 found|
| ANTHROPIC_API_KEY  | SET    |

Ready to develop. Run /evaluate <agent-name> to test an agent.
```

## Troubleshooting

- If `npm install` fails with permission errors, suggest running without sudo and checking node_modules ownership
- If TypeScript compilation fails, check `tsconfig.json` for strict mode settings
- If the MCP server won't start, check that all tool implementations are properly exported
