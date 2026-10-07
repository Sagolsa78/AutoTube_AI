import React, { useState } from 'react';
import Icon from '../../../../components/Icon';
import useStudioStore from '../../../../store/studioStore';
import TimelineTrack from '../components/TimelineTrack';

export default function StoryboardView({ onNext, onPrev }) {
  const editingScenes = useStudioStore(s => s.editingScenes);
  const setEditingScenes = useStudioStore(s => s.setEditingScenes);

  const [selectedSceneIdx, setSelectedSceneIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);

  const selectedScene = editingScenes[selectedSceneIdx] || null;

  // Mock total duration for the timeline
  const totalDuration = editingScenes.length > 0 ? editingScenes.length * 5 : 60;

  const handlePromptUpdate = (e) => {
    if (!selectedScene) return;
    const newScenes = [...editingScenes];
    newScenes[selectedSceneIdx].visual_prompt = e.target.value;
    setEditingScenes(newScenes);
  };

  const handleTextUpdate = (e) => {
    if (!selectedScene) return;
    const newScenes = [...editingScenes];
    newScenes[selectedSceneIdx].text = e.target.value;
    setEditingScenes(newScenes);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-surface">

      {/* ── Top Workspace: Preview & Inspector ────────────────────── */}
      <div className="flex-1 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-border min-h-0">

        {/* Left: Asset Library (Mock) */}
        <div className="hidden lg:flex w-64 bg-canvas flex-col">
           <div className="p-3 border-b border-border/50">
             <div className="relative">
               <Icon name="search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
               <input type="text" placeholder="Search assets..." className="w-full bg-surface border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs focus:border-brand-red focus:outline-none" />
             </div>
           </div>
           <div className="flex-1 overflow-y-auto p-2 grid grid-cols-2 gap-2 hide-scrollbar">
             {Array.from({ length: 8 }).map((_, i) => (
               <div key={i} className="aspect-[9/16] bg-elevated rounded-lg border border-border flex items-center justify-center hover:border-brand-red/50 cursor-pointer group relative overflow-hidden">
                 <Icon name="image" size={20} className="text-border" />
                 <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                   <Icon name="plus" size={16} className="text-white" />
                 </div>
               </div>
             ))}
           </div>
        </div>

        {/* Center: Video Preview Player */}
        <div className="flex-1 flex flex-col bg-surface-input relative">
           {/* Preview Header */}
           <div className="absolute top-0 inset-x-0 p-4 flex justify-between items-center z-10 bg-gradient-to-b from-canvas/80 to-transparent">
              <span className="text-xs font-bold text-text-secondary bg-surface/50 px-2 py-1 rounded backdrop-blur">
                {String(Math.floor(playbackTime / 60)).padStart(2, '0')}:{String(Math.floor(playbackTime % 60)).padStart(2, '0')} / 01:00
              </span>
              <button className="text-text-muted hover:text-text-primary bg-surface/50 p-1.5 rounded backdrop-blur">
                <Icon name="maximize" size={16} />
              </button>
           </div>

           {/* Canvas */}
           <div className="flex-1 flex items-center justify-center p-8 relative">
              <div className="h-full aspect-[9/16] bg-canvas border border-border rounded-2xl shadow-card-subtle flex flex-col items-center justify-center relative overflow-hidden">
                {selectedScene?.image_url ? (
                  <img src={selectedScene.image_url} alt="Scene preview" className="w-full h-full object-cover" />
                ) : (
                  <>
                    <Icon name="film" size={48} className="text-border mb-4" />
                    <p className="text-sm font-semibold text-text-muted">Awaiting Rendering</p>
                  </>
                )}

                {/* Mock Subtitle Overlay */}
                {selectedScene?.text && (
                  <div className="absolute bottom-16 inset-x-8 text-center">
                    <span className="bg-black/60 text-white font-bold text-xl px-2 py-1 leading-relaxed rounded backdrop-blur-sm shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                      {selectedScene.text.split(' ').slice(0, 5).join(' ')}...
                    </span>
                  </div>
                )}
              </div>
           </div>

           {/* Transport Controls */}
           <div className="h-16 border-t border-border/40 bg-surface flex items-center justify-center gap-6">
             <button className="text-text-muted hover:text-text-primary"><Icon name="skip-back" size={20} /></button>
             <button
               onClick={() => setIsPlaying(!isPlaying)}
               className="w-10 h-10 rounded-full bg-text-primary text-canvas flex items-center justify-center hover:scale-105 transition-transform"
             >
               <Icon name={isPlaying ? "pause" : "play"} size={20} className={isPlaying ? "" : "ml-1"} />
             </button>
             <button className="text-text-muted hover:text-text-primary"><Icon name="skip-forward" size={20} /></button>
           </div>
        </div>

        {/* Right: Scene Inspector */}
        <div className="w-full md:w-80 bg-canvas flex flex-col shrink-0">
          <div className="p-4 border-b border-border/50 flex items-center justify-between">
            <h3 className="text-sm font-bold text-text-primary">Inspector</h3>
            <span className="text-[10px] uppercase font-bold text-text-muted">Scene {selectedSceneIdx + 1}</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-6 hide-scrollbar">
            {selectedScene ? (
              <>
                {/* Visual Strategy */}
                <div className="space-y-2">
                   <div className="flex justify-between items-center">
                     <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Visual Gen Prompt</label>
                     <button className="text-[10px] text-brand-red font-bold hover:underline flex items-center gap-1">
                       <Icon name="refresh-cw" size={10} /> Regenerate
                     </button>
                   </div>
                   <textarea
                     value={selectedScene.visual_prompt || ''}
                     onChange={handlePromptUpdate}
                     className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs focus:border-brand-red focus:outline-none resize-none h-24 text-text-primary"
                   />
                </div>

                {/* Script Line */}
                <div className="space-y-2">
                   <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Narration / Subtitles</label>
                   <textarea
                     value={selectedScene.text || ''}
                     onChange={handleTextUpdate}
                     className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs focus:border-brand-red focus:outline-none resize-none h-20 text-text-primary"
                   />
                </div>

                {/* Transition */}
                <div className="space-y-2">
                   <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Transition (In)</label>
                   <select className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs focus:border-brand-red focus:outline-none">
                     <option value="none">Cut</option>
                     <option value="fade">Fade</option>
                     <option value="slide_left">Slide Left</option>
                   </select>
                </div>

                <div className="space-y-2">
                   <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Motion</label>
                   <select className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs focus:border-brand-red focus:outline-none">
                     <option value="none">Static</option>
                     <option value="pan_right">Pan Right (Ken Burns)</option>
                     <option value="zoom_in">Zoom In</option>
                   </select>
                </div>
              </>
            ) : (
              <div className="text-center py-10 text-text-muted text-xs">
                Select a scene from the timeline to edit properties.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Bottom: Timeline ──────────────────────────────────────── */}
      <div className="h-64 bg-surface-input border-t border-border flex flex-col shrink-0">
         {/* Timeline Toolbar */}
         <div className="h-10 border-b border-border/50 flex items-center px-4 justify-between bg-surface">
            <div className="flex items-center gap-4">
              <button className="text-text-muted hover:text-text-primary text-[10px] font-bold uppercase flex items-center gap-1.5"><Icon name="split-square-horizontal" size={12} /> Split</button>
              <button className="text-text-muted hover:text-text-primary text-[10px] font-bold uppercase flex items-center gap-1.5"><Icon name="trash-2" size={12} /> Delete</button>
            </div>
            <div className="flex items-center gap-2">
              <Icon name="zoom-out" size={14} className="text-text-muted" />
              <input type="range" className="w-24 accent-brand-red" min="1" max="100" defaultValue="50" />
              <Icon name="zoom-in" size={14} className="text-text-muted" />
            </div>
         </div>

         {/* Timeline Tracks Area */}
         <div className="flex-1 overflow-auto relative p-4 hide-scrollbar">

            {/* Playhead */}
            <div
              className="absolute top-0 bottom-0 w-px bg-brand-red z-20 pointer-events-none transition-all"
              style={{ left: `${(playbackTime / totalDuration) * 100}%`, minLeft: '1rem' }}
            >
              <div className="w-3 h-3 bg-brand-red rounded-full absolute -top-1.5 -translate-x-1/2 shadow-brand-glow" />
            </div>

            <div className="space-y-2 min-w-[800px]">
               <TimelineTrack
                 title="VISUAL"
                 color="bg-info"
                 scenes={editingScenes}
                 selectedIndex={selectedSceneIdx}
                 onSelect={setSelectedSceneIdx}
                 type="visual"
               />
               <TimelineTrack
                 title="AUDIO"
                 color="bg-success"
                 scenes={editingScenes}
                 selectedIndex={selectedSceneIdx}
                 onSelect={setSelectedSceneIdx}
                 type="audio"
               />
               <TimelineTrack
                 title="TEXT"
                 color="bg-warning"
                 scenes={editingScenes}
                 selectedIndex={selectedSceneIdx}
                 onSelect={setSelectedSceneIdx}
                 type="text"
               />
            </div>
         </div>
      </div>

    </div>
  );
}
