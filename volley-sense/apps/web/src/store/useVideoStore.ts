import { create } from 'zustand';
import { EventMarker } from '@lib/types';

type VideoState = {
  currentTime: number;
  duration: number;
  playing: boolean;
  overlays: boolean;
  markers: EventMarker[];
  setMarkers: (markers: EventMarker[]) => void;
  seek: (time: number) => void;
  togglePlay: () => void;
  setPlaying: (value: boolean) => void;
  setDuration: (value: number) => void;
  toggleOverlays: () => void;
};

export const useVideoStore = create<VideoState>((set) => ({
  currentTime: 0,
  duration: 120,
  playing: false,
  overlays: true,
  markers: [],
  setMarkers: (markers) => set(() => ({ markers })),
  seek: (time) => set(() => ({ currentTime: time })),
  togglePlay: () => set((state) => ({ playing: !state.playing })),
  setPlaying: (value) => set(() => ({ playing: value })),
  setDuration: (value) => set(() => ({ duration: value })),
  toggleOverlays: () => set((state) => ({ overlays: !state.overlays }))
}));
