export interface NodeInfo {
  id: string;
  type: string;
  flow: string;
  path: string;
  input: { name: string; type: string; required?: boolean; format?: string }[];
  output: { name: string; type: string; required?: boolean; format?: string }[];
  constraints: { verify: string; description: string; learnedFrom?: string }[];
  tests?: {
    name: string;
    description?: string;
    expect?: any;
    given?: any;
  }[];
  extends?: string;
}

export interface CodegenContext {
  node: NodeInfo;
  projectContext: string;
  stack: string;
  promptNote: string;
  images: string[];
  importStatement: string;
}

export interface TestContext {
  node: NodeInfo;
  implementationCode: string;
  testPath: string;
  existingTestCode: string;
  testFileExists: boolean;
  importStatement: string;
}

export interface CombinedTestContext {
  nodes: { node: NodeInfo; implCode: string }[];
  sections: string;
}

export interface FixContext {
  node: NodeInfo;
  testFilePath: string;
  currentCode: string;
  currentTestCode: string;
  testOutput: string;
  bugContext: string;
  failedCases: string[];
  importRules: string;
}

export interface ValidateFixContext {
  node: NodeInfo;
  errors: string;
  currentCode: string;
  importRules: string;
}

export interface BuildFixContext {
  errors: string;
}

export interface PromptTemplate<Ctx> {
  system: string;
  user: (ctx: Ctx) => string;
}

export interface PromptSet {
  name: string;
  version: string;
  codegen: PromptTemplate<CodegenContext>;
  setupCommand: PromptTemplate<CodegenContext>;
  verify: PromptTemplate<{ node: NodeInfo; code: string }>;
  validateFix: PromptTemplate<ValidateFixContext>;
  fixLoop: PromptTemplate<FixContext>;
  buildFix: PromptTemplate<BuildFixContext>;
  testGenerate: { system: string; newTest: (ctx: TestContext) => string; updateTest: (ctx: TestContext) => string };
  combinedTest: PromptTemplate<CombinedTestContext>;
  getStackInstructions: (stack: string) => { systemPrompt: string; promptNote: string };
  getImportRules: () => string;
}
