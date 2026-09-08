import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api';
import Icon from '../../../components/Icon';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/Card';
import Button from '../../../components/Button';
import EmptyState from '../../../components/EmptyState';
import Skeleton from '../../../components/Skeleton';
import { useNavigate } from 'react-router-dom';

export default function BriefStage({ selectedIdea, setSelectedIdea, onNext }) {
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(!selectedIdea);
  const navigate = useNavigate();

  useEffect(() => {
    if (selectedIdea) return;
    (async () => {
      try {
        const allIdeas = await api.getIdeas();
        setIdeas((allIdeas || []).filter(i => i.status === 'pending' || i.status === 'promoted'));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedIdea]);

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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-text-primary">Stage 1: Concept & Brief</h2>
          <p className="text-xs text-text-secondary">Select an idea concept to serve as the narrative foundation for your Short.</p>
        </div>
        {selectedIdea && (
          <Button variant="primary" size="sm" icon="arrow-right" iconPosition="right" onClick={onNext}>
            Draft Script
          </Button>
        )}
      </div>

      {selectedIdea ? (
        <Card variant="surface" className="border-brand-red/50 bg-surface">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-brand-red/15 text-brand-red flex items-center justify-center shrink-0 border border-brand-red/30">
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
                  <div className="pt-2">
                    <span className="inline-block bg-elevated border border-border px-2.5 py-1 rounded-md text-xs italic text-text-muted">
                      Hook Angle: "{selectedIdea.angle}"
                    </span>
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
      ) : ideas.length === 0 ? (
        <EmptyState
          icon="lightbulb"
          title="No Concepts Available"
          description="Your concept inbox is empty. Generate fresh video ideas to begin the production pipeline."
          action={
            <Button variant="primary" size="sm" icon="plus" onClick={() => navigate('/app/ideas')}>
              Generate Ideas
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-text-muted block">
            Select a Concept to Produce ({ideas.length} available)
          </span>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ideas.map(idea => (
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
                  <div className="pt-3 mt-3 border-t border-border/60">
                    <p className="text-[11px] text-text-muted italic truncate">
                      "{idea.angle}"
                    </p>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
