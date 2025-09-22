import { create } from 'zustand';
import { EventMarker } from '@lib/types';

type VideoState = {
  currentTime: number;
  duration: number;
  playing: boolean;
  overlays: boolean;
  markers: EventMarker[];
  source: string | null;
  setMarkers: (markers: EventMarker[]) => void;
  appendMarker: (marker: EventMarker) => void;
  seek: (time: number) => void;
  togglePlay: () => void;
  setPlaying: (value: boolean) => void;
  setDuration: (value: number) => void;
  setCurrentTime: (value: number) => void;
  toggleOverlays: () => void;
  setSource: (src: string | null) => void;
};

export const useVideoStore = create<VideoState>((set) => ({
  currentTime: 0,
  duration: 0,
  playing: false,
  overlays: true,
  markers: [],
  source: null,
  setMarkers: (markers) => set(() => ({ markers })),
  appendMarker: (marker) =>
    set((state) => ({
      markers: [...state.markers, marker]
    })),
  seek: (time) => set(() => ({ currentTime: time })),
  togglePlay: () => set((state) => ({ playing: !state.playing })),
  setPlaying: (value) => set(() => ({ playing: value })),
  setDuration: (value) => set(() => ({ duration: value })),
  setCurrentTime: (value) => set(() => ({ currentTime: value })),
  toggleOverlays: () => set((state) => ({ overlays: !state.overlays })),
  setSource: (src) => set(() => ({ source: src }))
}));
