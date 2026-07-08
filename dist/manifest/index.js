import * as fs from 'fs';
import * as path from 'path';
export class PxmlManifest {
    manifestPath;
    currentManifest;
    constructor(projectDir, projectName, version) {
        this.manifestPath = path.join(projectDir, '.pxml', 'manifest.json');
        this.currentManifest = this.loadOrCreate(projectName, version);
    }
    loadOrCreate(projectName, version) {
        const dir = path.dirname(this.manifestPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        if (fs.existsSync(this.manifestPath)) {
            try {
                const content = fs.readFileSync(this.manifestPath, 'utf-8');
                return JSON.parse(content);
            }
            catch (err) {
                // Fallback to fresh if corrupted
            }
        }
        return {
            project_name: projectName,
            version: version,
            nodes: {}
        };
    }
    get() {
        return this.currentManifest;
    }
    getNode(nodeId) {
        return this.currentManifest.nodes[nodeId];
    }
    setNode(nodeId, nodeData) {
        const existing = this.currentManifest.nodes[nodeId];
        this.currentManifest.nodes[nodeId] = {
            ...nodeData,
            locked: nodeData.locked ?? existing?.locked ?? false
        };
    }
    save() {
        fs.writeFileSync(this.manifestPath, JSON.stringify(this.currentManifest, null, 2), 'utf-8');
    }
    lockNode(nodeId, locked) {
        const node = this.currentManifest.nodes[nodeId];
        if (node) {
            node.locked = locked;
            this.save();
        }
    }
    clear() {
        this.currentManifest.nodes = {};
        this.save();
    }
}
