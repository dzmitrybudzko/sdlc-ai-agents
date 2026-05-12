import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import {
  GetPrDiffSchema,
  getPrDiff,
  ListOpenIssuesSchema,
  listOpenIssues,
} from "./tools/github.js";

import {
  GetFileBlameSchema,
  getFileBlame,
  GetRecentContributorsSchema,
  getRecentContributors,
  SearchCodebaseSchema,
  searchCodebase,
} from "./tools/git-local.js";

const server = new McpServer({
  name: "sdlc-mcp-server",
  version: "1.0.0",
});

server.tool(
  "get_pr_diff",
  "Fetch the diff and metadata for a GitHub pull request. Returns the unified diff, file count, additions, and deletions.",
  GetPrDiffSchema.shape,
  async ({ owner, repo, pr_number }) => {
    try {
      const result = await getPrDiff({ owner, repo, pr_number });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
    }
  }
);

server.tool(
  "list_open_issues",
  "List open issues for a GitHub repository with optional label filtering. Returns issue numbers, titles, labels, and assignees.",
  ListOpenIssuesSchema.shape,
  async ({ owner, repo, labels, limit }) => {
    try {
      const result = await listOpenIssues({ owner, repo, labels, limit });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
    }
  }
);

server.tool(
  "get_file_blame",
  "Run git blame on a file and return structured output with commit, author, date, and content for each line.",
  GetFileBlameSchema.shape,
  async ({ file_path, repo_path }) => {
    try {
      const result = await getFileBlame({ file_path, repo_path });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
    }
  }
);

server.tool(
  "get_recent_contributors",
  "Get the most active recent contributors for a file or directory based on git log. Useful for identifying who knows a codebase area best.",
  GetRecentContributorsSchema.shape,
  async ({ path, repo_path, limit, since }) => {
    try {
      const result = await getRecentContributors({ path, repo_path, limit, since });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
    }
  }
);

server.tool(
  "search_codebase",
  "Search for a regex pattern across the tracked files in a git repository. Returns matching file paths, line numbers, and content.",
  SearchCodebaseSchema.shape,
  async ({ pattern, repo_path, file_pattern, max_results }) => {
    try {
      const result = await searchCodebase({ pattern, repo_path, file_pattern, max_results });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
    }
  }
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error starting MCP server:", err);
  process.exit(1);
});
