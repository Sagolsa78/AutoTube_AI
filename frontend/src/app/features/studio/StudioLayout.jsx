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
    pipelineState,
    ui: { activeStage, showCopilot },
    setProject,
    setPipelineState,
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
      const projectId = searchParams.get('project');

      if (!scriptId && !ideaId && !videoId && !projectId) return;

      setRestoring(true);
      try {
        if (projectId) {
          const state = await api.getProjectState(projectId);
          setPipelineState(state);
          setProject({ id: state.id, title: state.title });
          setActiveStage(state.current_stage || 'concept');
        } else if (videoId) {
          const video = await api.getVideo(videoId);
          setRender({ videoId: video.id, status: video.status, stage: video.render_stage });
          setProject({ id: video.id, title: video.selected_title || 'Restored Video' });
          if (video.script_id) {
            const scriptData = await api.getScript(video.script_id);
            setScript(scriptData);
            setProject({ title: scriptData.topic || video.selected_title });
          }
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

  useEffect(() => {
    let intervalId;
    if (project?.id) {
      intervalId = setInterval(async () => {
        try {
          const state = await api.getProjectState(project.id);
          setPipelineState(state);
        } catch (err) {
          console.error("Failed to poll project state", err);
        }
      }, 5000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [project?.id]);

  const pipeline = [
    { id: 'concept', label: 'IDEA', icon: 'lightbulb' },
    { id: 'script', label: 'SCRIPT', icon: 'file-text' },
    { id: 'voice', label: 'VOICE', icon: 'mic' },
    { id: 'storyboard', label: 'STORYBOARD', icon: 'layout' },
    { id: 'output', label: 'OUTPUT', icon: 'film' }
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
    <div className="flex flex-col h-screen max-h-screen bg-canvas overflow-hidden relative isolate">
      {/* Cinematic Studio Background */}
      <div className="absolute inset-0 pointer-events-none -z-10" style={{ background: 'radial-gradient(circle at 50% -10%, rgba(167, 139, 250, 0.08), transparent 42%), var(--canvas)' }}>
         {/* Subtle grid pattern */}
         <div className="absolute inset-0 opacity-[0.04] bg-[linear-gradient(to_right,#ffffff12_1px,transparent_1px),linear-gradient(to_bottom,#ffffff12_1px,transparent_1px)] bg-[size:24px_24px]" />
      </div>

      {/* ── Studio Header ────────────────────────────────────────── */}
      <header className="h-16 bg-surface/80 backdrop-blur-xl border-b border-border/60 px-4 flex items-center justify-between shrink-0 relative z-20">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/app')}
            className="text-text-secondary hover:text-text-primary p-2 rounded-xl hover:bg-elevated transition-colors"
          >
            <Icon name="arrow-left" size={18} />
          </button>

          <div className="h-6 w-px bg-border/80" />

          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center shadow-sm">
                <Icon name="film" size={14} className="text-brand-red" />
             </div>
             <input
               type="text"
               value={project.title || script?.title || 'Untitled Project'}
               onChange={(e) => setProject({ title: e.target.value })}
               className="bg-transparent border-none text-sm font-bold text-text-primary placeholder:text-text-muted focus:outline-none hover:bg-elevated/50 px-2 py-1.5 rounded transition-colors w-64 md:w-80"
             />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[10px] text-text-muted font-mono uppercase mr-2 tracking-widest hidden sm:block">
             {project.status === 'saving' ? 'Saving...' : 'Draft Saved'}
          </span>
          <button
            onClick={toggleCopilot}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 ${
              showCopilot ? 'bg-ai/10 border-ai/30 text-ai shadow-ai-glow' : 'bg-surface border-border text-text-secondary hover:text-text-primary hover:border-border-strong'
            }`}
          >
            <Icon name="sparkles" size={14} /> Copilot
          </button>
          <button className="hidden sm:block px-4 py-2 rounded-xl text-xs font-bold text-text-secondary hover:text-text-primary bg-elevated border border-border hover:border-border-strong transition-all hover:-translate-y-0.5">
            Save
          </button>
          <button
            onClick={() => setShowPublish(true)}
            className="px-5 py-2 rounded-xl text-xs font-bold text-canvas bg-text-primary hover:bg-white shadow-[0_2px_10px_rgba(255,255,255,0.1)] transition-all flex items-center gap-2 hover:-translate-y-0.5"
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
      <div className="h-14 bg-surface/40 backdrop-blur-md border-b border-border/40 flex items-center justify-center px-4 shrink-0 relative z-20 shadow-sm">
        <div className="flex items-center w-full max-w-5xl relative gap-2">
          {/* Nodes */}
          {pipeline.map((stage, idx) => {
            const pipelineStages = pipeline.map(p => p.id);
            const currentIdx = pipelineStages.indexOf(pipelineState.current_stage || 'concept');

            // Derive status from the backend state machine
            const isActive = stage.id === activeStage;
            let isPast = false;
            let isBlocked = false;

            if (idx < currentIdx) isPast = true;
            if (stage.id === pipelineState.current_stage && pipelineState.status === 'done') isPast = true;
            if (stage.id === pipelineState.current_stage && pipelineState.status === 'blocked') isBlocked = true;

            return (
              <React.Fragment key={stage.id}>
                <button
                  onClick={() => setActiveStage(stage.id)}
                  className={`flex-1 flex items-center justify-center gap-3 px-3 py-2 rounded-xl transition-all duration-300 group ${
                    isActive ? 'bg-surface shadow-sm border border-border text-text-primary scale-105' :
                    'hover:bg-surface/50 border border-transparent text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <div className={`w-5 h-5 flex items-center justify-center shrink-0 ${isActive ? 'text-brand' : isBlocked ? 'text-warning' : isPast ? 'text-success' : 'text-text-muted group-hover:text-text-secondary'}`}>
                    {isPast ? <span className="text-sm">✓</span> : isBlocked ? <span className="text-sm">!</span> : isActive ? <span className="text-sm">●</span> : <span className="text-sm">○</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon name={stage.icon} size={14} className={isActive ? 'text-brand' : isBlocked ? 'text-warning' : isPast ? 'text-success' : 'text-text-muted group-hover:text-text-secondary'} />
                    <span className={`text-[10px] font-bold tracking-widest uppercase transition-colors ${
                      isActive ? 'text-text-primary' : 'text-text-muted group-hover:text-text-secondary'
                    }`}>
                      {stage.label}
                    </span>
                  </div>
                </button>
                {idx < pipeline.length - 1 && (
                  <Icon name="chevron-right" size={14} className="text-border shrink-0 opacity-50" />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {pipelineState?.blockingIssues?.length > 0 && (
        <div className="bg-danger/10 border-b border-danger/20 px-4 py-2 flex items-center justify-center gap-2">
           <Icon name="alert-triangle" size={14} className="text-danger" />
           <span className="text-xs font-bold text-danger uppercase tracking-widest">
             Blocked: {pipelineState.blockingIssues.join(', ')}
           </span>
        </div>
      )}

      {pipelineState?.warnings?.length > 0 && pipelineState?.blockingIssues?.length === 0 && (
        <div className="bg-warning/10 border-b border-warning/20 px-4 py-2 flex items-center justify-center gap-2">
           <Icon name="alert-circle" size={14} className="text-warning" />
           <span className="text-xs font-bold text-warning uppercase tracking-widest">
             Warning: {pipelineState.warnings.join(', ')}
           </span>
        </div>
      )}

      {/* ── Studio Workspace ─────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden relative z-10">
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
