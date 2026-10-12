import React, { useState, useEffect, useRef } from 'react';
import Icon from '../../../../components/Icon';
import useStudioStore from '../../../../store/studioStore';
import { api } from '../../../../services/api';
import { toast } from 'sonner';

export default function ScriptView({ onNext }) {
  const script = useStudioStore(s => s.script);
  const editingScenes = useStudioStore(s => s.editingScenes);
  const setEditingScenes = useStudioStore(s => s.setEditingScenes);
  const project = useStudioStore(s => s.project);

  const [activeSceneIdx, setActiveSceneIdx] = useState(0);
  const [saveState, setSaveState] = useState(''); // 'saving', 'saved', ''
  const saveTimeoutRef = useRef(null);

  const [aiWorking, setAiWorking] = useState(false);
  const [versions, setVersions] = useState([]);
  const [reverting, setReverting] = useState(false);

  useEffect(() => {
    if (script?.id) {
       api.getScriptVersions(script.id).then(setVersions).catch(console.error);
    }
  }, [script?.id, saveState]); // Reload when saved

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
      const newScene = { ...updated[activeSceneIdx], [field]: value };

      // Auto-calculate duration if narration changes
      if (field === 'narration') {
         const wordCount = (value || '').split(/\s+/).filter(Boolean).length;
         newScene.duration_est = Math.max(2, Math.ceil((wordCount / 150) * 60));
      }

      updated[activeSceneIdx] = newScene;
      return updated;
    });
    triggerSave();
  };

  const handleAiAction = async (action) => {
    setAiWorking(true);
    try {
      const res = await api.aiEditScene(script.id, activeScene.id, action);
      updateActiveScene('narration', res.narration);
      toast.success(`Scene updated via AI: ${action}`);
    } catch(e) {
      toast.error(`AI action failed: ${e.message}`);
    } finally {
      setAiWorking(false);
    }
  };

  const handleRevert = async (versionId) => {
    setReverting(true);
    try {
       const updated = await api.revertScriptVersion(script.id, versionId);
       setEditingScenes(updated.scenes);
       toast.success("Script reverted successfully");
    } catch (e) {
       toast.error("Failed to revert: " + e.message);
    } finally {
       setReverting(false);
    }
  };

  const handleAiInsightApply = () => {
     updateActiveScene('narration', "In a world where AI creates videos instantly...");
     toast.success("Applied AI suggestion");
  };

  const handleNext = async () => {
    if (project?.id) {
      try {
        await api.updateProject(project.id, { current_stage: 'voice' });
      } catch (err) {
        console.error("Failed to advance project state", err);
      }
    }
    onNext();
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden bg-canvas">

      {/* ── LEFT: SCENES LIST (25%) ──────────────────────────────────────── */}
      <div className="w-full md:w-1/4 min-w-[260px] border-r border-border/50 bg-surface/40 flex flex-col shrink-0 md:shrink">
        <div className="h-16 border-b border-border/50 px-5 flex items-center justify-between shrink-0 bg-canvas/50 backdrop-blur-md">
          <span className="text-xs font-bold uppercase tracking-widest text-text-muted">Scenes</span>
          <button className="text-text-muted hover:text-brand-red p-1.5 rounded-lg hover:bg-brand-red/10 transition-colors">
             <Icon name="plus" size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2 hide-scrollbar">
          {editingScenes.map((scene, idx) => (
            <button
              key={scene.id || idx}
              onClick={() => setActiveSceneIdx(idx)}
              className={`w-full text-left p-3 rounded-xl transition-all border group ${
                idx === activeSceneIdx
                  ? 'bg-surface border-ai/40 shadow-sm shadow-ai/5 scale-[1.02]'
                  : 'bg-transparent border-transparent hover:bg-surface/50 hover:border-border'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                 <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded transition-colors ${
                   idx === activeSceneIdx ? 'bg-ai/10 text-ai' : 'bg-surface border border-border text-text-muted group-hover:text-text-secondary'
                 }`}>
                   {String(idx + 1).padStart(2, '0')}
                 </span>
                 <span className={`text-xs font-semibold truncate transition-colors ${idx === activeSceneIdx ? 'text-text-primary' : 'text-text-secondary'}`}>
                   {idx === 0 ? 'Hook' : idx === editingScenes.length - 1 ? 'CTA' : 'Segment'}
                 </span>
               </div>
               <p className={`text-xs truncate transition-colors ${idx === activeSceneIdx ? 'text-text-secondary' : 'text-text-muted group-hover:text-text-secondary'}`}>
                 {scene.narration || 'Empty scene...'}
               </p>
              </button>
            ))}
        </div>
        <div className="p-4 border-t border-border/50 bg-surface/30">
           <button
             onClick={handleNext}
             className="w-full py-3 bg-brand-red text-white text-sm font-bold rounded-xl hover:bg-brand-red-hover hover:-translate-y-0.5 transition-all shadow-brand-glow hover:shadow-lg flex items-center justify-center gap-2"
           >
             Storyboard <Icon name="arrow-right" size={14} />
           </button>
        </div>
      </div>

      {/* ── CENTER: SCRIPT EDITOR (50%) ──────────────────────────────────── */}
      <div className="flex-1 flex flex-col bg-canvas relative shrink-0 min-h-[500px] md:min-h-0 isolate">
        {/* Subtle glow for the active editor area */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-ai/5 blur-[120px] rounded-full pointer-events-none -z-10" />

        <div className="h-16 border-b border-border/50 px-8 flex items-center justify-between shrink-0 z-10 bg-canvas/80 backdrop-blur-md">
          <div className="flex items-center gap-4">
             <span className="text-base font-bold text-text-primary">Scene {String(activeSceneIdx + 1).padStart(2, '0')}</span>
             <span className="text-xs text-text-muted bg-surface px-2.5 py-1 rounded-md border border-border">
               Est. Duration: ~{activeScene?.duration_est || 5}s
             </span>
             <span className="text-xs text-text-muted bg-surface px-2.5 py-1 rounded-md border border-border">
               Words: {(activeScene?.narration || '').split(/\s+/).filter(Boolean).length}
             </span>
          </div>

          <div className="flex items-center gap-2">
            {saveState === 'saving' && <span className="text-[10px] uppercase font-bold text-text-muted flex items-center gap-1.5"><Icon name="loader" size={12} className="animate-spin"/> Saving...</span>}
            {saveState === 'saved' && <span className="text-[10px] uppercase font-bold text-success flex items-center gap-1.5"><Icon name="check" size={12} /> Saved</span>}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 md:p-12 hide-scrollbar">
          <div className="max-w-3xl mx-auto space-y-10">

            {/* Narration */}
            <div className="space-y-4">
              <label className="text-xs font-bold uppercase tracking-widest text-text-muted flex items-center justify-between">
                <span className="flex items-center gap-2"><Icon name="mic" size={14} /> Narration</span>
                <span className="text-ai font-mono tracking-normal text-[10px] bg-ai/10 px-2 py-0.5 rounded">TTS / Voice</span>
              </label>
              <div className="group relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-ai/20 to-transparent rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition duration-500 pointer-events-none" />
                <textarea
                  className="relative w-full bg-surface/80 border border-border/80 rounded-2xl p-6 text-lg text-text-primary focus:outline-none focus:border-ai/50 focus:bg-surface min-h-[220px] leading-relaxed shadow-sm transition-all resize-none"
                  value={activeScene?.narration || ''}
                  onChange={e => updateActiveScene('narration', e.target.value)}
                  placeholder="What will the AI voice say here? Press space to start typing..."
                />
              </div>
            </div>

            {/* Visual Direction */}
            <div className="space-y-4">
              <label className="text-xs font-bold uppercase tracking-widest text-text-muted flex items-center justify-between">
                <span className="flex items-center gap-2"><Icon name="image" size={14} /> Visual Direction</span>
                <span className="text-text-muted/60 font-mono tracking-normal text-[10px] bg-surface px-2 py-0.5 rounded border border-border">AI Generation / Stock</span>
              </label>
              <textarea
                className="w-full bg-surface/40 border border-border/40 rounded-xl p-5 text-sm text-text-secondary focus:outline-none focus:border-ai/30 focus:bg-surface/80 min-h-[120px] leading-relaxed transition-all resize-none"
                value={activeScene?.visual_description || activeScene?.visual_prompt || ''}
                onChange={e => updateActiveScene('visual_prompt', e.target.value)}
                placeholder="Describe what the viewer should see. e.g. Cinematic pan over a glowing nebula..."
              />
            </div>

          </div>
        </div>
      </div>

      {/* ── RIGHT: AI COPILOT (25%) ──────────────────────────────────────── */}
      <div className="w-full md:w-1/4 min-w-[320px] border-l border-border/50 bg-surface/40 flex flex-col shrink-0 min-h-[400px] md:min-h-0 relative">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-ai/5 via-transparent to-transparent opacity-50 z-0"></div>

        <div className="h-16 px-5 border-b border-border/50 flex items-center justify-between z-10 bg-canvas/50 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-2 text-ai">
             <Icon name="sparkles" size={16} />
             <span className="text-xs font-bold uppercase tracking-widest">AutoTube Copilot</span>
          </div>
          <span className="text-[10px] font-bold tracking-wider text-text-muted bg-surface px-2 py-1 rounded border border-border">Script QA</span>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-8 relative z-10 hide-scrollbar">

          <div className="space-y-3">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Smart Actions</h4>
            <div className="grid grid-cols-2 gap-2">
               <button onClick={() => handleAiAction('improve')} disabled={aiWorking} className="bg-canvas border border-border hover:border-ai/40 hover:text-ai py-2.5 rounded-xl text-xs font-bold text-text-secondary transition-all disabled:opacity-50 hover:-translate-y-0.5 hover:shadow-sm">
                 Rewrite Scene
               </button>
               <button onClick={() => handleAiAction('shorten')} disabled={aiWorking} className="bg-canvas border border-border hover:border-ai/40 hover:text-ai py-2.5 rounded-xl text-xs font-bold text-text-secondary transition-all disabled:opacity-50 hover:-translate-y-0.5 hover:shadow-sm">
                 Make Shorter
               </button>
               <button onClick={() => handleAiAction('expand')} disabled={aiWorking} className="bg-canvas border border-border hover:border-ai/40 hover:text-ai py-2.5 rounded-xl text-xs font-bold text-text-secondary transition-all disabled:opacity-50 hover:-translate-y-0.5 hover:shadow-sm">
                 Make Longer
               </button>
               <button onClick={() => handleAiAction('hook')} disabled={aiWorking} className="bg-canvas border border-border hover:border-ai/40 hover:text-ai py-2.5 rounded-xl text-xs font-bold text-text-secondary transition-all disabled:opacity-50 hover:-translate-y-0.5 hover:shadow-sm">
                 Improve Hook
               </button>
               <button onClick={() => handleAiAction('scenes')} disabled={aiWorking} className="col-span-2 bg-ai/10 border border-ai/20 hover:bg-ai text-ai hover:text-white py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50 hover:-translate-y-0.5 hover:shadow-sm flex items-center justify-center gap-2">
                 <Icon name="plus" size={14} /> Generate Next Scene
               </button>
            </div>
            {aiWorking && (
              <div className="flex items-center justify-center gap-2 text-[10px] text-ai font-mono animate-pulse mt-3 bg-ai/5 py-1.5 rounded-lg border border-ai/10">
                <Icon name="loader" size={12} className="animate-spin" /> AutoTube AI is thinking...
              </div>
            )}
          </div>

          <div className="bg-surface/50 border border-border/40 rounded-xl p-4 mt-6">
             <h4 className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-3 flex items-center justify-between">
               <span>Version History</span>
               {reverting && <Icon name="loader" size={12} className="animate-spin text-ai" />}
             </h4>
             <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar">
                {versions.length === 0 ? (
                   <p className="text-xs text-text-muted italic text-center py-4 border border-dashed border-border/50 rounded">
                     No previous versions yet.
                   </p>
                ) : (
                   versions.map((v, i) => (
                      <div key={v.id} className="flex flex-col gap-1 p-2 border border-border/50 rounded hover:bg-surface transition-colors group">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-mono text-text-muted">
                            {new Date(v.created_at).toLocaleTimeString()}
                          </span>
                          <button
                            onClick={() => handleRevert(v.id)}
                            disabled={reverting}
                            className="text-[10px] font-bold text-ai opacity-0 group-hover:opacity-100 transition-opacity hover:underline"
                          >
                            Revert
                          </button>
                        </div>
                        <p className="text-xs text-text-secondary truncate">{v.full_text.substring(0, 40)}...</p>
                      </div>
                   ))
                )}
             </div>
          </div>

        </div>
      </div>

    </div>
  );
}
