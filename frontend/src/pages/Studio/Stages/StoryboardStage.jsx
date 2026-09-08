import React, { useState } from 'react';
import { api } from '../../../services/api';
import Icon from '../../../components/Icon';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/Card';
import Button from '../../../components/Button';
import { toast } from 'sonner';

export default function StoryboardStage({ script, editingScenes, setEditingScenes, onBack, onNext }) {
  const [modalScene, setModalScene] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [activeSceneIdx, setActiveSceneIdx] = useState(0);

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
        visual_intent: s.visual_intent,
        stock_query: s.stock_query,
      }));
      await api.updateScript(script.id, { scenes: patches });
      toast.success('Storyboard saved successfully');
    } catch (e) {
      toast.error(`Save failed: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const openAssetModal = async (sc) => {
    setModalScene(sc);
    const initialQuery = sc.stock_query || sc.visual_description || 'cinematic';
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
    } finally {
      setSearching(false);
    }
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

  const activeScene = editingScenes[activeSceneIdx] || null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-text-primary">Stage 3: Storyboard & Visuals</h2>
          <p className="text-xs text-text-secondary">Curate visual media, verify scene pacing, and customize narration per scene.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" icon="arrow-left" onClick={onBack}>
            Back
          </Button>
          <Button 
            variant="secondary" 
            size="sm" 
            icon="save" 
            onClick={saveSceneEdits} 
            disabled={saving}
            loading={saving}
          >
            Save Changes
          </Button>
          <Button variant="primary" size="sm" icon="arrow-right" iconPosition="right" onClick={onNext}>
            Proceed to Voice & Render
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        
        {/* CENTER COLUMN: Scene Inspector & 9:16 Visual Preview (8 cols) */}
        <div className="xl:col-span-8 space-y-6">
          {activeScene ? (
            <Card variant="surface" className="overflow-hidden p-0">
              <div className="flex flex-col md:flex-row items-stretch">
                
                {/* 9:16 Scene Visual Preview */}
                <div className="w-full md:w-[280px] lg:w-[320px] bg-black aspect-[9/16] relative flex items-center justify-center shrink-0 border-b md:border-b-0 md:border-r border-border group select-none">
                  {activeScene.asset?.thumbnail_url ? (
                    <img 
                      src={activeScene.asset.thumbnail_url} 
                      alt={`Scene ${activeScene.scene_number}`} 
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-text-muted">
                      <Icon name="image" size={32} />
                      <span className="text-[10px] uppercase tracking-widest font-mono">No clip assigned</span>
                    </div>
                  )}

                  {/* Replace Visual Overlay */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-xs">
                    <Button 
                      variant="primary" 
                      size="sm" 
                      icon="search" 
                      onClick={() => openAssetModal(activeScene)}
                    >
                      Replace Visual
                    </Button>
                  </div>

                  {/* Scene Pill Overlay */}
                  <div className="absolute top-3 left-3 flex flex-col gap-1.5">
                    <span className="bg-canvas/90 backdrop-blur-sm text-text-primary px-2.5 py-1 rounded text-xs font-mono font-bold border border-border shadow-md">
                      Scene {activeScene.scene_number}
                    </span>
                    {activeScene.duration_est && (
                      <span className="bg-canvas/80 text-text-secondary px-2 py-0.5 rounded text-[10px] font-mono border border-border w-fit">
                        ~{Math.round(activeScene.duration_est)}s
                      </span>
                    )}
                  </div>
                </div>

                {/* Scene Inspector / Narration Editor */}
                <div className="flex-1 p-5 sm:p-6 flex flex-col justify-between space-y-4">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1.5">
                        Scene Narration (Voiceover Script)
                      </label>
                      <textarea
                        className="w-full bg-surface-input border border-border rounded-lg p-3 text-sm text-text-primary focus:border-brand-red focus:outline-none min-h-[110px] resize-y leading-relaxed font-sans"
                        value={activeScene.narration || ''}
                        onChange={e => updateScene(activeSceneIdx, 'narration', e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1.5">
                          Visual Source Mode
                        </label>
                        <select
                          className="w-full bg-surface-input border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:border-brand-red focus:outline-none"
                          value={activeScene.preferred_visual_mode || 'STOCK'}
                          onChange={e => updateScene(activeSceneIdx, 'preferred_visual_mode', e.target.value)}
                        >
                          <option value="STOCK">Stock Footage (Pexels/Pixabay)</option>
                          <option value="AUTO">Auto-Select</option>
                          <option value="GENERATED_VIDEO">AI Video (ComfyUI)</option>
                          <option value="GENERATED_IMAGE">AI Image (ComfyUI)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1.5">
                          Current Source
                        </label>
                        <div className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-xs text-text-secondary flex items-center justify-between">
                          <span className="truncate">{activeScene.asset?.source || 'Unassigned'}</span>
                          {activeScene.asset?.source && <Icon name="check" size={12} className="text-success shrink-0" />}
                        </div>
                      </div>
                    </div>

                    {activeScene.visual_intent && (
                      <div className="bg-info/10 border border-info/20 p-3 rounded-lg text-xs text-info flex items-start gap-2">
                        <Icon name="sparkles" size={14} className="shrink-0 mt-0.5" />
                        <span className="leading-relaxed">{activeScene.visual_intent}</span>
                      </div>
                    )}
                  </div>

                  {/* Stock Query Prompt Bar */}
                  <div className="pt-3 border-t border-border/80">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1.5">
                      Visual Search Query / Prompt
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        className="flex-1 bg-surface-input border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:border-brand-red focus:outline-none font-mono"
                        value={activeScene.stock_query || activeScene.generation_prompt || activeScene.visual_description || ''}
                        onChange={e => {
                          const field = ['GENERATED_VIDEO', 'GENERATED_IMAGE'].includes(activeScene.preferred_visual_mode) ? 'generation_prompt' : 'stock_query';
                          updateScene(activeSceneIdx, field, e.target.value);
                        }}
                      />
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        icon="search" 
                        onClick={() => openAssetModal(activeScene)}
                      >
                        Search
                      </Button>
                    </div>
                  </div>
                </div>

              </div>
            </Card>
          ) : (
            <Card variant="surface" className="text-center py-12 text-text-muted">
              <span>No scenes available.</span>
            </Card>
          )}

          {/* BOTTOM: Horizontal Timeline Scroller (§13 & §16) */}
          <Card variant="surface">
            <CardHeader
              title={
                <CardTitle icon={<Icon name="film" size={16} className="text-brand-red" />}>
                  Scene Strip Timeline
                </CardTitle>
              }
              action={
                <span className="text-xs font-mono text-text-muted">
                  Scene {activeSceneIdx + 1} of {editingScenes.length}
                </span>
              }
            />
            <CardContent>
              <div className="flex gap-3 overflow-x-auto pb-2 snap-x hide-scrollbar">
                {editingScenes.map((sc, idx) => {
                  const isActive = idx === activeSceneIdx;
                  return (
                    <div
                      key={sc.id || idx}
                      onClick={() => setActiveSceneIdx(idx)}
                      className={`relative shrink-0 w-24 aspect-[9/16] rounded-xl overflow-hidden cursor-pointer snap-start transition-all border-2 select-none ${
                        isActive
                          ? 'border-brand-red scale-105 shadow-brand-glow z-10'
                          : 'border-border opacity-70 hover:opacity-100 hover:border-border-strong'
                      }`}
                    >
                      {sc.asset?.thumbnail_url ? (
                        <img 
                          src={sc.asset.thumbnail_url} 
                          alt={`Scene ${sc.scene_number}`} 
                          className="w-full h-full object-cover" 
                        />
                      ) : (
                        <div className="w-full h-full bg-elevated flex items-center justify-center text-text-muted">
                          <Icon name="image" size={20} />
                        </div>
                      )}
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 to-transparent p-1.5 pt-4 flex items-center justify-between">
                        <span className="text-[10px] font-mono font-bold text-white">
                          S{sc.scene_number || idx + 1}
                        </span>
                        {sc.asset?.source && (
                          <span className="w-1.5 h-1.5 rounded-full bg-success" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: Full Script Inspector (4 cols) */}
        <div className="xl:col-span-4 space-y-4">
          <Card variant="surface">
            <CardHeader
              title={
                <CardTitle icon={<Icon name="fileText" size={16} className="text-text-muted" />}>
                  Full Script Inspector
                </CardTitle>
              }
            />
            <CardContent className="space-y-3 max-h-[500px] overflow-y-auto">
              {editingScenes.map((s, i) => (
                <div
                  key={s.id || i}
                  onClick={() => setActiveSceneIdx(i)}
                  className={`p-3 rounded-lg border transition-all cursor-pointer text-xs leading-relaxed ${
                    i === activeSceneIdx
                      ? 'bg-elevated border-brand-red text-text-primary'
                      : 'bg-surface border-border/70 text-text-secondary hover:border-border hover:bg-surface-hover'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono font-bold text-brand-red uppercase">
                      Scene {s.scene_number || i + 1}
                    </span>
                    {s.asset?.source && (
                      <span className="text-[9px] font-mono text-text-muted uppercase">
                        {s.asset.source}
                      </span>
                    )}
                  </div>
                  <p>{s.narration}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

      </div>

      {/* Stock Video Search Modal */}
      {modalScene && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setModalScene(null)}
        >
          <div 
            className="bg-surface border border-border rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden" 
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-elevated/50">
              <h3 className="font-bold text-sm sm:text-base text-text-primary">
                Search Visuals for Scene {modalScene.scene_number}
              </h3>
              <button 
                type="button" 
                className="p-1.5 hover:bg-surface-hover rounded-lg text-text-secondary hover:text-text-primary transition-colors" 
                onClick={() => setModalScene(null)}
              >
                <Icon name="x" size={18} />
              </button>
            </div>
            
            <div className="p-4 sm:p-6 flex-1 flex flex-col overflow-hidden gap-4">
              <form 
                className="flex gap-2" 
                onSubmit={e => { e.preventDefault(); performAssetSearch(searchQuery); }}
              >
                <input
                  className="flex-1 bg-surface-input border border-border rounded-lg px-4 py-2.5 text-sm text-text-primary focus:border-brand-red focus:outline-none"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search stock footage..."
                />
                <Button 
                  variant="primary" 
                  size="sm" 
                  icon={searching ? 'loader' : 'search'} 
                  type="submit" 
                  disabled={searching}
                  loading={searching}
                >
                  Search
                </Button>
              </form>

              <div className="flex-1 overflow-y-auto bg-canvas rounded-xl p-4 border border-border">
                {searching ? (
                  <div className="h-48 flex flex-col items-center justify-center text-text-muted gap-3">
                    <Icon name="loader" size={28} className="animate-spin text-brand-red" />
                    <span className="text-xs">Searching visual providers...</span>
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="h-48 flex flex-col items-center justify-center text-text-muted gap-2">
                    <Icon name="image" size={36} className="opacity-30" />
                    <span className="text-xs">No media found. Try a different query.</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {searchResults.map((ast, idx) => (
                      <div
                        key={ast.source_asset_id || idx}
                        className="relative aspect-[9/16] bg-elevated rounded-xl border border-border overflow-hidden cursor-pointer group hover:border-brand-red hover:shadow-brand-glow transition-all"
                        onClick={() => selectAssetForScene(ast)}
                      >
                        <img 
                          src={ast.thumbnail_url} 
                          alt="Stock asset" 
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" 
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center">
                          <span className="w-8 h-8 rounded-full bg-brand-red text-white flex items-center justify-center shadow-brand-glow">
                            <Icon name="check" size={16} />
                          </span>
                          <span className="text-white text-xs font-bold mt-1">Select Clip</span>
                        </div>
                        <span className="absolute top-2 left-2 bg-canvas/80 px-2 py-0.5 rounded text-[9px] font-bold text-white uppercase tracking-wider border border-white/10">
                          {ast.source}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
