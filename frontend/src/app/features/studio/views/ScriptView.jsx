import React from 'react';
import Icon from '../../../../components/Icon';
import useStudioStore from '../../../../store/studioStore';

export default function ScriptView({ onNext }) {
  const script = useStudioStore(s => s.script);
  const editingScenes = useStudioStore(s => s.editingScenes);
  const setEditingScenes = useStudioStore(s => s.setEditingScenes);

  if (!script) {
    return <div className="p-8 text-center text-text-muted">No script generated yet.</div>;
  }

  const updateScene = (idx, field, value) => {
    setEditingScenes(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      return updated;
    });
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-border overflow-hidden">
      <div className="flex-1 p-6 lg:p-10 overflow-y-auto hide-scrollbar space-y-8 bg-surface">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Script Editor</h2>
            <p className="text-sm text-text-secondary">Refine the narration and visual cues.</p>
          </div>
          <button
            onClick={onNext}
            className="px-6 py-2.5 bg-brand-red text-white font-bold rounded-xl shadow-brand-glow hover:bg-brand-red-hover transition-colors flex items-center gap-2"
          >
            To Storyboard <Icon name="arrow-right" size={16} />
          </button>
        </div>

        <div className="space-y-4 max-w-3xl">
          {editingScenes.map((scene, idx) => (
            <div key={scene.id || idx} className="bg-canvas border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-text-muted uppercase">
                <span className="w-5 h-5 rounded bg-elevated flex items-center justify-center text-text-primary">
                  {idx + 1}
                </span>
                Scene
              </div>
              <textarea
                className="w-full bg-transparent border border-border rounded-lg p-3 text-sm text-text-primary focus:outline-none focus:border-brand-red min-h-[80px]"
                value={scene.narration}
                onChange={e => updateScene(idx, 'narration', e.target.value)}
                placeholder="Narration script..."
              />
              <input
                type="text"
                className="w-full bg-surface-input border border-border rounded-lg p-2 text-xs text-text-secondary focus:outline-none focus:border-brand-red"
                value={scene.visual_description || ''}
                onChange={e => updateScene(idx, 'visual_description', e.target.value)}
                placeholder="Visual description..."
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
