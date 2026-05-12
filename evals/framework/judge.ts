import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";

export interface EvalCriterion {
  name: string;
  description: string;
  threshold: number;
}

export interface EvalCase {
  input: string;
  expected_issues: string[];
  severity: string;
}

export interface CriterionScore {
  criterion: string;
  score: number;
  threshold: number;
  passed: boolean;
  reasoning: string;
}

export interface EvalResult {
  case_index: number;
  input_preview: string;
  scores: CriterionScore[];
  overall_pass: boolean;
}

export interface EvalSummary {
  agent: string;
  total_cases: number;
  passed_cases: number;
  criterion_averages: Record<string, { average: number; threshold: number; passed: boolean }>;
  overall_pass: boolean;
  results: EvalResult[];
}

const client = new Anthropic();

export async function judgeOutput(
  agentOutput: string,
  expectedIssues: string[],
  criteria: EvalCriterion[]
): Promise<CriterionScore[]> {
  const criteriaText = criteria
    .map(
      (c) =>
        `- ${c.name} (threshold: ${c.threshold}/10): ${c.description}`
    )
    .join("\n");

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `You are an evaluation judge. Grade the following agent output against the expected issues and criteria.

## Expected Issues
${expectedIssues.map((i) => `- ${i}`).join("\n")}

## Agent Output
${agentOutput}

## Grading Criteria
${criteriaText}

## Instructions
For each criterion, provide:
1. A score from 0 to 10
2. A brief reasoning (one sentence)

Respond in this exact JSON format (no other text):
{
  "scores": [
    {"criterion": "<name>", "score": <number>, "reasoning": "<text>"}
  ]
}`,
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";
  const parsed = JSON.parse(text) as {
    scores: Array<{ criterion: string; score: number; reasoning: string }>;
  };

  return parsed.scores.map((s) => {
    const criterion = criteria.find((c) => c.name === s.criterion);
    const threshold = criterion?.threshold ?? 7;
    return {
      criterion: s.criterion,
      score: s.score,
      threshold,
      passed: s.score >= threshold,
      reasoning: s.reasoning,
    };
  });
}

export async function runEvalSuite(
  agentName: string,
  datasetPath: string,
  criteriaPath: string,
  agentFn: (input: string) => Promise<string>
): Promise<EvalSummary> {
  const dataset = readFileSync(datasetPath, "utf-8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as EvalCase);

  const criteriaText = readFileSync(criteriaPath, "utf-8");
  const criteria = parseCriteria(criteriaText);

  const results: EvalResult[] = [];

  for (let i = 0; i < dataset.length; i++) {
    const testCase = dataset[i];
    console.log(
      `  Running case ${i + 1}/${dataset.length}: ${testCase.expected_issues[0]}...`
    );

    const agentOutput = await agentFn(testCase.input);
    const scores = await judgeOutput(
      agentOutput,
      testCase.expected_issues,
      criteria
    );

    results.push({
      case_index: i,
      input_preview: testCase.input.substring(0, 80) + "...",
      scores,
      overall_pass: scores.every((s) => s.passed),
    });
  }

  const criterionAverages: Record<
    string,
    { average: number; threshold: number; passed: boolean }
  > = {};

  for (const c of criteria) {
    const scores = results.flatMap((r) =>
      r.scores.filter((s) => s.criterion === c.name).map((s) => s.score)
    );
    const average =
      scores.length > 0
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : 0;
    criterionAverages[c.name] = {
      average: Math.round(average * 10) / 10,
      threshold: c.threshold,
      passed: average >= c.threshold,
    };
  }

  return {
    agent: agentName,
    total_cases: dataset.length,
    passed_cases: results.filter((r) => r.overall_pass).length,
    criterion_averages: criterionAverages,
    overall_pass: Object.values(criterionAverages).every((c) => c.passed),
    results,
  };
}

function parseCriteria(text: string): EvalCriterion[] {
  const criteria: EvalCriterion[] = [];
  const lines = text.split("\n");

  let currentName = "";
  let currentDesc = "";
  let currentThreshold = 7;

  for (const line of lines) {
    const headerMatch = line.match(/^###\s+(.+)/);
    if (headerMatch) {
      if (currentName) {
        criteria.push({
          name: currentName,
          description: currentDesc.trim(),
          threshold: currentThreshold,
        });
      }
      currentName = headerMatch[1].trim();
      currentDesc = "";
      currentThreshold = 7;
      continue;
    }

    const thresholdMatch = line.match(
      /[Tt]hreshold:\s*(\d+(?:\.\d+)?)/
    );
    if (thresholdMatch) {
      currentThreshold = parseFloat(thresholdMatch[1]);
    }

    if (currentName && line.trim() && !line.startsWith("#")) {
      currentDesc += line.trim() + " ";
    }
  }

  if (currentName) {
    criteria.push({
      name: currentName,
      description: currentDesc.trim(),
      threshold: currentThreshold,
    });
  }

  return criteria;
}

export function printSummary(summary: EvalSummary): void {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Evaluation Results: ${summary.agent}`);
  console.log(`${"=".repeat(60)}\n`);

  console.log("| Criterion          | Average | Threshold | Status |");
  console.log("|-------------------|---------|-----------|--------|");

  for (const [name, data] of Object.entries(summary.criterion_averages)) {
    const status = data.passed ? "PASS" : "FAIL";
    console.log(
      `| ${name.padEnd(18)} | ${String(data.average).padEnd(7)} | ${String(data.threshold).padEnd(9)} | ${status.padEnd(6)} |`
    );
  }

  console.log(
    `\nCases passed: ${summary.passed_cases}/${summary.total_cases}`
  );
  console.log(
    `Overall: ${summary.overall_pass ? "PASS" : "NEEDS IMPROVEMENT"}`
  );

  if (!summary.overall_pass) {
    const failed = Object.entries(summary.criterion_averages)
      .filter(([, d]) => !d.passed)
      .map(([name, d]) => `${name} (${d.average} < ${d.threshold})`)
      .join(", ");
    console.log(`Failed criteria: ${failed}`);
  }
}

if (process.argv[1] && process.argv.includes("--agent")) {
  const agentIndex = process.argv.indexOf("--agent");
  const agentName = process.argv[agentIndex + 1];

  if (!agentName) {
    console.error("Usage: tsx framework/judge.ts --agent <agent-name>");
    process.exit(1);
  }

  const evalDir = resolve(dirname(process.argv[1]), "..", agentName);
  const datasetPath = resolve(evalDir, "dataset.jsonl");
  const criteriaPath = resolve(evalDir, "criteria.md");

  console.log(`Running evals for agent: ${agentName}`);
  console.log(`Dataset: ${datasetPath}`);
  console.log(`Criteria: ${criteriaPath}\n`);

  const mockAgentFn = async (input: string): Promise<string> => {
    return `[Mock agent output for: ${input.substring(0, 50)}...]`;
  };

  runEvalSuite(agentName, datasetPath, criteriaPath, mockAgentFn).then(
    (summary) => {
      printSummary(summary);
      process.exit(summary.overall_pass ? 0 : 1);
    }
  );
}
