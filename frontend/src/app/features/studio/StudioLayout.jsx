import React from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../../components/Icon';
import useStudioStore from '../../../store/studioStore';
import PublishComposer from '../publishing/PublishComposer';
import CopilotPanel from './components/CopilotPanel';

import BriefView from './views/BriefView';
import StoryboardView from './views/StoryboardView';
import ScriptView from './views/ScriptView';
import OutputView from './views/OutputView';

// We will mock the other views for now until they are built
function PlaceholderView({ name }) {
  return <div className="p-8 flex items-center justify-center text-text-muted h-full">[{name} View Workspace]</div>;
}

export default function StudioLayout() {
  const navigate = useNavigate();
  // Using the store we built previously
  const script = useStudioStore((s) => s.script);

  const [showPublish, setShowPublish] = React.useState(false);
  const [showCopilot, setShowCopilot] = React.useState(false);

  // New pipeline
  const pipeline = [
    { id: 'concept', label: 'IDEA' },
    { id: 'script', label: 'SCRIPT' },
    { id: 'storyboard', label: 'STORYBOARD' },
    { id: 'voice', label: 'VOICE' },
    { id: 'output', label: 'OUTPUT' }
  ];

  const [activeStage, setActiveStage] = React.useState('concept');

  return (
    <div className="flex flex-col h-screen bg-canvas animate-in fade-in z-50 fixed inset-0">

      {/* ── Studio Header ────────────────────────────────────────── */}
      <header className="h-14 bg-surface border-b border-border px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/app')}
            className="text-text-secondary hover:text-text-primary p-1.5 rounded-lg hover:bg-elevated transition-colors"
          >
            <Icon name="arrow-left" size={18} />
          </button>

          <div className="h-4 w-px bg-border" />

          <input
            type="text"
            defaultValue={script?.title || 'Untitled Project'}
            className="bg-transparent border-none text-sm font-bold text-text-primary placeholder:text-text-muted focus:outline-none hover:bg-elevated/50 px-2 py-1 rounded transition-colors w-64"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-text-muted font-mono uppercase mr-4">
             Draft Saved
          </span>
          <button
            onClick={() => setShowCopilot(!showCopilot)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition-colors ${
              showCopilot ? 'bg-brand-red/10 border-brand-red/30 text-brand-red' : 'bg-surface border-border text-text-secondary hover:text-text-primary'
            }`}
          >
            <Icon name="sparkles" size={14} /> Copilot
          </button>
          <button className="px-3 py-1.5 rounded-lg text-xs font-semibold text-text-secondary hover:text-text-primary bg-elevated border border-border hover:border-border-strong transition-colors">
            Save
          </button>
          <button
            onClick={() => setShowPublish(true)}
            className="px-4 py-1.5 rounded-lg text-xs font-bold text-canvas bg-text-primary hover:bg-white shadow-sm transition-colors flex items-center gap-1.5"
          >
            Publish <Icon name="arrow-right" size={14} />
          </button>
        </div>
      </header>

      {showPublish && (
        <PublishComposer
          video={{ title: script?.title, description: script?.topic }}
          onClose={() => setShowPublish(false)}
        />
      )}

      {/* ── Pipeline Navigation ──────────────────────────────────── */}
      <div className="h-12 bg-surface/50 border-b border-border flex items-center justify-center px-4 shrink-0">
        <div className="flex items-center w-full max-w-4xl relative">

          {/* Progress Line */}
          <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-border -translate-y-1/2 z-0" />
          <div
            className="absolute top-1/2 left-0 h-[2px] bg-brand-red -translate-y-1/2 z-0 transition-all duration-300"
            style={{ width: `${(pipeline.findIndex(p => p.id === activeStage) / (pipeline.length - 1)) * 100}%` }}
          />

          {/* Nodes */}
          {pipeline.map((stage, idx) => {
            const currentIdx = pipeline.findIndex(p => p.id === activeStage);
            const isPast = idx < currentIdx;
            const isActive = idx === currentIdx;

            return (
              <button
                key={stage.id}
                onClick={() => setActiveStage(stage.id)}
                className="flex-1 relative z-10 flex flex-col items-center group cursor-pointer"
              >
                <div className={`w-3.5 h-3.5 rounded-full border-[3px] transition-all duration-300 ${
                  isActive ? 'bg-brand-red border-brand-red shadow-[0_0_12px_rgba(230,57,47,0.6)]' :
                  isPast ? 'bg-brand-red border-brand-red' :
                  'bg-canvas border-border group-hover:border-text-muted'
                }`} />
                <span className={`absolute top-5 text-[10px] font-bold tracking-wider transition-colors ${
                  isActive ? 'text-text-primary' :
                  isPast ? 'text-text-secondary' :
                  'text-text-muted group-hover:text-text-secondary'
                }`}>
                  {stage.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Studio Workspace ─────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {activeStage === 'concept' && <BriefView onNext={() => setActiveStage('script')} />}
        {activeStage === 'script' && <ScriptView onNext={() => setActiveStage('storyboard')} />}
        {activeStage === 'storyboard' && <StoryboardView />}
        {activeStage === 'voice' && <PlaceholderView name="Voice & Rendering" />}
        {activeStage === 'output' && <OutputView onPublish={() => setShowPublish(true)} />}

        <CopilotPanel isOpen={showCopilot} onClose={() => setShowCopilot(false)} />
      </div>

    </div>
  );
}
