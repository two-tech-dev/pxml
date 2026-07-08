import * as fs from 'fs';
import * as path from 'path';

export interface FileWriteOperation {
  filePath: string;
  originalContent: string | null;
  newContent: string;
}

export class FileWriter {
  private dryRun: boolean;
  private history: FileWriteOperation[] = [];

  constructor(dryRun = false) {
    this.dryRun = dryRun;
  }

  write(filePath: string, content: string) {
    const absolutePath = path.resolve(filePath);
    const originalContent = fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, 'utf-8') : null;
    
    this.history.push({
      filePath: absolutePath,
      originalContent,
      newContent: content
    });

    if (this.dryRun) {
      console.log(`[DRY RUN] Would write to: ${absolutePath}`);
      return;
    }

    const dir = path.dirname(absolutePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(absolutePath, content, 'utf-8');
  }

  rollback() {
    if (this.dryRun) {
      this.history = [];
      return;
    }

    for (const op of [...this.history].reverse()) {
      if (op.originalContent === null) {
        if (fs.existsSync(op.filePath)) {
          fs.unlinkSync(op.filePath);
        }
      } else {
        fs.writeFileSync(op.filePath, op.originalContent, 'utf-8');
      }
    }
    this.history = [];
  }

  getHistory(): FileWriteOperation[] {
    return this.history;
  }
}
