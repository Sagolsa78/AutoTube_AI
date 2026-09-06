import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import Icon from '../../components/Icon';
import { toast } from 'sonner';

import BriefStage from './Stages/BriefStage';
import ScriptStage from './Stages/ScriptStage';
import StoryboardStage from './Stages/StoryboardStage';
import RenderStage from './Stages/RenderStage';

const STAGES = ['brief', 'script', 'storyboard', 'render'];
const STAGE_LABELS = { brief: 'Brief', script: 'Script', storyboard: 'Storyboard', render: 'Render' };

export default function StudioShell() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const initialIdeaId = searchParams.get('idea');
  const initialScriptId = searchParams.get('script');

  const [stage, setStage] = useState(initialScriptId ? 'script' : 'brief');
  const [loading, setLoading] = useState(true);

  // Global Context
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
    (async () => {
      setLoading(true);
      try {
        const [prof, styles, chans] = await Promise.all([
          api.getProfile(), api.getCaptionStyles(), api.getChannels()
        ]);
        setProfile(prof);
        setCaptionStyles(styles);
        setChannels(chans);
        setSelectedCaption(prof?.caption_style || 'bold_centered');
        setSelectedVoice(prof?.default_voice_id || 'en-US-ChristopherNeural');

        if (initialScriptId) {
          const s = await api.getScript(initialScriptId);
          setScript(s);
          setEditingScenes(s.scenes?.map(sc => ({ ...sc })) || []);
          if (s.idea_id) {
            const allIdeas = await api.getIdeas();
            const idea = allIdeas.find(i => i.id === s.idea_id);
            if (idea) setSelectedIdea(idea);
          }
        } else if (initialIdeaId) {
          const allIdeas = await api.getIdeas();
          const idea = allIdeas.find(i => i.id === initialIdeaId);
          if (idea) setSelectedIdea(idea);
        }
      } catch (e) {
        toast.error('Failed to load production context');
      }
      setLoading(false);
    })();
  }, [initialIdeaId, initialScriptId]);

  if (loading) {
    return (
      <div className="empty-state">
        <span className="spinner spinner-lg" />
      </div>
    );
  }

  const currentIdx = STAGES.indexOf(stage);

  return (
    <div className="production-studio">
      <div className="page-header">
        <div>
          <h1>Production Studio</h1>
          <p>Develop your idea, refine the script, and generate the final render.</p>
        </div>
      </div>

      <div className="create-stepper">
        {STAGES.map((s, i) => (
          <div key={s} className={`stepper-step ${i <= currentIdx ? 'active' : ''} ${i === currentIdx ? 'current' : ''}`}>
            <div className="stepper-dot">{i < currentIdx ? <Icon name="check" size={14} /> : i + 1}</div>
            <span className="stepper-label">{STAGE_LABELS[s]}</span>
            {i < STAGES.length - 1 && <div className="stepper-line" />}
          </div>
        ))}
      </div>

      <div className="studio-stage-container">
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
            setScript={(s) => { setScript(s); setEditingScenes(s.scenes?.map(sc => ({ ...sc })) || []); }}
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
      </div>
    </div>
  );
}
