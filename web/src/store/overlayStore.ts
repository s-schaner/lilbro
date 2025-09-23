import { create } from 'zustand';

import { AnnotationRecord, AnnotationInput, CalibrationData } from '../components/OverlayCanvas';

interface OverlayState {
  activeUploadId: string | null;
  annotationsByUpload: Record<string, AnnotationRecord[]>;
  calibrationByUpload: Record<string, CalibrationData | null>;
  loading: boolean;
  error: string | null;
  setActiveUpload: (uploadId: string | null) => void;
  load: (uploadId: string, apiBase: string) => Promise<void>;
  saveAnnotation: (
    uploadId: string,
    payload: AnnotationInput,
    apiBase: string,
  ) => Promise<AnnotationRecord>;
  setCalibration: (uploadId: string, calibration: CalibrationData | null) => void;
  reset: (uploadId?: string | null) => void;
}

const INITIAL_STATE: Omit<OverlayState, 'setActiveUpload' | 'load' | 'saveAnnotation' | 'setCalibration' | 'reset'> = {
  activeUploadId: null,
  annotationsByUpload: {},
  calibrationByUpload: {},
  loading: false,
  error: null,
};

const normalizeUploadId = (uploadId?: string | null): string | null => {
  if (!uploadId) {
    return null;
  }
  return uploadId;
};

export const useOverlayStore = create<OverlayState>((set) => ({
  ...INITIAL_STATE,
  setActiveUpload(uploadId) {
    set({ activeUploadId: normalizeUploadId(uploadId) });
  },
  async load(uploadId, apiBase) {
    if (!uploadId) {
      set({ activeUploadId: null });
      return;
    }
    const target = normalizeUploadId(uploadId);
    set({ loading: true, error: null });
    try {
      const annotationsResponse = await fetch(`${apiBase}/annotations/${target}`);
      let annotations: AnnotationRecord[] = [];
      if (annotationsResponse.status === 404) {
        annotations = [];
      } else if (!annotationsResponse.ok) {
        throw new Error('Failed to load annotations');
      } else {
        annotations = (await annotationsResponse.json()) as AnnotationRecord[];
      }

      const calibrationResponse = await fetch(`${apiBase}/calibration/${target}`);
      let calibration: CalibrationData | null = null;
      if (calibrationResponse.status === 404) {
        calibration = null;
      } else if (!calibrationResponse.ok) {
        throw new Error('Failed to load calibration');
      } else {
        calibration = (await calibrationResponse.json()) as CalibrationData;
      }

      set((state) => ({
        activeUploadId: target,
        annotationsByUpload: { ...state.annotationsByUpload, [target]: annotations },
        calibrationByUpload: { ...state.calibrationByUpload, [target]: calibration },
        loading: false,
        error: null,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load overlay data';
      set((state) => ({
        loading: false,
        error: message,
        annotationsByUpload:
          target !== null
            ? { ...state.annotationsByUpload, [target]: [] }
            : state.annotationsByUpload,
        calibrationByUpload:
          target !== null
            ? { ...state.calibrationByUpload, [target]: null }
            : state.calibrationByUpload,
      }));
    }
  },
  async saveAnnotation(uploadId, payload, apiBase) {
    if (!uploadId) {
      throw new Error('Upload required before adding annotations.');
    }
    const response = await fetch(`${apiBase}/annotations/${uploadId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(detail || 'Unable to save annotation');
    }
    const record = (await response.json()) as AnnotationRecord;
    set((state) => {
      const existing = state.annotationsByUpload[uploadId] ?? [];
      return {
        annotationsByUpload: {
          ...state.annotationsByUpload,
          [uploadId]: [...existing, record],
        },
        error: null,
      };
    });
    return record;
  },
  setCalibration(uploadId, calibration) {
    if (!uploadId) {
      return;
    }
    set((state) => ({
      calibrationByUpload: {
        ...state.calibrationByUpload,
        [uploadId]: calibration,
      },
      error: null,
    }));
  },
  reset(uploadId) {
    if (!uploadId) {
      set({ ...INITIAL_STATE });
      return;
    }
    set((state) => {
      const annotations = { ...state.annotationsByUpload };
      const calibration = { ...state.calibrationByUpload };
      delete annotations[uploadId];
      delete calibration[uploadId];
      return {
        annotationsByUpload: annotations,
        calibrationByUpload: calibration,
        error: null,
        loading: state.loading && state.activeUploadId === uploadId ? false : state.loading,
        activeUploadId: state.activeUploadId === uploadId ? null : state.activeUploadId,
      };
    });
  },
}));

export const getOverlayStore = useOverlayStore.getState;
