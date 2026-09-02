import { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import Icon from '../components/Icon';

export default function Profile() {
  const [profile, setProfile] = useState(null);
  const [captionStyles, setCaptionStyles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  // Editable fields
  const [displayName, setDisplayName] = useState('');
  const [channelName, setChannelName] = useState('');
  const [defaultCta, setDefaultCta] = useState('');
  const [defaultNiche, setDefaultNiche] = useState('');
  const [captionStyle, setCaptionStyle] = useState('');
  const [wmEnabled, setWmEnabled] = useState(true);
  const [wmOpacity, setWmOpacity] = useState(0.4);
  const [wmPosition, setWmPosition] = useState('bottom_right');
  const [wmScale, setWmScale] = useState(0.12);

  const load = async () => {
    try {
      const [prof, styles] = await Promise.all([api.getProfile(), api.getCaptionStyles()]);
      setProfile(prof);
      setCaptionStyles(styles);
      setDisplayName(prof.display_name || '');
      setChannelName(prof.channel_name || '');
      setDefaultCta(prof.default_cta || '');
      setDefaultNiche(prof.default_niche || 'science_wow');
      setCaptionStyle(prof.caption_style || 'bold_centered');
      setWmEnabled(prof.watermark_enabled ?? true);
      setWmOpacity(prof.watermark_opacity ?? 0.4);
      setWmPosition(prof.watermark_position || 'bottom_right');
      setWmScale(prof.watermark_scale ?? 0.12);
    } catch (e) { console.error(e); }
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
      });
      setProfile(prof);
      alert('Settings saved successfully!');
    } catch (e) { console.error(e); alert('Save failed.'); }
    finally { setSaving(false); }
  };

  const uploadLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const prof = await api.uploadLogo(file);
      setProfile(prof);
    } catch (e) { console.error(e); alert('Logo upload failed.'); }
    finally { setUploading(false); }
  };

  const removeLogo = async () => {
    try {
      const prof = await api.deleteLogo();
      setProfile(prof);
    } catch (e) { console.error(e); }
  };

  if (!profile) return (
    <div className="empty-state">
      <span className="spinner spinner-lg" />
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <p>Your profile, default CTA, caption style, and watermark preferences.</p>
        </div>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? <span className="spinner" /> : <Icon name="check" size={14} />}
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </div>

      <div className="profile-layout">
        {/* Left: Logo */}
        <div className="logo-panel">
          <button className="logo-frame" onClick={() => fileRef.current?.click()} aria-label="Upload logo">
            {profile.logo_path ? (
              <img src={`/static/logos/${profile.logo_path.split('/').pop()}`} alt="Channel Watermark Logo" />
            ) : (
              <Icon name="image" size={32} />
            )}
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={uploadLogo} aria-hidden="true" />
          
          <div className="flex gap-1 mt-1">
            <button className="btn btn-sm btn-secondary" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <span className="spinner" /> : <Icon name="upload" size={12} />}
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
            {profile.logo_path && (
              <button className="btn btn-sm btn-danger" onClick={removeLogo} aria-label="Remove logo">
                <Icon name="x" size={12} />
              </button>
            )}
          </div>
          
          <p className="text-xs text-muted" style={{ textAlign: 'center', lineHeight: 1.5, marginTop: 4 }}>
            This logo will be burned as a watermark into every rendered video.
          </p>
        </div>

        {/* Right: Settings form */}
        <div className="card">
          <h3 className="card-title mb-3">Profile Details</h3>

          <div className="row-2">
            <div className="field">
              <label className="label" htmlFor="disp-name">Display Name</label>
              <input id="disp-name" className="input" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your name" />
            </div>
            <div className="field">
              <label className="label" htmlFor="chan-name">Channel Name</label>
              <input id="chan-name" className="input" value={channelName} onChange={e => setChannelName(e.target.value)} placeholder="My YouTube Channel" />
            </div>
          </div>

          <div className="field">
            <label className="label" htmlFor="default-cta">Default Call-to-Action</label>
            <input id="default-cta" className="input" value={defaultCta} onChange={e => setDefaultCta(e.target.value)}
              placeholder="Follow for more amazing facts!" />
            <span className="hint">This text is appended at the end of every new script.</span>
          </div>

          <div className="row-2 mt-3">
            <div className="field">
              <label className="label" htmlFor="def-niche">Default Content Niche</label>
              <select id="def-niche" className="select" value={defaultNiche} onChange={e => setDefaultNiche(e.target.value)}>
                <option value="science_wow">Science Wow</option>
                <option value="kids_facts">Kids Facts</option>
                <option value="tech_mysteries">Tech Mysteries</option>
              </select>
            </div>
            <div className="field">
              <label className="label" htmlFor="wm-enable">Watermark Enabled</label>
              <select id="wm-enable" className="select" value={wmEnabled ? 'yes' : 'no'} onChange={e => setWmEnabled(e.target.value === 'yes')}>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
          </div>

          {wmEnabled && (
            <div className="row-2">
              <div className="field">
                <label className="label" htmlFor="wm-pos">Watermark Position</label>
                <select id="wm-pos" className="select" value={wmPosition} onChange={e => setWmPosition(e.target.value)}>
                  <option value="bottom_right">Bottom Right</option>
                  <option value="bottom_left">Bottom Left</option>
                  <option value="top_right">Top Right</option>
                  <option value="top_left">Top Left</option>
                </select>
              </div>
              <div className="field">
                <label className="label" htmlFor="wm-opacity">Opacity ({Math.round(wmOpacity * 100)}%)</label>
                <input id="wm-opacity" type="range" min="0.1" max="1.0" step="0.05" value={wmOpacity}
                  onChange={e => setWmOpacity(parseFloat(e.target.value))}
                  style={{ accentColor: 'var(--accent)' }} />
              </div>
            </div>
          )}

          <hr className="divider" />

          {/* Caption Style Picker */}
          <div className="flex justify-between items-center mb-2">
            <h3 className="card-title">Default Caption Style</h3>
          </div>
          <p className="hint mb-3">Choose how subtitles appear in your videos. You can override this per-render.</p>
          
          <div className="caption-grid">
            {captionStyles.map(cs => (
              <div key={cs.key}
                className={`caption-card${captionStyle === cs.key ? ' selected' : ''}`}
                onClick={() => setCaptionStyle(cs.key)}
                onKeyDown={e => e.key === 'Enter' && setCaptionStyle(cs.key)}
                role="radio" aria-checked={captionStyle === cs.key} tabIndex={0}
              >
                <div className="caption-card-name">{cs.name}</div>
                <div className="caption-card-desc">{cs.description}</div>
                <div className="caption-card-preview">
                  <span style={cssToObj(cs.preview_css)}>Sample Text</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
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
