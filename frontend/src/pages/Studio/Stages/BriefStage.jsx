import { useState, useEffect } from 'react';
import { api } from '../../../services/api';
import Icon from '../../../components/Icon';
import Button from '../../../components/Button';
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
        setIdeas(allIdeas.filter(i => i.status === 'pending' || i.status === 'promoted'));
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    })();
  }, [selectedIdea]);

  if (loading) {
    return <div className="empty-state"><span className="spinner spinner-lg" /></div>;
  }

  return (
    <div className="create-stage">
      <h2 className="stage-title">Choose a topic</h2>
      <p className="stage-desc">Select an idea to turn into a Short, or generate new ones from Ideas.</p>

      {selectedIdea ? (
        <div className="selected-idea-banner mb-4">
          <Icon name="layers" size={16} />
          <div>
            <strong>{selectedIdea.title}</strong>
            <span className="text-muted"> — {selectedIdea.topic}</span>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setSelectedIdea(null)}>Change</Button>
        </div>
      ) : ideas.length === 0 ? (
        <div className="empty-state" style={{ padding: '40px' }}>
          <Icon name="layers" size={40} />
          <p>No ideas available. Generate some first on the Ideas page.</p>
          <Button variant="primary" icon="plus" onClick={() => navigate('/app/ideas')}>
            Generate Ideas
          </Button>
        </div>
      ) : (
        <div className="idea-pick-grid">
          {ideas.map(idea => (
            <button
              key={idea.id}
              className={`idea-pick-card ${selectedIdea?.id === idea.id ? 'selected' : ''}`}
              onClick={() => setSelectedIdea(idea)}
            >
              <div className="idea-pick-title">{idea.title}</div>
              <div className="idea-pick-topic">{idea.topic}</div>
              {idea.angle && <div className="idea-pick-angle">{idea.angle}</div>}
              <div className="idea-pick-meta">
                <span className={`badge badge-${idea.status}`}>{idea.status}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedIdea && (
        <div className="flex gap-2 mt-4">
          <Button variant="primary" icon="arrow-right" iconPosition="right" onClick={onNext}>
            Continue to Script
          </Button>
        </div>
      )}
    </div>
  );
}
