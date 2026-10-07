import React from 'react';
import Icon from '../../../../components/Icon';
import useStudioStore from '../../../../store/studioStore';

export default function BriefView({ onNext }) {
  const selectedIdea = useStudioStore((s) => s.selectedIdea);
  const contentType = useStudioStore((s) => s.contentType);
  const setContentType = useStudioStore((s) => s.setContentType);
  const targetDuration = useStudioStore((s) => s.targetDuration);
  const setTargetDuration = useStudioStore((s) => s.setTargetDuration);
  const language = useStudioStore((s) => s.language);
  const setLanguage = useStudioStore((s) => s.setLanguage);

  const [topic, setTopic] = React.useState(selectedIdea?.topic || '');
  const [generating, setGenerating] = React.useState(false);
  const setScript = useStudioStore((s) => s.setScript);
  const setSelectedIdea = useStudioStore((s) => s.setSelectedIdea);

  const handleDraftScript = async () => {
    if (!topic.trim()) {
      return;
    }
    setGenerating(true);
    try {
      const { api } = await import('../../../../services/api');
      let ideaId = selectedIdea?.id;
      if (!ideaId) {
        // Create an idea first
        const newIdea = await api.createIdea({
          topic,
          channel_id: null,
          angle: 'Auto-generated via Studio'
        });
        ideaId = newIdea.id;
        setSelectedIdea(newIdea);
      }

      const scriptData = await api.generateScript(ideaId, language, 'US', contentType, targetDuration);
      setScript(scriptData);
      onNext();
    } catch (err) {
      console.error(err);
      alert('Failed to draft script: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const [improving, setImproving] = React.useState(false);
  const handleImproveIdea = async () => {
    if (!topic.trim() || improving) return;
    setImproving(true);
    try {
      const { api } = await import('../../../../services/api');
      const res = await api.improveIdea(topic);
      if (res.improved_topic) {
        setTopic(res.improved_topic);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to improve idea: ' + err.message);
    } finally {
      setImproving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-border overflow-hidden">

      {/* ── Creative Brief Form ──────────────────────────────────────── */}
      <div className="flex-1 p-6 lg:p-10 overflow-y-auto hide-scrollbar space-y-8 bg-surface">
        <div className="space-y-1">
          <h2 className="text-xl font-bold tracking-tight">Creative Brief</h2>
          <p className="text-sm text-text-secondary">What should we create today?</p>
        </div>

        <div className="space-y-6 max-w-2xl">
          {/* Main Idea Input */}
          <div className="space-y-2">
             <div className="bg-canvas border border-border rounded-xl p-3 focus-within:border-brand-red focus-within:ring-1 focus-within:ring-brand-red/50 transition-all">
               <textarea
                 className="w-full bg-transparent border-none focus:outline-none resize-none text-text-primary text-base placeholder:text-text-muted min-h-[100px]"
                 placeholder="Describe your idea..."
                 value={topic}
                 onChange={(e) => setTopic(e.target.value)}
               />
               <div className="flex justify-between items-center mt-2 border-t border-border/40 pt-2">
                 <button
                   onClick={handleImproveIdea}
                   disabled={improving}
                   className="flex items-center gap-1.5 text-xs font-semibold text-brand-red hover:text-brand-red-hover transition-colors disabled:opacity-50"
                 >
                   <Icon name="sparkles" size={14} /> {improving ? 'Improving...' : 'Improve idea'}
                 </button>
                 <span className="text-[10px] text-text-muted font-mono">{topic.length} / 500</span>
               </div>
             </div>
          </div>

          {/* Metadata Controls */}
          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-1.5">
               <label className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Format</label>
               <select
                 value={contentType}
                 onChange={(e) => setContentType(e.target.value)}
                 className="w-full bg-canvas border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-brand-red"
               >
                 <option value="short">Short (9:16)</option>
                 <option value="long">Long (16:9)</option>
               </select>
             </div>

             <div className="space-y-1.5">
               <label className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Tone</label>
               <select className="w-full bg-canvas border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-brand-red">
                 <option value="energetic">Energetic</option>
                 <option value="documentary">Documentary</option>
                 <option value="humorous">Humorous</option>
               </select>
             </div>

             <div className="space-y-1.5">
               <label className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Language</label>
               <select
                 value={language}
                 onChange={(e) => setLanguage(e.target.value)}
                 className="w-full bg-canvas border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-brand-red"
               >
                 <option value="en">English (US)</option>
                 <option value="hi">Hindi</option>
                 <option value="es">Spanish</option>
               </select>
             </div>

             <div className="space-y-1.5">
               <label className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Visual Strategy</label>
               <select className="w-full bg-canvas border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-brand-red">
                 <option value="auto">Auto (AI selects)</option>
                 <option value="stock">Stock Only</option>
                 <option value="ai">AI Generated</option>
               </select>
             </div>
          </div>

          <div className="pt-4 flex flex-col items-end gap-3">
            {generating && (
              <div className="w-full text-xs text-text-secondary flex items-center justify-between animate-pulse">
                <span>Working on it... this may take up to a minute.</span>
                <span className="font-mono">Drafting script...</span>
              </div>
            )}
            <button
              onClick={handleDraftScript}
              disabled={generating || !topic.trim()}
              className="px-6 py-2.5 bg-brand-red text-white font-bold rounded-xl shadow-brand-glow hover:bg-brand-red-hover transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {generating ? 'Drafting...' : 'Draft Script'} <Icon name="arrow-right" size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Live Preview & AI Assistant ──────────────────────────────── */}
      <div className="w-full md:w-[400px] lg:w-[480px] bg-canvas flex flex-col shrink-0">
         <div className="p-4 border-b border-border/40 flex items-center justify-between">
           <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Live Preview</span>
           <span className="text-[10px] font-mono text-text-secondary bg-surface px-2 py-1 rounded">00:00 / 01:00</span>
         </div>

         <div className="flex-1 p-6 flex flex-col items-center justify-center">
            {/* 9:16 Video Proxy */}
            <div className="w-[280px] aspect-[9/16] bg-surface border border-border rounded-2xl flex flex-col items-center justify-center relative overflow-hidden shadow-card-subtle group">
               <Icon name="video" size={32} className="text-border mb-4" />
               <p className="text-sm font-semibold text-text-muted">Video Preview</p>
               <p className="text-xs text-border mt-1">Available after storyboarding</p>

               <div className="absolute inset-0 bg-canvas/80 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                  <button className="w-12 h-12 bg-text-primary rounded-full flex items-center justify-center text-canvas hover:scale-105 transition-transform">
                    <Icon name="play" size={20} className="ml-1" />
                  </button>
               </div>
            </div>
         </div>

         {/* AI Suggestions Panel */}
         <div className="h-48 border-t border-border bg-surface p-4 flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <Icon name="sparkles" size={14} className="text-brand-red" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-text-primary">AI Copilot</span>
            </div>

            <div className="flex-1 bg-canvas border border-border/50 rounded-xl p-3 flex flex-col">
              <p className="text-xs text-text-secondary flex-1">
                <span className="font-semibold text-text-primary">Hook Suggestion:</span> "You won't believe what scientists just found under the ice in Antarctica..."
              </p>
              <div className="flex items-center justify-end gap-2 mt-2">
                <button className="text-[10px] font-bold text-text-muted hover:text-text-primary px-2 py-1 rounded hover:bg-surface-hover transition-colors">
                  Regenerate
                </button>
                <button className="text-[10px] font-bold bg-elevated border border-border hover:border-brand-red/50 px-3 py-1 rounded transition-colors text-text-primary">
                  Use Hook
                </button>
              </div>
            </div>
         </div>
      </div>

    </div>
  );
}
