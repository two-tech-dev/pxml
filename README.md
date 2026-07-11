# pxml — AI-driven code generation from structured XML specs

`pxml` is a monorepo containing:

| Package | Description | npm |
|---|---|---|
| `@two-tech-dev/pxml-core` | Parser, codegen, test runner, fix loop, schema validation | [`@two-tech-dev/pxml-core`](https://www.npmjs.com/package/@two-tech-dev/pxml-core) |
| `@two-tech-dev/pxml` | CLI (`pxml init`, `pxml compile`, `pxml test`, `pxml fix`, `pxml validate`) | [`@two-tech-dev/pxml`](https://www.npmjs.com/package/@two-tech-dev/pxml) |
| `@pxml/studio` | ReactFlow web editor with WebSocket streaming compile, undo/redo, plugin manager | Private |

Instead of writing free-form prompts, you specify your web application architecture in XML, manage modifications using a Manifest, and allow the AI to perform local self-healing repairs at minimal cost.

## Why pxml?

| Feature | Free-form Prompting | pxml |
|---|---|---|
| **Input format** | Natural language paragraphs | Declarative XML with typed inputs/outputs/constraints |
| **Validation** | None (discover at runtime) | Schema validation before any LLM call |
| **Execution order** | AI guesses dependencies | Topological sort from `<depends_on>` |
| **Tests** | Write separately (or skip) | `<test>` blocks auto-compiled to Vitest |
| **Bug fixing** | Re-prompt entire file | Surgical SEARCH/REPLACE patch |
| **Regression prevention** | None | `bugs_history.xml` attached to every fix prompt |
| **Token cost** | Unpredictable | Measured per-node, printed in dollars |
| **Delivery guarantee** | Best-effort | Test suite must pass before fix accepted |
| **Git audit** | Chat transcripts | Every spec is a file in git |

## Quick Start

```bash
npm install -g @two-tech-dev/pxml
pxml init
export ANTHROPIC_API_KEY="your-api-key"
pxml compile
```

### Providers

```bash
# Anthropic (default)
pxml compile --provider anthropic --model claude-3-5-sonnet

# OpenAI
pxml compile --provider openai --model gpt-4o

# Ollama (local)
pxml compile --provider ollama --model llama3.2:latest --baseUrl http://localhost:11434
```

### Flags

```bash
pxml compile --dry-run          # show plan without AI calls
pxml compile --no-autogen-tests # skip AI test generation
pxml compile --verify           # AI self-verification (2× tokens)
pxml compile --no-validate      # skip per-file linter validation
pxml compile --no-build-check   # skip post-codegen build verification
```

## Commands

| Command | Description |
|---|---|
| `pxml init` | Initialize project with sample flows and packages |
| `pxml compile [file]` | Generate code from XML specs |
| `pxml test [--node id]` | Run compiled test suite |
| `pxml fix --flow name` | Self-heal failing tests (up to 3 retries) |
| `pxml validate` | Schema + cross-reference validation |
| `pxml doctor` | Check environment and API keys |
| `pxml install` / `pxml i` | Install packages from `pxml.json` |
| `pxml plugin url-git <url>` | Install single package from git |
| `pxml migrate` | Update to latest pxml syntax |
| `pxml diagnose --log <path>` | Analyze compile log for failure patterns |

## Project Structure

```
my-project/
├── project.xml          # main config: name, stack, imports, autogen-tests
├── flows/               # node definitions grouped by feature
│   ├── auth.xml
│   ├── cart.xml
│   └── catalog.xml
├── packages/            # installed git packages
├── pxml.json            # manifest: version + installed packages
├── bugs_history.xml     # institutional memory for regression prevention
└── .pxml/
    ├── manifest.json    # test results, compile state
    └── layout.json      # graph editor layout (pxml Studio)
```

## Example XML

```xml
<project name="my-app" stack="nextjs" version="0.1.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:noNamespaceSchemaLocation="pxml.xsd">
  <import src="flows/blog.xml" as="blog" />
</project>

<!-- flows/blog.xml -->
<flow name="blog.write">
  <node id="api.posts.create" type="api-route">
    <meta>
      <path>app/api/posts/route.ts</path>
      <depends_on>db.setup</depends_on>
    </meta>
    <input>
      <field name="title" type="string" required="true" />
      <field name="content" type="string" required="true" />
    </input>
    <constraint verify="static">
      POST returns 201 with created post; title max 200 chars
    </constraint>
    <test>
      <given>
        <body json="true">
          <title>Hello</title>
          <content>My post</content>
        </body>
      </given>
      <expect><status>201</status></expect>
    </test>
  </node>
</flow>
```

## pxml Studio

Launch the visual graph editor with a single command:

```bash
pxml studio                 # starts on http://localhost:3001
pxml studio --port 8080     # custom port
```

A ReactFlow-based graph editor for visual pxml project management. Features:

- **Graph canvas**: 6 node types (api-route, ui-component, db-model, middleware, config-file, setup-command)
- **Drag-to-connect**: multi-handle edges (3 source + 3 target per node)
- **Draw.io-style edges**: draggable waypoints, midpoint bend-points, delete button on hover
- **Property panel**: 5 tabs (basic, fields, constraints, tests, meta)
- **Compile**: WebSocket streaming with real-time node status animation
- **Test/Fix/Diagnose**: run tests, self-heal, analyze failures
- **Plugin manager**: install packages from git URLs
- **Undo/Redo**: full history stack (Ctrl+Z / Ctrl+Shift+Z)
- **Layout persistence**: saved to `.pxml/layout.json`
- **Resizable panels**: left sidebar, right properties, bottom output
- **XML import/export**: bidirectional XML ↔ graph serialization
- **Cursor/VS Code dark theme**

<img width="1908" height="948" alt="image" src="https://github.com/user-attachments/assets/de786d46-ce7c-4028-9a9c-97c13de8bb6a" />


## Multi-Stack Support

`pxml` supports `nextjs`, `python`, `rust`, `go` — the code generator adjusts prompt guidelines and style directives based on `<project stack="...">`.

## Regression Prevention

Document known bugs in `bugs_history.xml`. The compiler attaches them to every fix prompt to prevent recurrence:

```xml
<bugs xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xsi:noNamespaceSchemaLocation="bugs.xsd">
  <bug id="cart.badge" flow="cart.view">
    Cart badge count displays 0 despite items in cart.
    Always fetch from backend DB route, not localStorage.
  </bug>
</bugs>
```

## Token Usage

After every `compile` or `fix`, the CLI prints a cost summary with input/output/cached tokens and estimated dollar cost.

## Editor Autocomplete

`pxml validate` auto-generates an enriched `pxml.xsd` with exact autocomplete for flows, node types, and `extends` targets from imported packages — no LSP configuration needed.

## License

MIT
