import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import Icon from '../components/Icon';
import GridContainer from '../components/layout/GridContainer';
import PageHeader from '../components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '../components/Card';
import Button from '../components/Button';
import Skeleton from '../components/Skeleton';
import { toast } from 'sonner';

export default function Profile() {
  const [profile, setProfile] = useState(null);
  const [captionStyles, setCaptionStyles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();
  
  const [ytStatus, setYtStatus] = useState(null);

  // Editable settings
  const [displayName, setDisplayName] = useState('');
  const [channelName, setChannelName] = useState('');
  const [defaultCta, setDefaultCta] = useState('');
  const [defaultNiche, setDefaultNiche] = useState('');
  const [captionStyle, setCaptionStyle] = useState('');
  const [wmEnabled, setWmEnabled] = useState(true);
  const [wmOpacity, setWmOpacity] = useState(0.4);
  const [wmPosition, setWmPosition] = useState('bottom_right');
  const [wmScale, setWmScale] = useState(0.12);
  
  const [defaultVoiceId, setDefaultVoiceId] = useState('en-US-ChristopherNeural');
  const [contentTone, setContentTone] = useState('casual');
  const [nicheKeywords, setNicheKeywords] = useState('');
  const [titleStylePreference, setTitleStylePreference] = useState('curiosity');
  const [hashtagSet, setHashtagSet] = useState('');
  const [autoApprove, setAutoApprove] = useState(false);

  // AI Model Settings
  const [modelsData, setModelsData] = useState(null);
  const [selectedProvider, setSelectedProvider] = useState('ollama');
  const [selectedModel, setSelectedModel] = useState('qwen2.5-coder:7b');
  const [savingModel, setSavingModel] = useState(false);

  const load = async () => {
    try {
      const [prof, styles, yt, models] = await Promise.all([
        api.getProfile(), 
        api.getCaptionStyles(),
        api.getYoutubeStatus(),
        api.getModels().catch(() => null)
      ]);
      setProfile(prof);
      setCaptionStyles(styles || []);
      setYtStatus(yt);
      if (models) {
        setModelsData(models);
        if (models.user_preference?.preferred_ai_provider) {
          setSelectedProvider(models.user_preference.preferred_ai_provider);
        }
        if (models.user_preference?.preferred_ai_model) {
          setSelectedModel(models.user_preference.preferred_ai_model);
        }
      }
      setDisplayName(prof?.display_name || '');
      setChannelName(prof?.channel_name || '');
      setDefaultCta(prof?.default_cta || '');
      setDefaultNiche(prof?.default_niche || 'science_wow');
      setCaptionStyle(prof?.caption_style || 'bold_centered');
      setWmEnabled(prof?.watermark_enabled ?? true);
      setWmOpacity(prof?.watermark_opacity ?? 0.4);
      setWmPosition(prof?.watermark_position || 'bottom_right');
      setWmScale(prof?.watermark_scale ?? 0.12);
      setDefaultVoiceId(prof?.default_voice_id || 'en-US-ChristopherNeural');
      setContentTone(prof?.content_tone || 'casual');
      setNicheKeywords((prof?.niche_keywords || []).join(', '));
      setTitleStylePreference(prof?.title_style_preference || 'curiosity');
      setHashtagSet((prof?.hashtag_set || []).join(', '));
      setAutoApprove(prof?.auto_approve ?? false);
    } catch (e) { 
      console.error(e); 
    }
  };

  const saveAiModel = async () => {
    setSavingModel(true);
    try {
      await api.updateAiSettings({ provider: selectedProvider, model: selectedModel });
      toast.success(`Active AI model set to ${selectedModel} via ${selectedProvider.toUpperCase()}`);
      const m = await api.getModels();
      setModelsData(m);
    } catch (e) {
      toast.error('Failed to update AI model: ' + e.message);
    } finally {
      setSavingModel(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    try {
      const prof = await api.updateProfile({
        display_name: displayName,
        channel_name: channelName,
        default_cta: defaultCta,
        default_niche: defaultNiche,
        caption_style: captionStyle,
        watermark_enabled: wmEnabled,
        watermark_opacity: wmOpacity,
        watermark_position: wmPosition,
        watermark_scale: wmScale,
        default_voice_id: defaultVoiceId,
        content_tone: contentTone,
        niche_keywords: nicheKeywords.split(',').map(s => s.trim()).filter(Boolean),
        title_style_preference: titleStylePreference,
        hashtag_set: hashtagSet.split(',').map(s => s.trim()).filter(Boolean),
        auto_approve: autoApprove,
      });
      setProfile(prof);
      toast.success('Channel preferences saved successfully!');
    } catch (e) { 
      console.error(e); 
      toast.error('Save failed: ' + e.message); 
    } finally { 
      setSaving(false); 
    }
  };

  const uploadLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const prof = await api.uploadLogo(file);
      setProfile(prof);
      toast.success('Channel logo uploaded successfully!');
    } catch (e) { 
      console.error(e); 
      toast.error('Logo upload failed.'); 
    } finally { 
      setUploading(false); 
    }
  };

  const removeLogo = async () => {
    try {
      const prof = await api.deleteLogo();
      setProfile(prof);
      toast.success('Watermark removed');
    } catch (e) { 
      console.error(e); 
    }
  };

  const handleYoutubeConnect = async () => {
    try {
      // get auth url from backend
      const res = await api.getYoutubeAuthUrl();
      window.location.href = res.auth_url;
    } catch (e) {
      toast.error('Failed to start YouTube authentication');
    }
  };

  const handleYoutubeDisconnect = async () => {
    try {
      await api.disconnectYoutube();
      setYtStatus({ connected: false });
      toast.success('YouTube disconnected');
    } catch (e) {
      toast.error('Failed to disconnect YouTube');
    }
  };

  if (!profile) {
    return (
      <GridContainer>
        <div className="space-y-6">
          <Skeleton height="60px" rounded="rounded-xl" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-4">
              <Skeleton height="360px" rounded="rounded-xl" />
            </div>
            <div className="lg:col-span-8 space-y-6">
              <Skeleton height="200px" rounded="rounded-xl" />
              <Skeleton height="200px" rounded="rounded-xl" />
            </div>
          </div>
        </div>
      </GridContainer>
    );
  }

  return (
    <GridContainer>
      <div className="space-y-6">
        <PageHeader
          title="Studio Settings"
          description="Configure brand identity, watermark overlay, AI generation defaults, and subtitle styling."
          actions={
            <Button
              variant="primary"
              size="sm"
              icon={saving ? 'loader' : 'check'}
              onClick={save}
              disabled={saving}
              loading={saving}
              className="shadow-brand-glow"
            >
              {saving ? 'Saving...' : 'Save Preferences'}
            </Button>
          }
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT COLUMN: Watermark & Brand Simulator (4 cols) */}
          <div className="lg:col-span-4 space-y-6 sticky top-20">
            <Card variant="surface">
              <CardHeader
                title={
                  <CardTitle icon={<Icon name="image" size={16} className="text-brand-red" />}>
                    Watermark Overlay
                  </CardTitle>
                }
              />
              <CardContent className="space-y-4">
                {/* 9:16 Interactive Watermark Simulator */}
                <div 
                  className="w-full aspect-[9/16] relative bg-black rounded-xl border border-border overflow-hidden cursor-pointer group shadow-inner flex items-center justify-center select-none"
                  onClick={() => fileRef.current?.click()}
                  title="Click to change logo"
                >
                  {/* Subtle video mock frame */}
                  <div className="absolute top-3 inset-x-3 flex justify-between pointer-events-none opacity-25">
                    <span className="text-[9px] font-mono text-white">9:16 SIMULATOR</span>
                    <span className="w-2 h-2 rounded-full bg-brand-red" />
                  </div>

                  {profile.logo_path ? (
                    <img
                      src={`/static/logos/${profile.logo_path.split('/').pop()}`}
                      alt="Watermark Logo"
                      className="absolute pointer-events-none transition-all duration-200"
                      style={{
                        width: `${Math.max(10, Math.min(50, wmScale * 100))}%`,
                        opacity: wmEnabled ? wmOpacity : 0,
                        ...(wmPosition.includes('top') ? { top: '24px' } : { bottom: '24px' }),
                        ...(wmPosition.includes('left') ? { left: '16px' } : { right: '16px' })
                      }}
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-text-muted opacity-60 group-hover:opacity-100 group-hover:text-brand-red transition-all">
                      <Icon name="upload" size={28} />
                      <span className="text-xs font-bold font-mono">Upload PNG Logo</span>
                    </div>
                  )}

                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-white text-xs font-bold bg-canvas/80 px-3 py-1 rounded-lg border border-white/10">
                      {profile.logo_path ? 'Change PNG' : 'Upload PNG'}
                    </span>
                  </div>
                </div>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={uploadLogo} aria-hidden="true" />

                <div className="flex gap-2">
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    icon={uploading ? 'loader' : 'upload'} 
                    className="flex-1"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    loading={uploading}
                  >
                    Upload Logo
                  </Button>
                  {profile.logo_path && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      icon="trash" 
                      className="hover:text-danger hover:bg-danger/10"
                      onClick={removeLogo}
                      title="Remove watermark"
                    />
                  )}
                </div>

                <p className="text-[11px] text-text-muted text-center leading-relaxed">
                  Transparent PNG logo burned into rendered video output.
                </p>
              </CardContent>
            </Card>

            {/* Watermark Controls */}
            <Card variant="surface">
              <CardHeader
                title={
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-bold uppercase tracking-wider text-text-muted">Overlay Settings</span>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="accent-brand-red w-3.5 h-3.5" 
                        checked={wmEnabled} 
                        onChange={e => setWmEnabled(e.target.checked)} 
                      />
                      <span className="text-xs font-semibold text-text-primary">Enable</span>
                    </label>
                  </div>
                }
              />
              <CardContent className="space-y-4">
                {wmEnabled && (
                  <>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-text-muted mb-1.5">Position</label>
                      <select 
                        className="w-full bg-surface-input border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:border-brand-red focus:outline-none"
                        value={wmPosition} 
                        onChange={e => setWmPosition(e.target.value)}
                      >
                        <option value="bottom_right">Bottom Right</option>
                        <option value="bottom_left">Bottom Left</option>
                        <option value="top_right">Top Right</option>
                        <option value="top_left">Top Left</option>
                      </select>
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider text-text-muted mb-1">
                        <span>Opacity</span>
                        <span className="font-mono text-text-primary">{Math.round(wmOpacity * 100)}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0.1" 
                        max="1.0" 
                        step="0.05" 
                        value={wmOpacity} 
                        onChange={e => setWmOpacity(parseFloat(e.target.value))}
                        className="w-full accent-brand-red"
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* RIGHT COLUMN: Settings Forms (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* AI Model & Inference Provider Settings */}
            <Card variant="surface" className="border-brand-red/30">
              <CardHeader
                title={
                  <div className="flex items-center justify-between w-full">
                    <CardTitle icon={<Icon name="cpu" size={16} className="text-brand-red" />}>
                      AI Intelligence & LLM Selection
                    </CardTitle>
                    <span className="text-[10px] font-mono uppercase tracking-wider bg-brand-red/10 text-brand-red px-2 py-0.5 rounded border border-brand-red/20 font-bold">
                      {selectedProvider === 'ollama' ? '⚡ Local Inference' : '☁️ Cloud Inference'}
                    </span>
                  </div>
                }
              />
              <CardContent className="space-y-4">
                <p className="text-xs text-text-muted">
                  Choose which language model powers idea generation and structured 3-act storytelling. 
                  Local Ollama models run completely free on your local GPU/CPU; cloud providers utilize external APIs.
                </p>

                {/* Provider Selector Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[
                    { id: 'ollama', label: 'Ollama', sub: 'Local Offline', isLocal: true },
                    { id: 'gemini', label: 'Gemini', sub: 'Google AI', isLocal: false },
                    { id: 'groq', label: 'Groq', sub: 'Llama 3.3', isLocal: false },
                    { id: 'openrouter', label: 'OpenRouter', sub: 'DeepSeek / Multi', isLocal: false },
                  ].map(p => {
                    const isAvail = modelsData?.providers?.[p.id]?.available;
                    const isSelected = selectedProvider === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelectedProvider(p.id);
                          const provModels = modelsData?.providers?.[p.id]?.models || [];
                          if (provModels.length > 0 && !provModels.includes(selectedModel)) {
                            setSelectedModel(provModels[0]);
                          }
                        }}
                        className={`p-3 rounded-xl border text-left transition-all relative select-none ${
                          isSelected 
                            ? 'bg-brand-red/10 border-brand-red shadow-brand-glow text-text-primary' 
                            : 'bg-surface-input border-border hover:border-text-muted text-text-secondary'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold">{p.label}</span>
                          <span className={`w-2 h-2 rounded-full ${isAvail ? 'bg-success' : 'bg-text-muted'}`} />
                        </div>
                        <span className="text-[10px] text-text-muted block leading-tight">{p.sub}</span>
                        <span className="text-[9px] font-mono mt-1.5 block text-text-secondary">
                          {isAvail ? (p.isLocal ? '● Installed' : '● Ready') : '○ Unconfigured'}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Model Selector for chosen Provider */}
                <div className="bg-elevated p-3.5 rounded-xl border border-border space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-text-muted mb-1">
                        Active Model ({selectedProvider.toUpperCase()})
                      </label>
                      <div className="text-xs text-text-secondary">
                        {selectedProvider === 'ollama' ? (
                          <span>Installed model on your machine: <code className="text-brand-red font-mono">qwen2.5-coder:7b</code></span>
                        ) : (
                          <span>Cloud model managed via configured API key</span>
                        )}
                      </div>
                    </div>

                    <Button
                      variant="primary"
                      size="sm"
                      onClick={saveAiModel}
                      loading={savingModel}
                      disabled={savingModel}
                      className="shrink-0 shadow-brand-glow"
                    >
                      Apply Active Model
                    </Button>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    {(modelsData?.providers?.[selectedProvider]?.models || ['qwen2.5-coder:7b']).map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setSelectedModel(m)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium border transition-colors ${
                          selectedModel === m
                            ? 'bg-brand-red text-white border-brand-red shadow-sm'
                            : 'bg-surface-input border-border text-text-secondary hover:text-text-primary hover:border-text-muted'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Brand & Content Identity */}
            <Card variant="surface">
              <CardHeader
                title={
                  <CardTitle icon={<Icon name="film" size={16} className="text-brand-red" />}>
                    Channel Identity & Narrative Defaults
                  </CardTitle>
                }
              />
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-1.5">Creator Display Name</label>
                    <input 
                      className="w-full bg-surface-input border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:border-brand-red focus:outline-none"
                      value={displayName} 
                      onChange={e => setDisplayName(e.target.value)} 
                      placeholder="e.g. Alex Rivera" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-1.5">Channel Name</label>
                    <input 
                      className="w-full bg-surface-input border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:border-brand-red focus:outline-none"
                      value={channelName} 
                      onChange={e => setChannelName(e.target.value)} 
                      placeholder="e.g. Science Wow Shorts" 
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-1.5">Default Call-to-Action (CTA)</label>
                  <input 
                    className="w-full bg-surface-input border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:border-brand-red focus:outline-none"
                    value={defaultCta} 
                    onChange={e => setDefaultCta(e.target.value)} 
                    placeholder="e.g. Subscribe for daily mind-blowing facts!" 
                  />
                  <p className="text-[11px] text-text-muted mt-1">Appended to the final scene narration of every generated Short.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-1.5">Default Niche</label>
                    <select 
                      className="w-full bg-surface-input border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:border-brand-red focus:outline-none"
                      value={defaultNiche} 
                      onChange={e => setDefaultNiche(e.target.value)}
                    >
                      <option value="science_wow">Science Wow</option>
                      <option value="kids_facts">Kids Facts</option>
                      <option value="tech_mysteries">Tech Mysteries</option>
                      <option value="history_facts">History Facts</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-1.5">Narrative Script Tone</label>
                    <select 
                      className="w-full bg-surface-input border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:border-brand-red focus:outline-none"
                      value={contentTone} 
                      onChange={e => setContentTone(e.target.value)}
                    >
                      <option value="casual">Casual & Energetic</option>
                      <option value="dramatic">Dramatic & Mysterious</option>
                      <option value="educational">Educational & Clear</option>
                      <option value="humorous">Humorous & Witty</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* AI Generation Preferences */}
            <Card variant="surface">
              <CardHeader
                title={
                  <CardTitle icon={<Icon name="sparkles" size={16} className="text-brand-red" />}>
                    AI Voice & Prompt Preferences
                  </CardTitle>
                }
              />
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-1.5">Default Voice Talent (Edge-TTS)</label>
                    <select 
                      className="w-full bg-surface-input border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:border-brand-red focus:outline-none"
                      value={defaultVoiceId} 
                      onChange={e => setDefaultVoiceId(e.target.value)}
                    >
                      <optgroup label="US English">
                        <option value="en-US-ChristopherNeural">Christopher (Male - Authoritative)</option>
                        <option value="en-US-GuyNeural">Guy (Male - Casual)</option>
                        <option value="en-US-EricNeural">Eric (Male - Energetic)</option>
                        <option value="en-US-JennyNeural">Jenny (Female - Clear)</option>
                        <option value="en-US-AriaNeural">Aria (Female - Expressive)</option>
                      </optgroup>
                      <optgroup label="UK English">
                        <option value="en-GB-SoniaNeural">Sonia (Female)</option>
                        <option value="en-GB-RyanNeural">Ryan (Male)</option>
                      </optgroup>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-1.5">Title Style Formula</label>
                    <select 
                      className="w-full bg-surface-input border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:border-brand-red focus:outline-none"
                      value={titleStylePreference} 
                      onChange={e => setTitleStylePreference(e.target.value)}
                    >
                      <option value="curiosity">Curiosity Gap ("The Secret Behind...")</option>
                      <option value="factual">Factual & Punchy</option>
                      <option value="clickbait">High-Stakes Hook</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-1.5">Topic Keyword Anchors</label>
                    <input 
                      className="w-full bg-surface-input border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:border-brand-red focus:outline-none font-mono"
                      value={nicheKeywords} 
                      onChange={e => setNicheKeywords(e.target.value)} 
                      placeholder="space, astrophysics, mystery" 
                    />
                    <p className="text-[10px] text-text-muted mt-1">Comma-separated keywords guiding LLM idea brainstorming.</p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-1.5">Default YouTube Hashtags</label>
                    <input 
                      className="w-full bg-surface-input border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:border-brand-red focus:outline-none font-mono"
                      value={hashtagSet} 
                      onChange={e => setHashtagSet(e.target.value)} 
                      placeholder="shorts, viral, science" 
                    />
                    <p className="text-[10px] text-text-muted mt-1">Auto-appended to YouTube descriptions.</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Subtitle Caption Presets Picker */}
            <Card variant="surface">
              <CardHeader
                title={
                  <CardTitle icon={<Icon name="video" size={16} className="text-brand-red" />}>
                    Default Subtitle Style
                  </CardTitle>
                }
              />
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {(captionStyles || []).map(cs => {
                    const isSelected = captionStyle === cs.key;
                    return (
                      <div
                        key={cs.key}
                        onClick={() => setCaptionStyle(cs.key)}
                        className={`p-3.5 rounded-xl border cursor-pointer transition-all select-none ${
                          isSelected
                            ? 'bg-elevated border-brand-red shadow-brand-glow ring-1 ring-brand-red'
                            : 'bg-surface border-border hover:border-border-strong'
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold text-xs text-text-primary">{cs.name}</span>
                          {isSelected && <Icon name="check" size={14} className="text-brand-red" />}
                        </div>
                        <p className="text-[10px] text-text-secondary line-clamp-1 mb-3">
                          {cs.description}
                        </p>
                        <div className="w-full h-12 bg-black rounded-lg border border-border/60 flex items-center justify-center p-2 text-center overflow-hidden">
                          <span style={cssToObj(cs.preview_css)} className="text-xs">
                            SUBTITLE SAMPLE
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Integrations */}
            <Card variant="surface">
              <CardHeader
                title={
                  <CardTitle icon={<Icon name="link" size={16} className="text-brand-red" />}>
                    Integrations
                  </CardTitle>
                }
              />
              <CardContent>
                <div className="flex items-center justify-between p-4 bg-elevated rounded-xl border border-border">
                  <div className="flex items-center gap-3">
                    <Icon name="youtube" size={24} className="text-[#FF0000]" />
                    <div>
                      <h4 className="text-sm font-bold text-text-primary">YouTube Account</h4>
                      <p className="text-[11px] text-text-muted">
                        {ytStatus?.connected 
                          ? `Connected to ${ytStatus.channel_title || 'Channel'}` 
                          : 'Not connected. Connect to automatically upload Shorts.'}
                      </p>
                    </div>
                  </div>
                  <Button 
                    variant={ytStatus?.connected ? 'secondary' : 'primary'} 
                    size="sm" 
                    onClick={ytStatus?.connected ? handleYoutubeDisconnect : handleYoutubeConnect}
                  >
                    {ytStatus?.connected ? 'Disconnect' : 'Connect'}
                  </Button>
                </div>
              </CardContent>
            </Card>

          </div>

        </div>
      </div>
    </GridContainer>
  );
}

function cssToObj(css) {
  if (!css) return {};
  const obj = {};
  css.split(';').filter(Boolean).forEach(rule => {
    const [prop, ...v] = rule.split(':');
    if (!prop || !v.length) return;
    const camel = prop.trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    obj[camel] = v.join(':').trim();
  });
  return obj;
}
