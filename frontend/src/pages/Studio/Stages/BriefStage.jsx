import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api';
import Icon from '../../../components/Icon';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/Card';
import Button from '../../../components/Button';
import EmptyState from '../../../components/EmptyState';
import Skeleton from '../../../components/Skeleton';
import { useNavigate } from 'react-router-dom';
import { useChannel } from '../../../contexts/ChannelContext';
import { toast } from 'sonner';

const CONTENT_TYPES = [
  { id: 'facts', label: 'Fast Facts', icon: 'zap' },
  { id: 'explainer', label: 'Explainer', icon: 'info' },
  { id: 'story', label: 'Story & Mystery', icon: 'book-open' },
  { id: 'news', label: 'Tech / News', icon: 'activity' },
  { id: 'motivation', label: 'Motivation', icon: 'sparkles' },
  { id: 'custom', label: 'Custom', icon: 'edit-3' },
];

const DURATIONS = [
  { id: '30', label: '30 sec', desc: '~65 words' },
  { id: '60', label: '60 sec', desc: '~130 words' },
  { id: '90', label: '90 sec', desc: '~190 words' },
];

export default function BriefStage({ selectedIdea, setSelectedIdea, contentType, setContentType, duration, setDuration, onNext }) {
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(!selectedIdea);
  const [quickTopic, setQuickTopic] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [generatingQuick, setGeneratingQuick] = useState(false);

  // Freeform settings
  const [customPrompt, setCustomPrompt] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [tone, setTone] = useState('');
  const [format, setFormat] = useState('short');
  const [customDuration, setCustomDuration] = useState('');

  const { activeChannelId, activeChannel } = useChannel();
  const navigate = useNavigate();

  useEffect(() => {
    if (selectedIdea) return;
    (async () => {
      try {
        setLoading(true);
        const allIdeas = await api.getIdeas(activeChannelId);
        setIdeas((allIdeas || []).filter(i => i.status === 'pending' || i.status === 'promoted'));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedIdea, activeChannelId]);

  const handleQuickCreate = async (e) => {
    e.preventDefault();
    if (!quickTopic.trim()) {
      toast.error('Please enter a video topic');
      return;
    }
    if (!activeChannelId) {
      toast.error('Please select an active channel first');
      return;
    }

    setGeneratingQuick(true);
    try {
      const payload = {
        niche: quickTopic.trim(),
        content_type: contentType,
        custom_content_type: contentType === 'custom' ? 'custom' : undefined,
        custom_prompt: contentType === 'custom' ? customPrompt : undefined,
        target_audience: contentType === 'custom' ? targetAudience : undefined,
        tone: contentType === 'custom' ? tone : undefined,
        format: contentType === 'custom' ? format : undefined,
        target_duration: contentType === 'custom' && customDuration ? parseInt(customDuration, 10) : parseInt(duration, 10)
      };

      const generated = await api.generateIdeas(activeChannelId, 3, payload);
      if (generated && generated.length > 0) {
        const topIdea = generated[0];
        setSelectedIdea(topIdea);
        toast.success(`Draft concept generated: "${topIdea.title}"`);
        onNext();
      } else {
        toast.error('Failed to draft concept. Try again.');
      }
    } catch (err) {
      toast.error(`Quick create failed: ${err.message}`);
    } finally {
      setGeneratingQuick(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton height="80px" rounded="rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Skeleton height="160px" rounded="rounded-xl" />
          <Skeleton height="160px" rounded="rounded-xl" />
          <Skeleton height="160px" rounded="rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ── Stage Header ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-text-primary">Stage 1: Concept & Brief</h2>
          <p className="text-xs text-text-secondary">Start with a quick topic prompt or choose from your curated idea lab.</p>
        </div>
        {selectedIdea && (
          <Button variant="primary" size="sm" icon="arrow-right" iconPosition="right" onClick={onNext}>
            Proceed to Script
          </Button>
        )}
      </div>

      {/* ── Quick Create Studio Box ──────────────────────────────── */}
      {!selectedIdea && (
        <Card variant="surface" className="border-brand-red/30 bg-surface shadow-card-subtle">
          <CardHeader
            title={
              <CardTitle icon={<Icon name="sparkles" className="text-brand-red" size={18} />}>
                Quick Create [DEBUG: C={String(contentType)}, D={String(duration)}]
              </CardTitle>
            }
          />
          <CardContent>
            <form onSubmit={handleQuickCreate} className="space-y-5">
              {/* Topic Input */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-2">
                  What do you want to create?
                </label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={quickTopic}
                    onChange={(e) => setQuickTopic(e.target.value)}
                    placeholder="e.g. Why the Sahara Desert was once a lush green rainforest..."
                    className="flex-1 bg-surface-input border border-border rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-red focus:outline-none transition-colors"
                    autoFocus
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    icon={generatingQuick ? 'loader' : 'zap'}
                    loading={generatingQuick}
                    disabled={generatingQuick || !quickTopic.trim()}
                    className="shrink-0 shadow-brand-glow"
                  >
                    {generatingQuick ? 'Generating Draft...' : 'Generate Draft'}
                  </Button>
                </div>
              </div>

              {/* Content Type & Duration Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                {/* Content Type Chips */}
                <div>
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-text-muted mb-2">
                    Content Type
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {CONTENT_TYPES.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setContentType(t.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors select-none ${
                          contentType === t.id
                            ? 'bg-brand-red text-white shadow-sm'
                            : 'bg-elevated text-text-secondary hover:text-text-primary border border-border'
                        }`}
                      >
                        <Icon name={t.icon} size={13} />
                        <span>{t.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Target Duration */}
                {contentType !== 'custom' && (
                  <div>
                    <span className="block text-[11px] font-bold uppercase tracking-wider text-text-muted mb-2">
                      Target Duration
                    </span>
                    <div className="flex gap-2">
                      {DURATIONS.map((d) => (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => setDuration(d.id)}
                          className={`flex-1 py-1.5 px-2 rounded-lg text-center transition-colors select-none ${
                            duration == d.id
                              ? 'bg-elevated border border-brand-red text-brand-red font-bold'
                              : 'bg-surface-input border border-border text-text-muted hover:text-text-secondary'
                          }`}
                        >
                          <div className="text-xs font-bold">{d.label}</div>
                          <div className="text-[10px] opacity-75 font-mono">{d.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Freeform Settings Panel */}
              {contentType === 'custom' && (
                <div className="bg-elevated border border-border p-4 rounded-xl space-y-4 animate-in fade-in">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1.5">
                      Custom Formatting Instructions
                    </label>
                    <textarea
                      value={customPrompt}
                      onChange={e => setCustomPrompt(e.target.value)}
                      placeholder="e.g. Start with a rhetorical question, explain 3 key points, and end with a cliffhanger..."
                      className="w-full bg-surface-input border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:border-brand-red focus:outline-none min-h-[60px]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1.5">Target Audience</label>
                      <input
                        type="text"
                        value={targetAudience}
                        onChange={e => setTargetAudience(e.target.value)}
                        placeholder="e.g. Teens, Professionals"
                        className="w-full bg-surface-input border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:border-brand-red focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1.5">Tone</label>
                      <input
                        type="text"
                        value={tone}
                        onChange={e => setTone(e.target.value)}
                        placeholder="e.g. Humorous, Serious"
                        className="w-full bg-surface-input border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:border-brand-red focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1.5">Format</label>
                      <select
                        value={format}
                        onChange={e => setFormat(e.target.value)}
                        className="w-full bg-surface-input border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:border-brand-red focus:outline-none"
                      >
                        <option value="short">Short (9:16)</option>
                        <option value="long_form">Long Form (16:9)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1.5">Duration (seconds)</label>
                      <input
                        type="number"
                        value={customDuration}
                        onChange={e => setCustomDuration(e.target.value)}
                        placeholder="e.g. 120"
                        className="w-full bg-surface-input border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:border-brand-red focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Progressive Disclosure: Advanced Options */}
              <div className="pt-2 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="text-xs text-text-muted hover:text-text-primary flex items-center gap-1.5 transition-colors font-medium"
                >
                  <Icon name={showAdvanced ? 'chevron-up' : 'chevron-down'} size={14} />
                  <span>Advanced options</span>
                </button>

                {showAdvanced && (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-elevated/60 rounded-xl border border-border/80 text-xs animate-in fade-in">
                    <div>
                      <span className="text-text-muted block mb-1">Target Niche</span>
                      <span className="font-semibold text-text-primary capitalize">
                        {activeChannel?.niche || 'General Shorts'}
                      </span>
                    </div>
                    <div>
                      <span className="text-text-muted block mb-1">Language</span>
                      <span className="font-semibold text-text-primary uppercase">
                        {activeChannel?.language || 'English (en)'}
                      </span>
                    </div>
                    <div>
                      <span className="text-text-muted block mb-1">Voice Talent</span>
                      <span className="font-semibold text-text-primary">
                        {activeChannel?.default_voice_id || 'Christopher (US)'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ── Selected Concept Spotlight ───────────────────────────── */}
      {selectedIdea ? (
        <Card variant="surface" className="border-brand-red/50 bg-surface">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-brand-red/15 text-brand-red flex items-center justify-center shrink-0 border border-brand-red/30 shadow-brand-glow">
                <Icon name="lightbulb" size={22} />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-brand-red bg-brand-red/10 px-2 py-0.5 rounded border border-brand-red/20">
                    Selected Concept
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-text-primary">
                  {selectedIdea.title}
                </h3>
                <p className="text-xs text-text-secondary max-w-2xl leading-relaxed">
                  {selectedIdea.topic}
                </p>
                {selectedIdea.angle && (
                  <div className="pt-2 flex flex-wrap gap-2">
                    <span className="inline-block bg-elevated border border-border px-2.5 py-1 rounded-md text-xs italic text-text-muted">
                      Hook Angle: "{selectedIdea.angle}"
                    </span>
                    {selectedIdea.settings?.content_type && (
                      <span className="inline-flex items-center gap-1 bg-surface-input border border-border px-2.5 py-1 rounded-md text-[11px] uppercase tracking-wider text-text-muted font-bold">
                        <Icon name="tag" size={12} />
                        {selectedIdea.settings.content_type}
                      </span>
                    )}
                    {selectedIdea.settings?.target_duration && (
                      <span className="inline-flex items-center gap-1 bg-surface-input border border-border px-2.5 py-1 rounded-md text-[11px] uppercase tracking-wider text-text-muted font-bold">
                        <Icon name="clock" size={12} />
                        {selectedIdea.settings.target_duration}s
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 sm:self-center shrink-0">
              <Button variant="secondary" size="sm" onClick={() => setSelectedIdea(null)}>
                Change Concept
              </Button>
              <Button variant="primary" size="sm" icon="arrow-right" iconPosition="right" onClick={onNext}>
                Proceed to Script
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        /* ── Or Choose from Curated Idea Lab ─────────────────────── */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-text-muted">
              Or Select from Idea Lab ({ideas.length})
            </span>
            <button
              onClick={() => navigate('/app/ideas')}
              className="text-xs text-brand-red hover:underline font-semibold"
            >
              Open Idea Lab →
            </button>
          </div>

          {ideas.length === 0 ? (
            <EmptyState
              icon="lightbulb"
              title="No Saved Concepts Yet"
              description="Use the Quick Create box above to brainstorm your first Short, or visit the Idea Lab."
              action={
                <Button variant="secondary" size="sm" icon="sparkles" onClick={() => navigate('/app/ideas')}>
                  Brainstorm in Idea Lab
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {ideas.map((idea) => (
                <Card
                  key={idea.id}
                  variant="surface"
                  hoverable
                  className="cursor-pointer flex flex-col justify-between"
                  onClick={() => setSelectedIdea(idea)}
                >
                  <div className="space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <h4 className="font-bold text-sm text-text-primary line-clamp-2 leading-tight">
                        {idea.title}
                      </h4>
                      <span className="text-[10px] font-mono text-text-muted uppercase shrink-0">
                        {idea.status}
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed">
                      {idea.topic}
                    </p>
                  </div>

                  {idea.angle && (
                    <div className="pt-3 mt-3 border-t border-border/60 flex flex-col gap-2">
                      <p className="text-[11px] text-text-muted italic truncate">
                        "{idea.angle}"
                      </p>
                      {(idea.settings?.content_type || idea.settings?.target_duration) && (
                        <div className="flex gap-2">
                          {idea.settings?.content_type && (
                            <span className="inline-flex items-center gap-1 bg-surface-input border border-border px-2 py-0.5 rounded text-[9px] uppercase tracking-wider text-text-muted font-bold">
                              {idea.settings.content_type}
                            </span>
                          )}
                          {idea.settings?.target_duration && (
                            <span className="inline-flex items-center gap-1 bg-surface-input border border-border px-2 py-0.5 rounded text-[9px] uppercase tracking-wider text-text-muted font-bold">
                              {idea.settings.target_duration}s
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
