import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Icon from '../../../components/Icon';
import useStudioStore from '../../../store/studioStore';
import PublishComposer from '../publishing/PublishComposer';
import CopilotPanel from './components/CopilotPanel';
import { api } from '../../../services/api';
import { toast } from 'sonner';

import BriefView from './views/BriefView';
import StoryboardView from './views/StoryboardView';
import ScriptView from './views/ScriptView';
import VoiceView from './views/VoiceView';
import OutputView from './views/OutputView';

export default function StudioLayout() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const {
    script,
    project,
    ui: { activeStage, showCopilot },
    setProject,
    setScript,
    setEditingScenes,
    setAudio,
    setRender,
    setPublishing,
    setActiveStage,
    toggleCopilot
  } = useStudioStore();

  const [showPublish, setShowPublish] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    const restoreProject = async () => {
      const scriptId = searchParams.get('script');
      const ideaId = searchParams.get('idea');
      const videoId = searchParams.get('video');

      if (!scriptId && !ideaId && !videoId) return;

      setRestoring(true);
      try {
        if (videoId) {
          const video = await api.getVideo(videoId);
          setRender({ videoId: video.id, status: video.status, stage: video.render_stage });
          setProject({ id: video.id, title: video.selected_title || 'Restored Video' });
          if (video.script_id) {
            const scriptData = await api.getScript(video.script_id);
            setScript(scriptData);
            setProject({ title: scriptData.topic || video.selected_title });
          }
          // Assuming publishing metadata fetch if needed
          setActiveStage('output');
        } else if (scriptId) {
          const scriptData = await api.getScript(scriptId);
          setScript(scriptData);
          setProject({ title: scriptData.topic || 'Restored Script' });
          setActiveStage('script');
        } else if (ideaId) {
          const ideaData = await api.getIdea(ideaId);
          setProject({ title: ideaData.topic || 'Restored Idea' });
          setActiveStage('concept');
        }
      } catch (err) {
        toast.error('Failed to restore project context: ' + err.message);
      } finally {
        setRestoring(false);
      }
    };
    restoreProject();
  }, [searchParams]);

  const pipeline = [
    { id: 'concept', label: 'IDEA' },
    { id: 'script', label: 'SCRIPT' },
    { id: 'voice', label: 'VOICE' },
    { id: 'storyboard', label: 'STORYBOARD' },
    { id: 'output', label: 'OUTPUT' }
  ];

  if (restoring) {
    return (
      <div className="flex flex-col h-full bg-canvas items-center justify-center animate-in fade-in">
        <Icon name="loader" className="animate-spin text-brand-red mb-4" size={32} />
        <p className="text-sm font-bold text-text-secondary">Restoring project context...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-canvas animate-in fade-in">

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
            value={project.title || script?.title || 'Untitled Project'}
            onChange={(e) => setProject({ title: e.target.value })}
            className="bg-transparent border-none text-sm font-bold text-text-primary placeholder:text-text-muted focus:outline-none hover:bg-elevated/50 px-2 py-1 rounded transition-colors w-64"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-text-muted font-mono uppercase mr-4">
             {project.status === 'saving' ? 'Saving...' : 'Draft Saved'}
          </span>
          <button
            onClick={toggleCopilot}
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
          video={typeof showPublish === 'object' ? { ...showPublish } : { ...project, id: project.id || script?.id, title: project.title || script?.topic, description: script?.topic }}
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
        {activeStage === 'concept' && <BriefView onNext={() => setActiveStage('script')} onAutoPilot={() => setActiveStage('output')} />}
        {activeStage === 'script' && <ScriptView onNext={() => setActiveStage('voice')} />}
        {activeStage === 'voice' && <VoiceView onNext={() => setActiveStage('storyboard')} />}
        {activeStage === 'storyboard' && <StoryboardView onNext={() => setActiveStage('output')} />}
        {activeStage === 'output' && <OutputView onPublish={(renderedVideoInfo) => setShowPublish(renderedVideoInfo || true)} />}

        <CopilotPanel isOpen={showCopilot} onClose={() => toggleCopilot()} />
      </div>

    </div>
  );
}
