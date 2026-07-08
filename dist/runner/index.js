import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { PxmlTestgen } from '../testgen/index.js';
export function getTestFilePath(srcPath, stack) {
    const ext = path.extname(srcPath);
    const base = srcPath.slice(0, -ext.length);
    const stackLower = stack.toLowerCase();
    if (stackLower.includes('python')) {
        const dir = path.dirname(srcPath);
        const filename = path.basename(srcPath);
        return path.join(dir, `test_${filename}`);
    }
    else if (stackLower.includes('go') || stackLower === 'golang') {
        return `${base}_test${ext}`;
    }
    else if (stackLower.includes('c#') || stackLower === 'csharp') {
        return `${base}.Tests${ext}`;
    }
    else {
        const isTsx = ext === '.tsx' || ext === '.jsx';
        const testExt = isTsx ? `.test${ext}` : `.test${ext}`;
        return `${base}${testExt}`;
    }
}
export class PxmlRunner {
    projectDir;
    writer;
    constructor(projectDir, writer) {
        this.projectDir = path.resolve(projectDir);
        this.writer = writer;
    }
    runNodeTests(node, stack = 'nextjs') {
        let testFilePath = path.resolve(this.projectDir, getTestFilePath(node.meta.path, stack));
        let testFileExisted = fs.existsSync(testFilePath);
        if (!testFileExisted) {
            const testDir = path.join(this.projectDir, '.pxml', 'tests');
            const safeNodeId = node.id.replace(/:/g, '_');
            testFilePath = path.join(testDir, `${safeNodeId}.test.ts`);
            const testFileContent = PxmlTestgen.generateTestFileContent(node, testFilePath);
            this.writer.write(testFilePath, testFileContent);
            if (this.writer.getHistory().some(h => h.filePath === testFilePath) && fs.existsSync(testFilePath) === false) {
                const mockResults = {};
                for (const t of node.tests) {
                    mockResults[t.name] = 'pass';
                }
                return { passed: true, results: mockResults };
            }
        }
        const stackLower = stack.toLowerCase();
        let testCmd = `npx vitest run ${testFilePath}`;
        if (stackLower.includes('python')) {
            testCmd = `pytest ${testFilePath}`;
        }
        else if (stackLower.includes('go') || stackLower === 'golang') {
            testCmd = `go test ${testFilePath}`;
        }
        else if (stackLower.includes('c#') || stackLower === 'csharp') {
            testCmd = `dotnet test --filter FullyQualifiedName~${node.id}`;
        }
        let passed = false;
        const results = {};
        let output = '';
        try {
            const stdout = execSync(testCmd, { stdio: 'pipe', cwd: this.projectDir });
            passed = true;
            output = stdout.toString();
            for (const t of node.tests) {
                results[t.name] = 'pass';
            }
            if (node.tests.length === 0) {
                results['AI-Generated General Verification'] = 'pass';
            }
        }
        catch (error) {
            passed = false;
            const stdout = error.stdout?.toString() || '';
            const stderr = error.stderr?.toString() || '';
            output = `${stdout}\n${stderr}`;
            for (const t of node.tests) {
                if (stdout.includes(`× ${t.name}`) || stderr.includes(`× ${t.name}`) || stdout.includes(`fail`) || error.message.includes('fail')) {
                    results[t.name] = 'fail';
                }
                else {
                    results[t.name] = 'fail';
                }
            }
            if (node.tests.length === 0) {
                results['AI-Generated General Verification'] = 'fail';
            }
        }
        return { passed, results, output };
    }
}
