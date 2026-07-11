import { CodegenContext } from './types.js';

export function codegenSystemPrompt(ctx: CodegenContext): string {
  return '';
}

export function codegenUserPrompt(ctx: CodegenContext): string {
  const ext = ctx.node.extends
    ? `- Extends Base Component: ${ctx.node.extends}\n  (Inline its sub-components; do NOT import it as a module.)\n`
    : '';

  const imageBlock = ctx.images.length > 0
    ? `\nReference Images (screenshots/designs to match):\n${ctx.images.length} image(s) attached below.\n`
    : '';

  return `Project Context:
${ctx.projectContext}

Generate implementation file for this node:
- ID: ${ctx.node.id}
- Type: ${ctx.node.type}
- Flow: ${ctx.node.flow}
- Destination Path: ${ctx.node.path}
- Input Fields: ${JSON.stringify(ctx.node.input)}
- Output Fields: ${JSON.stringify(ctx.node.output)}
- ${ctx.promptNote}
${ext}- Constraints:
${ctx.node.constraints.map(c => `  - [${c.verify}] ${c.description}${c.learnedFrom ? ` (bug fix: ${c.learnedFrom})` : ''}`).join('\n')}
${imageBlock}
Generate the cleanest code matching this specification. Do not include markdown wrapping or explanation.`;
}
