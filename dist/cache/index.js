import * as crypto from 'crypto';
export class PxmlCache {
    /**
     * Generates a stable hash for a node's configuration to verify if it has changed.
     */
    static hashNode(node) {
        const serialized = JSON.stringify({
            id: node.id,
            type: node.type,
            flow: node.flow,
            extends: node.extends,
            meta: node.meta,
            input: node.input,
            output: node.output,
            constraints: node.constraints,
            tests: node.tests
        });
        return crypto.createHash('sha256').update(serialized).digest('hex');
    }
    static hashNodeTests(node) {
        const serialized = JSON.stringify({
            input: node.input,
            output: node.output,
            constraints: node.constraints,
            tests: node.tests
        });
        return crypto.createHash('sha256').update(serialized).digest('hex');
    }
}
