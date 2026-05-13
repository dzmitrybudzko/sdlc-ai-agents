import { describe, it, expect, vi, beforeEach } from "vitest";
import { getFileBlame, getRecentContributors, searchCodebase } from "./git-local.js";

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

vi.mock("node:util", () => ({
  promisify: (fn: unknown) => fn,
}));

import { execFile } from "node:child_process";

const mockExecFile = execFile as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetAllMocks();
});

describe("getFileBlame", () => {
  const HASH_A = "a".repeat(40);
  const HASH_B = "b".repeat(40);

  const porcelainOutput = [
    `${HASH_A} 1 1 1`,
    "author Alice Chen",
    "author-mail <alice@example.com>",
    "author-time 1700000000",
    "author-tz +0000",
    "committer Alice Chen",
    "committer-mail <alice@example.com>",
    "committer-time 1700000000",
    "committer-tz +0000",
    "summary Initial commit",
    "filename src/index.ts",
    "\tconst x = 1;",
    `${HASH_B} 2 2 1`,
    "author Bob Smith",
    "author-mail <bob@example.com>",
    "author-time 1700100000",
    "author-tz +0000",
    "committer Bob Smith",
    "committer-mail <bob@example.com>",
    "committer-time 1700100000",
    "committer-tz +0000",
    "summary Add feature",
    "filename src/index.ts",
    "\tconst y = 2;",
  ].join("\n");

  it("parses porcelain output into structured blame lines", async () => {
    mockExecFile.mockResolvedValue({ stdout: porcelainOutput });

    const result = await getFileBlame({ file_path: "src/index.ts" });

    expect(result.file_path).toBe("src/index.ts");
    expect(result.lines).toHaveLength(2);
    expect(result.total_lines).toBe(2);
  });

  it("extracts commit hash, author, date, and content correctly", async () => {
    mockExecFile.mockResolvedValue({ stdout: porcelainOutput });

    const result = await getFileBlame({ file_path: "src/index.ts" });

    expect(result.lines[0]).toEqual({
      commit: "aaaaaaaa",
      author: "Alice Chen",
      date: new Date(1700000000 * 1000).toISOString(),
      line_number: 1,
      content: "const x = 1;",
    });

    expect(result.lines[1]).toEqual({
      commit: "bbbbbbbb",
      author: "Bob Smith",
      date: new Date(1700100000 * 1000).toISOString(),
      line_number: 2,
      content: "const y = 2;",
    });
  });

  it("returns unique contributors", async () => {
    mockExecFile.mockResolvedValue({ stdout: porcelainOutput });

    const result = await getFileBlame({ file_path: "src/index.ts" });

    expect(result.contributors).toEqual(["Alice Chen", "Bob Smith"]);
  });

  it("deduplicates contributors when same author has multiple lines", async () => {
    const hash = "c".repeat(40);
    const sameAuthorOutput = [
      `${hash} 1 1 1`,
      "author Alice Chen",
      "author-time 1700000000",
      "\tline one",
      `${hash} 2 2 1`,
      "author Alice Chen",
      "author-time 1700000000",
      "\tline two",
    ].join("\n");

    mockExecFile.mockResolvedValue({ stdout: sameAuthorOutput });

    const result = await getFileBlame({ file_path: "src/index.ts" });

    expect(result.contributors).toEqual(["Alice Chen"]);
    expect(result.lines).toHaveLength(2);
  });

  it("passes repo_path as cwd to git", async () => {
    mockExecFile.mockResolvedValue({ stdout: "" });

    await getFileBlame({ file_path: "src/index.ts", repo_path: "/custom/repo" });

    expect(mockExecFile).toHaveBeenCalledWith(
      "git",
      ["blame", "--porcelain", "src/index.ts"],
      expect.objectContaining({ cwd: "/custom/repo" })
    );
  });

  it("returns empty result for empty git output", async () => {
    mockExecFile.mockResolvedValue({ stdout: "" });

    const result = await getFileBlame({ file_path: "empty.ts" });

    expect(result.lines).toEqual([]);
    expect(result.total_lines).toBe(0);
    expect(result.contributors).toEqual([]);
  });

  it("propagates git errors", async () => {
    mockExecFile.mockRejectedValue(new Error("fatal: no such path 'missing.ts'"));

    await expect(getFileBlame({ file_path: "missing.ts" })).rejects.toThrow(
      "fatal: no such path"
    );
  });
});

describe("getRecentContributors", () => {
  const gitLogOutput = [
    "Alice Chen|alice@example.com|2024-06-15T10:00:00+00:00|Add auth module",
    "Bob Smith|bob@example.com|2024-06-14T09:00:00+00:00|Fix login bug",
    "Alice Chen|alice@example.com|2024-06-13T08:00:00+00:00|Refactor middleware",
    "Carol Jones|carol@example.com|2024-06-12T07:00:00+00:00|Update deps",
  ].join("\n");

  it("aggregates commits by author and sorts by count descending", async () => {
    mockExecFile.mockResolvedValue({ stdout: gitLogOutput });

    const result = await getRecentContributors({ path: "src/", limit: 10 });

    expect(result[0].name).toBe("Alice Chen");
    expect(result[0].commit_count).toBe(2);
    expect(result[1].name).toBe("Bob Smith");
    expect(result[1].commit_count).toBe(1);
    expect(result[2].name).toBe("Carol Jones");
    expect(result[2].commit_count).toBe(1);
  });

  it("respects the limit parameter", async () => {
    mockExecFile.mockResolvedValue({ stdout: gitLogOutput });

    const result = await getRecentContributors({ path: "src/", limit: 2 });

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("Alice Chen");
    expect(result[1].name).toBe("Bob Smith");
  });

  it("returns last commit date and message for each contributor", async () => {
    mockExecFile.mockResolvedValue({ stdout: gitLogOutput });

    const result = await getRecentContributors({ path: "src/", limit: 10 });

    expect(result[0].last_commit_date).toBe("2024-06-15T10:00:00+00:00");
    expect(result[0].last_commit_message).toBe("Add auth module");
    expect(result[0].email).toBe("alice@example.com");
  });

  it("handles commit messages containing pipe characters", async () => {
    const outputWithPipe = "Dev User|dev@test.com|2024-01-01T00:00:00+00:00|fix: A|B test case\n";
    mockExecFile.mockResolvedValue({ stdout: outputWithPipe });

    const result = await getRecentContributors({ path: "src/", limit: 10 });

    expect(result[0].last_commit_message).toBe("fix: A|B test case");
  });

  it("passes --since flag when provided", async () => {
    mockExecFile.mockResolvedValue({ stdout: "" });

    await getRecentContributors({ path: "src/", limit: 10, since: "2024-01-01" });

    expect(mockExecFile).toHaveBeenCalledWith(
      "git",
      expect.arrayContaining(["--since=2024-01-01"]),
      expect.any(Object)
    );
  });

  it("returns empty array for empty git log", async () => {
    mockExecFile.mockResolvedValue({ stdout: "" });

    const result = await getRecentContributors({ path: "src/", limit: 10 });

    expect(result).toEqual([]);
  });
});

describe("searchCodebase", () => {
  const grepOutput = [
    "src/index.ts:5:import { Router } from 'express';",
    "src/app.ts:12:const router = new Router();",
    "src/routes.ts:1:import { Router } from 'express';",
  ].join("\n");

  it("parses git grep output into structured matches", async () => {
    mockExecFile.mockResolvedValue({ stdout: grepOutput });

    const result = await searchCodebase({ pattern: "Router", max_results: 50 });

    expect(result.matches).toHaveLength(3);
    expect(result.total_matches).toBe(3);
    expect(result.truncated).toBe(false);
  });

  it("extracts file, line number, and content from each match", async () => {
    mockExecFile.mockResolvedValue({ stdout: grepOutput });

    const result = await searchCodebase({ pattern: "Router", max_results: 50 });

    expect(result.matches[0]).toEqual({
      file: "src/index.ts",
      line_number: 5,
      content: "import { Router } from 'express';",
    });
  });

  it("truncates results when exceeding max_results", async () => {
    mockExecFile.mockResolvedValue({ stdout: grepOutput });

    const result = await searchCodebase({ pattern: "Router", max_results: 2 });

    expect(result.matches).toHaveLength(2);
    expect(result.total_matches).toBe(3);
    expect(result.truncated).toBe(true);
  });

  it("returns empty results when git grep exits with code 1 (no matches)", async () => {
    const err = new Error("exit code 1") as Error & { code: number };
    err.code = 1;
    mockExecFile.mockRejectedValue(err);

    const result = await searchCodebase({ pattern: "nonexistent", max_results: 50 });

    expect(result.matches).toEqual([]);
    expect(result.total_matches).toBe(0);
    expect(result.truncated).toBe(false);
  });

  it("propagates errors other than exit code 1", async () => {
    const err = new Error("fatal: not a git repository") as Error & { code: number };
    err.code = 128;
    mockExecFile.mockRejectedValue(err);

    await expect(searchCodebase({ pattern: "test", max_results: 50 })).rejects.toThrow(
      "fatal: not a git repository"
    );
  });

  it("passes file_pattern as glob filter to git grep", async () => {
    mockExecFile.mockResolvedValue({ stdout: "" });

    await searchCodebase({ pattern: "TODO", max_results: 50, file_pattern: "*.ts" });

    expect(mockExecFile).toHaveBeenCalledWith(
      "git",
      ["grep", "-n", "-I", "--no-color", "-E", "TODO", "--", "*.ts"],
      expect.any(Object)
    );
  });

  it("preserves the search pattern in the result", async () => {
    mockExecFile.mockResolvedValue({ stdout: "" });

    const result = await searchCodebase({ pattern: "my-regex.*", max_results: 50 });

    expect(result.pattern).toBe("my-regex.*");
  });
});
