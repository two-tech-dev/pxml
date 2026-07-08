# pxml Compiler

`pxml` is a structured XML DSL and compiler for AI-driven code generation. Instead of writing free-form prompts, you specify your web application architecture in XML, manage modifications using a Manifest, and allow the AI to perform local self-healing repairs at minimal cost.

## Installation

Install the compiler globally via npm:
```bash
npm install -g @two-tech-dev/pxml
```

## End-to-End Getting Started Guide

### 1. Initialize Sample Project
```bash
pxml init
```
This command initializes the folder structure:
- `project.xml`: main config file that imports defined flows and local packages.
- `flows/blog.xml`: defines individual nodes (e.g. `api.posts.create`) containing paths, constraints, and test scenarios.
- `packages/`: directory to save local packages (initialized with a sample plugin `init-nextjs-project`).

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

# Disable automatic AI test generation to save tokens
pxml compile --no-autogen-tests
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

#### Regression Prevention via `bugs_history.xml`
You can document persistent bugs in `bugs_history.xml`. When you run `pxml fix`, the compiler automatically aggregates these descriptions and feeds them to the AI to prevent code regressions. 

To enable editor validation and autocomplete, link your `bugs_history.xml` file to the provided `bugs.xsd` schema:
```xml
<bugs xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xsi:noNamespaceSchemaLocation="bugs.xsd">
  <bug id="cart.badge" flow="cart.view">
    Cart badge count displays 0 despite items being in the shopping cart database. Always fetch active cart status from the backend database route instead of localStorage.
  </bug>
</bugs>
```

### 5. Validate Specifications (Validate)
```bash
pxml validate
```
This validates your XML configuration files. It checks:
- Standard XML schema compliance.
- Nodes defining `<output>` fields must contain at least one `<test>` case (prevents deployment failures due to missing tests; ignores `db-model` and `setup-command` nodes).
- All required inputs declared in `<input>` must be supplied in test `<given>` parameters (either at root, in `body`, `query`, or `headers`).
- Test `<given>` parameters cannot contain extra fields not declared in `<input>` to prevent spec inconsistencies.

### 6. Validate Environment (Doctor)
```bash
pxml doctor
```
Checks tool environment settings and required environment keys.

### 7. Migrate Project to Latest Syntax (Migrate)
```bash
pxml migrate
```
Updates all project XML files (`project.xml`, `flows/*.xml`, `packages/*/project.xml`) to the latest pxml syntax standard:
- Adds `autogen-tests="true" on `<project>` and `<node>` elements
- Updates `xsi:noNamespaceSchemaLocation` to correct relative paths
- Copies latest `pxml.xsd` and `bugs.xsd` schemas to project root

### 8. Token Usage & Cost Statistics
After executing `pxml compile` or `pxml fix`, the CLI outputs a comprehensive token usage summary (Input, Output, and Cached tokens) along with an estimated dollar cost based on the active LLM provider rates.

### 9. Multi-Stack Support
`pxml` supports non-JS/TS stacks (e.g. `python`, `rust`, `go`) by dynamically adjusting the code generator's prompt guidelines and style directives to match the `<project>` `stack` attribute.

### 10. XML Schema Autocomplete & Validation
To get XML autocomplete, inline documentation, and real-time syntax checking in editors like VS Code, associate your `.xml` files with the provided `pxml.xsd` schema:

### Controlling AI Test Generation
You can control per-project or per-node whether the AI should automatically generate test files. Set `autogen-tests="false"` on the `<project>` or `<node>` element to skip AI test generation (saves token costs). Equivalent CLI flag: `--no-autogen-tests`.
```xml
<project name="my-app" stack="nextjs" version="0.1.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:noNamespaceSchemaLocation="pxml.xsd">
  ...
</project>
```
*(Requires VS Code XML extension by Red Hat or equivalent)*
