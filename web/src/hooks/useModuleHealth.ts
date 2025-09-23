import { useEffect, useState } from 'react';
import { ModuleHealth } from '../data/types';

const markIngestStatus = (modules: ModuleHealth[], status: string): ModuleHealth[] => {
  let ingestFound = false;
  const nextModules = modules.map((module) => {
    if (module.name !== 'ingest') {
      return module;
    }
    ingestFound = true;
    return {
      ...module,
      status,
    };
  });

  if (!ingestFound) {
    nextModules.push({ name: 'ingest', status, enabled: true });
  }

  return nextModules;
};

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

        let nextModules: ModuleHealth[] = payload.modules;

        try {
          const ingestResponse = await fetch('/ingest/health');
          if (!ingestResponse.ok) {
            throw new Error('Unable to load ingest health');
          }
          const ingestPayload = await ingestResponse.json();
          if (!ingestPayload.ok) {
            nextModules = markIngestStatus(nextModules, 'degraded');
          }
        } catch (error) {
          nextModules = markIngestStatus(nextModules, 'degraded');
        }

        if (cancelled) return;
        setModules(nextModules);
      } catch (error) {
        if (cancelled) return;
        setModules((current) => {
          if (current.length > 0) {
            return current;
          }
          return [
            {
              name: 'core',
              status: (error as Error).message,
              enabled: true,
            },
          ];
        });
      }
    };

    fetchHealth();

    return () => {
      cancelled = true;
    };
  }, []);

  return modules;
};
