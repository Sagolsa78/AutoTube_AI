import { useState } from 'react';
import { api } from '../../../services/api';
import Icon from '../../../components/Icon';
import Button from '../../../components/Button';
import Badge from '../../../components/Badge';
import { toast } from 'sonner';

export default function StoryboardStage({ script, editingScenes, setEditingScenes, onBack, onNext }) {
  const [modalScene, setModalScene] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);

  const updateScene = (idx, field, value) => {
    setEditingScenes(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      return updated;
    });
  };

  const saveSceneEdits = async () => {
    if (!script) return;
    setSaving(true);
    try {
      const patches = editingScenes.map(s => ({
        id: s.id,
        narration: s.narration,
        visual_description: s.visual_description,
        preferred_visual_mode: s.preferred_visual_mode,
        generation_prompt: s.generation_prompt,
      }));
      await api.updateScript(script.id, { scenes: patches });
      toast.success('Storyboard edits saved');
    } catch (e) {
      toast.error(`Save failed: ${e.message}`);
    }
    setSaving(false);
  };

  const openAssetModal = async (sc) => {
    setModalScene(sc);
    const initialQuery = sc.visual_description || 'nature';
    setSearchQuery(initialQuery);
    performAssetSearch(initialQuery);
  };

  const performAssetSearch = async (q) => {
    if (!q) return;
    setSearching(true);
    try {
      const res = await api.searchAssets(q);
      setSearchResults(res.results || []);
    } catch (e) {
      toast.error(`Asset search failed: ${e.message}`);
    }
    setSearching(false);
  };

  const selectAssetForScene = async (assetData) => {
    if (!modalScene) return;
    try {
      const res = await api.assignAssetToScene(modalScene.id, assetData);
      
      setEditingScenes(prev => prev.map(s => {
        if (s.id === modalScene.id) {
          return {
            ...s,
            asset_id: res.asset_id,
            asset: {
              thumbnail_url: assetData.thumbnail_url,
              source: assetData.source,
              photographer: assetData.photographer
            }
          };
        }
        return s;
      }));

      toast.success(`Assigned clip to Scene ${modalScene.scene_number}`);
      setModalScene(null);
    } catch (e) {
      toast.error(`Assignment failed: ${e.message}`);
    }
  };

  return (
    <div className="create-stage">
      <h2 className="stage-title">Storyboard</h2>
      <p className="stage-desc">Review visual clips, edit narration, or swap stock assets before rendering.</p>

      <div className="storyboard-grid">
        {editingScenes.map((sc, i) => (
          <div key={sc.id} className="storyboard-card">
            <div className="storyboard-asset-header">
              {sc.asset?.thumbnail_url ? (
                <img src={sc.asset.thumbnail_url} alt={`Scene ${sc.scene_number}`} className="storyboard-asset-thumb" />
              ) : (
                <div className="storyboard-asset-placeholder">
                  <Icon name="image" size={24} />
                  <span>No visual selected</span>
                </div>
              )}
              <div className="storyboard-asset-overlay">
                <Button variant="primary" size="sm" icon="search" onClick={() => openAssetModal(sc)}>
                  Swap Clip
                </Button>
              </div>
            </div>

            <div className="storyboard-card-header flex justify-between items-center">
              <span className="storyboard-scene-num">Scene {sc.scene_number}</span>
              {sc.asset?.source && (
                <Badge variant="default" style={{ background: 'var(--surface-input)' }}>
                  {sc.asset.source}
                </Badge>
              )}
            </div>

            <div className="storyboard-field">
              <label className="label text-xs">Narration</label>
              <textarea
                className="textarea"
                rows={3}
                value={sc.narration}
                onChange={e => updateScene(i, 'narration', e.target.value)}
              />
            </div>

            <div className="storyboard-field">
              <label className="label text-xs">Visual Mode</label>
              <select 
                className="select" 
                value={sc.preferred_visual_mode || 'STOCK'} 
                onChange={e => updateScene(i, 'preferred_visual_mode', e.target.value)}
              >
                <option value="AUTO">Auto (Let Engine Decide)</option>
                <option value="STOCK">Stock Footage</option>
                <option value="GENERATED_VIDEO">AI Video</option>
                <option value="GENERATED_IMAGE">AI Image</option>
                <option value="MOTION_GRAPHIC">Motion Graphic</option>
                <option value="SOURCE_FOOTAGE">Source Footage</option>
              </select>
            </div>

            {sc.visual_intent && (
              <div className="storyboard-field">
                <label className="label text-xs">AI Visual Intent</label>
                <div className="text-xs text-muted" style={{ padding: '8px', background: 'var(--surface-input)', borderRadius: 'var(--r-xs)' }}>
                  {sc.visual_intent}
                </div>
              </div>
            )}

            {(sc.preferred_visual_mode === 'GENERATED_VIDEO' || sc.preferred_visual_mode === 'GENERATED_IMAGE') ? (
              <div className="storyboard-field">
                <label className="label text-xs">
                  <Icon name="sparkles" size={12} className="c-accent" /> AI Generation Prompt
                </label>
                <textarea
                  className="textarea"
                  rows={2}
                  value={sc.generation_prompt || ''}
                  onChange={e => updateScene(i, 'generation_prompt', e.target.value)}
                  placeholder="e.g. A cinematic close-up of a tardigrade..."
                />
              </div>
            ) : (sc.preferred_visual_mode === 'STOCK' || !sc.preferred_visual_mode) ? (
              <div className="storyboard-field">
                <label className="label text-xs">
                  <Icon name="image" size={12} /> Stock Search Prompt
                </label>
                <div className="flex gap-2">
                  <input
                    className="input"
                    value={sc.visual_description}
                    onChange={e => updateScene(i, 'visual_description', e.target.value)}
                    placeholder="e.g. tardigrade electron microscope"
                  />
                  <Button variant="secondary" size="sm" icon="search" onClick={() => openAssetModal(sc)} />
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div className="storyboard-full-text mt-4">
        <label className="label text-xs">Full Script (auto-generated from scenes)</label>
        <div className="script-fulltext-preview">
          {editingScenes.map(s => s.narration).join(' ')}
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        <Button variant="secondary" onClick={onBack}>Back to Script</Button>
        <Button variant="secondary" icon="save" onClick={saveSceneEdits} loading={saving}>
          Save Edits
        </Button>
        <Button variant="primary" icon="arrow-right" iconPosition="right" onClick={onNext}>
          Continue to Render
        </Button>
      </div>

      {modalScene && (
        <div className="modal-overlay" onClick={() => setModalScene(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Select Clip for Scene {modalScene.scene_number}</h3>
              <button className="btn btn-sm btn-secondary" onClick={() => setModalScene(null)}>
                <Icon name="x" size={14} />
              </button>
            </div>
            <div className="modal-body">
              <form
                className="asset-search-form"
                onSubmit={e => { e.preventDefault(); performAssetSearch(searchQuery); }}
              >
                <input
                  className="input flex-1"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search Pexels & Pixabay..."
                />
                <Button variant="primary" type="submit" loading={searching}>
                  Search
                </Button>
              </form>

              {searching ? (
                <div className="empty-state" style={{ padding: '40px' }}>
                  <span className="spinner spinner-lg" />
                  <p>Searching stock video provider APIs...</p>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="empty-state" style={{ padding: '40px' }}>
                  <p>No video clips found. Try a broader search term.</p>
                </div>
              ) : (
                <div className="asset-grid">
                  {searchResults.map((ast, idx) => (
                    <div
                      key={ast.source_asset_id || idx}
                      className="asset-card"
                      onClick={() => selectAssetForScene(ast)}
                    >
                      <img src={ast.thumbnail_url} alt={ast.photographer} />
                      <span className="asset-badge" style={{ position: 'absolute', top: 4, left: 4, background: 'rgba(0,0,0,0.6)', padding: '2px 6px', borderRadius: 'var(--r-sm)', fontSize: '10px' }}>
                        {ast.source}
                      </span>
                      {ast.photographer && (
                        <div className="asset-author" style={{ position: 'absolute', bottom: 4, left: 4, right: 4, background: 'rgba(0,0,0,0.6)', padding: '2px 6px', borderRadius: 'var(--r-sm)', fontSize: '10px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          by {ast.photographer}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
