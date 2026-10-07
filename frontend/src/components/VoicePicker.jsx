import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import Icon from './Icon';
import Skeleton from './Skeleton';

export default function VoicePicker({ selectedVoice, onSelect, language = 'en' }) {
  const [voices, setVoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(null);
  const [audio, setAudio] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        let data = [];
        if (api.getVoices) {
          data = await api.getVoices(language);
        } else {
          const res = await fetch(`/api/voices?language=${language}`);
          if (res.ok) data = await res.json();
        }
        setVoices(data);
      } catch (err) {
        console.error('Failed to fetch voices:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [language]);

  const handlePreview = (voiceId) => {
    if (audio) {
      audio.pause();
    }
    if (playing === voiceId) {
      setPlaying(null);
      setAudio(null);
      return;
    }
    setPlaying(voiceId);

    const url = `/api/voices/preview/${voiceId}`;
    const newAudio = new Audio(url);
    newAudio.onended = () => {
      setPlaying(null);
      setAudio(null);
    };
    newAudio.play().catch(e => {
      console.error(e);
      setPlaying(null);
    });
    setAudio(newAudio);
  };

  if (!loading && voices.length === 0) {
    return (
      <select
        className="w-full bg-surface-input border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:border-brand-red focus:outline-none"
        value={selectedVoice}
        onChange={e => onSelect(e.target.value)}
      >
        <option value="en-US-ChristopherNeural">Christopher (Male - Authoritative)</option>
        <option value="en-US-JennyNeural">Jenny (Female - Clear)</option>
        <option value="hi-IN-MadhurNeural">Madhur (Male - Hindi)</option>
        <option value="hi-IN-SwaraNeural">Swara (Female - Hindi)</option>
      </select>
    );
  }

  return (
    <div className="space-y-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
      {loading ? (
        <div className="space-y-2">
          <Skeleton height="60px" rounded="rounded-lg" />
          <Skeleton height="60px" rounded="rounded-lg" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {voices.map(voice => (
            <div
              key={voice.id}
              onClick={() => onSelect(voice.id)}
              className={`p-3 rounded-xl border cursor-pointer transition-all ${
                selectedVoice === voice.id
                  ? 'border-brand-red bg-brand-red/10 shadow-brand-glow'
                  : 'border-border bg-surface-input hover:border-brand-red/50'
              } flex justify-between items-center`}
            >
              <div className="flex flex-col">
                <span className="text-xs font-bold text-text-primary">{voice.name || voice.id}</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-text-muted capitalize">{voice.gender}</span>
                  <span className="text-[10px] bg-elevated px-1.5 py-0.5 rounded border border-border text-text-muted">
                    {voice.language}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePreview(voice.id);
                }}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  playing === voice.id ? 'bg-brand-red text-white' : 'bg-elevated text-text-primary hover:bg-border'
                }`}
              >
                <Icon name={playing === voice.id ? "square" : "play"} size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
