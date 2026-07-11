import * as fs from 'fs';
import * as path from 'path';

export interface ManifestNode {
  node_id: string;
  source_file: string;
  xml_hash: string;
  output_files: string[];
  depends_on: string[];
  flow: string;
  locked: boolean;
  last_test_run?: Record<string, 'pass' | 'fail'>;
  generated_at?: string;
}

export interface Manifest {
  project_name: string;
  version: string;
  nodes: Record<string, ManifestNode>;
}

export class PxmlManifest {
  private manifestPath: string;
  private currentManifest: Manifest;

  constructor(projectDir: string, projectName: string, version: string) {
    this.manifestPath = path.join(projectDir, '.pxml', 'manifest.json');
    this.currentManifest = this.loadOrCreate(projectName, version);
  }

  private loadOrCreate(projectName: string, version: string): Manifest {
    const dir = path.dirname(this.manifestPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(this.manifestPath)) {
      try {
        const content = fs.readFileSync(this.manifestPath, 'utf-8');
        return JSON.parse(content) as Manifest;
      } catch (err) {
        // Fallback to fresh if corrupted
      }
    }

    return {
      project_name: projectName,
      version: version,
      nodes: {}
    };
  }

  get(): Manifest {
    return this.currentManifest;
  }

  getNode(nodeId: string): ManifestNode | undefined {
    return this.currentManifest.nodes[nodeId];
  }

  setNode(nodeId: string, nodeData: Omit<ManifestNode, 'locked'> & { locked?: boolean }) {
    const existing = this.currentManifest.nodes[nodeId];
    this.currentManifest.nodes[nodeId] = {
      ...nodeData,
      locked: nodeData.locked ?? existing?.locked ?? false
    };
  }

  save() {
    fs.writeFileSync(this.manifestPath, JSON.stringify(this.currentManifest, null, 2), 'utf-8');
  }

  lockNode(nodeId: string, locked: boolean) {
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
