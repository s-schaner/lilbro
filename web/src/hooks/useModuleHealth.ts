import { useEffect, useState } from 'react';
import { ModuleHealth } from '../data/types';

export const useModuleHealth = () => {
  const [modules, setModules] = useState<ModuleHealth[]>([]);

  useEffect(() => {
    let cancelled = false;

    const fetchHealth = async () => {
      try {
        const response = await fetch('/api/modules/health');
        if (!response.ok) {
          throw new Error('Unable to load module health');
        }
        const payload = await response.json();
        if (cancelled) return;
        setModules(payload.modules);
      } catch (error) {
        if (cancelled) return;
        setModules([
          {
            name: 'core',
            status: (error as Error).message,
            enabled: true,
          },
        ]);
      }
    };

    fetchHealth();

    return () => {
      cancelled = true;
    };
  }, []);

  return modules;
};
