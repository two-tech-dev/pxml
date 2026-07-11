import { useState } from 'react';
import { useProjectStore, useUIStore } from '../../stores/index.js';

export function WorkspaceDialog() {
  const [open, setOpen] = useState(false);
  const [path, setPath] = useState('');
  const openProject = useProjectStore(s => s.openProject);
  const workspacePath = useProjectStore(s => s.workspacePath);
  const project = useProjectStore(s => s.project);

  async function handleOpen() {
    if (!path.trim()) return;
    try {
      await openProject(path.trim());
      setOpen(false);
    } catch (e: any) {
      alert(e.message);
    }
  }

  return (
    <>
      <div className="h-10 bg-zinc-900 border-b border-zinc-800 flex items-center px-3 gap-2 shrink-0">
        <button
          onClick={() => setOpen(true)}
          className="text-xs bg-violet-600 hover:bg-violet-500 px-3 py-1 rounded font-medium"
        >
          Open Project
        </button>
        <button
          onClick={() => { useProjectStore.getState().saveProject(); }}
          className="text-xs bg-zinc-700 hover:bg-zinc-600 px-3 py-1 rounded font-medium"
          disabled={!workspacePath}
        >
          Save
        </button>
        {project && (
          <span className="text-sm text-zinc-400 ml-2">
            {project.name} <span className="text-zinc-600">({project.stack})</span>
          </span>
        )}
        <button
          onClick={() => { useProjectStore.getState().relayout(); }}
          className="text-xs bg-zinc-700 hover:bg-zinc-600 px-3 py-1 rounded font-medium ml-auto"
        >
          Auto Layout
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 w-[500px] shadow-xl">
            <h2 className="text-lg font-bold mb-4">Open pxml Project</h2>
            <input
              type="text"
              value={path}
              onChange={e => setPath(e.target.value)}
              placeholder="/path/to/your/project (contains project.xml)"
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm font-mono
                         focus:outline-none focus:border-violet-500 mb-4"
              onKeyDown={e => e.key === 'Enter' && handleOpen()}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setOpen(false)}
                className="px-4 py-1.5 text-sm bg-zinc-700 hover:bg-zinc-600 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleOpen}
                className="px-4 py-1.5 text-sm bg-violet-600 hover:bg-violet-500 rounded font-medium"
              >
                Open
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
