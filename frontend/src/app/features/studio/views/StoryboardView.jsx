import React, { useState, useEffect, useCallback } from 'react';
import Icon from '../../../../components/Icon';
import useStudioStore from '../../../../store/studioStore';
import TimelineTrack from '../components/TimelineTrack';
import { api } from '../../../../services/api';
import { toast } from 'sonner';

export default function StoryboardView() {
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

  return (
    <div className="flex-1 flex flex-col overflow-y-auto lg:overflow-hidden bg-surface">

      {/* ── Top Workspace: Preview & Inspector ────────────────────── */}
      <div className="flex-1 flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-border/50 lg:min-h-0 overflow-y-auto lg:overflow-hidden">

        {/* Left: Asset Library (20%) */}
        <div className="flex w-full h-64 lg:h-auto lg:w-72 bg-canvas flex-col shrink-0 border-b lg:border-b-0 lg:border-r border-border/50">
           <div className="p-4 border-b border-border/50 space-y-3">
             <div className="flex items-center justify-between">
               <h3 className="text-xs font-bold uppercase tracking-widest text-text-primary">Assets</h3>
             </div>

             {/* Tabs */}
             <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
               {['Search', 'Stock', 'AI', 'Uploads'].map(tab => (
                 <button
                   key={tab}
                   onClick={() => setAssetTab(tab.toLowerCase())}
                   className={`text-[10px] font-bold uppercase px-3 py-1.5 rounded-full whitespace-nowrap transition-colors ${
                     assetTab === tab.toLowerCase() ? 'bg-text-primary text-canvas' : 'bg-surface text-text-muted hover:text-text-primary'
                   }`}
                 >
                   {tab}
                 </button>
               ))}
             </div>

             <div className="relative">
               <Icon name="search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
               <input
                 type="text"
                 placeholder="Search library..."
                 value={searchQuery}
                 onChange={e => setSearchQuery(e.target.value)}
                 onKeyDown={e => e.key === 'Enter' && searchAssets(searchQuery)}
                 className="w-full bg-surface/50 border border-border/60 rounded-xl pl-9 pr-3 py-2.5 text-xs text-text-primary focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red/20 transition-all"
               />
             </div>
           </div>

           <div className="flex-1 overflow-y-auto p-3 hide-scrollbar relative bg-surface/20">
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
                  <div className="flex flex-col gap-2 w-full">
                    <button onClick={handleGenerateAsset} className="bg-brand-red text-white text-[11px] font-bold py-2 rounded-lg hover:bg-brand-red-hover transition-colors shadow-sm">
                      Generate AI visual
                    </button>
                    <button onClick={() => searchAssets('nature', 'stock')} className="bg-surface text-text-primary text-[11px] font-bold py-2 rounded-lg border border-border hover:bg-elevated transition-colors">
                      Search Stock
                    </button>
                  </div>
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
                        <div className="bg-brand-red text-white p-1.5 rounded-full shadow-lg scale-50 group-hover:scale-100 transition-transform">
                          <Icon name="check" size={14} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
             )}
           </div>
        </div>

        {/* Center: Video Preview Player (55%) */}
        <div className="flex-1 flex flex-col bg-surface/40 relative shrink-0 min-h-[450px] lg:min-h-0">
           {/* Preview Header */}
           <div className="absolute top-0 inset-x-0 p-5 flex justify-between items-center z-10">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-text-primary bg-surface/80 border border-border/50 px-3 py-1.5 rounded-lg backdrop-blur shadow-sm">
                  {String(Math.floor(playbackTime / 60)).padStart(2, '0')}:{String(Math.floor(playbackTime % 60)).padStart(2, '0')}
                  <span className="text-text-muted mx-1">/</span>
                  {String(Math.floor(totalDuration / 60)).padStart(2, '0')}:{String(Math.floor(totalDuration % 60)).padStart(2, '0')}
                </span>
              </div>
              <div className="flex gap-2">
                <button className="text-text-secondary hover:text-text-primary bg-surface/80 border border-border/50 p-2 rounded-lg backdrop-blur shadow-sm transition-colors">
                  <Icon name="maximize" size={14} />
                </button>
              </div>
           </div>

           {/* Canvas */}
           <div className="flex-1 flex items-center justify-center p-6 md:p-12 relative overflow-hidden min-h-0">
              {/* Subtle background glow */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-brand-red/5 rounded-full blur-[100px] pointer-events-none"></div>

              <div className="h-full aspect-[9/16] bg-canvas border border-border/50 rounded-[2rem] shadow-2xl flex flex-col items-center justify-center relative overflow-hidden group">
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
           <div className="h-20 border-t border-border/40 bg-surface/50 backdrop-blur flex items-center justify-center gap-8 px-6">
             <button className="text-text-muted hover:text-text-primary transition-colors"><Icon name="skip-back" size={20} /></button>
             <button
               onClick={() => setIsPlaying(!isPlaying)}
               className="w-12 h-12 rounded-full bg-text-primary text-canvas flex items-center justify-center hover:scale-105 hover:shadow-lg transition-all"
             >
               <Icon name={isPlaying ? "pause" : "play"} size={22} className={isPlaying ? "" : "ml-1"} />
             </button>
             <button className="text-text-muted hover:text-text-primary transition-colors"><Icon name="skip-forward" size={20} /></button>
           </div>
        </div>

        {/* Right: Scene Inspector (25%) */}
        <div className="w-full lg:w-[320px] bg-canvas flex flex-col shrink-0 min-h-[400px] lg:min-h-0">
          <div className="h-14 border-b border-border/50 flex items-center justify-between px-5">
            <h3 className="text-xs font-bold uppercase tracking-widest text-text-primary">Inspector</h3>
            <span className="text-[10px] font-bold bg-brand-red/10 text-brand-red px-2 py-1 rounded">Scene {String(selectedSceneIdx + 1).padStart(2, '0')}</span>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-6 hide-scrollbar">
            {selectedScene ? (
              <>
                {/* Visual Strategy */}
                <div className="space-y-2">
                   <div className="flex justify-between items-center">
                     <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Visual Prompt</label>
                     <button onClick={handleRegeneratePrompt} className="text-[10px] text-brand-red font-bold hover:text-brand-red-hover flex items-center gap-1 transition-colors">
                       <Icon name="refresh-cw" size={10} /> Regenerate
                     </button>
                   </div>
                   <textarea
                     value={selectedScene.visual_prompt || selectedScene.visual_description || ''}
                     onChange={handlePromptUpdate}
                     className="w-full bg-surface border border-border/60 rounded-xl p-3 text-xs focus:border-brand-red/50 focus:outline-none resize-none h-28 text-text-primary leading-relaxed transition-colors"
                     placeholder="Describe the visual for this scene..."
                   />
                </div>

                {/* Script Line */}
                <div className="space-y-2">
                   <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Narration / Subtitles</label>
                   <textarea
                     value={selectedScene.text || selectedScene.narration || ''}
                     onChange={handleTextUpdate}
                     className="w-full bg-surface border border-border/60 rounded-xl p-3 text-xs focus:border-brand-red/50 focus:outline-none resize-none h-24 text-text-secondary leading-relaxed transition-colors"
                     placeholder="Text that appears on screen..."
                   />
                </div>

                <div className="h-px bg-border/40 my-2"></div>

                {/* Settings Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                     <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Transition</label>
                     <select className="w-full bg-surface border border-border/60 rounded-lg px-3 py-2.5 text-xs text-text-primary focus:border-brand-red/50 focus:outline-none cursor-pointer transition-colors">
                       <option value="none">Cut</option>
                       <option value="fade">Fade</option>
                       <option value="slide_left">Slide Left</option>
                     </select>
                  </div>

                  <div className="space-y-2">
                     <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Motion</label>
                     <select className="w-full bg-surface border border-border/60 rounded-lg px-3 py-2.5 text-xs text-text-primary focus:border-brand-red/50 focus:outline-none cursor-pointer transition-colors">
                       <option value="none">Static</option>
                       <option value="pan_right">Pan Right</option>
                       <option value="zoom_in">Zoom In</option>
                     </select>
                  </div>

                  <div className="space-y-2">
                     <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Visual Mode</label>
                     <select className="w-full bg-surface border border-border/60 rounded-lg px-3 py-2.5 text-xs text-text-primary focus:border-brand-red/50 focus:outline-none cursor-pointer transition-colors">
                       <option value="fill">Fill</option>
                       <option value="fit">Fit (Blur bg)</option>
                     </select>
                  </div>

                  <div className="space-y-2">
                     <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Duration</label>
                     <input
                       type="text"
                       value={`${selectedScene.duration_est || 5}s`}
                       disabled
                       className="w-full bg-surface/50 border border-transparent rounded-lg px-3 py-2.5 text-xs text-text-secondary cursor-not-allowed"
                     />
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center py-10 opacity-60">
                <Icon name="mouse-pointer" size={32} className="text-border mb-3" />
                <p className="text-xs text-text-muted max-w-[180px]">Select a scene from the timeline below to edit its properties.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Bottom: Timeline (Fixed Height) ──────────────────────────────────────── */}
      <div className="h-56 bg-canvas border-t border-border/50 flex flex-col shrink-0 relative z-20">
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
