import React, { createContext, useContext, useMemo } from 'react';

type FeatureFlags = {
  trainer: boolean;
  screenSnap: boolean;
  insights: boolean;
  exports: boolean;
  ingest: boolean;
};

const defaultFlags: FeatureFlags = {
  trainer: import.meta.env.VITE_ENABLE_TRAINER !== 'false',
  screenSnap: import.meta.env.VITE_ENABLE_SCREEN_SNAP !== 'false',
  insights: import.meta.env.VITE_ENABLE_INSIGHTS !== 'false',
  exports: import.meta.env.VITE_ENABLE_EXPORTS !== 'false',
  ingest: import.meta.env.VITE_ENABLE_INGEST !== 'false',
};

const FeatureFlagsContext = createContext<FeatureFlags>(defaultFlags);

export const FeatureFlagsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const flags = useMemo(() => defaultFlags, []);
  return <FeatureFlagsContext.Provider value={flags}>{children}</FeatureFlagsContext.Provider>;
};

export const useFeatureFlags = () => useContext(FeatureFlagsContext);
