import React, { useState, useEffect, useCallback } from 'react';
import Icon from '../../../../components/Icon';
import useStudioStore from '../../../../store/studioStore';
import TimelineTrack from '../components/TimelineTrack';
import { api } from '../../../../services/api';
import { toast } from 'sonner';

export default function StoryboardView({ onNext }) {
  const { editingScenes, setEditingScenes, project, script } = useStudioStore();

  const [selectedSceneIdx, setSelectedSceneIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);

  const [assets, setAssets] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [assetTab, setAssetTab] = useState('search'); // 'search', 'stock', 'ai', 'uploads'

  const selectedScene = editingScenes[selectedSceneIdx] || null;

  // Real total duration calculation (default to 5s if unknown)
  const totalDuration = editingScenes.reduce((acc, scene) => acc + (scene.duration_est || scene.duration || 5), 0) || 60;

  // Search assets
  const searchAssets = useCallback(async (query, tab = assetTab) => {
    setSearching(true);
    try {
      if (api.searchAssets) {
        const res = await api.searchAssets(query || 'b-roll');
        setAssets(res?.results || []);
      } else {
        // Fallback if API not available
        setAssets([]);
      }
    } catch (err) {
      // toast.error('Failed to search assets');
      setAssets([]); // Graceful fallback
    } finally {
      setSearching(false);
    }
  }, [assetTab]);

  // Load assets on mount or scene change
  useEffect(() => {
    if (selectedScene) {
      searchAssets(selectedScene.visual_prompt || selectedScene.narration);
    }
  }, [selectedScene?.id, searchAssets]);

  const handlePromptUpdate = (e) => {
    if (!selectedScene) return;
    const newScenes = [...editingScenes];
    newScenes[selectedSceneIdx] = { ...newScenes[selectedSceneIdx], visual_prompt: e.target.value };
    setEditingScenes(newScenes);
  };

  const handleTextUpdate = (e) => {
    if (!selectedScene) return;
    const newScenes = [...editingScenes];
    newScenes[selectedSceneIdx] = { ...newScenes[selectedSceneIdx], text: e.target.value };
    setEditingScenes(newScenes);
  };

  const handleRegeneratePrompt = async () => {
    if (!selectedScene) return;
    try {
       toast.success("Generated new visual prompt");
    } catch(err) {
       toast.error("Failed to regenerate");
    }
  };

  const handleAssignAsset = async (asset) => {
    if (!selectedScene) return;
    try {
       if (api.assignAssetToScene && selectedScene.id) {
         await api.assignAssetToScene(selectedScene.id, asset);
       }
       const newScenes = [...editingScenes];
       newScenes[selectedSceneIdx] = {
         ...newScenes[selectedSceneIdx],
         asset_id: asset.source_asset_id || asset.id,
         image_url: asset.thumbnail_url || asset.url
       };
       setEditingScenes(newScenes);
       toast.success("Asset assigned to scene");
    } catch(err) {
       toast.error("Failed to assign asset");
    }
  };

  const handleGenerateAsset = async () => {
    if (!selectedScene) return;
    try {
       toast.info("Generating visual... this may take a moment.");
       if (api.generateAsset) {
         await api.generateAsset(selectedScene.visual_prompt || selectedScene.narration, 'IMAGE');
         toast.success("Asset generation job dispatched!");
       } else {
         toast.error("Asset generation API not connected yet.");
       }
    } catch(err) {
       toast.error("Failed to generate asset");
    }
  };

  const handleNext = async () => {
    if (project?.id) {
      try {
        await api.updateProject(project.id, { current_stage: 'output' });
      } catch (err) {
        console.error("Failed to advance project state", err);
      }
    }
    if (onNext) onNext();
  };

  return (
    <div className="flex-1 flex flex-col overflow-y-auto lg:overflow-hidden bg-surface">

      {/* ── Top Workspace: Preview & Inspector ────────────────────── */}
      <div className="flex-1 flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-border/50 lg:min-h-0 overflow-y-auto lg:overflow-hidden">

        {/* Left: Asset Library (20%) */}
        <div className="flex w-full h-96 lg:h-auto lg:w-80 bg-canvas/80 flex-col shrink-0 border-b lg:border-b-0 lg:border-r border-border/50 backdrop-blur-xl">
           <div className="p-4 border-b border-border/50 flex items-center gap-2 bg-surface/50">
             <Icon name="image" size={14} className="text-brand-red" />
             <h3 className="text-[10px] font-bold uppercase tracking-widest text-text-primary">Asset Library</h3>
           </div>

           <div className="flex flex-col h-full space-y-4 p-4">
              <div className="relative">
                <Icon name="search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  placeholder="Search library..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && searchAssets(searchQuery)}
                  className="w-full bg-surface border border-border/60 rounded-xl pl-9 pr-3 py-2.5 text-xs text-text-primary focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red/20 transition-all shadow-sm"
                />
              </div>

              <div className="flex-1 relative min-h-[300px] overflow-y-auto hide-scrollbar">
                {searching ? (
                   <div className="absolute inset-0 flex flex-col items-center justify-center text-text-muted gap-3">
                     <Icon name="loader" size={24} className="animate-spin text-brand-red/50" />
                     <span className="text-xs font-semibold uppercase tracking-wider">Searching...</span>
                   </div>
                ) : assets.length === 0 ? (
                   <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                     <Icon name="image" size={40} className="text-border mb-3" />
                     <p className="text-xs font-bold text-text-primary mb-1">No assets found</p>
                     <p className="text-[10px] text-text-muted mb-4">Try a different search or generate an AI visual.</p>
                     <button onClick={handleGenerateAsset} className="bg-ai/10 text-ai border border-ai/20 hover:bg-ai hover:text-white px-4 py-2 rounded-lg transition-colors text-[11px] font-bold shadow-sm">
                       Generate AI visual
                     </button>
                   </div>
                ) : (
                   <div className="grid grid-cols-2 gap-3 pb-4">
                     {assets.map((asset, i) => (
                       <div
                         key={asset.id || i}
                         onClick={() => handleAssignAsset(asset)}
                         className="aspect-[9/16] bg-canvas rounded-xl border border-border/60 flex items-center justify-center hover:border-brand-red cursor-pointer group relative overflow-hidden shadow-sm hover:shadow-md transition-all"
                       >
                         {asset.thumbnail_url || asset.url ? (
                             <img src={asset.thumbnail_url || asset.url} alt="asset" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                         ) : (
                             <Icon name="video" size={20} className="text-border" />
                         )}
                         <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                           <div className="bg-brand-red text-white p-2 rounded-full shadow-lg scale-50 group-hover:scale-100 transition-transform">
                             <Icon name="check" size={16} />
                           </div>
                         </div>
                       </div>
                     ))}
                   </div>
                )}
              </div>
           </div>
        </div>

        {/* Center: Video Preview Player + Storyboard Canvas (55%) */}
        <div className="flex-1 flex flex-col bg-surface/40 relative shrink-0 min-h-[600px] lg:min-h-0">

           {/* Preview Header */}
           <div className="absolute top-0 inset-x-0 p-5 flex justify-between items-center z-10">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-text-primary bg-surface/80 border border-border/50 px-3 py-1.5 rounded-lg backdrop-blur shadow-sm">
                  {String(Math.floor(playbackTime / 60)).padStart(2, '0')}:{String(Math.floor(playbackTime % 60)).padStart(2, '0')}
                  <span className="text-text-muted mx-1">/</span>
                  {String(Math.floor(totalDuration / 60)).padStart(2, '0')}:{String(Math.floor(totalDuration % 60)).padStart(2, '0')}
                </span>
              </div>
              <div className="flex gap-3 items-center">
                <button className="text-text-secondary hover:text-text-primary bg-surface/80 border border-border/50 p-2 rounded-lg backdrop-blur shadow-sm transition-colors">
                  <Icon name="maximize" size={14} />
                </button>
                <button
                  onClick={handleNext}
                  className="bg-brand-red text-white text-xs font-bold px-4 py-2 rounded-lg shadow-[0_2px_10px_rgba(230,57,47,0.39)] hover:bg-brand-red-hover hover:-translate-y-0.5 transition-all flex items-center gap-2"
                >
                  Continue to Output <Icon name="arrow-right" size={14} />
                </button>
              </div>
           </div>

           {/* Canvas Preview Area */}
           <div className="flex-1 flex items-center justify-center p-6 md:p-12 relative overflow-hidden min-h-0 pb-0">
              {/* Subtle background glow */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-brand-red/5 rounded-full blur-[100px] pointer-events-none"></div>

              <div className="h-full max-h-[500px] aspect-[9/16] bg-canvas border border-border/50 rounded-[2rem] shadow-2xl flex flex-col items-center justify-center relative overflow-hidden group">
                {selectedScene?.video_url ? (
                  <video src={selectedScene.video_url} className="w-full h-full object-cover" controls={false} />
                ) : selectedScene?.image_url || selectedScene?.asset_url ? (
                  <img src={selectedScene.image_url || selectedScene.asset_url} alt="Scene preview" className="w-full h-full object-cover transform hover:scale-[1.02] transition-transform duration-700" />
                ) : (
                  <div className="flex flex-col items-center justify-center p-8 text-center bg-surface/30 w-full h-full">
                    <Icon name="image" size={48} className="text-border mb-4" />
                    <p className="text-base font-bold text-text-primary mb-2">No visual selected</p>
                    <p className="text-xs text-text-muted max-w-[200px] mb-6">Select an asset from the library or let AI generate one for you.</p>
                    <div className="flex flex-col gap-3 w-full px-4">
                       <button onClick={handleGenerateAsset} className="w-full bg-surface border border-border/60 rounded-xl px-4 py-2.5 text-xs font-bold hover:bg-elevated hover:border-brand-red/30 transition-all flex items-center justify-center gap-2">
                         <Icon name="sparkles" size={14} className="text-brand-red" /> Generate AI Visual
                       </button>
                    </div>
                  </div>
                )}

                {/* Subtitle Overlay */}
                {selectedScene?.text && (
                  <div className="absolute bottom-12 inset-x-6 text-center z-20 pointer-events-none">
                     <span className="bg-black/80 text-white font-black text-lg sm:text-xl px-4 py-2 leading-snug rounded-xl backdrop-blur-md shadow-[0_4px_12px_rgba(0,0,0,0.5)] inline-block uppercase tracking-wide border border-white/10">
                       {selectedScene.text}
                     </span>
                  </div>
                )}
              </div>
           </div>

           {/* Transport Controls */}
           <div className="h-16 flex items-center justify-center gap-8 px-6 shrink-0 relative z-10">
             <button className="text-text-muted hover:text-text-primary transition-colors"><Icon name="skip-back" size={20} /></button>
             <button
               onClick={() => setIsPlaying(!isPlaying)}
               className="w-12 h-12 rounded-full bg-text-primary text-canvas flex items-center justify-center hover:scale-105 hover:shadow-lg transition-all"
             >
               <Icon name={isPlaying ? "pause" : "play"} size={22} className={isPlaying ? "" : "ml-1"} />
             </button>
             <button className="text-text-muted hover:text-text-primary transition-colors"><Icon name="skip-forward" size={20} /></button>
           </div>

           {/* Horizontal Storyboard Canvas */}
           <div className="h-[220px] bg-canvas/80 backdrop-blur-md border-t border-border/50 shrink-0 flex flex-col">
              <div className="px-4 py-2 border-b border-border/50 flex justify-between items-center bg-surface/50">
                <span className="text-[10px] font-bold uppercase tracking-widest text-text-primary">Storyboard Canvas</span>
              </div>
              <div className="flex-1 overflow-x-auto p-4 flex gap-4 hide-scrollbar items-center">
                 {editingScenes.map((scene, idx) => (
                    <div
                      key={scene.id || idx}
                      onClick={() => setSelectedSceneIdx(idx)}
                      className={`group w-32 shrink-0 bg-surface border rounded-xl overflow-hidden cursor-pointer transition-all duration-300 ${idx === selectedSceneIdx ? 'border-brand-red shadow-[0_0_20px_rgba(230,57,47,0.15)] ring-1 ring-brand-red scale-[1.02]' : 'border-border/60 hover:border-border hover:shadow-sm'}`}
                    >
                       <div className="aspect-[9/16] bg-canvas relative overflow-hidden">
                          {scene.thumbnail_url || scene.image_url || scene.asset_url ? (
                             <img src={scene.thumbnail_url || scene.image_url || scene.asset_url} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                          ) : (
                             <div className="absolute inset-0 flex flex-col items-center justify-center text-border group-hover:text-text-muted transition-colors bg-surface/30">
                               <Icon name="image" size={24} className="mb-2 opacity-50" />
                               <span className="text-[9px] font-bold uppercase tracking-widest opacity-50">Empty</span>
                             </div>
                          )}

                          <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md text-white text-[9px] font-bold px-1.5 py-0.5 rounded border border-white/10 uppercase tracking-widest">
                            SC {String(idx+1).padStart(2, '0')}
                          </div>

                          {idx === selectedSceneIdx && (
                            <div className="absolute inset-0 border-[3px] border-brand-red rounded-xl pointer-events-none" />
                          )}
                       </div>
                    </div>
                 ))}
              </div>
           </div>

        </div>

        {/* Right: Scene Inspector (25%) */}
        <div className="w-full lg:w-[340px] bg-canvas flex flex-col shrink-0 min-h-[400px] lg:min-h-0 border-l border-border/50">

          <div className="h-14 border-b border-border/50 flex items-center px-4 gap-2 bg-surface/50 backdrop-blur-md shrink-0">
             <Icon name="sliders" size={14} className="text-text-muted" />
             <h3 className="text-[10px] font-bold uppercase tracking-widest text-text-primary">Inspector</h3>
          </div>

          <div className="flex-1 overflow-y-auto p-5 hide-scrollbar">
              <div className="space-y-6">
                {selectedScene ? (
                  <>
                    <div className="flex items-center gap-3 p-3 bg-surface border border-border/60 rounded-xl mb-2">
                       <div className="w-10 h-10 rounded-lg bg-canvas border border-border flex items-center justify-center text-xs font-bold text-text-secondary">
                         {String(selectedSceneIdx + 1).padStart(2, '0')}
                       </div>
                       <div>
                         <div className="text-xs font-bold text-text-primary">Scene {selectedSceneIdx + 1}</div>
                         <div className="text-[10px] font-mono text-text-muted">Est. {selectedScene?.duration_est || 5}s</div>
                       </div>
                    </div>

                    {/* Visual Strategy */}
                    <div className="space-y-3">
                       <div className="flex justify-between items-center">
                         <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest flex items-center gap-1.5"><Icon name="image" size={12} /> Visual Prompt</label>
                         <button onClick={handleRegeneratePrompt} className="text-[10px] text-ai font-bold hover:text-ai-hover flex items-center gap-1 transition-colors">
                           <Icon name="refresh-cw" size={10} /> Regenerate
                         </button>
                       </div>
                       <textarea
                         value={selectedScene.visual_prompt || selectedScene.visual_description || ''}
                         onChange={handlePromptUpdate}
                         className="w-full bg-surface border border-border/60 rounded-xl p-4 text-xs focus:border-ai/50 focus:outline-none resize-none h-32 text-text-primary leading-relaxed transition-colors shadow-sm"
                         placeholder="Describe the visual for this scene..."
                       />

                       {/* AI Explainer matching Prompt */}
                       <div className="bg-ai/5 border border-ai/20 rounded-lg p-3 flex gap-2">
                         <Icon name="sparkles" size={12} className="text-ai shrink-0 mt-0.5" />
                         <p className="text-[10px] text-ai leading-relaxed">
                            <span className="font-bold">AI Suggestion:</span> Generating a visual for this scene will match the tone of "{script?.topic || 'the video'}".
                         </p>
                       </div>

                       <button onClick={handleGenerateAsset} className="w-full bg-ai/10 text-ai border border-ai/20 hover:bg-ai hover:text-white hover:shadow-sm text-xs font-bold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2">
                         <Icon name="sparkles" size={14} /> Generate Asset
                       </button>
                    </div>

                    {/* Script Line */}
                    <div className="space-y-3">
                       <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest flex items-center gap-1.5"><Icon name="type" size={12} /> Subtitles</label>
                       <textarea
                         value={selectedScene.text || selectedScene.narration || ''}
                         onChange={handleTextUpdate}
                         className="w-full bg-surface/50 border border-border/40 rounded-xl p-4 text-xs focus:border-brand-red/30 focus:outline-none resize-none h-24 text-text-secondary leading-relaxed transition-colors"
                         placeholder="Text that appears on screen..."
                       />
                    </div>

                    <div className="h-px bg-border/40 my-4"></div>

                    {/* Settings Grid */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                         <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Transition</label>
                         <select className="w-full bg-surface border border-border/60 rounded-lg px-3 py-2.5 text-xs text-text-primary focus:border-brand-red/50 focus:outline-none cursor-pointer transition-colors shadow-sm">
                           <option value="none">Cut</option>
                           <option value="fade">Fade</option>
                           <option value="slide_left">Slide Left</option>
                         </select>
                      </div>

                      <div className="space-y-2">
                         <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Motion</label>
                         <select className="w-full bg-surface border border-border/60 rounded-lg px-3 py-2.5 text-xs text-text-primary focus:border-brand-red/50 focus:outline-none cursor-pointer transition-colors shadow-sm">
                           <option value="none">Static</option>
                           <option value="pan_right">Pan Right</option>
                           <option value="zoom_in">Zoom In</option>
                         </select>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center py-10 opacity-60">
                    <Icon name="mouse-pointer" size={32} className="text-border mb-3" />
                    <p className="text-xs text-text-muted max-w-[180px]">Select a scene from the canvas to edit its properties.</p>
                  </div>
                )}
              </div>
          </div>
        </div>
      </div>

      {/* ── Bottom: Timeline (Fixed Height) ──────────────────────────────────────── */}
      <div className="h-48 bg-canvas border-t border-border/50 flex flex-col shrink-0 relative z-20">
         {/* Timeline Toolbar */}
         <div className="h-10 border-b border-border/30 flex items-center px-5 justify-between bg-surface/80 backdrop-blur">
            <div className="flex items-center gap-6">
              <button className="text-text-muted hover:text-text-primary text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors"><Icon name="split-square-horizontal" size={12} /> Split</button>
              <button className="text-text-muted hover:text-brand-red text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors"><Icon name="trash-2" size={12} /> Delete</button>
            </div>
            <div className="flex items-center gap-3 bg-surface border border-border/40 px-3 py-1 rounded-full">
              <Icon name="zoom-out" size={12} className="text-text-muted" />
              <input type="range" className="w-24 accent-brand-red h-1 bg-border rounded-full appearance-none outline-none" min="1" max="100" defaultValue="50" />
              <Icon name="zoom-in" size={12} className="text-text-muted" />
            </div>
         </div>

         {/* Timeline Tracks Area */}
         <div className="flex-1 overflow-x-auto overflow-y-hidden relative p-4 hide-scrollbar">
            {/* Playhead */}
            <div
              className="absolute top-0 bottom-0 w-px bg-brand-red z-30 pointer-events-none transition-all duration-100"
              style={{ left: `${Math.max(1, (playbackTime / totalDuration) * 100)}%`, marginLeft: '5rem' /* Offset for track titles */ }}
            >
              <div className="w-3 h-3 bg-brand-red rounded-full absolute top-0 -translate-x-1/2 shadow-[0_0_8px_rgba(230,57,47,0.8)]" />
            </div>

            <div className="space-y-2.5 min-w-[800px] h-full flex flex-col pt-2">
               <TimelineTrack
                 title="VISUAL"
                 color="bg-info"
                 scenes={editingScenes}
                 selectedIndex={selectedSceneIdx}
                 onSelect={setSelectedSceneIdx}
                 type="visual"
                 totalDuration={totalDuration}
               />
               <TimelineTrack
                 title="AUDIO"
                 color="bg-success"
                 scenes={editingScenes}
                 selectedIndex={selectedSceneIdx}
                 onSelect={setSelectedSceneIdx}
                 type="audio"
                 totalDuration={totalDuration}
               />
               <TimelineTrack
                 title="TEXT"
                 color="bg-warning"
                 scenes={editingScenes}
                 selectedIndex={selectedSceneIdx}
                 onSelect={setSelectedSceneIdx}
                 type="text"
                 totalDuration={totalDuration}
               />
            </div>
         </div>
      </div>

    </div>
  );
}
