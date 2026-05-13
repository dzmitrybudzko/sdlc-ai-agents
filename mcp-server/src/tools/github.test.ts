import { describe, it, expect, vi, beforeEach } from "vitest";
import { getPrDiff, listOpenIssues } from "./github.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});

describe("getPrDiff", () => {
  const prMetadata = {
    title: "Add rate limiting",
    changed_files: 3,
    additions: 120,
    deletions: 15,
  };

  const diffText = `diff --git a/src/app.ts b/src/app.ts
--- a/src/app.ts
+++ b/src/app.ts
@@ -1,3 +1,5 @@
+import { rateLimit } from './middleware';
 const app = express();`;

  function mockPrResponses(): void {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => prMetadata,
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => diffText,
      });
  }

  it("returns PR metadata and diff", async () => {
    mockPrResponses();

    const result = await getPrDiff({ owner: "acme", repo: "api", pr_number: 42 });

    expect(result.pr_number).toBe(42);
    expect(result.title).toBe("Add rate limiting");
    expect(result.files_changed).toBe(3);
    expect(result.additions).toBe(120);
    expect(result.deletions).toBe(15);
    expect(result.diff).toContain("rateLimit");
  });

  it("makes two requests to the correct GitHub API URL", async () => {
    mockPrResponses();

    await getPrDiff({ owner: "acme", repo: "api", pr_number: 42 });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[0][0]).toBe(
      "https://api.github.com/repos/acme/api/pulls/42"
    );
    expect(mockFetch.mock.calls[1][0]).toBe(
      "https://api.github.com/repos/acme/api/pulls/42"
    );
  });

  it("sends JSON accept header for metadata and diff accept for diff", async () => {
    mockPrResponses();

    await getPrDiff({ owner: "acme", repo: "api", pr_number: 42 });

    const metadataHeaders = mockFetch.mock.calls[0][1].headers;
    expect(metadataHeaders.Accept).toBe("application/vnd.github.v3+json");

    const diffHeaders = mockFetch.mock.calls[1][1].headers;
    expect(diffHeaders.Accept).toBe("application/vnd.github.v3.diff");
  });

  it("includes Authorization header when GITHUB_TOKEN is set", async () => {
    vi.stubEnv("GITHUB_TOKEN", "ghp_test123");
    mockPrResponses();

    await getPrDiff({ owner: "acme", repo: "api", pr_number: 42 });

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers.Authorization).toBe("Bearer ghp_test123");
  });

  it("omits Authorization header when GITHUB_TOKEN is not set", async () => {
    delete process.env.GITHUB_TOKEN;
    mockPrResponses();

    await getPrDiff({ owner: "acme", repo: "api", pr_number: 42 });

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers.Authorization).toBeUndefined();
  });

  it("throws on non-OK metadata response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
    });

    await expect(
      getPrDiff({ owner: "acme", repo: "api", pr_number: 9999 })
    ).rejects.toThrow("GitHub API error fetching PR #9999: 404 Not Found");
  });

  it("throws on non-OK diff response", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => prMetadata,
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: "Forbidden",
      });

    await expect(
      getPrDiff({ owner: "acme", repo: "api", pr_number: 42 })
    ).rejects.toThrow("GitHub API error fetching diff for PR #42: 403 Forbidden");
  });
});

describe("listOpenIssues", () => {
  const issuesResponse = [
    {
      number: 1,
      title: "Login broken on Safari",
      state: "open",
      labels: [{ name: "bug" }, { name: "P1" }],
      assignees: [{ login: "alice" }],
      created_at: "2024-06-01T10:00:00Z",
      updated_at: "2024-06-05T14:00:00Z",
      html_url: "https://github.com/acme/api/issues/1",
    },
    {
      number: 7,
      title: "Add dark mode",
      state: "open",
      labels: [{ name: "enhancement" }],
      assignees: [],
      created_at: "2024-06-10T08:00:00Z",
      updated_at: "2024-06-10T08:00:00Z",
      html_url: "https://github.com/acme/api/issues/7",
    },
  ];

  it("returns mapped issues with flattened labels and assignees", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => issuesResponse,
    });

    const result = await listOpenIssues({ owner: "acme", repo: "api", limit: 30 });

    expect(result).toHaveLength(2);

    expect(result[0]).toEqual({
      number: 1,
      title: "Login broken on Safari",
      state: "open",
      labels: ["bug", "P1"],
      assignees: ["alice"],
      created_at: "2024-06-01T10:00:00Z",
      updated_at: "2024-06-05T14:00:00Z",
      url: "https://github.com/acme/api/issues/1",
    });

    expect(result[1].labels).toEqual(["enhancement"]);
    expect(result[1].assignees).toEqual([]);
  });

  it("passes state=open and per_page to the API", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => [] });

    await listOpenIssues({ owner: "acme", repo: "api", limit: 15 });

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("state=open");
    expect(url).toContain("per_page=15");
  });

  it("passes labels filter when provided", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => [] });

    await listOpenIssues({ owner: "acme", repo: "api", limit: 30, labels: "bug,P1" });

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("labels=bug%2CP1");
  });

  it("omits labels param when not provided", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => [] });

    await listOpenIssues({ owner: "acme", repo: "api", limit: 30 });

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).not.toContain("labels=");
  });

  it("throws on non-OK response", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
    });

    await expect(
      listOpenIssues({ owner: "acme", repo: "api", limit: 30 })
    ).rejects.toThrow("GitHub API error listing issues: 401 Unauthorized");
  });

  it("returns empty array for repo with no open issues", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => [] });

    const result = await listOpenIssues({ owner: "acme", repo: "api", limit: 30 });

    expect(result).toEqual([]);
  });
});
