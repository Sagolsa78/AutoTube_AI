import React, { useState, useEffect } from 'react';
import Icon from '../../../../components/Icon';
import useStudioStore from '../../../../store/studioStore';
import { useChannel } from '../../../../contexts/ChannelContext';
import { api } from '../../../../services/api';
import { toast } from 'sonner';

export default function BriefView({ onNext, onAutoPilot }) {
  const { activeChannelId } = useChannel();
  const selectedIdea = useStudioStore((s) => s.selectedIdea);
  const contentType = useStudioStore((s) => s.project?.contentType || 'short');
  const setContentType = useStudioStore((s) => s.setContentType);
  const targetDuration = useStudioStore((s) => s.project?.targetDuration || '60');
  const setTargetDuration = useStudioStore((s) => s.setTargetDuration);
  const language = useStudioStore((s) => s.audio?.language || 'en');
  const setLanguage = useStudioStore((s) => s.setLanguage);

  // Additional metadata for new spec
  const [tone, setTone] = useState('energetic');
  const [visualStrategy, setVisualStrategy] = useState('auto');
  const [audience, setAudience] = useState('general');

  const [topic, setTopic] = useState(selectedIdea?.topic || selectedIdea?.title || '');
  const [generating, setGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState('');

  const setScript = useStudioStore((s) => s.setScript);
  const setSelectedIdea = useStudioStore((s) => s.setSelectedIdea);
  const setRender = useStudioStore((s) => s.setRender);
  const project = useStudioStore((s) => s.project);
  const voiceId = useStudioStore((s) => s.audio?.voice);
  const formatType = contentType === 'long' ? '16:9' : '9:16';

  const [improving, setImproving] = useState(false);
  const [aiInsight, setAiInsight] = useState(null);
  const [hooks, setHooks] = useState(null);
  const [loadingHooks, setLoadingHooks] = useState(false);

  // Auto-fetch insights removed to avoid unprompted API calls. User must click 'Improve idea' now.
  useEffect(() => {
    if (topic.length < 20) {
      setAiInsight(null);
      setHooks(null);
    }
  }, [topic]);

  const handleGenerateHooks = async () => {
    if (!topic.trim()) return;
    setLoadingHooks(true);
    try {
      let ideaId = selectedIdea?.id;
      if (!ideaId) {
        const newIdea = await api.createIdea({
          topic,
          channel_id: activeChannelId || null,
          angle: `Tone: ${tone}, Audience: ${audience}`
        });
        ideaId = newIdea.id;
        setSelectedIdea(newIdea);
      }
      const data = await api.getHooks(ideaId);
      setHooks(data);
      toast.success("Hooks generated successfully!");
    } catch(e) {
      console.error(e);
      toast.error('Failed to generate hooks: ' + e.message);
    } finally {
      setLoadingHooks(false);
    }
  };

  const handleDraftScript = async () => {
    if (!topic.trim()) return;
    setGenerating(true);
    try {
      setGenerationStep('Analyzing idea');
      let ideaId = selectedIdea?.id;
      if (!ideaId) {
        const newIdea = await api.createIdea({
          topic,
          channel_id: activeChannelId || null,
          angle: `Tone: ${tone}, Audience: ${audience}`
        });
        ideaId = newIdea.id;
        setSelectedIdea(newIdea);
      }

      setGenerationStep('Building hook');
      await new Promise(r => setTimeout(r, 600));

      setGenerationStep('Generating script');
      const scriptData = await api.generateScript(ideaId, language, 'US', contentType, targetDuration);

      setGenerationStep('Checking quality');
      await new Promise(r => setTimeout(r, 400));

      setScript(scriptData);

      // Advance pipeline
      if (project?.id) {
        await api.updateProject(project.id, {
          idea_id: ideaId,
          script_id: scriptData.id,
          current_stage: 'script',
          title: scriptData.topic || topic
        });
      }

      onNext();
    } catch (err) {
      console.error(err);
      toast.error('Couldn\'t generate script', {
        description: err.message || 'The AI provider did not return a valid script.'
      });
    } finally {
      setGenerating(false);
      setGenerationStep('');
    }
  };

  const handleImproveIdea = async () => {
    if (!topic.trim() || improving) return;
    setImproving(true);
    try {
      const res = await api.improveIdea(topic, activeChannelId || null);
      if (res.improved_topic) {
        setAiInsight(res.improved_topic);
        toast.success("AI suggested a new angle!");
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to improve idea: ' + err.message);
    } finally {
      setImproving(false);
    }
  };

  const handleAutoPilot = async () => {
    if (!topic.trim() || generating) return;
    setGenerating(true);
    try {
      setGenerationStep('Analyzing idea');
      let ideaId = selectedIdea?.id;
      if (!ideaId) {
        const newIdea = await api.createIdea({
          topic,
          channel_id: activeChannelId || null,
          angle: `Tone: ${tone}, Audience: ${audience}`
        });
        ideaId = newIdea.id;
        setSelectedIdea(newIdea);
      }

      setGenerationStep('Generating script');
      const scriptData = await api.generateScript(ideaId, language, 'US', contentType, targetDuration);
      setScript(scriptData);

      setGenerationStep('Dispatching engine');
      const opts = {
        script_id: scriptData.id,
        style: 'cinematic', // default fallback
        caption_style: 'auto',
        custom_cta: null,
        voice_override: voiceId,
        visual_strategy: 'auto',
        content_type: contentType,
        target_duration_seconds: targetDuration,
        orientation: formatType,
        quality: 'standard'
      };
      const video = await api.renderVideoFull(opts);
      setRender({ videoId: video.id });

      // Advance pipeline
      if (project?.id) {
        await api.updateProject(project.id, {
          idea_id: ideaId,
          script_id: scriptData.id,
          video_id: video.id,
          current_stage: 'output',
          title: scriptData.topic || topic
        });
      }

      onAutoPilot();
    } catch (err) {
      console.error(err);
      toast.error('Auto-Pilot failed: ' + err.message);
    } finally {
      setGenerating(false);
      setGenerationStep('');
    }
  };

  const applyInsight = () => {
    if (aiInsight) {
      setTopic(aiInsight);
      setAiInsight(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden bg-canvas">

      {/* ── LEFT: Creative Brief (60%) ──────────────────────────────────────── */}
      <div className="w-full lg:w-[60%] p-6 lg:p-12 lg:overflow-y-auto hide-scrollbar border-r border-border/50 shrink-0 lg:shrink">
        <div className="max-w-2xl mx-auto space-y-8">

          <div className="space-y-2">
            <h2 className="text-3xl font-bold tracking-tight text-text-primary">Create something worth watching.</h2>
            <p className="text-text-secondary text-sm">Describe the video you want AutoTube to make.</p>
          </div>

          <div className="space-y-6">
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-brand-red/30 to-brand-red/0 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition duration-500"></div>
              <div className="relative bg-surface border border-border/60 rounded-2xl p-4 transition-all shadow-sm group-focus-within:border-brand-red/50">
                <textarea
                  className="w-full bg-transparent border-none focus:outline-none resize-none text-text-primary text-lg placeholder:text-text-muted min-h-[140px] leading-relaxed"
                  placeholder="E.g., A video explaining why time behaves differently near black holes..."
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                />
                <div className="flex justify-between items-center mt-4 border-t border-border/40 pt-3">
                  <button
                    onClick={handleImproveIdea}
                    disabled={improving || !topic.trim()}
                    className="flex items-center gap-2 text-sm font-semibold text-brand-red hover:text-brand-red-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Icon name={improving ? "loader" : "sparkles"} size={16} className={improving ? "animate-spin" : ""} />
                    {improving ? 'Improving...' : 'Improve idea'}
                  </button>
                  <span className="text-xs text-text-muted font-mono bg-canvas px-2 py-1 rounded">{topic.length} chars</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-2">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-text-muted">Format</label>
                <select
                  value={contentType}
                  onChange={(e) => setContentType(e.target.value)}
                  className="w-full bg-surface border border-border/60 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red/20 transition-all cursor-pointer"
                >
                  <option value="short">Short (9:16)</option>
                  <option value="long">Long (16:9)</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-text-muted">Duration</label>
                <select
                  value={targetDuration}
                  onChange={(e) => setTargetDuration(Number(e.target.value))}
                  className="w-full bg-surface border border-border/60 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red/20 transition-all cursor-pointer"
                >
                  <option value={30}>30 sec</option>
                  <option value={45}>45 sec</option>
                  <option value={60}>60 sec</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-text-muted">Language</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full bg-surface border border-border/60 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red/20 transition-all cursor-pointer"
                >
                  <option value="en">English</option>
                  <option value="hi">Hindi</option>
                  <option value="es">Spanish</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-text-muted">Tone</label>
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className="w-full bg-surface border border-border/60 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red/20 transition-all cursor-pointer"
                >
                  <option value="energetic">Energetic</option>
                  <option value="documentary">Documentary</option>
                  <option value="humorous">Humorous</option>
                  <option value="dramatic">Dramatic</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-text-muted">Visual Strategy</label>
                <select
                  value={visualStrategy}
                  onChange={(e) => setVisualStrategy(e.target.value)}
                  className="w-full bg-surface border border-border/60 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red/20 transition-all cursor-pointer"
                >
                  <option value="auto">Auto (AI selects)</option>
                  <option value="stock">Stock Only</option>
                  <option value="ai">AI Generated</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-text-muted">Audience</label>
                <input
                  type="text"
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  placeholder="E.g., Science fans"
                  className="w-full bg-surface border border-border/60 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red/20 transition-all"
                />
              </div>
            </div>

            <div className="pt-8 flex flex-col md:flex-row items-center gap-4">
              <button
                onClick={handleDraftScript}
                disabled={generating || !topic.trim()}
                className="w-full md:w-auto px-6 py-3.5 bg-surface border border-border text-text-primary text-base font-bold rounded-xl hover:bg-elevated hover:border-border-strong hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:hover:translate-y-0"
              >
                Generate Script
              </button>
              <button
                onClick={handleAutoPilot}
                disabled={generating || !topic.trim()}
                className="w-full md:flex-1 px-8 py-3.5 bg-brand-red text-white text-base font-bold rounded-xl shadow-brand-glow hover:shadow-lg hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none relative overflow-hidden group"
              >
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                {generating ? (
                  <>
                    <Icon name="loader" size={18} className="animate-spin relative z-10" />
                    <span className="relative z-10">{generationStep || 'Generating...'}</span>
                  </>
                ) : (
                  <>
                    <Icon name="zap" size={18} className="relative z-10" />
                    <span className="relative z-10">Auto-Pilot Generation</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT: AutoTube Copilot (40%) ──────────────────────────────── */}
      <div className="w-full lg:w-[40%] bg-surface/40 flex flex-col shrink-0 relative border-l border-border/50">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-ai/10 via-transparent to-transparent opacity-50"></div>

        <div className="h-16 px-6 border-b border-border/50 flex items-center justify-between z-10 bg-canvas/50 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-2 text-ai">
             <Icon name="sparkles" size={16} />
             <span className="text-xs font-bold uppercase tracking-widest">AutoTube Copilot</span>
          </div>
          <span className="text-[10px] font-bold tracking-wider text-text-muted bg-surface px-2 py-1 rounded border border-border">AI Assistant</span>
        </div>

        <div className="flex-1 p-6 flex flex-col gap-4 overflow-y-auto z-10 relative hide-scrollbar">

          <div className="bg-surface border border-border rounded-xl p-4 shadow-sm hover:border-ai/30 transition-colors group">
            <h4 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-2 flex items-center gap-2">
              Topic Improvement {improving && <span className="w-2 h-2 rounded-full bg-ai animate-pulse" />}
            </h4>
            <p className={`text-sm leading-relaxed ${aiInsight ? 'text-text-primary' : 'text-text-muted italic'}`}>
              {aiInsight || 'Describe your idea and click "Improve idea" to get an AI optimized topic...'}
            </p>
            {aiInsight && (
               <div className="mt-4 flex justify-end">
                  <button onClick={applyInsight} className="text-xs font-bold bg-ai/10 text-ai hover:bg-ai hover:text-white px-3 py-1.5 rounded-lg transition-colors border border-ai/20 hover:border-ai">
                    Apply Suggestion
                  </button>
               </div>
            )}
          </div>

          <div className="bg-surface border border-border rounded-xl p-4 shadow-sm flex flex-col gap-3">
             <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-text-muted uppercase tracking-widest flex items-center gap-2">
                  Hook Candidates
                </h4>
                <button
                  onClick={handleGenerateHooks}
                  disabled={loadingHooks || !topic.trim()}
                  className="text-xs font-bold text-ai hover:text-white bg-ai/10 hover:bg-ai px-2.5 py-1 rounded transition-colors disabled:opacity-50"
                >
                  {loadingHooks ? 'Generating...' : 'Generate Hooks'}
                </button>
             </div>

             {hooks && hooks.candidates ? (
               <div className="flex flex-col gap-3 mt-2">
                 {hooks.candidates.map((c, i) => (
                   <div key={i} className={`p-3 rounded border ${i === hooks.best_hook_index ? 'border-ai bg-ai/10' : 'border-border/50 bg-bg-2'}`}>
                     <div className="flex justify-between items-start gap-2 mb-1">
                       <span className="text-[10px] font-bold text-ai uppercase tracking-wider">{c.angle}</span>
                       <span className="text-[10px] font-mono text-text-muted">Score: {c.expected_retention_score}</span>
                     </div>
                     <p className="text-sm font-semibold text-text-primary">"{c.hook_text}"</p>
                     <p className="text-xs text-text-muted mt-2">👁️ {c.visual_suggestion}</p>
                   </div>
                 ))}
               </div>
             ) : (
               <div className="text-sm text-text-muted italic py-4 text-center border border-dashed border-border/50 rounded">
                 Generate hooks to see options...
               </div>
             )}
          </div>

        </div>
      </div>
    </div>
  );
}
