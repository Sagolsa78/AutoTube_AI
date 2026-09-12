import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../../services/api';
import Icon from '../../../components/Icon';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/Card';
import Button from '../../../components/Button';
import { toast } from 'sonner';

export default function EditorStage({ idea, script, setScript, editingScenes, setEditingScenes, onBack, onNext }) {
  // Generation State
  const [generating, setGenerating] = useState(false);
  const [language, setLanguage] = useState('en');
  const [locale, setLocale] = useState('US');

  // Editor State
  const [activeSceneIdx, setActiveSceneIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const saveTimeoutRef = useRef(null);
  const [generatingAsset, setGeneratingAsset] = useState(null); // Tracks { sceneIdx, jobId }

  // Asset Modal State
  const [modalScene, setModalScene] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Script Generation Logic
  const generateScript = async () => {
    if (!idea) {
      toast.error('Please select a concept first');
      return;
    }
    setGenerating(true);
    try {
      const result = await api.generateScript(idea.id, language, locale);
      setScript(result);
      toast.success('Script drafted successfully!');
    } catch (e) {
      toast.error(`Script generation failed: ${e.message}`);
    } finally {
      setGenerating(false);
    }
  };

  // 2. Debounced Autosave Logic
  const updateScene = (idx, field, value) => {
    setEditingScenes(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      return updated;
    });
  };

  const saveSceneEdits = useCallback(async (scenesToSave) => {
    if (!script) return;
    setSaving(true);
    try {
      const patches = scenesToSave.map(s => ({
        id: s.id,
        narration: s.narration,
        visual_description: s.visual_description,
        preferred_visual_mode: s.preferred_visual_mode,
        generation_prompt: s.generation_prompt,
        visual_intent: s.visual_intent,
        stock_query: s.stock_query,
      }));
      await api.updateScript(script.id, { scenes: patches });
      setLastSaved(new Date());
    } catch (e) {
      console.error(`Save failed: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }, [script]);

  // Debounce the save effect whenever editingScenes changes deeply
  useEffect(() => {
    if (!script || editingScenes.length === 0) return;
    
    // Clear previous timeout
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    
    // Set new timeout (debounced by 1.5 seconds)
    saveTimeoutRef.current = setTimeout(() => {
      saveSceneEdits(editingScenes);
    }, 1500);

    return () => clearTimeout(saveTimeoutRef.current);
  }, [editingScenes, script, saveSceneEdits]);

  // 3. Asset Curation Logic
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

  const generateAssetForScene = async (sceneIdx) => {
    const scene = editingScenes[sceneIdx];
    const mode = scene.preferred_visual_mode;
    if (!['GENERATED_IMAGE', 'GENERATED_VIDEO'].includes(mode)) return;
    
    const prompt = scene.generation_prompt || scene.visual_description || idea?.topic || "beautiful scenery";
    const mappedMode = mode === 'GENERATED_IMAGE' ? 'IMAGE' : 'VIDEO';

    try {
      setGeneratingAsset({ sceneIdx, jobId: null });
      const res = await api.generateAsset(prompt, mappedMode);
      const jobId = res.job_id;
      setGeneratingAsset({ sceneIdx, jobId });

      // Poll the job
      const checkInterval = setInterval(async () => {
        try {
          const jobRes = await api.getJob(jobId);
          if (jobRes.status === 'completed') {
            clearInterval(checkInterval);
            setGeneratingAsset(null);
            toast.success('Asset generated successfully!');
            
            const updatedScenes = [...editingScenes];
            updatedScenes[sceneIdx] = {
              ...updatedScenes[sceneIdx],
              asset: {
                source: 'comfyui',
                url: jobRes.result.url,
                thumbnail_url: jobRes.result.thumbnail_url,
                id: jobRes.result.asset_id
              },
              asset_id: jobRes.result.asset_id
            };
            setEditingScenes(updatedScenes);
            
            await api.assignAssetToScene(scene.id, {
                source_asset_id: `comfy_${jobId}`,
                source: 'comfyui',
                url: jobRes.result.url,
                thumbnail_url: jobRes.result.thumbnail_url
            });
            
          } else if (jobRes.status === 'failed') {
            clearInterval(checkInterval);
            setGeneratingAsset(null);
            toast.error(`Generation failed: ${jobRes.error_message}`);
          }
        } catch (e) {
            console.error("Poll error", e);
        }
      }, 3000);

    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to dispatch generation job');
      setGeneratingAsset(null);
    }
  };

  // UI Render
  const activeScene = editingScenes[activeSceneIdx] || null;

  return (
    <div className="space-y-6 flex flex-col h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border shrink-0">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-text-primary">Studio Editor</h2>
          <p className="text-xs text-text-secondary">Edit narration and curate visuals in a unified workspace.</p>
        </div>
        <div className="flex items-center gap-4">
            {script && (
                <div className="flex items-center gap-2 text-xs font-mono">
                    {saving ? (
                        <span className="text-brand-blue flex items-center gap-1"><Icon name="loader" className="animate-spin" size={12}/> Saving...</span>
                    ) : lastSaved ? (
                        <span className="text-success flex items-center gap-1"><Icon name="check" size={12}/> Saved</span>
                    ) : (
                        <span className="text-text-muted">Unsaved changes</span>
                    )}
                </div>
            )}
            <div className="flex items-center gap-2 border-l border-border pl-4">
                <Button variant="ghost" size="sm" icon="arrow-left" onClick={onBack}>
                    Back
                </Button>
                {script && (
                    <Button variant="primary" size="sm" icon="arrow-right" iconPosition="right" onClick={onNext}>
                        Proceed to Voice & Render
                    </Button>
                )}
            </div>
        </div>
      </div>

      {/* Idea Context Bar */}
      {idea && (
        <div className="bg-surface border border-border rounded-xl p-4 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-8 h-8 rounded-lg bg-elevated border border-border flex items-center justify-center text-brand-red shrink-0">
              <Icon name="lightbulb" size={16} />
            </span>
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">Selected Concept</span>
              <h3 className="text-sm font-bold text-text-primary truncate">{idea.title}</h3>
            </div>
          </div>
          {idea.angle && (
            <span className="text-xs italic text-text-muted hidden md:inline truncate max-w-sm">
              "{idea.angle}"
            </span>
          )}
        </div>
      )}

      {/* Main Content Area */}
      {!script ? (
        // Generation Empty State
        <Card variant="surface" className="max-w-xl mx-auto text-center p-8 space-y-6 mt-12">
          <div className="w-14 h-14 bg-elevated border border-border rounded-2xl flex items-center justify-center text-brand-red mx-auto shadow-inner">
            <Icon name="sparkles" size={28} />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-text-primary">Generate Script</h3>
            <p className="text-xs text-text-secondary max-w-sm mx-auto">
              Our narrative AI will analyze your hook angle and construct a 5-to-7 scene script optimized for 9:16 Shorts viewer retention.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 text-left max-w-sm mx-auto bg-elevated p-4 rounded-xl border border-border">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1.5">Language</label>
              <select 
                className="w-full bg-surface-input border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:border-brand-red focus:outline-none"
                value={language} 
                onChange={e => setLanguage(e.target.value)}
              >
                <option value="en">English</option>
                <option value="hi">Hindi</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1.5">Dialect</label>
              <select 
                className="w-full bg-surface-input border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:border-brand-red focus:outline-none"
                value={locale} 
                onChange={e => setLocale(e.target.value)}
              >
                <option value="US">US</option>
                <option value="UK">UK</option>
                <option value="IN">India</option>
                <option value="ES">Spain</option>
              </select>
            </div>
          </div>

          <Button 
            variant="primary" 
            size="md" 
            icon={generating ? 'loader' : 'zap'} 
            onClick={generateScript} 
            disabled={generating}
            loading={generating}
            className="w-full max-w-xs mx-auto shadow-brand-glow"
          >
            {generating ? 'Drafting Script...' : 'Generate Script'}
          </Button>
        </Card>
      ) : (
        // Split Pane Workspace
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start flex-1 min-h-[600px]">
          
          {/* LEFT PANE: Script Editing (5 cols) */}
          <div className="lg:col-span-5 flex flex-col h-full max-h-[80vh] overflow-hidden bg-surface border border-border rounded-xl">
             <div className="p-3 border-b border-border bg-elevated/50 flex justify-between items-center shrink-0">
                <span className="text-xs font-bold uppercase tracking-wider text-text-muted">
                    Script Scenes ({editingScenes.length})
                </span>
                <span className="text-[10px] font-mono text-text-secondary bg-surface px-2 py-0.5 rounded border border-border">
                    Autosave ON
                </span>
             </div>
             
             <div className="overflow-y-auto hide-scrollbar flex-1 p-3 space-y-3">
                 {editingScenes.map((sc, idx) => {
                     const isActive = idx === activeSceneIdx;
                     return (
                         <div 
                            key={sc.id || idx}
                            onClick={() => setActiveSceneIdx(idx)}
                            className={`p-3 rounded-xl border transition-all cursor-pointer ${isActive ? 'border-brand-red bg-elevated shadow-md' : 'border-border bg-surface hover:border-border-strong'}`}
                         >
                             <div className="flex justify-between items-center mb-2">
                                <span className="bg-canvas text-text-primary px-2 py-0.5 rounded text-[10px] font-mono font-bold border border-border">
                                    Scene {sc.scene_number || idx + 1}
                                </span>
                                {sc.asset?.source && (
                                    <Icon name="check-circle" size={12} className="text-success" />
                                )}
                             </div>
                             
                             <textarea
                                className="w-full bg-surface-input border border-border rounded-lg p-2 text-sm text-text-primary focus:border-brand-red focus:outline-none min-h-[80px] resize-y font-sans mb-2"
                                placeholder="Voiceover narration..."
                                value={sc.narration || ''}
                                onChange={e => updateScene(idx, 'narration', e.target.value)}
                                onClick={e => e.stopPropagation()} // prevent double triggers if needed
                             />
                             
                             <input 
                                type="text"
                                className="w-full bg-transparent border-none p-0 text-xs text-text-muted focus:outline-none focus:text-text-primary placeholder:text-text-muted/50"
                                placeholder="Visual description prompt..."
                                value={sc.visual_description || ''}
                                onChange={e => updateScene(idx, 'visual_description', e.target.value)}
                                onClick={e => e.stopPropagation()}
                             />
                         </div>
                     );
                 })}
             </div>
          </div>

          {/* RIGHT PANE: Visual Curation (7 cols) */}
          <div className="lg:col-span-7 h-full max-h-[80vh] bg-surface border border-border rounded-xl overflow-hidden flex flex-col">
              {activeScene ? (
                  <div className="flex flex-col h-full">
                      {/* Top Action Bar */}
                      <div className="p-3 border-b border-border bg-elevated/50 flex justify-between items-center shrink-0">
                          <span className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-2">
                              <Icon name="image" size={14} className="text-brand-red" />
                              Visual Inspector (Scene {activeScene.scene_number})
                          </span>
                      </div>
                      
                      <div className="flex flex-col md:flex-row flex-1 p-6 gap-8 items-start">
                          
                          {/* 9:16 Canvas Preview */}
                          <div className="w-full md:w-[280px] bg-black aspect-[9/16] relative flex items-center justify-center shrink-0 border border-border group select-none rounded-xl overflow-hidden shadow-2xl mx-auto">
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

                            {/* Replace Overlay */}
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-xs">
                                <Button 
                                variant="primary" 
                                size="sm" 
                                icon="search" 
                                onClick={() => openAssetModal(activeScene)}
                                >
                                Search Assets
                                </Button>
                            </div>
                            
                            {activeScene.duration_est && (
                                <div className="absolute bottom-3 right-3 bg-black/80 backdrop-blur-sm text-white px-2 py-0.5 rounded text-[10px] font-mono border border-border/50">
                                    ~{Math.round(activeScene.duration_est)}s
                                </div>
                            )}
                          </div>

                          {/* Scene Visual Controls */}
                          <div className="flex-1 space-y-6 w-full">
                            
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1.5">
                                Visual Intent (AI Generated)
                                </label>
                                <div className="bg-info/10 border border-info/20 p-3 rounded-lg text-xs text-info flex items-start gap-2">
                                    <Icon name="sparkles" size={14} className="shrink-0 mt-0.5" />
                                    <span className="leading-relaxed">{activeScene.visual_intent || "No intent generated."}</span>
                                </div>
                            </div>
                            
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1.5">
                                    Visual Source Mode
                                    </label>
                                    <select
                                    className="w-full bg-surface-input border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-brand-red focus:outline-none"
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
                                    Search Query / Prompt
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            className="flex-1 bg-surface-input border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-brand-red focus:outline-none font-mono"
                                            value={activeScene.stock_query || activeScene.generation_prompt || activeScene.visual_description || ''}
                                            onChange={e => {
                                                const field = ['GENERATED_VIDEO', 'GENERATED_IMAGE'].includes(activeScene.preferred_visual_mode) ? 'generation_prompt' : 'stock_query';
                                                updateScene(activeSceneIdx, field, e.target.value);
                                            }}
                                        />
                                        {['GENERATED_VIDEO', 'GENERATED_IMAGE'].includes(activeScene.preferred_visual_mode) ? (
                                            <Button 
                                                variant="primary" 
                                                size="sm" 
                                                icon={generatingAsset?.sceneIdx === activeSceneIdx ? "loader" : "zap"} 
                                                disabled={generatingAsset?.sceneIdx === activeSceneIdx}
                                                className={generatingAsset?.sceneIdx === activeSceneIdx ? "animate-pulse" : ""}
                                                onClick={() => generateAssetForScene(activeSceneIdx)}
                                            >
                                                {generatingAsset?.sceneIdx === activeSceneIdx ? "Generating..." : "Generate"}
                                            </Button>
                                        ) : (
                                            <Button 
                                                variant="secondary" 
                                                size="sm" 
                                                icon="search" 
                                                onClick={() => openAssetModal(activeScene)}
                                            >
                                                Find
                                            </Button>
                                        )}
                                    </div>
                                </div>
                                
                                <div className="pt-4 mt-4 border-t border-border">
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1.5">
                                    Current Source
                                    </label>
                                    {activeScene.asset?.source ? (
                                        <div className="w-full bg-success/10 border border-success/30 rounded-lg p-3 text-xs flex items-center justify-between">
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-success font-bold truncate">Assigned: {activeScene.asset.source}</span>
                                                {activeScene.asset.photographer && (
                                                    <span className="text-success/70 text-[10px] truncate">By {activeScene.asset.photographer}</span>
                                                )}
                                            </div>
                                            <Icon name="check-circle" size={16} className="text-success shrink-0" />
                                        </div>
                                    ) : (
                                        <div className="w-full bg-elevated border border-border rounded-lg p-3 text-xs text-text-muted text-center">
                                            No visual asset assigned yet.
                                        </div>
                                    )}
                                </div>
                            </div>
                          </div>
                      </div>
                  </div>
              ) : (
                  <div className="flex items-center justify-center h-full text-text-muted text-sm">
                      Select a scene to edit its visuals.
                  </div>
              )}
          </div>
        </div>
      )}

      {/* Asset Picker Modal */}
      {modalScene && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setModalScene(null)}
        >
          <div 
            className="bg-surface border border-border rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-border flex items-center gap-3 bg-elevated">
              <Icon name="search" size={16} className="text-text-muted" />
              <input 
                type="text"
                autoFocus
                className="flex-1 bg-transparent border-none outline-none text-text-primary text-sm placeholder:text-text-muted"
                placeholder="Search Pexels for B-Roll..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && performAssetSearch(searchQuery)}
              />
              <Button variant="ghost" size="sm" onClick={() => performAssetSearch(searchQuery)} loading={searching} icon="arrow-right" />
              <div className="w-px h-4 bg-border mx-1" />
              <button onClick={() => setModalScene(null)} className="p-1 hover:bg-surface-hover rounded text-text-muted transition-colors">
                <Icon name="x" size={18} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 hide-scrollbar">
              {searching ? (
                <div className="flex flex-col items-center justify-center h-40 gap-3 text-text-muted">
                  <Icon name="loader" size={24} className="animate-spin" />
                  <span className="text-sm">Searching global asset libraries...</span>
                </div>
              ) : searchResults.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {searchResults.map((res, i) => (
                    <div 
                      key={i}
                      onClick={() => selectAssetForScene(res)}
                      className="group relative aspect-[9/16] bg-elevated rounded-xl overflow-hidden border-2 border-transparent hover:border-brand-red cursor-pointer transition-all hover:-translate-y-1 hover:shadow-brand-glow"
                    >
                      <img src={res.thumbnail_url} alt="Stock" className="w-full h-full object-cover" />
                      
                      {res.type === 'video' && (
                        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white p-1.5 rounded-full shadow-sm">
                          <Icon name="video" size={12} />
                        </div>
                      )}
                      
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-2 pt-6 opacity-0 group-hover:opacity-100 transition-opacity text-left">
                        <p className="text-[10px] font-bold text-white line-clamp-1">{res.source}</p>
                        {res.photographer && <p className="text-[9px] text-gray-300 truncate">By {res.photographer}</p>}
                      </div>
                      
                      <div className="absolute inset-0 bg-brand-red/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                        <div className="bg-brand-red text-white w-8 h-8 rounded-full flex items-center justify-center shadow-lg transform scale-50 group-hover:scale-100 transition-transform duration-200">
                          <Icon name="check" size={16} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-40 text-text-muted gap-2">
                  <Icon name="search" size={24} />
                  <p className="text-sm">No assets found. Try a different query.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
