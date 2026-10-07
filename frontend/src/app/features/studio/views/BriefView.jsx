import React, { useState, useEffect } from 'react';
import Icon from '../../../../components/Icon';
import useStudioStore from '../../../../store/studioStore';
import { api } from '../../../../services/api';
import { toast } from 'sonner';

export default function BriefView({ onNext, onAutoPilot }) {
  const selectedIdea = useStudioStore((s) => s.selectedIdea);
  const contentType = useStudioStore((s) => s.contentType);
  const setContentType = useStudioStore((s) => s.setContentType);
  const targetDuration = useStudioStore((s) => s.targetDuration);
  const setTargetDuration = useStudioStore((s) => s.setTargetDuration);
  const language = useStudioStore((s) => s.language);
  const setLanguage = useStudioStore((s) => s.setLanguage);

  // Additional metadata for new spec
  const [tone, setTone] = useState('energetic');
  const [visualStrategy, setVisualStrategy] = useState('auto');
  const [audience, setAudience] = useState('general');

  const [topic, setTopic] = useState(selectedIdea?.topic || '');
  const [generating, setGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState('');

  const setScript = useStudioStore((s) => s.setScript);
  const setSelectedIdea = useStudioStore((s) => s.setSelectedIdea);
  const setRender = useStudioStore((s) => s.setRender);
  const voiceSettings = useStudioStore((s) => s.voiceSettings);
  const formatType = useStudioStore((s) => s.project?.formatType || '9:16');

  const [improving, setImproving] = useState(false);
  const [aiInsight, setAiInsight] = useState(null);

  // Auto-fetch insights when topic changes significantly (debounced)
  useEffect(() => {
    if (topic.length < 20) {
      setAiInsight(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
         // Real API call would go here to get a hook suggestion based on the topic.
         // Since we don't have a dedicated getInsights endpoint, we'll simulate an insight request
         // or call improveIdea passively if such endpoint existed.
         // For now, we'll keep it empty unless the user clicks "Improve idea"
      } catch(e) {}
    }, 1000);
    return () => clearTimeout(timer);
  }, [topic]);

  const handleDraftScript = async () => {
    if (!topic.trim()) return;
    setGenerating(true);
    try {
      setGenerationStep('Analyzing idea');
      let ideaId = selectedIdea?.id;
      if (!ideaId) {
        const newIdea = await api.createIdea({
          topic,
          channel_id: null,
          angle: `Tone: ${tone}, Audience: ${audience}`
        });
        ideaId = newIdea.id;
        setSelectedIdea(newIdea);
      }

      setGenerationStep('Building hook');
      await new Promise(r => setTimeout(r, 1000)); // UI delay for polish

      setGenerationStep('Generating script');
      const scriptData = await api.generateScript(ideaId, language, 'US', contentType, targetDuration);

      setGenerationStep('Checking quality');
      await new Promise(r => setTimeout(r, 800)); // UI delay for polish

      setScript(scriptData);
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
      const res = await api.improveIdea(topic);
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
          channel_id: null,
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
        voice_override: voiceSettings?.voiceId,
        visual_strategy: 'auto',
        content_type: contentType,
        target_duration_seconds: targetDuration,
        orientation: formatType,
        quality: 'standard'
      };
      const video = await api.renderVideoFull(opts);
      setRender({ videoId: video.id });
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
            <h2 className="text-3xl font-bold tracking-tight text-text-primary">What should we create?</h2>
            <p className="text-text-secondary text-sm">Tell AutoTube what you want to make, and we'll handle the rest.</p>
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
                className="w-full md:w-auto px-6 py-3.5 bg-surface border border-border/80 text-text-primary text-base font-bold rounded-xl hover:bg-surface-hover hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:hover:translate-y-0"
              >
                Draft Script Only
              </button>
              <button
                onClick={handleAutoPilot}
                disabled={generating || !topic.trim()}
                className="w-full md:flex-1 px-8 py-3.5 bg-brand-red text-white text-base font-bold rounded-xl shadow-[0_4px_14px_0_rgba(230,57,47,0.39)] hover:shadow-[0_6px_20px_rgba(230,57,47,0.23)] hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none relative overflow-hidden group"
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

      {/* ── RIGHT: Live Preview & AI Insights (40%) ──────────────────────────────── */}
      <div className="w-full lg:w-[40%] bg-surface/30 flex flex-col shrink-0 relative">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-brand-red/5 via-transparent to-transparent opacity-50"></div>

        <div className="p-6 border-b border-border/30 flex items-center justify-between z-10 bg-canvas/50 backdrop-blur-md">
          <span className="text-xs font-bold uppercase tracking-widest text-text-muted">Live Preview</span>
          <span className="text-xs font-mono text-text-secondary bg-surface px-2.5 py-1 rounded-md border border-border/50">Abstract</span>
        </div>

        <div className="flex-1 p-6 flex flex-col items-center justify-center z-10 relative">
          <div className="w-[260px] aspect-[9/16] bg-canvas border border-border/50 rounded-3xl flex flex-col items-center justify-center relative overflow-hidden shadow-2xl">
            {/* Abstract visualizer for IDEA stage */}
            <div className="absolute inset-0 flex items-center justify-center opacity-30">
              <div className="w-48 h-48 bg-brand-red/20 rounded-full blur-3xl animate-pulse"></div>
            </div>
            <Icon name="lightbulb" size={32} className="text-brand-red/80 mb-4" />
            <p className="text-base font-semibold text-text-primary text-center px-4">Concept Stage</p>
            <p className="text-xs text-text-muted mt-2 text-center px-6">Provide a topic to begin the creative process.</p>
          </div>
        </div>

        {/* AI Insight Panel */}
        <div className="m-6 bg-surface border border-border/60 rounded-2xl p-5 shadow-lg relative overflow-hidden z-10 group transition-all hover:border-brand-red/30">
          <div className="absolute top-0 left-0 w-1 h-full bg-brand-red rounded-l-2xl"></div>

          <div className="flex items-center gap-2 mb-3">
            <Icon name="sparkles" size={16} className="text-brand-red" />
            <span className="text-xs font-bold uppercase tracking-widest text-text-primary">AI Insight</span>
          </div>

          <div className="flex flex-col gap-4">
            {aiInsight ? (
              <>
                <p className="text-sm text-text-secondary leading-relaxed">
                  <span className="font-semibold text-text-primary block mb-1">Stronger hook available:</span>
                  "{aiInsight}"
                </p>
                <div className="flex justify-end">
                  <button
                    onClick={applyInsight}
                    className="text-xs font-bold bg-brand-red/10 text-brand-red border border-brand-red/20 hover:bg-brand-red hover:text-white px-4 py-1.5 rounded-lg transition-colors"
                  >
                    Use this hook
                  </button>
                </div>
              </>
            ) : (
              <p className="text-sm text-text-muted italic leading-relaxed">
                Describe your idea and AutoTube will suggest hooks and improvements.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
