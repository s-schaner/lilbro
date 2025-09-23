import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type OverlayTool = 'select' | 'box' | 'lasso';

interface OverlayToolState {
  tool: OverlayTool;
  setTool: (tool: OverlayTool) => void;
}

export const useOverlayTool = create<OverlayToolState>()(
  persist(
    (set) => ({
      tool: 'select',
      setTool: (tool) => set({ tool }),
    }),
    {
      name: 'overlay-tool',
    },
  ),
);
