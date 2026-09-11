const API_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '';
const BASE = API_URL ? `${API_URL.replace(/\/$/, '')}/api` : '/api';

let authToken = localStorage.getItem('autotube_auth_token') || null;

export const setAuthToken = (token) => {
  authToken = token;
  if (token) {
    localStorage.setItem('autotube_auth_token', token);
  } else {
    localStorage.removeItem('autotube_auth_token');
  }
};

async function request(endpoint, options = {}) {
  const url = `${BASE}${endpoint}`;
  const headers = { ...options.headers };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  // Don't set Content-Type for FormData (browser sets the multipart boundary)
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    if (res.status === 401) {
      setAuthToken(null);
      window.location.href = '/login';
      return;
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `API ${res.status}: ${res.statusText}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  // ── Profile ──────────────────────────────────────
  getProfile:        ()      => request('/profile/'),
  updateProfile:     (data)  => request('/profile/', { method: 'PATCH', body: JSON.stringify(data) }),
  uploadLogo:        (file)  => { const fd = new FormData(); fd.append('file', file); return request('/profile/logo', { method: 'POST', body: fd }); },
  deleteLogo:        ()      => request('/profile/logo', { method: 'DELETE' }),
  getCaptionStyles:  ()      => request('/profile/caption-styles'),

  // ── Channels ─────────────────────────────────────
  getChannels:    () => request('/channels/'),
  createChannel:  (d) => request('/channels/', { method: 'POST', body: JSON.stringify(d) }),

  // ── Ideas ────────────────────────────────────────
  getIdeas:       (channelId) => request(`/ideas/${channelId ? '?channel_id=' + channelId : ''}`),
  generateIdeas:  (channelId, count, niche) => request('/ideas/generate', { method: 'POST', body: JSON.stringify({ channel_id: channelId, count, niche }) }),
  discardIdea:    (id) => request(`/ideas/${id}/discard`, { method: 'POST' }),

  // ── Scripts ──────────────────────────────────────
  getScripts:     (ideaId) => request(`/scripts/${ideaId ? '?idea_id=' + ideaId : ''}`),
  getScript:      (id) => request(`/scripts/${id}`),
  generateScript: (ideaId, language = 'en', locale = 'US') => request(`/scripts/generate/${ideaId}?language=${language}&locale=${locale}`, { method: 'POST' }),
  regenerateScript: (id) => request(`/scripts/${id}/regenerate`, { method: 'POST' }),
  updateScript:   (id, data) => request(`/scripts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  discardScript:  (id) => request(`/scripts/${id}/discard`, { method: 'POST' }),

  // ── Videos ───────────────────────────────────────
  getVideos:      () => request('/videos/'),
  getVideo:       (id) => request(`/videos/${id}`),
  getVideoProgress: (id) => request(`/videos/${id}/progress`),
  renderVideo:    (scriptId, style, captionStyle, customCta, voiceOverride) => request('/videos/render', {
    method: 'POST',
    body: JSON.stringify({ script_id: scriptId, style, caption_style: captionStyle, custom_cta: customCta, voice_override: voiceOverride }),
  }),
  updateVideo:    (id, data) => request(`/videos/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  approveVideo:   (id, data = null) => {
    const opts = { method: 'PATCH' };
    if (data) opts.body = JSON.stringify(data);
    return request(`/videos/${id}/approve`, opts);
  },
  rejectVideo:    (id) => request(`/videos/${id}/reject`, { method: 'PATCH' }),
  uploadVideo:    (id, meta) => request(`/videos/${id}/upload`, { method: 'POST', body: JSON.stringify(meta) }),
  cancelVideo:    (id) => request(`/videos/${id}/cancel`, { method: 'POST' }),
  pauseVideo:     (id) => request(`/videos/${id}/pause`, { method: 'POST' }),
  resumeVideo:    (id) => request(`/videos/${id}/resume`, { method: 'POST' }),

  // ── Analytics ────────────────────────────────────
  getDashboardAnalytics: () => request('/analytics/'),
  getTopVideos:   (limit = 5) => request(`/analytics/summary/top-videos?limit=${limit}`),
  getAnalytics:   (videoId) => request(`/analytics/${videoId}`),
  analyticsCleanup: () => request('/analytics/cleanup', { method: 'POST' }),
  getSystemLogs:   (lines = 100) => request(`/analytics/logs?lines=${lines}`),

  // ── Assets ───────────────────────────────────────
  searchAssets:   (query, count = 8) => request(`/assets/search?query=${encodeURIComponent(query)}&count=${count}`),
  assignAssetToScene: (sceneId, assetData) => request(`/assets/scenes/${sceneId}/assign`, { method: 'POST', body: JSON.stringify(assetData) }),

  // ── System & Compute Plane ────────────────────────
  getSystemHealth: () => request('/system/health'),
  getComputeTelemetry: () => request('/jobs/telemetry'),

  // ── Integrations (YouTube) ────────────────────────
  getYoutubeAuthUrl: () => request('/youtube/auth'),
  getYoutubeStatus: () => request('/youtube/status'),
  disconnectYoutube: () => request('/youtube/disconnect', { method: 'DELETE' }),
};
