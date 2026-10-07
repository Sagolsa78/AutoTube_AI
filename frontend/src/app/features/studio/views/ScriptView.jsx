import React, { useState, useEffect, useRef } from 'react';
import Icon from '../../../../components/Icon';
import useStudioStore from '../../../../store/studioStore';
import { api } from '../../../../services/api';
import { toast } from 'sonner';

export default function ScriptView({ onNext }) {
  const script = useStudioStore(s => s.script);
  const editingScenes = useStudioStore(s => s.editingScenes);
  const setEditingScenes = useStudioStore(s => s.setEditingScenes);

  const [activeSceneIdx, setActiveSceneIdx] = useState(0);
  const [saveState, setSaveState] = useState(''); // 'saving', 'saved', ''
  const saveTimeoutRef = useRef(null);

  const [aiWorking, setAiWorking] = useState(false);

  if (!script || !editingScenes || editingScenes.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-canvas">
        <Icon name="file-text" size={48} className="text-border mb-4" />
        <h3 className="text-lg font-bold text-text-primary">No script yet</h3>
        <p className="text-sm text-text-secondary mb-6 text-center max-w-sm">
          Go back to the Idea stage to generate your script, or start writing from scratch.
        </p>
        <div className="flex gap-4">
          <button className="px-4 py-2 bg-brand-red text-white font-bold rounded-lg shadow-sm">
            Generate Script
          </button>
        </div>
      </div>
    );
  }

  const activeScene = editingScenes[activeSceneIdx];

  const triggerSave = () => {
    setSaveState('saving');
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        if (script.id) {
           await api.updateScript(script.id, {
             scenes: editingScenes,
             full_text: editingScenes.map(s => s.narration).join('\n')
           });
        }
        setSaveState('saved');
        setTimeout(() => setSaveState(''), 2000);
      } catch(e) {
        toast.error("Failed to autosave script");
        setSaveState('');
      }
    }, 1500);
  };

  const updateActiveScene = (field, value) => {
    setEditingScenes(prev => {
      const updated = [...prev];
      updated[activeSceneIdx] = { ...updated[activeSceneIdx], [field]: value };
      return updated;
    });
    triggerSave();
  };

  const handleAiAction = async (action) => {
    setAiWorking(true);
    try {
      // Simulate AI operation since we don't have a specific endpoint for scene-level AI rewrite in the given codebase.
      // In reality, this would hit something like api.rewriteScene(activeScene.id, action)
      await new Promise(r => setTimeout(r, 1200));

      let updatedText = activeScene.narration;
      if (action === 'rewrite') updatedText = `(Rewritten) ${activeScene.narration}`;
      if (action === 'shorten') updatedText = activeScene.narration.substring(0, Math.max(20, activeScene.narration.length / 2));

      updateActiveScene('narration', updatedText);
      toast.success(`Scene updated via AI: ${action}`);
    } catch(e) {
      toast.error("AI action failed");
    } finally {
      setAiWorking(false);
    }
  };

  const handleAiInsightApply = () => {
     updateActiveScene('narration', "In a world where AI creates videos instantly...");
     toast.success("Applied AI suggestion");
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden bg-canvas">

      {/* ── LEFT: SCENES LIST (25%) ──────────────────────────────────────── */}
      <div className="w-full md:w-1/4 min-w-[250px] border-r border-border/50 bg-surface/30 flex flex-col shrink-0 md:shrink">
        <div className="h-14 border-b border-border/50 px-4 flex items-center justify-between shrink-0 bg-surface/80 backdrop-blur">
          <span className="text-xs font-bold uppercase tracking-widest text-text-muted">Scenes</span>
          <button className="text-text-muted hover:text-text-primary p-1">
             <Icon name="plus" size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {editingScenes.map((scene, idx) => (
            <button
              key={scene.id || idx}
              onClick={() => setActiveSceneIdx(idx)}
              className={`w-full text-left p-3 rounded-xl transition-all border ${
                idx === activeSceneIdx
                  ? 'bg-surface border-brand-red/30 shadow-sm'
                  : 'bg-transparent border-transparent hover:bg-surface-hover'
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                 <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                   idx === activeSceneIdx ? 'bg-brand-red/10 text-brand-red' : 'bg-canvas text-text-muted'
                 }`}>
                   {String(idx + 1).padStart(2, '0')}
                 </span>
                 <span className="text-xs font-semibold text-text-primary truncate">
                   {idx === 0 ? 'Hook' : idx === editingScenes.length - 1 ? 'CTA' : 'Segment'}
                 </span>
              </div>
              <p className={`text-xs truncate ${idx === activeSceneIdx ? 'text-text-secondary' : 'text-text-muted'}`}>
                {scene.narration || 'Empty scene...'}
              </p>
            </button>
          ))}
        </div>
        <div className="p-4 border-t border-border/50">
           <button
             onClick={onNext}
             className="w-full py-2.5 bg-text-primary text-canvas text-sm font-bold rounded-lg hover:bg-white transition-colors shadow-sm flex items-center justify-center gap-2"
           >
             Storyboard <Icon name="arrow-right" size={14} />
           </button>
        </div>
      </div>

      {/* ── CENTER: SCRIPT EDITOR (50%) ──────────────────────────────────── */}
      <div className="flex-1 flex flex-col bg-canvas relative shrink-0 min-h-[500px] md:min-h-0">
        <div className="h-14 border-b border-border/30 px-6 flex items-center justify-between shrink-0 z-10">
          <div className="flex items-center gap-3">
             <span className="text-sm font-bold text-text-primary">Scene {String(activeSceneIdx + 1).padStart(2, '0')}</span>
             <span className="text-xs text-text-muted bg-surface px-2 py-0.5 rounded-full border border-border/50">
               ~{activeScene?.duration_est || 5}s
             </span>
          </div>

          <div className="flex items-center gap-2">
            {saveState === 'saving' && <span className="text-[10px] uppercase font-bold text-text-muted flex items-center gap-1.5"><Icon name="loader" size={12} className="animate-spin"/> Saving...</span>}
            {saveState === 'saved' && <span className="text-[10px] uppercase font-bold text-success flex items-center gap-1.5"><Icon name="check" size={12} /> Saved</span>}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 md:p-10 hide-scrollbar">
          <div className="max-w-3xl mx-auto space-y-8">

            {/* Narration */}
            <div className="space-y-3">
              <label className="text-[11px] font-bold uppercase tracking-widest text-text-muted flex items-center justify-between">
                <span>Narration</span>
                <span className="text-brand-red/80 font-mono tracking-normal">TTS / Audio</span>
              </label>
              <div className="group relative">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-brand-red/10 to-transparent rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition duration-500"></div>
                <textarea
                  className="relative w-full bg-surface border border-border/60 rounded-2xl p-5 text-base text-text-primary focus:outline-none focus:border-brand-red/50 min-h-[160px] leading-relaxed shadow-sm transition-colors resize-none"
                  value={activeScene?.narration || ''}
                  onChange={e => updateActiveScene('narration', e.target.value)}
                  placeholder="What will the AI voice say here?"
                />
              </div>
            </div>

            {/* Visual Direction */}
            <div className="space-y-3">
              <label className="text-[11px] font-bold uppercase tracking-widest text-text-muted flex items-center justify-between">
                <span>Visual Direction</span>
                <span className="text-text-muted/60 font-mono tracking-normal">B-Roll / Generation</span>
              </label>
              <textarea
                className="w-full bg-surface/50 border border-border/40 rounded-xl p-4 text-sm text-text-secondary focus:outline-none focus:border-brand-red/30 focus:bg-surface min-h-[100px] leading-relaxed transition-all resize-none"
                value={activeScene?.visual_description || activeScene?.visual_prompt || ''}
                onChange={e => updateActiveScene('visual_prompt', e.target.value)}
                placeholder="Describe what the viewer should see..."
              />
            </div>

          </div>
        </div>
      </div>

      {/* ── RIGHT: AI COPILOT (25%) ──────────────────────────────────────── */}
      <div className="w-full md:w-1/4 min-w-[280px] border-l border-border/50 bg-surface/40 flex flex-col shrink-0 min-h-[300px] md:min-h-0">
        <div className="h-14 border-b border-border/50 px-4 flex items-center gap-2 shrink-0 bg-surface/80 backdrop-blur">
          <Icon name="sparkles" size={16} className="text-brand-red" />
          <span className="text-xs font-bold uppercase tracking-widest text-text-primary">AI Copilot</span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">

          <div className="space-y-2">
            <h4 className="text-[11px] font-bold uppercase tracking-widest text-text-muted mb-3">Quick Actions</h4>
            <div className="grid grid-cols-2 gap-2">
               <button onClick={() => handleAiAction('improve')} disabled={aiWorking} className="bg-canvas border border-border/60 hover:border-brand-red/40 hover:bg-surface py-2 rounded-lg text-xs font-semibold text-text-secondary transition-all disabled:opacity-50">
                 Improve
               </button>
               <button onClick={() => handleAiAction('rewrite')} disabled={aiWorking} className="bg-canvas border border-border/60 hover:border-brand-red/40 hover:bg-surface py-2 rounded-lg text-xs font-semibold text-text-secondary transition-all disabled:opacity-50">
                 Rewrite
               </button>
               <button onClick={() => handleAiAction('shorten')} disabled={aiWorking} className="bg-canvas border border-border/60 hover:border-brand-red/40 hover:bg-surface py-2 rounded-lg text-xs font-semibold text-text-secondary transition-all disabled:opacity-50">
                 Shorten
               </button>
               <button onClick={() => handleAiAction('expand')} disabled={aiWorking} className="bg-canvas border border-border/60 hover:border-brand-red/40 hover:bg-surface py-2 rounded-lg text-xs font-semibold text-text-secondary transition-all disabled:opacity-50">
                 Expand
               </button>
            </div>
            {aiWorking && <p className="text-[10px] text-brand-red font-mono animate-pulse mt-2 text-center">AI is thinking...</p>}
          </div>

          <div className="h-px bg-border/40 my-4" />

          <div className="bg-canvas border border-brand-red/20 rounded-xl p-4 relative overflow-hidden shadow-sm">
             <div className="absolute top-0 left-0 w-1 h-full bg-brand-red"></div>
             <p className="text-[10px] font-bold uppercase tracking-widest text-brand-red mb-2">Suggestion</p>
             <p className="text-xs text-text-secondary italic mb-4 leading-relaxed">
               "Consider opening with a stronger hook that directly questions the viewer's reality."
             </p>

             <div className="bg-surface/50 border border-border/40 p-2.5 rounded-lg mb-3">
                <p className="text-xs text-text-primary font-medium">"In a world where AI creates videos instantly..."</p>
             </div>

             <button onClick={handleAiInsightApply} className="w-full bg-brand-red/10 text-brand-red hover:bg-brand-red hover:text-white transition-colors border border-brand-red/20 text-xs font-bold py-2 rounded-lg">
               Apply Change
             </button>
          </div>

        </div>
      </div>

    </div>
  );
}
