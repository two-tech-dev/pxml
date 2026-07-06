# pxml Compiler

`pxml` is a structured XML DSL and compiler for AI-driven code generation. Instead of writing free-form prompts, you specify your web application architecture in XML, manage modifications using a Manifest, and allow the AI to perform local self-healing repairs at minimal cost.

## End-to-End Getting Started Guide

### 1. Initialize Sample Project
```bash
pxml init
```
This command initializes the folder structure:
- `project.xml`: main config file that imports defined flows.
- `flows/blog.xml`: defines individual nodes (e.g. `api.posts.create`) containing paths, constraints, and test scenarios.

### 2. Compile Specification (Compile)
Ensure you set the environment variable `ANTHROPIC_API_KEY` (or `OPENAI_API_KEY` if using OpenAI):
```bash
export ANTHROPIC_API_KEY="your-api-key"
pxml compile

# Or using OpenAI provider
export OPENAI_API_KEY="your-api-key"
pxml compile --provider openai --model gpt-4o

# Or using Ollama provider locally
pxml compile --provider ollama --model llama3 --baseUrl http://localhost:11434
```
Or check the compile execution plan with `--dry-run`:
```bash
pxml compile --dry-run
```

### 3. Run Self-Generated Tests (Test)
```bash
pxml test
```
This compiles the `<test>` tags into Vitest files and runs them, saving the outcome to `.pxml/manifest.json`.

### 4. Self-Healing Bug Repairs (Fix)
If any test fails, instead of regenerating the entire codebase, you can execute a target self-healing fix:
```bash
pxml fix --flow=blog.write

# Or using OpenAI provider
pxml fix --flow=blog.write --provider openai --model gpt-4o

# Or using Ollama provider locally
pxml fix --flow=blog.write --provider ollama --model llama3 --baseUrl http://localhost:11434
```
This formulates a minimal context patch prompt and retries local SEARCH/REPLACE edits up to 3 times.

### 5. Validate Environment (Doctor)
```bash
pxml doctor
```
Checks tool environment settings and required environment keys.

### 6. XML Schema Autocomplete & Validation
To get XML autocomplete, inline documentation, and real-time syntax checking in editors like VS Code, associate your `.xml` files with the provided `pxml.xsd` schema:
```xml
<project name="my-app" stack="nextjs" version="0.1.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:noNamespaceSchemaLocation="pxml.xsd">
  ...
</project>
```
*(Requires VS Code XML extension by Red Hat or equivalent)*
