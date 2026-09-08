import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../../services/api';
import Icon from '../../components/Icon';
import GridContainer from '../../components/layout/GridContainer';
import { toast } from 'sonner';

import BriefStage from './Stages/BriefStage';
import ScriptStage from './Stages/ScriptStage';
import StoryboardStage from './Stages/StoryboardStage';
import RenderStage from './Stages/RenderStage';

const STAGES = [
  { id: 'brief', step: 1, label: 'Concept & Brief', icon: 'lightbulb', desc: 'Select or brainstorm topic' },
  { id: 'script', step: 2, label: 'Script Writing', icon: 'fileText', desc: 'AI scene & narration generation' },
  { id: 'storyboard', step: 3, label: 'Storyboard', icon: 'image', desc: 'Visual curation & stock clips' },
  { id: 'render', step: 4, label: 'Voice & Render', icon: 'film', desc: 'Audio engine & assembly' }
];

export default function StudioShell() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const initialIdeaId = searchParams.get('idea');
  const initialScriptId = searchParams.get('script');

  const [stage, setStage] = useState(initialScriptId ? 'script' : 'brief');
  const [loading, setLoading] = useState(true);

  // Global Production Context
  const [profile, setProfile] = useState(null);
  const [channels, setChannels] = useState([]);
  const [captionStyles, setCaptionStyles] = useState([]);

  // Production State
  const [selectedIdea, setSelectedIdea] = useState(null);
  const [script, setScript] = useState(null);
  const [editingScenes, setEditingScenes] = useState([]);
  
  const [selectedStyle, setSelectedStyle] = useState('fast_facts');
  const [selectedCaption, setSelectedCaption] = useState('bold_centered');
  const [selectedVoice, setSelectedVoice] = useState('en-US-ChristopherNeural');

  useEffect(() => {
    let isMounted = true;
    (async () => {
      setLoading(true);
      try {
        const [prof, styles, chans] = await Promise.all([
          api.getProfile(), api.getCaptionStyles(), api.getChannels()
        ]);
        if (!isMounted) return;

        setProfile(prof);
        setCaptionStyles(styles || []);
        setChannels(chans || []);
        setSelectedCaption(prof?.caption_style || 'bold_centered');
        setSelectedVoice(prof?.default_voice_id || 'en-US-ChristopherNeural');

        if (initialScriptId) {
          const s = await api.getScript(initialScriptId);
          if (!isMounted) return;
          setScript(s);
          setEditingScenes(s.scenes?.map(sc => ({ ...sc })) || []);
          if (s.idea_id) {
            const allIdeas = await api.getIdeas();
            const idea = (allIdeas || []).find(i => i.id === s.idea_id);
            if (idea && isMounted) setSelectedIdea(idea);
          }
        } else if (initialIdeaId) {
          const allIdeas = await api.getIdeas();
          const idea = (allIdeas || []).find(i => i.id === initialIdeaId);
          if (idea && isMounted) setSelectedIdea(idea);
        }
      } catch (e) {
        console.error(e);
        toast.error('Failed to load production context');
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => { isMounted = false; };
  }, [initialIdeaId, initialScriptId]);

  const currentIdx = STAGES.findIndex(s => s.id === stage);

  if (loading) {
    return (
      <GridContainer>
        <div className="flex items-center justify-center min-h-[50vh] text-center">
          <div className="flex flex-col items-center gap-3">
            <Icon name="loader" className="animate-spin text-brand-red" size={32} />
            <span className="text-xs font-mono text-text-secondary">Initializing Production Engine...</span>
          </div>
        </div>
      </GridContainer>
    );
  }

  return (
    <div className="w-full">
      {/* ── Workflow Navigation Ribbon (Responsive Stepper) ────────────────── */}
      <div className="border-b border-border bg-surface/80 backdrop-blur-sm sticky top-14 z-20">
        <GridContainer>
          <div className="flex items-center justify-between py-3 overflow-x-auto hide-scrollbar gap-2 sm:gap-6">
            {STAGES.map((s, idx) => {
              const isActive = stage === s.id;
              const isPast = idx < currentIdx;
              const isSelectable = idx <= currentIdx || (idx === 1 && selectedIdea) || (idx >= 2 && script);

              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => isSelectable && setStage(s.id)}
                  disabled={!isSelectable}
                  className={`flex items-center gap-2.5 py-1.5 px-3 rounded-lg transition-all text-left shrink-0 select-none ${
                    isActive 
                      ? 'bg-elevated border border-border-strong text-text-primary' 
                      : isPast
                        ? 'text-text-primary hover:bg-surface-hover' 
                        : 'text-text-muted opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-bold transition-all ${
                    isActive 
                      ? 'bg-brand-red text-white shadow-brand-glow' 
                      : isPast 
                        ? 'bg-success/20 text-success' 
                        : 'bg-elevated border border-border text-text-muted'
                  }`}>
                    {isPast ? '✓' : s.step}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className={`text-xs font-bold truncate ${isActive ? 'text-brand-red' : ''}`}>
                      {s.label}
                    </span>
                    <span className="text-[10px] text-text-muted hidden md:inline truncate">
                      {s.desc}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </GridContainer>
      </div>

      {/* ── Stage Content Surface ─────────────────────────────────────────── */}
      <div className="py-6">
        <GridContainer>
          {stage === 'brief' && (
            <BriefStage 
              selectedIdea={selectedIdea} 
              setSelectedIdea={setSelectedIdea} 
              onNext={() => setStage('script')} 
            />
          )}

          {stage === 'script' && (
            <ScriptStage 
              idea={selectedIdea}
              script={script}
              setScript={(s) => { 
                setScript(s); 
                setEditingScenes(s.scenes?.map(sc => ({ ...sc })) || []); 
              }}
              onBack={() => setStage('brief')}
              onNext={() => setStage('storyboard')}
            />
          )}

          {stage === 'storyboard' && (
            <StoryboardStage 
              script={script}
              editingScenes={editingScenes}
              setEditingScenes={setEditingScenes}
              onBack={() => setStage('script')}
              onNext={() => setStage('render')}
            />
          )}

          {stage === 'render' && (
            <RenderStage 
              script={script}
              captionStyles={captionStyles}
              selectedStyle={selectedStyle}
              setSelectedStyle={setSelectedStyle}
              selectedCaption={selectedCaption}
              setSelectedCaption={setSelectedCaption}
              selectedVoice={selectedVoice}
              setSelectedVoice={setSelectedVoice}
              onBack={() => setStage('storyboard')}
            />
          )}
        </GridContainer>
      </div>
    </div>
  );
}
