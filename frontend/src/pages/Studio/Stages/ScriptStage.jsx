import { useState } from 'react';
import { api } from '../../../services/api';
import Icon from '../../../components/Icon';
import Button from '../../../components/Button';
import Badge from '../../../components/Badge';
import { toast } from 'sonner';

export default function ScriptStage({ idea, script, setScript, onBack, onNext }) {
  const [generating, setGenerating] = useState(false);

  const generateScript = async () => {
    if (!idea) return;
    setGenerating(true);
    try {
      const result = await api.generateScript(idea.id);
      setScript(result);
      toast.success('Script generated successfully!');
    } catch (e) {
      toast.error(`Script generation failed: ${e.message}`);
    }
    setGenerating(false);
  };

  return (
    <div className="create-stage">
      <h2 className="stage-title">Generate Script</h2>
      
      {idea && (
        <div className="selected-idea-banner mb-4">
          <Icon name="layers" size={16} />
          <div>
            <strong>{idea.title}</strong>
            <span className="text-muted"> — {idea.topic}</span>
          </div>
        </div>
      )}

      {!script ? (
        <div className="script-gen-action">
          <p>The AI will generate a scene-by-scene script with narration and visual descriptions for each beat.</p>
          <Button variant="primary" icon="sparkles" onClick={generateScript} loading={generating}>
            Generate Script
          </Button>
        </div>
      ) : (
        <div className="script-preview">
          <div className="script-preview-header">
            <h3>Generated Script</h3>
            <div className="flex gap-2">
              <Badge 
                variant={script.quality_score >= 70 ? 'approved' : 'pending'}
                style={{ 
                  background: script.quality_score >= 70 ? 'var(--success-muted)' : 'var(--warning-muted)', 
                  color: script.quality_score >= 70 ? 'var(--success)' : 'var(--warning)' 
                }}
              >
                QA: {script.quality_score || 'N/A'}
              </Badge>
              <span className="text-muted text-sm">~{script.duration_est?.toFixed(0) || 0}s</span>
            </div>
          </div>
          
          <div className="scene-list-preview">
            {script.scenes?.map((sc) => (
              <div key={sc.id} className="scene-preview-card">
                <div className="scene-number">Scene {sc.scene_number}</div>
                <div className="scene-narration">{sc.narration}</div>
                <div className="scene-visual">
                  <Icon name="image" size={12} /> {sc.visual_description}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 mt-4">
        <Button variant="secondary" onClick={onBack}>Back to Idea</Button>
        {script && (
          <>
            <Button variant="secondary" icon="refresh-cw" onClick={generateScript} loading={generating}>
              Regenerate
            </Button>
            <Button variant="primary" icon="layout" iconPosition="right" onClick={onNext}>
              Edit Storyboard
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
