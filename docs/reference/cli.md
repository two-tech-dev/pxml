# CLI Commands Reference

`pxml` provides a command-line interface to manage code generation, execution, testing, and healing workflows.

## Commands

### `pxml init`
Initializes a standard Next.js directory layout, copies the local `pxml.xsd` validation schema, and generates a sample `project.xml` configuration.

### `pxml compile`
Compiles all modified nodes defined in XML to source code files.
- `--dry-run`: Performs syntax check, imports flat-mapping, and topological sorting without writing code files to disk.
- `--provider <name>`: AI provider to use (`anthropic`, `openai`, `ollama`, or `custom`). Defaults to `anthropic`.
- `--apiKey <key>`: Custom API key override.
- `--baseUrl <url>`: Override the default API endpoint URL (essential for custom gateways or local Ollama endpoints).
- `--model <model>`: Custom LLM model name (e.g. `gpt-4o`, `claude-3-5-sonnet`, `llama3`).

### `pxml test`
Compiles all node `<test>` specs into real `.test.ts` Vitest test files and executes them. Test outcomes (`pass` or `fail`) are saved in `.pxml/manifest.json`.

### `pxml fix`
Invokes the self-healing AI loop to repair failing tests automatically.
- `--flow <flowName>`: Restricts repairs to a specific flow (e.g. `blog.write`).
- `--node <nodeId>`: Restricts repair loop to a single target node.
- `--provider <name>`: AI provider configuration for generation.
- `--model <model>`: AI model configuration for generation.

### `pxml diagnose`
Parses server/execution JSON log files and attempts to isolate runtime failures to specific nodes using heuristic algorithms.
- `--log <logPath>`: Path to the log file to analyze.

### `pxml doctor`
Performs validation checks on project configs, env keys, databases, and general environment options.
