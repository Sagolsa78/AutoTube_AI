import { create } from 'zustand';
import { api } from '../services/api';

const useContentStore = create((set, get) => ({
  ideas: [],
  scripts: [],
  videos: [],
  publications: [],
  loading: false,
  error: null,
  lastChannelId: null,

  fetchContent: async (channelId, force = false) => {
    // Avoid refetching if same channel and already fetched recently, unless forced
    if (!force && get().lastChannelId === channelId && get().videos.length > 0) {
       return;
    }

    set({ loading: true, error: null });
    try {
      const [ideas, scripts, videos] = await Promise.all([
        api.getIdeas(channelId).catch(() => []),
        api.getScripts(channelId).catch(() => []),
        api.getVideos(channelId).catch(() => [])
      ]);

      const safeIdeas = ideas || [];
      const safeScripts = scripts || [];
      const safeVideos = videos || [];

      // Link them together
      const ideasById = new Map(safeIdeas.map(i => [i.id, i]));
      const scriptsById = new Map(safeScripts.map(s => {
        return [s.id, { ...s, idea: ideasById.get(s.idea_id) }];
      }));

      const enrichedVideos = safeVideos.map(v => {
        const script = scriptsById.get(v.script_id);
        const idea = script?.idea;

        let derivedTitle = v.selected_title;
        if (!derivedTitle) {
          derivedTitle = idea?.topic || idea?.title || `Untitled · ${new Date(v.created_at).toLocaleDateString()}`;
        }

        return {
          ...v,
          script,
          derivedTitle
        };
      });

      // Extract publications from videos
      const publications = [];
      enrichedVideos.forEach(v => {
        if (v.publications && v.publications.length > 0) {
           publications.push(...v.publications.map(p => ({ ...p, video: v })));
        } else if (v.status === 'uploaded') {
           // Fallback if publications array is missing but status is uploaded
           publications.push({ id: v.id, video: v, platform: 'unknown', published_at: v.created_at });
        }
      });

      set({
        ideas: safeIdeas,
        scripts: Array.from(scriptsById.values()),
        videos: enrichedVideos,
        publications,
        lastChannelId: channelId,
        loading: false
      });
    } catch (err) {
      console.error('Failed to fetch content:', err);
      set({ error: err.message, loading: false });
    }
  },

  getMetrics: () => {
    const { ideas, scripts, videos, publications } = get();
    return {
      ideas: ideas.length,
      scripts: scripts.length,
      rendering: videos.filter(v => v.status === 'rendering').length,
      failed: videos.filter(v => v.status === 'failed').length,
      review: videos.filter(v => v.status === 'ready').length,
      scheduled: videos.filter(v => v.status === 'approved').length,
      published: publications.length,
    };
  }
}));

export default useContentStore;
