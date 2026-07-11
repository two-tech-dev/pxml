import { z } from 'zod';

export const ImportSchema = z.object({
  src: z.string().optional(),
  package: z.string().optional(),
  from: z.string().optional(),
  as: z.string()
});

export const MetaSchema = z.object({
  path: z.string(),
  depends_on: z.array(z.string()).default([])
});

export const FieldSchema = z.object({
  name: z.string(),
  type: z.string(),
  required: z.boolean().default(true),
  format: z.string().optional()
});

export const ConstraintSchema = z.object({
  verify: z.enum(['static', 'llm-judge']).default('static'),
  description: z.string(),
  learnedFrom: z.string().optional()
});

export const TestExpectSchema = z.object({
  field: z.string().optional(),
  status: z.number().optional(),
  body: z.any().optional(),
  contains: z.string().optional(),
  match: z.string().optional()
});

export const TestCaseSchema = z.object({
  name: z.string(),
  given: z.any(),
  expect: TestExpectSchema
});

export const NodeSchema = z.object({
  id: z.string(),
  type: z.string(),
  flow: z.string(),
  extends: z.string().optional(),
  autogenTests: z.boolean().default(true),
  meta: MetaSchema,
  input: z.array(FieldSchema).default([]),
  output: z.array(FieldSchema).default([]),
  constraints: z.array(ConstraintSchema).default([]),
  tests: z.array(TestCaseSchema).default([]),
  images: z.array(z.string()).default([])
});

export const ProjectSchema = z.object({
  name: z.string(),
  stack: z.string(), // EXTENSION POINT: Expand backend/frontend stack types
  version: z.string(),
  autogenTests: z.boolean().default(true),
  imports: z.array(ImportSchema).default([]),
  nodes: z.array(NodeSchema).default([])
});

export type Import = z.infer<typeof ImportSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type Node = z.infer<typeof NodeSchema>;
export type TestCase = z.infer<typeof TestCaseSchema>;
export type Constraint = z.infer<typeof ConstraintSchema>;
export type Field = z.infer<typeof FieldSchema>;
