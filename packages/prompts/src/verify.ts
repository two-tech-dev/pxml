export const VERIFY_SYSTEM = `You are a senior code reviewer. Return ONLY the corrected code or the exact word 'STABLE'. Do not include markdown code blocks or explanations.`;

export function verifyUserPrompt(opts: {
  nodeId: string;
  path: string;
  constraints: { verify: string; description: string }[];
  code: string;
}): string {
  return `Verify the correctness and deployment stability of the following generated code for node '${opts.nodeId}'.
Destination Path: ${opts.path}
Constraints:
${opts.constraints.map(c => `  - [${c.verify}] ${c.description}`).join('\n')}

Generated Code:
\`\`\`
${opts.code}
\`\`\`

Analyze the code. Are there any bugs, schema inconsistencies, or missing imports/exports?
In particular, check that EVERY import statement resolves to a real file or npm package.
The installed UI library lives under '@/components/ui/...' (real files). Bare package-name imports are NOT valid.
If there are issues, output the corrected code. If the code is fully stable, output the word "STABLE".`;
}
