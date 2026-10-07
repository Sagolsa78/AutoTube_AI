import { create } from 'zustand';

const useStudioStore = create((set, get) => ({
  // Core Domain State
  project: {
    id: null,
    title: '',
    status: 'draft',
    channelId: null,
    targetDuration: '60',
    contentType: 'short',
    visualStrategy: 'auto',
  },

  selectedIdea: null,
  script: null,
  editingScenes: [],
  selectedSceneId: null,
  assets: [],

  audio: {
    voice: 'en-US-ChristopherNeural',
    language: 'en',
    speed: 1.0,
    emotion: 'neutral',
    music: null,
    voiceStatus: 'idle', // idle, loading, ready, error
  },

  render: {
    videoId: null,
    status: 'pending',
    stage: null,
    progress: 0,
    error: null,
    finalVideoUrl: null,
    previewUrl: null,
  },

  publishing: {
    selectedPlatforms: [],
    metadata: {},
    scheduledAt: null,
    status: 'idle',
    error: null,
  },

  // UI State
  ui: {
    activeStage: 'concept', // concept, script, storyboard, voice, output
    showCopilot: false,
    inspectorOpen: true,
    previewMode: 'scene', // scene, video
  },

  // Global Config
  channels: [],
  captionStyles: [],

  // --- ACTIONS ---

  // Project Actions
  setProject: (projectUpdates) => set((state) => ({
    project: { ...state.project, ...projectUpdates }
  })),

  // Idea Actions
  setSelectedIdea: (selectedIdea) => set({ selectedIdea }),

  // Script & Scenes Actions
  setScript: (script) => {
    set({ script });
    if (script?.scenes) {
      set({ editingScenes: script.scenes.map(sc => ({ ...sc })) });
    }
  },
  setEditingScenes: (scenesOrUpdater) => set((state) => ({
    editingScenes: typeof scenesOrUpdater === 'function' ? scenesOrUpdater(state.editingScenes) : scenesOrUpdater
  })),
  setSelectedSceneId: (selectedSceneId) => set({ selectedSceneId }),
  updateScene: (sceneId, updates) => set((state) => ({
    editingScenes: state.editingScenes.map(sc => sc.id === sceneId ? { ...sc, ...updates } : sc)
  })),

  // Assets Actions
  setAssets: (assets) => set({ assets }),
  addAsset: (asset) => set((state) => ({ assets: [...state.assets, asset] })),

  // Audio Actions
  setAudio: (audioUpdates) => set((state) => ({
    audio: { ...state.audio, ...audioUpdates }
  })),

  // Render Actions
  setRender: (renderUpdates) => set((state) => ({
    render: { ...state.render, ...renderUpdates }
  })),

  // Publishing Actions
  setPublishing: (pubUpdates) => set((state) => ({
    publishing: { ...state.publishing, ...pubUpdates }
  })),

  // UI Actions
  setUI: (uiUpdates) => set((state) => ({
    ui: { ...state.ui, ...uiUpdates }
  })),
  setActiveStage: (stage) => set((state) => ({
    ui: { ...state.ui, activeStage: stage }
  })),
  toggleCopilot: () => set((state) => ({
    ui: { ...state.ui, showCopilot: !state.ui.showCopilot }
  })),
  toggleInspector: () => set((state) => ({
    ui: { ...state.ui, inspectorOpen: !state.ui.inspectorOpen }
  })),

  // Global Config Actions
  setChannels: (channels) => set({ channels }),
  setCaptionStyles: (captionStyles) => set({ captionStyles }),

  // Legacy mappings for quick compatibility (to be phased out if possible)
  setContentType: (contentType) => set((state) => ({ project: { ...state.project, contentType } })),
  setTargetDuration: (targetDuration) => set((state) => ({ project: { ...state.project, targetDuration } })),
  setLanguage: (language) => set((state) => ({ audio: { ...state.audio, language } })),
}));

export default useStudioStore;
