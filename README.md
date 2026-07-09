# pxml Compiler

`pxml` is a structured XML DSL and compiler for AI-driven code generation. Instead of writing free-form prompts, you specify your web application architecture in XML, manage modifications using a Manifest, and allow the AI to perform local self-healing repairs at minimal cost.

## Why pxml? (Free-form Prompts vs. pxml)

### 1. Defining an API endpoint (same outcome, different approach)

**Free-form prompt (what you type today):**
> _"Create a Next.js API route at `app/api/posts/route.ts` that uses better-sqlite3, creates a 'posts' table if it doesn't exist, handles POST to insert a new post with title/content, and handles GET to list all posts. Make it dynamic, not cached."_

**pxml (what you write instead):**
```xml
<node id="api.posts.create" type="api-route" flow="blog.write">
  <meta><path>app/api/posts/route.ts</path></meta>
  <input>
    <field name="title" type="string" required="true" />
    <field name="content" type="string" required="true" />
  </input>
  <test>
    <given>
      <body json="true">
        <title>Hello</title>
        <content>My post</content>
      </body>
    </given>
    <expect><status>200</status></expect>
  </test>
</node>
```

**Why it matters:** The prompt is brittle — one typo, one ambiguous phrase, and the LLM generates broken or diverging code. The XML is a structured spec: the AI can only generate code that fits the declared schema, and the `<test>` block is automatically compiled into an executable Vitest file that proves the code works.

### 2. Fixing a failing endpoint (compare the workflows)

**Free-form (when you discover `/api/posts` returns 500):**
1. Copy the error message into a new chat.
2. Paste your entire `route.ts` file.
3. Write: _"The POST handler is broken, fix it."_
4. The LLM regenerates the **entire** file — possibly breaking other parts.
5. No automated re-test; you manually verify in browser.
6. Next session: AI forgets this ever happened.

**pxml (`pxml fix --flow=blog.write`):**
1. Failing test is already recorded in `.pxml/manifest.json`.
2. AI receives only: the failing test name, the current source file, and the `bugs_history.xml` context.
3. AI emits a **surgical SEARCH/REPLACE patch** changing only the broken lines.
4. The test runner automatically re-executes the suite.
5. Retries up to 3 times if the fix doesn't pass.
6. Root cause is recorded in `bugs_history.xml` — future fixes will never reproduce it.

### 3. Feature comparison

| Feature | Free-form Prompting (ChatGPT, Cursor) | pxml Specification-driven Compilation |
| :--- | :--- | :--- |
| **Input format** | Paragraphs of natural language | Declarative XML with typed inputs, outputs, constraints |
| **Validation** | None (you discover mistakes at runtime) | Schema validation before any LLM call (`pxml validate`) |
| **Execution order** | AI guesses dependencies (often wrong) | Topological sort from explicit `<depends_on>` (guaranteed correct) |
| **Tests** | You write tests separately (or skip them) | `<test>` blocks auto-compiled to Vitest, run automatically |
| **Bug fixing** | Re-prompt with full file — regenerates everything, risks regression | Partial `SEARCH/REPLACE` patch — only broken lines change |
| **Regression prevention** | None — each chat session starts from scratch | `bugs_history.xml` permanently attached to every fix prompt |
| **Token cost** | Unpredictable (entire files in/out each turn) | Measured per-node, printed in dollars after every compile/fix |
| **Delivery guarantee** | Best-effort (AI may skip constraints) | Test suite must pass before fix is accepted |

### 4. Enterprise governance (managing AI projects at scale)

**The problem with free-form prompts in a team:**
- Developer A writes a blog CRUD prompt → gets a working API.
- Developer B writes "blog CRUD" differently → gets a slightly different implementation.
- Developer C wants to review what A and B actually asked the AI → there's no diff, no PR, no audit trail.
- QA finds a bug → nobody knows which prompt version caused it.
- New hire joins → reads 200 chat transcripts to understand the project.
- CTO asks "how much did AI codegen cost this sprint" → zero data.

**With pxml in an enterprise:**
- Every "prompt" is a file in git → PR reviewable, diffable, revertable.
- Schema (`pxml.xsd`) enforces consistent structure across all teams → no more "coding style by who wrote the prompt".
- `bugs_history.xml` serves as a permanent institutional memory → bugs never resurface in any team's work.
- `pxml compile` outputs per-node dollar cost → finance has actual data.
- CI/CD pipeline runs `pxml validate && pxml compile --dry-run` on every PR → catches spec errors before they reach production.
- Onboarding: new dev reads the `.xml` files → understands the entire app architecture in 10 minutes, not 2 days of chat archaeology.

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
- `pxml.json`: manifest tracking the pxml version and installed packages.

### 1.5. Install Packages (Optional)

**Via manifest (recommended):** add the package URL to `pxml.json`, then run:

```bash
pxml install   # or: pxml i
```

`pxml.json` example:
```json
{
  "pxml": "0.4.2",
  "packages": {
    "ui-ux-components-pxml": "https://github.com/two-tech-dev/ui-ux-components-pxml.git"
  }
}
```

This clones each package into `packages/<name>/` and binds its editor schema
automatically (skips already-installed ones).

**Ad-hoc:** install a single package without editing the manifest first:

```bash
pxml plugin url-git https://github.com/two-tech-dev/ui-ux-components-pxml.git
```

Both commands wire the package's `catalog.xml` into `.vscode/settings.json`
so the editor suggests component names, flows and types immediately.

After installation, add an `<import>` to `project.xml` and run `pxml validate`
to generate an alias-aware enriched schema with exact `extends` autocomplete:

```xml
<import package="ui-ux-components-pxml" from="packages/ui-ux-components-pxml" as="uix" />
```

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

### 10. XML Editor Autocomplete (Auto-Sync)

When your project imports a package (from git or local `packages/`),
`pxml validate` automatically generates an **OASIS XML catalog** + **enriched
schema** that enumerates the exact suggestions the editor should offer:

- `flow` attribute → every flow across all imported packages (auth, ecommerce,
  marketing, setup, …) plus your project's own flows.
- `type` attribute → all known node types (ui-component, api-route,
  setup-command, …).
- `extends` attribute → every base component id prefixed with **your actual
  import alias** (e.g. `uix:auth:login`, `uix:ecommerce:productGrid`).

The enriched schema is a **union with `xs:string`** — custom values you type
still validate, so you get suggestions without false errors.

The catalog and `.vscode/settings.json` (`xml.catalogs`) are updated
automatically on every `pxml validate` / `pxml compile` / `pxml migrate`,
merging with any existing settings.

**Works for both** `from="github:..."` and `from="packages/..."` imports.

When you open a `project.xml` that references `pxml.xsd`, VS Code (Red Hat
XML extension) resolves the catalog and uses the enriched schema — zero
configuration needed.

> If you prefer not to use the auto-sync, you can still bind the enriched
> schema manually. The `ui-ux-components-pxml` package ships its own
> `ui-ux-components-pxml.xsd` + `catalog.xml`; point your `xml.catalogs`
> setting to the `catalog.xml` path.

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
