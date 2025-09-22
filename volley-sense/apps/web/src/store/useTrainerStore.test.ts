import { describe, expect, it } from 'vitest';
import { act } from '@testing-library/react';
import { useTrainerStore, createDefaultDefinitions } from './useTrainerStore';

const resetStore = () => {
  const { setState } = useTrainerStore;
  setState({
    definitions: createDefaultDefinitions(),
    previewMarkers: {},
    loadingPreviews: {},
    lastExplainedId: undefined
  });
};

describe('useTrainerStore', () => {
  it('toggles definitions', () => {
    resetStore();
    const id = useTrainerStore.getState().definitions[0].id;
    act(() => {
      useTrainerStore.getState().toggleDefinition(id);
    });
    const updated = useTrainerStore.getState().definitions[0];
    expect(updated.enabled).toBe(false);
  });

  it('stores preview markers', () => {
    resetStore();
    act(() => {
      useTrainerStore.getState().setPreviewMarkers('abc', [
        { t: 10, label: 'Test', kind: 'custom', conf: 0.7 }
      ]);
    });
    const markers = useTrainerStore.getState().previewMarkers['abc'];
    expect(markers).toHaveLength(1);
    expect(markers?.[0].label).toBe('Test');
  });
});
