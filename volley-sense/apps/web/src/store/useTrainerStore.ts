import { nanoid } from 'nanoid';
import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { EventDefinition, EventMarker } from '@lib/types';

const templates: EventDefinition['template'][] = ['Contact', 'Injury Risk', 'Formation', 'General'];

const memoryStorage = (): StateStorage => {
  const store: Record<string, string> = {};
  return {
    getItem: (name) => store[name] ?? null,
    setItem: (name, value) => {
      store[name] = value;
    },
    removeItem: (name) => {
      delete store[name];
    }
  };
};

export const createDefaultDefinitions = (): EventDefinition[] =>
  templates.map((template, index) => ({
    id: nanoid(),
    name: `${template} Event ${index + 1}`,
    template,
    threshold: 0.7,
    enabled: true,
    createdAt: new Date(Date.now() - index * 3600_000).toISOString(),
    version: 'v1'
  }));

type TrainerState = {
  definitions: EventDefinition[];
  previewMarkers: Record<string, EventMarker[]>;
  loadingPreviews: Record<string, boolean>;
  lastExplainedId?: string;
  upsertDefinition: (definition: EventDefinition) => void;
  toggleDefinition: (id: string) => void;
  setDefinitions: (definitions: EventDefinition[]) => void;
  setPreviewMarkers: (id: string, markers: EventMarker[]) => void;
  setPreviewLoading: (id: string, loading: boolean) => void;
  setLastExplained: (id?: string) => void;
};

export const useTrainerStore = create<TrainerState>()(
  persist(
    (set) => ({
      definitions: createDefaultDefinitions(),
      previewMarkers: {},
      loadingPreviews: {},
      lastExplainedId: undefined,
      upsertDefinition: (definition) =>
        set((state) => ({
          definitions: state.definitions.some((item) => item.id === definition.id)
            ? state.definitions.map((item) => (item.id === definition.id ? definition : item))
            : [...state.definitions, definition]
        })),
      toggleDefinition: (id) =>
        set((state) => ({
          definitions: state.definitions.map((def) =>
            def.id === id
              ? {
                  ...def,
                  enabled: !def.enabled
                }
              : def
          )
        })),
      setDefinitions: (definitions) => set(() => ({ definitions })),
      setPreviewMarkers: (id, markers) =>
        set((state) => ({
          previewMarkers: {
            ...state.previewMarkers,
            [id]: markers
          }
        })),
      setPreviewLoading: (id, loading) =>
        set((state) => ({
          loadingPreviews: {
            ...state.loadingPreviews,
            [id]: loading
          }
        })),
      setLastExplained: (id) => set(() => ({ lastExplainedId: id }))
    }),
    {
      name: 'volley-sense-trainer',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? window.localStorage : memoryStorage()
      ),
      partialize: (state) => ({
        definitions: state.definitions
      })
    }
  )
);

export const buildDefinition = (
  partial: Pick<EventDefinition, 'name' | 'template' | 'threshold'>
): EventDefinition => ({
  id: nanoid(),
  enabled: true,
  createdAt: new Date().toISOString(),
  version: 'shadow',
  ...partial
});
