export class PxmlPatcher {
  /**
   * Applies a diff/patch securely to file contents.
   * If it cannot apply cleanly, it throws an error.
   * Expects patch format:
   * <<<<<<< SEARCH
   * original code
   * =======
   * new code
   * >>>>>>> REPLACE
   */
  static applyPatch(originalContent: string, patch: string): string {
    const searchBlocks = this.parsePatch(patch);
    if (searchBlocks.length === 0) {
      // If it is not in search/replace format, check if it's just raw code and replace entirely
      if (patch.trim().length > 0 && !patch.includes('<<<<<<<')) {
        return patch;
      }
      throw new Error('Invalid patch format: no SEARCH/REPLACE blocks found.');
    }

    let result = originalContent;
    for (const block of searchBlocks) {
      if (!result.includes(block.search)) {
        throw new Error(`Failed to apply patch: search block not found in original file.\nSearch block:\n${block.search}`);
      }
      result = result.replace(block.search, block.replace);
    }

    return result;
  }

  static parsePatch(patch: string): { search: string; replace: string }[] {
    const blocks: { search: string; replace: string }[] = [];
    const lines = patch.split('\n');
    let i = 0;

    while (i < lines.length) {
      if (lines[i].startsWith('<<<<<<< SEARCH')) {
        const searchLines: string[] = [];
        const replaceLines: string[] = [];
        i++;

        while (i < lines.length && !lines[i].startsWith('=======')) {
          searchLines.push(lines[i]);
          i++;
        }
        i++; // skip =======

        while (i < lines.length && !lines[i].startsWith('>>>>>>> REPLACE')) {
          replaceLines.push(lines[i]);
          i++;
        }
        i++; // skip >>>>>>> REPLACE

        blocks.push({
          search: searchLines.join('\n'),
          replace: replaceLines.join('\n')
        });
      } else {
        i++;
      }
    }

    return blocks;
  }
}
