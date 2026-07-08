import { describe, it, expect } from 'vitest';
import { PxmlDiagnostics } from '../src/diagnostics/index.ts';
import { PxmlPatcher } from '../src/patcher/index.ts';

describe('PxmlDiagnostics', () => {
  it('should map errors to flow heuristics', () => {
    const diag1 = PxmlDiagnostics.diagnoseHeuristic({
      message: 'Unauthorized access attempts',
      statusCode: 401
    });
    expect(diag1?.flow).toBe('auth');
    expect(diag1?.suspectedType).toBe('middleware');

    const diag2 = PxmlDiagnostics.diagnoseHeuristic({
      message: 'PrismaClientKnownRequestError: Unique constraint failed on the fields: (slug)',
    });
    expect(diag2?.flow).toBe('db');
    expect(diag2?.suspectedType).toBe('db-model');
  });
});

describe('PxmlPatcher', () => {
  it('should apply search/replace patches cleanly', () => {
    const original = `const a = 1;\nconst b = 2;\nconst c = 3;`;
    const patch = `
<<<<<<< SEARCH
const b = 2;
=======
const b = 20;
const d = 40;
>>>>>>> REPLACE
`;
    const result = PxmlPatcher.applyPatch(original, patch);
    expect(result).toBe(`const a = 1;\nconst b = 20;\nconst d = 40;\nconst c = 3;`);
  });

  it('should throw error when search block is not found', () => {
    const original = `const a = 1;`;
    const patch = `
<<<<<<< SEARCH
const b = 2;
=======
const b = 20;
>>>>>>> REPLACE
`;
    expect(() => PxmlPatcher.applyPatch(original, patch)).toThrow('search block not found');
  });
});
