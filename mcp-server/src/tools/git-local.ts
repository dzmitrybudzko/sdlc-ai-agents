import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";

const execFileAsync = promisify(execFile);

async function runGit(
  args: string[],
  cwd?: string
): Promise<string> {
  const { stdout } = await execFileAsync("git", args, {
    cwd: cwd ?? process.cwd(),
    maxBuffer: 10 * 1024 * 1024,
  });
  return stdout;
}

export const GetFileBlameSchema = z.object({
  file_path: z.string().describe("Path to the file (relative to repo root)"),
  repo_path: z
    .string()
    .optional()
    .describe("Path to the git repository root (defaults to cwd)"),
});

export type GetFileBlameInput = z.infer<typeof GetFileBlameSchema>;

export interface BlameLine {
  commit: string;
  author: string;
  date: string;
  line_number: number;
  content: string;
}

export interface FileBlameResult {
  file_path: string;
  lines: BlameLine[];
  total_lines: number;
  contributors: string[];
}

export async function getFileBlame(
  input: GetFileBlameInput
): Promise<FileBlameResult> {
  const { file_path, repo_path } = input;

  const output = await runGit(
    ["blame", "--porcelain", file_path],
    repo_path
  );

  const lines: BlameLine[] = [];

  let currentCommit = "";
  let currentAuthor = "";
  let currentDate = "";
  let lineNumber = 0;

  for (const line of output.split("\n")) {
    const commitMatch = line.match(
      /^([0-9a-f]{40})\s+(\d+)\s+(\d+)/
    );
    if (commitMatch) {
      currentCommit = commitMatch[1];
      lineNumber = parseInt(commitMatch[3], 10);
      continue;
    }

    const authorMatch = line.match(/^author (.+)/);
    if (authorMatch) {
      currentAuthor = authorMatch[1];
      continue;
    }

    const dateMatch = line.match(/^author-time (\d+)/);
    if (dateMatch) {
      currentDate = new Date(
        parseInt(dateMatch[1], 10) * 1000
      ).toISOString();
      continue;
    }

    if (line.startsWith("\t")) {
      lines.push({
        commit: currentCommit.substring(0, 8),
        author: currentAuthor,
        date: currentDate,
        line_number: lineNumber,
        content: line.substring(1),
      });
    }
  }

  const contributors = [...new Set(lines.map((l) => l.author))];

  return {
    file_path,
    lines,
    total_lines: lines.length,
    contributors,
  };
}

export const GetRecentContributorsSchema = z.object({
  path: z
    .string()
    .describe("File or directory path (relative to repo root)"),
  repo_path: z
    .string()
    .optional()
    .describe("Path to the git repository root (defaults to cwd)"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .describe("Maximum number of contributors to return"),
  since: z
    .string()
    .optional()
    .describe("Only consider commits after this date (ISO 8601)"),
});

export type GetRecentContributorsInput = z.infer<
  typeof GetRecentContributorsSchema
>;

export interface Contributor {
  name: string;
  email: string;
  commit_count: number;
  last_commit_date: string;
  last_commit_message: string;
}

export async function getRecentContributors(
  input: GetRecentContributorsInput
): Promise<Contributor[]> {
  const { path, repo_path, limit, since } = input;

  const args = [
    "log",
    "--format=%aN|%aE|%aI|%s",
    `-n`,
    "500",
  ];
  if (since) {
    args.push(`--since=${since}`);
  }
  args.push("--", path);

  const output = await runGit(args, repo_path);

  const contributorMap = new Map<
    string,
    {
      email: string;
      count: number;
      lastDate: string;
      lastMessage: string;
    }
  >();

  for (const line of output.trim().split("\n")) {
    if (!line) continue;
    const [name, email, date, ...messageParts] = line.split("|");
    const message = messageParts.join("|");

    const existing = contributorMap.get(name);
    if (existing) {
      existing.count++;
    } else {
      contributorMap.set(name, {
        email,
        count: 1,
        lastDate: date,
        lastMessage: message,
      });
    }
  }

  return [...contributorMap.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, limit)
    .map(([name, data]) => ({
      name,
      email: data.email,
      commit_count: data.count,
      last_commit_date: data.lastDate,
      last_commit_message: data.lastMessage,
    }));
}

export const SearchCodebaseSchema = z.object({
  pattern: z.string().describe("Search pattern (regex supported)"),
  repo_path: z
    .string()
    .optional()
    .describe("Path to the git repository root (defaults to cwd)"),
  file_pattern: z
    .string()
    .optional()
    .describe("Glob pattern to filter files (e.g., '*.ts')"),
  max_results: z
    .number()
    .int()
    .min(1)
    .max(500)
    .default(50)
    .describe("Maximum number of matching lines to return"),
});

export type SearchCodebaseInput = z.infer<typeof SearchCodebaseSchema>;

export interface SearchMatch {
  file: string;
  line_number: number;
  content: string;
}

export interface SearchResult {
  pattern: string;
  matches: SearchMatch[];
  total_matches: number;
  truncated: boolean;
}

export async function searchCodebase(
  input: SearchCodebaseInput
): Promise<SearchResult> {
  const { pattern, repo_path, file_pattern, max_results } = input;

  const args = ["grep", "-n", "-I", "--no-color", `-E`, pattern];
  if (file_pattern) {
    args.push("--", file_pattern);
  }

  let output: string;
  try {
    output = await runGit(args, repo_path);
  } catch (err) {
    const exitCode = (err as { code?: unknown }).code;
    if (exitCode === 1) {
      return {
        pattern,
        matches: [],
        total_matches: 0,
        truncated: false,
      };
    }
    throw err;
  }

  const allMatches: SearchMatch[] = [];
  for (const line of output.trim().split("\n")) {
    if (!line) continue;
    const match = line.match(/^(.+?):(\d+):(.*)$/);
    if (match) {
      allMatches.push({
        file: match[1],
        line_number: parseInt(match[2], 10),
        content: match[3],
      });
    }
  }

  const truncated = allMatches.length > max_results;
  const matches = allMatches.slice(0, max_results);

  return {
    pattern,
    matches,
    total_matches: allMatches.length,
    truncated,
  };
}
