import React, { useState, useEffect } from 'react';
import Icon from '../../../../components/Icon';
import useStudioStore from '../../../../store/studioStore';
import { api } from '../../../../services/api';
import { toast } from 'sonner';

export default function VoiceView() {
  const { language, setLanguage, voiceSettings, setVoiceSettings } = useStudioStore();

  const [voices, setVoices] = useState([]);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  // Voice settings state
  const [selectedLanguage, setSelectedLanguage] = useState(language || 'en');
  const [selectedVoice, setSelectedVoice] = useState(voiceSettings?.voiceId || '');
  const [style, setStyle] = useState(voiceSettings?.style || 'storytelling');
  const [speed, setSpeed] = useState(voiceSettings?.speed || 1.0);
  const [bgm, setBgm] = useState(voiceSettings?.bgm || 'none');
  const [bgmVolume, setBgmVolume] = useState(voiceSettings?.bgmVolume || 0.2);

  // Fetch voices based on language
  useEffect(() => {
    let active = true;
    const fetchVoices = async () => {
      setLoadingVoices(true);
      try {
        if (api.getVoices) {
          const res = await api.getVoices(selectedLanguage);
          if (active) {
            setVoices(res || []);
            // Auto-select first voice if none selected
            if (res?.length > 0 && (!selectedVoice || !res.find(v => v.id === selectedVoice))) {
              setSelectedVoice(res[0].id);
            }
          }
        }
      } catch (err) {
        if (active) {
           toast.error('Failed to load voices');
           // Fallback mocks
           const mocks = [
             { id: 'v1', name: 'Aria', gender: 'Female', type: 'Natural' },
             { id: 'v2', name: 'Davis', gender: 'Male', type: 'Deep' }
           ];
           setVoices(mocks);
           setSelectedVoice(mocks[0].id);
        }
      } finally {
        if (active) setLoadingVoices(false);
      }
    };
    fetchVoices();
    return () => { active = false; };
  }, [selectedLanguage]);

  const handlePreview = async () => {
    if (!selectedVoice) return;
    setPreviewing(true);
    try {
       // Simulate audio fetch since we might not have a specific preview api
       await new Promise(r => setTimeout(r, 1500));
       toast.success("Playing voice preview");
    } catch(err) {
       toast.error("Failed to generate preview");
    } finally {
       setPreviewing(false);
    }
  };

  const handleSaveSettings = () => {
    setLanguage(selectedLanguage);
    setVoiceSettings({
       voiceId: selectedVoice,
       style,
       speed,
       bgm,
       bgmVolume
    });
    toast.success("Voice settings saved");
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden bg-canvas">

      {/* ── LEFT: Voice Selection (60%) ──────────────────────────────────────── */}
      <div className="w-full md:w-[60%] border-r border-border/50 bg-surface/30 p-8 lg:p-12 md:overflow-y-auto hide-scrollbar shrink-0 md:shrink">
        <div className="max-w-2xl mx-auto space-y-10">

          <div>
            <h2 className="text-2xl font-bold tracking-tight text-text-primary mb-2">Voice & Audio</h2>
            <p className="text-sm text-text-secondary">Configure the primary narration and background music for your video.</p>
          </div>

          <div className="bg-canvas border border-border/60 rounded-2xl p-6 shadow-sm">
             <h3 className="text-sm font-bold text-text-primary mb-6 flex items-center gap-2">
               <Icon name="mic" size={16} className="text-brand-red" /> Primary Voice
             </h3>

             <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                {/* Language */}
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-text-muted">Language</label>
                  <select
                    value={selectedLanguage}
                    onChange={e => setSelectedLanguage(e.target.value)}
                    className="w-full bg-surface border border-border/60 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-red/50 transition-colors"
                  >
                    <option value="en">English (US)</option>
                    <option value="hi">Hindi (India)</option>
                    <option value="es">Spanish</option>
                  </select>
                </div>

                {/* Style */}
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-text-muted">Emotion / Style</label>
                  <select
                    value={style}
                    onChange={e => setStyle(e.target.value)}
                    className="w-full bg-surface border border-border/60 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-red/50 transition-colors"
                  >
                    <option value="storytelling">Storytelling</option>
                    <option value="energetic">Energetic / Upbeat</option>
                    <option value="serious">Serious / Documentary</option>
                  </select>
                </div>
             </div>

             {/* Voice Grid */}
             <div className="space-y-3 mb-6">
               <label className="text-[11px] font-bold uppercase tracking-widest text-text-muted">Select Voice</label>
               {loadingVoices ? (
                 <div className="h-32 flex items-center justify-center border border-dashed border-border/50 rounded-xl">
                   <Icon name="loader" size={20} className="animate-spin text-brand-red/50" />
                 </div>
               ) : (
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[240px] overflow-y-auto pr-2 custom-scrollbar">
                    {voices.map(v => (
                      <button
                        key={v.id}
                        onClick={() => setSelectedVoice(v.id)}
                        className={`text-left p-4 rounded-xl border transition-all ${
                          selectedVoice === v.id
                            ? 'bg-brand-red/5 border-brand-red/50 shadow-sm'
                            : 'bg-surface border-border/40 hover:border-border hover:bg-surface-hover'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-bold text-sm text-text-primary">{v.name}</span>
                          {selectedVoice === v.id && <Icon name="check-circle" size={14} className="text-brand-red" />}
                        </div>
                        <div className="flex gap-2">
                          <span className="text-[10px] bg-canvas px-2 py-0.5 rounded text-text-secondary border border-border/50">{v.gender || 'Unknown'}</span>
                          <span className="text-[10px] bg-canvas px-2 py-0.5 rounded text-text-secondary border border-border/50">{v.type || 'Natural'}</span>
                        </div>
                      </button>
                    ))}
                 </div>
               )}
             </div>

             <div className="flex items-center justify-between border-t border-border/40 pt-6">
                <div className="flex items-center gap-3">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-text-muted w-12">Speed</label>
                  <input
                    type="range"
                    min="0.5" max="1.5" step="0.1"
                    value={speed}
                    onChange={e => setSpeed(Number(e.target.value))}
                    className="w-32 accent-brand-red"
                  />
                  <span className="text-xs font-mono text-text-secondary w-8">{speed.toFixed(1)}x</span>
                </div>

                <button
                  onClick={handlePreview}
                  disabled={previewing || !selectedVoice}
                  className="bg-text-primary text-canvas px-5 py-2.5 rounded-lg text-xs font-bold hover:bg-white transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
                >
                  {previewing ? <Icon name="loader" size={14} className="animate-spin" /> : <Icon name="play" size={14} className="ml-0.5" />}
                  Preview Voice
                </button>
             </div>
          </div>

          <div className="bg-canvas border border-border/60 rounded-2xl p-6 shadow-sm">
             <h3 className="text-sm font-bold text-text-primary mb-6 flex items-center gap-2">
               <Icon name="music" size={16} className="text-brand-red" /> Background Music
             </h3>

             <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-text-muted">Track / Mood</label>
                  <select
                    value={bgm}
                    onChange={e => setBgm(e.target.value)}
                    className="w-full bg-surface border border-border/60 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-red/50 transition-colors"
                  >
                    <option value="none">None</option>
                    <option value="calm">Calm Documentary</option>
                    <option value="energetic">Energetic Beats</option>
                    <option value="dramatic">Dramatic Tension</option>
                    <option value="lofi">Lofi Chill</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-text-muted">Volume</label>
                  <div className="flex items-center gap-3 h-[42px] px-2 bg-surface rounded-xl border border-border/60">
                    <Icon name="volume-1" size={16} className="text-text-muted" />
                    <input
                      type="range"
                      min="0" max="1" step="0.05"
                      value={bgmVolume}
                      onChange={e => setBgmVolume(Number(e.target.value))}
                      disabled={bgm === 'none'}
                      className="flex-1 accent-brand-red"
                    />
                    <Icon name="volume-2" size={16} className="text-text-muted" />
                  </div>
                </div>
             </div>
          </div>

          <div className="flex justify-end pt-4">
             <button onClick={handleSaveSettings} className="bg-brand-red hover:bg-brand-red-hover text-white px-8 py-3 rounded-xl font-bold text-sm shadow-[0_4px_14px_0_rgba(230,57,47,0.39)] transition-all">
               Save Voice Settings
             </button>
          </div>

        </div>
      </div>

      {/* ── RIGHT: Voice Health & Insights (40%) ──────────────────────────────── */}
      <div className="w-full md:w-[40%] bg-surface/10 p-8 flex flex-col justify-center">

         <div className="max-w-xs mx-auto w-full">
            <h4 className="text-xs font-bold uppercase tracking-widest text-text-muted mb-6 text-center">Voice Health Analysis</h4>

            <div className="space-y-6 bg-canvas border border-border/40 p-6 rounded-2xl shadow-sm">

               <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                     <span className="font-semibold text-text-primary">Naturalness</span>
                     <span className="font-mono text-brand-red">92/100</span>
                  </div>
                  <div className="h-1.5 w-full bg-surface rounded-full overflow-hidden">
                     <div className="h-full bg-brand-red rounded-full" style={{ width: '92%' }}></div>
                  </div>
               </div>

               <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                     <span className="font-semibold text-text-primary">Pronunciation</span>
                     <span className="font-mono text-brand-red">97/100</span>
                  </div>
                  <div className="h-1.5 w-full bg-surface rounded-full overflow-hidden">
                     <div className="h-full bg-brand-red rounded-full" style={{ width: '97%' }}></div>
                  </div>
               </div>

               <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                     <span className="font-semibold text-text-primary">Pacing</span>
                     <span className="font-mono text-brand-red">84/100</span>
                  </div>
                  <div className="h-1.5 w-full bg-surface rounded-full overflow-hidden">
                     <div className="h-full bg-brand-red rounded-full" style={{ width: '84%' }}></div>
                  </div>
               </div>

            </div>

            {selectedLanguage === 'hi' && (
              <div className="mt-6 bg-brand-red/5 border border-brand-red/20 rounded-xl p-4">
                 <p className="text-xs text-text-secondary leading-relaxed">
                   <span className="font-bold text-text-primary">Hint:</span> Hindi voices work best with the <span className="font-bold">Storytelling</span> style to preserve native cadence and pauses.
                 </p>
              </div>
            )}
         </div>
      </div>

    </div>
  );
}
