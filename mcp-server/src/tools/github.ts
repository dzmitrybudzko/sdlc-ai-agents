import { z } from "zod";

export const GetPrDiffSchema = z.object({
  owner: z.string().describe("Repository owner (user or organization)"),
  repo: z.string().describe("Repository name"),
  pr_number: z.number().int().positive().describe("Pull request number"),
});

export type GetPrDiffInput = z.infer<typeof GetPrDiffSchema>;

export interface PrDiffResult {
  pr_number: number;
  title: string;
  diff: string;
  files_changed: number;
  additions: number;
  deletions: number;
}

export async function getPrDiff(input: GetPrDiffInput): Promise<PrDiffResult> {
  const { owner, repo, pr_number } = input;
  const token = process.env.GITHUB_TOKEN;

  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3.diff",
    "User-Agent": "sdlc-mcp-server",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const prResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${pr_number}`,
    {
      headers: {
        ...headers,
        Accept: "application/vnd.github.v3+json",
      },
    }
  );

  if (!prResponse.ok) {
    throw new Error(
      `GitHub API error fetching PR #${pr_number}: ${prResponse.status} ${prResponse.statusText}`
    );
  }

  const prData = (await prResponse.json()) as {
    title: string;
    changed_files: number;
    additions: number;
    deletions: number;
  };

  const diffResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${pr_number}`,
    { headers }
  );

  if (!diffResponse.ok) {
    throw new Error(
      `GitHub API error fetching diff for PR #${pr_number}: ${diffResponse.status} ${diffResponse.statusText}`
    );
  }

  const diff = await diffResponse.text();

  return {
    pr_number,
    title: prData.title,
    diff,
    files_changed: prData.changed_files,
    additions: prData.additions,
    deletions: prData.deletions,
  };
}

export const ListOpenIssuesSchema = z.object({
  owner: z.string().describe("Repository owner"),
  repo: z.string().describe("Repository name"),
  labels: z
    .string()
    .optional()
    .describe("Comma-separated list of label names to filter by"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(30)
    .describe("Maximum number of issues to return"),
});

export type ListOpenIssuesInput = z.infer<typeof ListOpenIssuesSchema>;

export interface Issue {
  number: number;
  title: string;
  state: string;
  labels: string[];
  assignees: string[];
  created_at: string;
  updated_at: string;
  url: string;
}

export async function listOpenIssues(
  input: ListOpenIssuesInput
): Promise<Issue[]> {
  const { owner, repo, labels, limit } = input;
  const token = process.env.GITHUB_TOKEN;

  const params = new URLSearchParams({
    state: "open",
    per_page: String(limit),
  });
  if (labels) {
    params.set("labels", labels);
  }

  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "sdlc-mcp-server",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/issues?${params}`,
    { headers }
  );

  if (!response.ok) {
    throw new Error(
      `GitHub API error listing issues: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as Array<{
    number: number;
    title: string;
    state: string;
    labels: Array<{ name: string }>;
    assignees: Array<{ login: string }>;
    created_at: string;
    updated_at: string;
    html_url: string;
  }>;

  return data.map((issue) => ({
    number: issue.number,
    title: issue.title,
    state: issue.state,
    labels: issue.labels.map((l) => l.name),
    assignees: issue.assignees.map((a) => a.login),
    created_at: issue.created_at,
    updated_at: issue.updated_at,
    url: issue.html_url,
  }));
}
