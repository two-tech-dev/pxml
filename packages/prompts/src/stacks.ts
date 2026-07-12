export function getStackInstructions(stack: string): { systemPrompt: string; promptNote: string } {
  const s = stack.toLowerCase();
  if (s.includes('python')) {
    return {
      systemPrompt: `You are an expert Python developer generating implementation code for a node specification.
Generate ONLY the file contents. Do not include markdown code block syntax or explanations. Only output code.
CRITICAL: Use idiomatic Python code, follow PEP 8 styling, type hints preferred.`,
      promptNote: `Stack: Python. Use standard Python practices and imports.`
    };
  }
  if (s.includes('rust')) {
    return {
      systemPrompt: `You are an expert Rust developer generating implementation code for a node specification.
Generate ONLY the file contents. Do not include markdown code block syntax or explanations. Only output code.
CRITICAL: Write clean Rust code, manage lifetimes and ownership correctly.`,
      promptNote: `Stack: Rust. Use standard Rust syntax and crate references.`
    };
  }
  if (s.includes('go') || s === 'golang') {
    return {
      systemPrompt: `You are an expert Go developer generating implementation code for a node specification.
Generate ONLY the file contents. Do not include markdown code block syntax or explanations. Only output code.
CRITICAL: Write idiomatic Go code, ensure correct package declaration, format to gofmt standards.`,
      promptNote: `Stack: Go. Use standard Go packaging and syntax.`
    };
  }
  if (s.includes('c#') || s === 'csharp' || s.includes('dotnet')) {
    return {
      systemPrompt: `You are an expert C# developer generating implementation code for a node specification.
Generate ONLY the file contents. Do not include markdown code block syntax or explanations. Only output code.
CRITICAL: Use modern C# syntax, follow standard .NET conventions.`,
      promptNote: `Stack: C# / .NET. Use standard .NET namespace and architecture.`
    };
  }
  if (s.includes('c++') || s === 'cpp') {
    return {
      systemPrompt: `You are an expert C++ developer generating implementation code for a node specification.
Generate ONLY the file contents. Do not include markdown code block syntax or explanations. Only output code.
CRITICAL: Use modern C++ standards (C++17/20), handle memory management correctly.`,
      promptNote: `Stack: C++. Use standard C++ library and syntax.`
    };
  }
  return {
    systemPrompt: `You are an expert software engineer generating implementation code for a node specification.
Generate ONLY the file contents. Do not include markdown code block syntax or explanations. Only output code.
CRITICAL: This is the COMPLETE file. Do NOT define the same export (GET, POST, default, etc.) more than once.
CRITICAL: The codebase uses ES Modules (ESM). You must STRICTLY use 'import ... from ...' syntax. NEVER generate CommonJS 'require(...)' calls.
CRITICAL: Never import from '@/*' — use relative paths only.`,
    promptNote: `Stack: JS/TS (${stack}). Ensure ES Module format.`
  };
}
