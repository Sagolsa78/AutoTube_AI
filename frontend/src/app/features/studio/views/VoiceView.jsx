import React, { useState, useEffect } from 'react';
import Icon from '../../../../components/Icon';
import useStudioStore from '../../../../store/studioStore';
import { api, getApiBase } from '../../../../services/api';
import { toast } from 'sonner';

export default function VoiceView({ onNext }) {
  // Correctly read from the store's actual shape
  const audioState = useStudioStore((s) => s.audio);
  const setAudio = useStudioStore((s) => s.setAudio);
  const project = useStudioStore((s) => s.project);

  const [voices, setVoices] = useState([]);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  // Voice settings state - initialize from the store's audio slice
  const [selectedLanguage, setSelectedLanguage] = useState(audioState?.language || 'en');
  const [selectedVoice, setSelectedVoice] = useState(audioState?.voice || '');
  const [style, setStyle] = useState(audioState?.emotion || 'storytelling');
  const [speed, setSpeed] = useState(audioState?.speed || 1.0);
  const [pitch, setPitch] = useState(0.0);
  const [stability, setStability] = useState(0.5);
  const [similarity, setSimilarity] = useState(0.75);

  const [bgm, setBgm] = useState(audioState?.music || 'none');
  const [bgmVolume, setBgmVolume] = useState(0.2);

  const [audioPreviewUrl, setAudioPreviewUrl] = useState(null);

  useEffect(() => {
    let active = true;
    const fetchVoices = async () => {
      setLoadingVoices(true);
      try {
        const res = await api.getVoices(selectedLanguage);
        if (active) {
          const voiceList = Array.isArray(res) ? res : [];
          setVoices(voiceList);
          // Auto-select first voice if none selected
          if (voiceList.length > 0 && (!selectedVoice || !voiceList.find(v => v.id === selectedVoice))) {
            setSelectedVoice(voiceList[0].id);
          }
        }
      } catch (err) {
        if (active) {
          console.error('Failed to load voices:', err);
          setVoices([]);
          // Don't clear selected voice on error - keep the previous selection
        }
      } finally {
        if (active) setLoadingVoices(false);
      }
    };
    fetchVoices();
    return () => { active = false; };
  }, [selectedLanguage]);

  const handlePreview = async () => {
    if (!selectedVoice) {
      toast.error("Please select a voice first");
      return;
    }
    setPreviewing(true);
    try {
      const base = getApiBase();
      const url = `${base}/voices/preview/${selectedVoice}`;
      setAudioPreviewUrl(url);
      toast.success("Loading voice preview...");
      setTimeout(() => setPreviewing(false), 500);
    } catch(err) {
      toast.error("Failed to generate preview");
      setPreviewing(false);
    }
  };

  const handleNext = async () => {
    // Save voice settings to store
    setAudio({
      voice: selectedVoice,
      language: selectedLanguage,
      speed: speed,
      emotion: style,
      music: bgm,
    });

    if (project?.id) {
      try {
        await api.updateProject(project.id, {
          current_stage: 'storyboard',
          voice_override: selectedVoice
        });
      } catch (err) {
        console.error("Failed to advance project state", err);
      }
    }
    if (onNext) onNext();
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden bg-canvas">

      {/* ── LEFT: Voice Selection (60%) ──────────────────────────────────────── */}
      <div className="w-full md:w-[60%] border-r border-border/50 bg-surface/30 p-8 lg:p-12 md:overflow-y-auto hide-scrollbar shrink-0 md:shrink">
        <div className="max-w-2xl mx-auto space-y-10 animate-in">

          <div>
            <h2 className="text-2xl font-bold tracking-tight text-text-primary mb-2">Voice & Audio</h2>
            <p className="text-sm text-text-secondary">Configure the primary narration and background music for your video.</p>
          </div>

          <div className="bg-canvas border border-border/60 rounded-2xl p-6 shadow-card-subtle">
            <h3 className="text-sm font-bold text-text-primary mb-6 flex items-center gap-2">
              <Icon name="mic" size={16} className="text-brand-red" /> Primary Voice
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
              {/* Language */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-widest text-text-muted">Language</label>
                <select
                  value={selectedLanguage}
                  onChange={e => { setSelectedLanguage(e.target.value); }}
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
              ) : voices.length === 0 ? (
                <div className="h-32 flex flex-col items-center justify-center border border-dashed border-border/50 rounded-xl text-text-muted">
                  <Icon name="mic" size={24} className="mb-2 opacity-50" />
                  <p className="text-xs">No voices available for this language.</p>
                  <p className="text-[10px] mt-1 text-text-muted">The voice API may be offline or no voices are configured.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[240px] overflow-y-auto pr-2 custom-scrollbar">
                  {voices.map(v => (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVoice(v.id)}
                      className={`text-left p-4 rounded-xl border transition-all hover:-translate-y-0.5 ${
                        selectedVoice === v.id
                          ? 'bg-brand-red/5 border-brand-red/50 shadow-sm shadow-brand-red/10'
                          : 'bg-surface border-border/40 hover:border-border hover:bg-elevated'
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

            <div className="flex flex-col gap-6 border-t border-border/40 pt-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Speed */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Speed</label>
                    <span className="text-xs font-mono text-text-secondary">{speed.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.5" max="1.5" step="0.05"
                    value={speed}
                    onChange={e => setSpeed(Number(e.target.value))}
                    className="w-full accent-brand-red h-1.5 bg-surface rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-brand-red [&::-webkit-slider-thumb]:rounded-full"
                  />
                </div>

                {/* Pitch */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted flex items-center gap-1.5">Pitch</label>
                    <span className="text-xs font-mono text-text-muted">{pitch > 0 ? '+' : ''}{Math.round(pitch * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="-0.5" max="0.5" step="0.05"
                    value={pitch}
                    onChange={e => setPitch(Number(e.target.value))}
                    className="w-full accent-brand-red h-1.5 bg-surface rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-brand-red [&::-webkit-slider-thumb]:rounded-full"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-canvas border border-border/60 rounded-2xl p-6 shadow-card-subtle">
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

          <div className="flex justify-end pt-4 gap-4">
            <button onClick={handleNext} className="bg-brand-red hover:bg-brand-red-hover text-white px-8 py-3 rounded-xl font-bold text-sm shadow-[0_4px_14px_0_rgba(230,57,47,0.39)] transition-all flex items-center gap-2 hover:-translate-y-0.5">
              Storyboard <Icon name="arrow-right" size={14} />
            </button>
          </div>

        </div>
      </div>

      {/* ── RIGHT: Audio Visualizer & Studio (40%) ──────────────────────────────── */}
      <div className="w-full md:w-[40%] bg-surface/40 flex flex-col shrink-0 relative border-l border-border/50 isolate">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-ai/10 via-transparent to-transparent opacity-50 -z-10"></div>

        <div className="h-16 px-6 border-b border-border/50 flex items-center justify-between z-10 bg-canvas/50 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-2 text-text-primary">
            <Icon name="radio" size={16} className="text-brand-red" />
            <span className="text-xs font-bold uppercase tracking-widest">Audio Studio</span>
          </div>
          <span className="text-[10px] font-bold tracking-wider text-text-muted bg-surface px-2 py-1 rounded border border-border">AI Rendering</span>
        </div>

        <div className="flex-1 p-8 flex flex-col z-10">

          <div className="bg-canvas border border-border/60 rounded-2xl p-6 shadow-card-subtle mb-8 flex-1 flex flex-col items-center justify-center">
            {/* Audio Visualization */}
            <div className="relative mb-6">
              <div className="w-24 h-24 rounded-full border-2 border-dashed border-border flex items-center justify-center">
                <Icon name="radio" size={36} className="text-border opacity-50" />
              </div>
              {selectedVoice && (
                <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-brand-red/10 border border-brand-red/20 flex items-center justify-center">
                  <Icon name="check" size={14} className="text-brand-red" />
                </div>
              )}
            </div>

            <p className="text-sm text-text-secondary italic text-center max-w-sm mb-2">
              {selectedVoice ? `Voice selected: ${voices.find(v => v.id === selectedVoice)?.name || selectedVoice}` : 'No voice selected yet'}
            </p>
            <p className="text-xs text-text-muted text-center max-w-sm mb-6">
              Preview your selected voice before moving to the storyboard. The final voiceover will be generated during the render phase.
            </p>

            {audioPreviewUrl && (
              <div className="w-full max-w-md bg-surface p-4 rounded-xl border border-border/60 animate-in">
                <audio src={audioPreviewUrl} controls autoPlay className="w-full h-10 outline-none" />
              </div>
            )}
          </div>

          <div className="flex justify-center mt-auto shrink-0">
            <button
              onClick={handlePreview}
              disabled={previewing || !selectedVoice}
              className="bg-brand-red text-white border-brand-red/30 hover:bg-brand-red-hover py-3.5 px-8 rounded-xl text-sm font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 w-full max-w-sm hover:-translate-y-0.5 shadow-brand-glow"
            >
              {previewing ? <Icon name="loader" size={14} className="animate-spin" /> : <Icon name="play" size={14} className="ml-1" />}
              {previewing ? 'Loading Preview...' : 'Preview Voice'}
            </button>
          </div>

        </div>
      </div>

    </div>
  );
}
