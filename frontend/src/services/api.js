
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

/** Return the resolved API base URL (for diagnostics / boot checks). */
export const getApiBase = () => BASE;

async function request(endpoint, options = {}) {
  const url = `${BASE}${endpoint}`;
  const headers = { ...options.headers };

  // We rely on App.jsx onAuthStateChange to keep authToken up to date
  // so we don't block the network request on getSession() every time.
  let activeToken = authToken;

  if (activeToken) {
    headers['Authorization'] = `Bearer ${activeToken}`;
  }

  // Don't set Content-Type for FormData (browser sets the multipart boundary)
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  // Setup timeout (default 60s)
  const timeoutMs = options.timeout || 60000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...options, headers, signal: controller.signal });
    clearTimeout(timeoutId);

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
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw error;
  }
}

export const api = {
  // ── Auth & Users ─────────────────────────────────
  register:          (data)  => request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login:             (data)  => request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  getMe:             ()      => request('/auth/me'),
  getModels:         ()      => request('/auth/models'),
  updateAiSettings:  (data)  => request('/auth/ai-settings', { method: 'PATCH', body: JSON.stringify(data) }),

  // ── Profile ──────────────────────────────────────
  getProfile:        ()      => request('/profile/'),
  updateProfile:     (data)  => request('/profile/', { method: 'PATCH', body: JSON.stringify(data) }),
  uploadLogo:        (file)  => { const fd = new FormData(); fd.append('file', file); return request('/profile/logo', { method: 'POST', body: fd }); },
  deleteLogo:        ()      => request('/profile/logo', { method: 'DELETE' }),
  getCaptionStyles:  ()      => request('/profile/caption-styles'),

  // ── Channels ─────────────────────────────────────
  getChannels:    () => request('/channels/'),
  getChannel:     (id) => request(`/channels/${id}`),
  createChannel:  (d) => request('/channels/', { method: 'POST', body: JSON.stringify(d) }),
  updateChannel:  (id, d) => request(`/channels/${id}`, { method: 'PATCH', body: JSON.stringify(d) }),
  deleteChannel:  (id) => request(`/channels/${id}`, { method: 'DELETE' }),

  // ── Ideas ────────────────────────────────────────
  getIdeas:       (channelId) => request(`/ideas/${channelId ? '?channel_id=' + channelId : ''}`),
  createIdea:     (data) => request('/ideas/', { method: 'POST', body: JSON.stringify(data) }),
  improveIdea:    (topic, channel_id = null) => request('/ideas/improve', { method: 'POST', body: JSON.stringify({ topic, channel_id }) }),
  generateIdeas:  (channelId, count, data) => request('/ideas/generate', { method: 'POST', body: JSON.stringify({ channel_id: channelId, count, ...(typeof data === 'string' ? { niche: data } : data) }), timeout: 120000 }),
  discardIdea:    (id) => request(`/ideas/${id}/discard`, { method: 'POST' }),

  // ── Content Intelligence (Phase 2/3) ─────────────
  getRecommendedIdea: (channelId) => request(`/ideas/recommend-next${channelId ? '?channel_id=' + channelId : ''}`, { timeout: 120000 }),
  dismissIdea: (id, reason) => request(`/ideas/${id}/dismiss`, { method: 'POST', body: JSON.stringify({ reason }) }),

  // ── Scripts ──────────────────────────────────────
  getScripts:     (param1, param2) => {
      let channelId = typeof param1 === 'string' ? param1 : (param1?.channelId || param1?.channel_id);
      let ideaId = typeof param1 === 'object' ? (param1?.idea_id || param1?.ideaId) : param2;
      const params = new URLSearchParams();
      if (channelId) params.append('channel_id', channelId);
      if (ideaId) params.append('idea_id', ideaId);
      const qs = params.toString();
      return request(`/scripts/${qs ? '?' + qs : ''}`);
  },
  getScript:        (id) => request(`/scripts/${id}`),
  generateScript:   (ideaId, language = 'en', locale = 'US', contentType = 'short', targetDuration = 30) => request(`/scripts/generate/${ideaId}?language=${language}&locale=${locale}&content_type=${contentType}&target_duration_seconds=${targetDuration}`, { method: 'POST', timeout: 120000 }),
  regenerateScript: (id) => request(`/scripts/${id}/regenerate`, { method: 'POST', timeout: 120000 }),
  updateScript:   (id, data) => request(`/scripts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  discardScript:  (id) => request(`/scripts/${id}/discard`, { method: 'POST' }),

  // ── Assets & Scenes ──────────────────────────────
  searchAssets:   (query) => request(`/assets/search?query=${encodeURIComponent(query)}`),
  assignAssetToScene: (sceneId, asset) => request(`/scenes/${sceneId}/asset`, { method: 'POST', body: JSON.stringify(asset) }),
  generateAsset:  (prompt, type = 'IMAGE') => request(`/assets/generate`, { method: 'POST', body: JSON.stringify({ prompt, type }), timeout: 120000 }),

  // ── Videos ───────────────────────────────────────
  getVideos:      (channelId) => request(`/videos/${channelId ? '?channel_id=' + channelId : ''}`),
  getVideo:       (id) => request(`/videos/${id}`),
  getVideoPreviewUrl: (id) => request(`/videos/${id}/preview-url`),
  previewVideo:   (id) => request(`/videos/${id}/preview`),
  getVideoProgress: (id) => request(`/videos/${id}/progress`),
  renderVideo:    (scriptId, style, captionStyle, customCta, voiceOverride, visualStrategy = "auto") => request('/videos/render', {
    method: 'POST',
    body: JSON.stringify({ script_id: scriptId, style, caption_style: captionStyle, custom_cta: customCta, voice_override: voiceOverride, visual_strategy: visualStrategy }),
  }),
  /** Full format-aware render (Phase 4) */
  renderVideoFull: (opts) => request('/videos/render', {
    method: 'POST',
    body: JSON.stringify(opts),
  }),
  /** Download video file (Phase 10) — returns a fetch Response for blob download */
  downloadVideo:  (id) => {
    const token = localStorage.getItem('autotube_auth_token');
    return fetch(`${BASE}/videos/${id}/download`, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    });
  },
  updateVideo:    (id, data) => request(`/videos/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  generateVideoMetadata: (id) => request(`/videos/${id}/generate-metadata`, { method: 'POST', timeout: 120000 }),
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
  getDashboardAnalytics: (channelId) => request(`/analytics/${channelId ? '?channel_id=' + channelId : ''}`),
  getTopVideos:   (channelId, limit = 5) => {
      const qs = new URLSearchParams({ limit });
      if (channelId) qs.append('channel_id', channelId);
      return request(`/analytics/summary/top-videos?${qs.toString()}`);
  },
  getAnalytics:   (videoId) => request(`/analytics/${videoId}`),
  analyticsCleanup: () => request('/analytics/cleanup', { method: 'POST' }),
  getSystemLogs:   (lines = 100) => request(`/analytics/logs?lines=${lines}`),

  // ── Assets ───────────────────────────────────────
  searchAssets:   (query, count = 8) => request(`/assets/search?query=${encodeURIComponent(query)}&count=${count}`),
  assignAssetToScene: (sceneId, assetData) => request(`/assets/scenes/${sceneId}/assign`, { method: 'POST', body: JSON.stringify(assetData) }),
  generateAsset:  (prompt, mode) => request(`/assets/generate?prompt=${encodeURIComponent(prompt)}&mode=${mode}`, { method: 'POST' }),

  // ── System & Compute Plane ────────────────────────
  getSystemHealth: () => request('/system/health'),
  getSystemRuntime: () => request('/system/runtime'),
  getComputeTelemetry: () => request('/jobs/telemetry'),
  getJobs:        (params = '') => request(`/jobs/${params}`),
  getJob:         (id) => request(`/jobs/${id}`),
  createJob:      (data) => request('/jobs/', { method: 'POST', body: JSON.stringify(data) }),
  cancelJob:      (id) => request(`/jobs/${id}/cancel`, { method: 'POST' }),

  // ── Integrations (YouTube & Meta/TikTok) ────────────────────────
  getIntegrationStatus: (platform) => request(`/integrations/${platform}/status`),
  getYoutubeAuthUrl: () => request('/youtube/auth'),
  getYoutubeStatus: () => request('/youtube/status'),
  getYoutubeConfigStatus: () => request('/youtube/config-status'),
  updateYoutubeConfig: (data) => request('/system/youtube-config', { method: 'POST', body: JSON.stringify(data) }),
  refreshYoutubeToken: () => request('/youtube/refresh', { method: 'POST' }),
  disconnectYoutube: () => request('/youtube/disconnect', { method: 'DELETE' }),
  uploadYoutubeSecrets: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const token = localStorage.getItem('autotube_auth_token');

    // We use standard fetch here because the `request` wrapper hardcodes Content-Type: application/json
    const baseUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '';
    const formattedBase = baseUrl ? `${baseUrl.replace(/\/$/, '')}/api` : '/api';

    const res = await fetch(`${formattedBase}/youtube/upload-secrets`, {
      method: 'POST',
      body: formData,
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.message || 'Failed to upload secrets');
    }
    return res.json();
  },

  // ── TTS Voices ────────────────────────────────────
  getVoices: (language) => request(`/voices/${language ? '?language=' + language : ''}`),

  // ── Costs ─────────────────────────────────────────
  getCostSummary: () => request('/costs/summary'),
  getJobCosts: (jobId) => request(`/costs/jobs/${jobId}`),

  // ── Multi-Platform Publishing ────────────────────────
  publishUniversal: (payload) => request('/publishing/compose', { method: 'POST', body: JSON.stringify(payload) }),

  // ── Assets ─────────────────────────────────────────
  searchAssets: (query) => request(`/assets/search?query=${encodeURIComponent(query)}`),
  assignAssetToScene: (sceneId, assetData) => request(`/assets/scenes/${sceneId}/assign`, {
    method: 'POST',
    body: JSON.stringify(assetData)
  }),
  generateAsset: (prompt, mode) => request(`/assets/generate?prompt=${encodeURIComponent(prompt)}&mode=${encodeURIComponent(mode)}`, { method: 'POST' }),

  // ── Calendar ───────────────────────────────────────
  getCalendar: (startDate, endDate, channelId) => {
    const qs = new URLSearchParams({ start_date: startDate.toISOString(), end_date: endDate.toISOString() });
    if (channelId) qs.append('channel_id', channelId);
    return request(`/calendar/?${qs.toString()}`);
  },
  scheduleVideo: (payload) => request('/calendar/schedule', { method: 'POST', body: JSON.stringify(payload) }),
};
