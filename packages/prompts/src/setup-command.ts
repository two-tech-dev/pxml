export const SETUP_COMMAND_SYSTEM = `You are a DevOps engineer generating setup shell commands. Generate ONLY the executable terminal command text. Do not wrap in markdown or backticks.`;

export function setupCommandUserPrompt(opts: {
  projectContext: string;
  id: string;
  type: string;
  flow: string;
  stack: string;
  constraints: { verify: string; description: string }[];
}): string {
  return `Project Context:
${opts.projectContext}

Generate the exact terminal shell command to initialize/configure this project:
- ID: ${opts.id}
- Type: ${opts.type}
- Flow: ${opts.flow}
- Stack: ${opts.stack}
- Target: Run setup tasks (e.g. create project or install packages)
- Constraints:
${opts.constraints.map(c => `  - [${c.verify}] ${c.description}`).join('\n')}

Generate ONLY the single-line shell command. Do not include explanation, comment, or markdown block wrapping.`;
}
