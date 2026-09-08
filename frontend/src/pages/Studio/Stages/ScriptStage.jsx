import React, { useState } from 'react';
import { api } from '../../../services/api';
import Icon from '../../../components/Icon';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/Card';
import Button from '../../../components/Button';
import ScoreBadge from '../../../components/ScoreBadge';
import { toast } from 'sonner';

export default function ScriptStage({ idea, script, setScript, onBack, onNext }) {
  const [generating, setGenerating] = useState(false);
  const [language, setLanguage] = useState('en');
  const [locale, setLocale] = useState('US');

  const generateScript = async () => {
    if (!idea) {
      toast.error('Please select a concept first');
      return;
    }
    setGenerating(true);
    try {
      const result = await api.generateScript(idea.id, language, locale);
      setScript(result);
      toast.success('Script drafted successfully!');
    } catch (e) {
      toast.error(`Script generation failed: ${e.message}`);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-text-primary">Stage 2: Script Writing</h2>
          <p className="text-xs text-text-secondary">AI generates high-hook scene narration and visual prompts based on your concept.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" icon="arrow-left" onClick={onBack}>
            Back
          </Button>
          {script && (
            <>
              <Button 
                variant="secondary" 
                size="sm" 
                icon="refresh-cw" 
                onClick={generateScript} 
                disabled={generating}
                loading={generating}
              >
                Regenerate
              </Button>
              <Button variant="primary" size="sm" icon="arrow-right" iconPosition="right" onClick={onNext}>
                Storyboard
              </Button>
            </>
          )}
        </div>
      </div>

      {idea && (
        <div className="bg-surface border border-border rounded-xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-8 h-8 rounded-lg bg-elevated border border-border flex items-center justify-center text-brand-red shrink-0">
              <Icon name="lightbulb" size={16} />
            </span>
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">Selected Concept</span>
              <h3 className="text-sm font-bold text-text-primary truncate">{idea.title}</h3>
            </div>
          </div>
          {idea.angle && (
            <span className="text-xs italic text-text-muted hidden md:inline truncate max-w-sm">
              "{idea.angle}"
            </span>
          )}
        </div>
      )}

      {!script ? (
        <Card variant="surface" className="max-w-xl mx-auto text-center p-8 space-y-6">
          <div className="w-14 h-14 bg-elevated border border-border rounded-2xl flex items-center justify-center text-brand-red mx-auto shadow-inner">
            <Icon name="sparkles" size={28} />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-text-primary">Generate Script</h3>
            <p className="text-xs text-text-secondary max-w-sm mx-auto">
              Our narrative AI will analyze your hook angle and construct a 5-to-7 scene script optimized for 9:16 Shorts viewer retention.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 text-left max-w-sm mx-auto bg-elevated p-4 rounded-xl border border-border">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1.5">Language</label>
              <select 
                className="w-full bg-surface-input border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:border-brand-red focus:outline-none"
                value={language} 
                onChange={e => setLanguage(e.target.value)}
              >
                <option value="en">English</option>
                <option value="hi">Hindi</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1.5">Dialect</label>
              <select 
                className="w-full bg-surface-input border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:border-brand-red focus:outline-none"
                value={locale} 
                onChange={e => setLocale(e.target.value)}
              >
                <option value="US">US</option>
                <option value="UK">UK</option>
                <option value="IN">India</option>
                <option value="ES">Spain</option>
              </select>
            </div>
          </div>

          <Button 
            variant="primary" 
            size="md" 
            icon={generating ? 'loader' : 'zap'} 
            onClick={generateScript} 
            disabled={generating}
            loading={generating}
            className="w-full max-w-xs mx-auto shadow-brand-glow"
          >
            {generating ? 'Drafting Script...' : 'Generate Script'}
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Scenes Column */}
          <div className="lg:col-span-8 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-text-muted">
                Scene Timeline ({script.scenes?.length || 0} scenes)
              </span>
              <span className="text-xs font-mono text-text-secondary">
                Est. {script.duration_est ? `${script.duration_est.toFixed(1)}s` : '—'}
              </span>
            </div>

            {(script.scenes || []).map((sc, idx) => (
              <Card key={sc.id || idx} variant="surface" className="flex gap-4 items-start">
                <div className="w-8 h-8 rounded-lg bg-elevated border border-border flex items-center justify-center shrink-0 font-mono font-bold text-xs text-brand-red">
                  {sc.scene_number || idx + 1}
                </div>
                <div className="flex-1 space-y-2.5 min-w-0">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block mb-1">
                      Narration
                    </span>
                    <p className="text-sm text-text-primary leading-relaxed">
                      {sc.narration}
                    </p>
                  </div>
                  <div className="bg-elevated/70 p-3 rounded-lg border border-border text-xs text-text-secondary flex items-start gap-2.5">
                    <Icon name="image" size={14} className="text-text-muted mt-0.5 shrink-0" />
                    <span className="leading-relaxed">{sc.visual_description}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Script Overview Column */}
          <div className="lg:col-span-4 space-y-4">
            <Card variant="surface">
              <CardHeader
                title={
                  <CardTitle icon={<Icon name="fileText" size={16} className="text-brand-red" />}>
                    Script Metadata
                  </CardTitle>
                }
              />
              <CardContent className="space-y-4 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-border/60">
                  <span className="text-text-muted">Quality Score</span>
                  <ScoreBadge score={script.quality_score} label="Score" />
                </div>
                <div className="flex justify-between items-center py-1 border-b border-border/60">
                  <span className="text-text-muted">Est. Duration</span>
                  <span className="font-mono font-bold text-text-primary">
                    {script.duration_est ? `${script.duration_est.toFixed(1)}s` : '—'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-border/60">
                  <span className="text-text-muted">Language</span>
                  <span className="font-mono font-bold uppercase text-text-primary">
                    {script.language}-{script.locale}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-text-muted">Scene Count</span>
                  <span className="font-mono font-bold text-text-primary">
                    {script.scenes?.length || 0} Scenes
                  </span>
                </div>
              </CardContent>
            </Card>

            <Button 
              variant="primary" 
              size="md" 
              icon="arrow-right" 
              iconPosition="right" 
              className="w-full shadow-brand-glow"
              onClick={onNext}
            >
              Proceed to Storyboard
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
