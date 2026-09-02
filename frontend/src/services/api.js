const BASE = '/api';

async function request(endpoint, options = {}) {
  const url = `${BASE}${endpoint}`;
  const headers = { ...options.headers };

  // Don't set Content-Type for FormData (browser sets the multipart boundary)
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
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
  approveIdea:    (id) => request(`/ideas/${id}/approve`, { method: 'PATCH' }),
  rejectIdea:     (id) => request(`/ideas/${id}/reject`, { method: 'PATCH' }),

  // ── Scripts ──────────────────────────────────────
  getScripts:     (ideaId) => request(`/scripts/${ideaId ? '?idea_id=' + ideaId : ''}`),
  getScript:      (id) => request(`/scripts/${id}`),
  generateScript: (ideaId) => request(`/scripts/generate/${ideaId}`, { method: 'POST' }),

  // ── Videos ───────────────────────────────────────
  getVideos:      () => request('/videos/'),
  getVideo:       (id) => request(`/videos/${id}`),
  renderVideo:    (scriptId, style, captionStyle, customCta) => request('/videos/render', {
    method: 'POST',
    body: JSON.stringify({ script_id: scriptId, style, caption_style: captionStyle, custom_cta: customCta }),
  }),
  approveVideo:   (id) => request(`/videos/${id}/approve`, { method: 'PATCH' }),
  rejectVideo:    (id) => request(`/videos/${id}/reject`, { method: 'PATCH' }),
  uploadVideo:    (id, meta) => request(`/videos/${id}/upload`, { method: 'POST', body: JSON.stringify(meta) }),

  // ── Analytics ────────────────────────────────────
  getTopVideos:   (limit = 5) => request(`/analytics/summary/top-videos?limit=${limit}`),
  getAnalytics:   (videoId) => request(`/analytics/${videoId}`),
};
