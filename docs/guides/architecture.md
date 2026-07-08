# Architecture Overview

`pxml` is a compilation and orchestration framework that compiles structured project specifications (XML DSL) into runnable codebases using Large Language Models (LLMs).

## Core Concepts

### 1. Unified Flat Abstract Syntax Tree (AST)
Rather than compiling isolated files, the compiler reads a main entry file (e.g. `project.xml`), recursively resolves all external `<import>` nodes, namespaces references, flat-maps inherited templates (`extends`), and validates the merged tree using a strict Zod schema.

```
project.xml (imports blog.xml) 
   └── blog.xml (imports types.xml) 
          └── types.xml (base schema templates)
```

The resulting parsed structure is a single, flat array of nodes in memory containing fully-qualified identifiers (e.g. `blog:types:base.api-route`).

### 2. Dependency Graph & Topological Execution
To ensure code is generated in the correct order, the compiler builds a dependency graph mapping node dependencies (`depends_on`). 
- Node configurations/APIs are compiled *before* the components or pages that call them.
- Circular dependencies are identified at build-time using a DFS search order traversal and immediately halt execution.

### 3. Local Self-Healing Loop
When tests fail, instead of regenerating the entire codebase from scratch, the CLI uses the compiled manifest and execution logs to trace failures back to specific nodes. It then prompts the AI to generate a precise git-like SEARCH/REPLACE patch block (using `<<<<<<< SEARCH / ======= / >>>>>>> REPLACE`), runs tests again to confirm the fix, and allows up to 3 automatic repair iterations.
