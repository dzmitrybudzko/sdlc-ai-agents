import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runEvalSuite, printSummary } from "../framework/judge.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const client = new Anthropic();

const agentSystemPrompt = readFileSync(
  resolve(__dirname, "../../.claude/agents/code-reviewer.md"),
  "utf-8"
);

async function codeReviewerAgent(input: string): Promise<string> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: agentSystemPrompt,
    messages: [
      {
        role: "user",
        content: `Review the following code for bugs, security vulnerabilities, performance issues, and style violations:\n\n\`\`\`\n${input}\n\`\`\``,
      },
    ],
  });

  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

async function main(): Promise<void> {
  console.log("Running code-reviewer evaluation...\n");

  const datasetPath = resolve(__dirname, "dataset.jsonl");
  const criteriaPath = resolve(__dirname, "criteria.md");

  const summary = await runEvalSuite(
    "code-reviewer",
    datasetPath,
    criteriaPath,
    codeReviewerAgent
  );

  printSummary(summary);
  process.exit(summary.overall_pass ? 0 : 1);
}

main().catch((err) => {
  console.error("Eval run failed:", err);
  process.exit(1);
});
