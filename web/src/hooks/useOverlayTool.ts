import { useCallback, useEffect, useState } from 'react';

export type OverlayTool = 'select' | 'box' | 'lasso';

interface OverlayToolState {
  tool: OverlayTool;
  setTool: (tool: OverlayTool) => void;
}

const STORAGE_KEY = 'overlay-tool';

const isOverlayTool = (value: unknown): value is OverlayTool =>
  value === 'select' || value === 'box' || value === 'lasso';

const getStoredTool = (): OverlayTool => {
  if (typeof window === 'undefined') {
    return 'select';
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isOverlayTool(stored) ? stored : 'select';
};

let currentTool: OverlayTool = getStoredTool();
const listeners = new Set<(tool: OverlayTool) => void>();

const setCurrentTool = (tool: OverlayTool) => {
  currentTool = tool;

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, tool);
  }

  listeners.forEach((listener) => listener(tool));
};

export const useOverlayTool = (): OverlayToolState => {
  const [tool, setToolState] = useState<OverlayTool>(currentTool);

  useEffect(() => {
    const listener = (nextTool: OverlayTool) => setToolState(nextTool);
    listeners.add(listener);

    // Ensure the subscribing component sees the latest value.
    listener(currentTool);

    return () => {
      listeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY && isOverlayTool(event.newValue)) {
        setCurrentTool(event.newValue);
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const setTool = useCallback((nextTool: OverlayTool) => {
    setCurrentTool(nextTool);
  }, []);

  return { tool, setTool };
};
