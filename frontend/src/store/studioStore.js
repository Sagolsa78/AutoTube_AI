import { create } from 'zustand';

const useStudioStore = create((set, get) => ({
  // Global Production Context
  profile: null,
  channels: [],
  captionStyles: [],

  // Production State
  selectedIdea: null,
  script: null,
  editingScenes: [],

  // User Selections
  selectedStyle: 'fast_facts',
  selectedCaption: 'bold_centered',
  selectedVoice: 'en-US-ChristopherNeural',
  selectedVisualStrategy: 'auto',
  contentType: 'facts',
  targetDuration: '60',
  language: 'en',

  // Actions
  setProfile: (profile) => set({ profile }),
  setChannels: (channels) => set({ channels }),
  setCaptionStyles: (captionStyles) => set({ captionStyles }),

  setSelectedIdea: (selectedIdea) => set({ selectedIdea }),
  setScript: (script) => {
    set({ script });
    if (script?.scenes) {
      set({ editingScenes: script.scenes.map(sc => ({ ...sc })) });
    }
  },
  setEditingScenes: (scenesOrUpdater) => set((state) => ({
    editingScenes: typeof scenesOrUpdater === 'function' ? scenesOrUpdater(state.editingScenes) : scenesOrUpdater
  })),

  setSelectedStyle: (selectedStyle) => set({ selectedStyle }),
  setSelectedCaption: (selectedCaption) => set({ selectedCaption }),
  setSelectedVoice: (selectedVoice) => set({ selectedVoice }),
  setSelectedVisualStrategy: (selectedVisualStrategy) => set({ selectedVisualStrategy }),
  setContentType: (contentType) => set({ contentType }),
  setTargetDuration: (targetDuration) => set({ targetDuration }),
  setLanguage: (language) => set({ language }),
}));

export default useStudioStore;
