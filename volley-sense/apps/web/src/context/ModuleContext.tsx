import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';

import { fetchModules, toggleModule } from '@lib/api';
import { ModuleStatus } from '@lib/types';

export type ModuleContextValue = {
  modules: ModuleStatus[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  setModuleEnabled: (id: string, enabled: boolean) => Promise<ModuleStatus>;
};

export const ModuleContext = createContext<ModuleContextValue | undefined>(undefined);

export const ModuleProvider = ({ children }: { children: ReactNode }) => {
  const [modules, setModules] = useState<ModuleStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadModules = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await fetchModules();
      setModules(payload);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Unable to load module registry');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadModules();
  }, [loadModules]);

  const setModuleEnabled = useCallback(async (id: string, enabled: boolean) => {
    const result = await toggleModule(id, enabled);
    setModules((previous) =>
      previous.some((module) => module.id === id)
        ? previous.map((module) => (module.id === id ? result : module))
        : [...previous, result]
    );
    return result;
  }, []);

  const value = useMemo<ModuleContextValue>(
    () => ({ modules, loading, error, refresh: loadModules, setModuleEnabled }),
    [modules, loading, error, loadModules, setModuleEnabled]
  );

  return <ModuleContext.Provider value={value}>{children}</ModuleContext.Provider>;
};

export const useModules = (): ModuleContextValue => {
  const context = useContext(ModuleContext);
  if (!context) {
    throw new Error('useModules must be used within a ModuleProvider');
  }
  return context;
};

export const useModule = (moduleId: string): ModuleStatus | undefined => {
  const { modules } = useModules();
  return modules.find((module) => module.id === moduleId);
};
