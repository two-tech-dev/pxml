# XML Schema Reference

`pxml` configuration is defined using a structured XML document validated against `pxml.xsd`.

## Element Definitions

### `<project>`
The root element of a project config.
#### Attributes:
- `name` (required): Name of the project.
- `stack` (required): Framework stack being used (e.g. `nextjs`).
- `version` (required): Spec version.

---

### `<import>`
Imports nodes from external files.
#### Attributes:
- `src` (required): Relative file path to the imported XML file.
- `as` (required): Namespace alias to prefix imported nodes.

---

### `<node>`
Defines a compilation node (code unit).
#### Attributes:
- `id` (required): Unique ID for the node.
- `type` (required): Type of node (`api-route`, `ui-component`, `db-model`, `middleware`, `config-file`, `setup-command`).
- `flow` (required): Business logic flow grouping (e.g. `blog.write`).
- `extends` (optional): ID of a base node to inherit metadata, constraints, and tests from.

---

### `<meta>`
Defines target paths and dependencies.
#### Children:
- `<path>` (required): File path where generated code will be written.
- `<depends_on>` (optional, multiple): Node ID this node depends on.

---

### `<input>` / `<output>`
Defines schemas for fields.
#### Children:
- `<field>` (multiple):
  - `name` (required): Field name.
  - `type` (required): Data type.
  - `required` (optional): `true` or `false`.
  - `format` (optional): Extra format constraints (e.g. `uuid`).

---

### `<constraint>`
Specifies coding rules for the AI.
#### Attributes:
- `verify` (default: `static`):
  - `static`: Can be tested programmatically.
  - `llm-judge`: Intention checks requiring LLM judgment (e.g. "Do not leak secret keys in responses").
- `learned-from` (optional): References a bug ID from `bugs_history.xml`. Associates the constraint with a historical bug to prevent code regressions during generation and fixing.

---

### `<test>`
Generates test scenarios in Vitest.
#### Children:
- `<name>` (required): Test case label.
- `<given>` (required): Input mocks.
- `<expect>` (required): Expected assertions.
  - `<status>` (optional): Expected HTTP status code.
  - `<contains>` (optional): Expected response content text.
  - `<match>` (optional): Regular expression match pattern.
