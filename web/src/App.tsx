import React, { useEffect, useMemo, useState } from 'react';
import { UploadCloud, Video, Layers } from 'lucide-react';
import { FeatureFlagsProvider, useFeatureFlags } from './context/FeatureFlagsContext';
import { useVolleyData } from './hooks/useVolleyData';
import { useModuleHealth } from './hooks/useModuleHealth';
import { EventTrainerPanel } from './modules/EventTrainerPanel';
import { PlayersPanel } from './modules/PlayersPanel';
import { EventsPanel } from './modules/EventsPanel';
import { FormationPanel } from './modules/FormationPanel';
import { InsightsPanel } from './modules/InsightsPanel';
import { ScreenSnapPanel } from './modules/ScreenSnapPanel';
import { ModuleHealthList } from './components/ModuleHealthList';
import { ErrorBoundary } from './components/ErrorBoundary';
import { UploadModal } from './components/UploadModal';

const AppShell: React.FC = () => {
  const { players, events, formation, loading } = useVolleyData();
  const modules = useModuleHealth();
  const flags = useFeatureFlags();

  const [activeTab, setActiveTab] = useState('players');
  const [showUpload, setShowUpload] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  const availableTabs = useMemo(
    () => [
      { id: 'players', label: 'Players', element: <PlayersPanel players={players} />, enabled: true },
      { id: 'events', label: 'Events', element: <EventsPanel events={events} />, enabled: true },
      { id: 'formation', label: 'Formation', element: <FormationPanel formation={formation} />, enabled: true },
      { id: 'insights', label: 'Insights', element: <InsightsPanel />, enabled: flags.insights },
    ].filter((tab) => tab.enabled),
    [players, events, formation, flags.insights],
  );

  useEffect(() => {
    if (!availableTabs.find((tab) => tab.id === activeTab)) {
      setActiveTab(availableTabs[0]?.id ?? 'players');
    }
  }, [activeTab, availableTabs]);

  const timelineMax = useMemo(() => Math.max(60, ...events.map((event) => event.timestamp)), [events]);

  const triggerExport = async (artifact: string) => {
    if (!flags.exports) {
      setExportMessage('Exports disabled by feature flag.');
      return;
    }
    try {
      const res = await fetch(`/api/export/${artifact}`);
      if (!res.ok) {
        throw new Error('Unable to export artifact');
      }
      const payload = await res.json();
      setExportMessage(`Export ready: ${payload.download_url}`);
    } catch (error) {
      setExportMessage((error as Error).message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950/60 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3 text-lg font-semibold">
            <Video className="h-6 w-6 text-brand" /> VolleySense Console
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <Layers className="h-4 w-4" /> Modules online: {modules.length}
            {flags.ingest && (
              <button
                onClick={() => setShowUpload(true)}
                className="rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white"
              >
                <UploadCloud className="mr-2 inline h-4 w-4" /> Upload
              </button>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-7xl flex-1 gap-6 px-6 py-6">
        <div className="flex w-72 flex-col gap-4">
          <ErrorBoundary label="Event Trainer">
            {flags.trainer ? <EventTrainerPanel /> : <DisabledCard label="Trainer" />}
          </ErrorBoundary>
          <ErrorBoundary label="Module Health">
            <div className="module-card">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Module Health</h3>
              <ModuleHealthList modules={modules} />
            </div>
          </ErrorBoundary>
        </div>
        <div className="flex flex-1 flex-col gap-4">
          <section className="relative h-72 rounded-xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900">
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
              <Video className="h-12 w-12 text-slate-700" />
              <p className="text-sm text-slate-400">Video viewport placeholder with annotated overlays.</p>
            </div>
          </section>
          <section className="module-card">
            <div className="relative h-20">
              <div className="absolute left-0 right-0 top-1/2 h-0.5 -translate-y-1/2 bg-slate-700" />
              {events.map((event) => (
                <div
                  key={event.id}
                  className="absolute top-2 flex -translate-x-1/2 flex-col items-center"
                  style={{ left: `${(event.timestamp / timelineMax) * 100}%` }}
                >
                  <div className="h-6 w-6 rounded-full border border-brand bg-brand/30 text-center text-xs leading-6">
                    •
                  </div>
                  <span className="mt-2 text-xs text-slate-400">{event.label}</span>
                </div>
              ))}
            </div>
          </section>
          {flags.screenSnap && (
            <ErrorBoundary label="ScreenSnap">
              <ScreenSnapPanel />
            </ErrorBoundary>
          )}
          {loading && <div className="text-xs text-slate-500">Loading match data…</div>}
        </div>
        <div className="w-80 space-y-4">
          <div className="module-card">
            <div className="flex gap-2">
              {availableTabs.map((tab) => (
                <button
                  key={tab.id}
                  className={`tab-button ${activeTab === tab.id ? 'tab-button-active' : 'bg-slate-800 text-slate-300'}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="mt-4">
              <ErrorBoundary label={`${activeTab} panel`}>
                {availableTabs.find((tab) => tab.id === activeTab)?.element}
              </ErrorBoundary>
            </div>
          </div>
        </div>
      </main>
      <footer className="border-t border-slate-800 bg-slate-950/50">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="text-xs uppercase tracking-wide text-slate-500">Exports</div>
          <div className="flex gap-3">
            {['report', 'highlights', 'coach-notes'].map((artifact) => (
              <button
                key={artifact}
                onClick={() => triggerExport(artifact)}
                className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs uppercase tracking-wide hover:border-brand"
              >
                {artifact}
              </button>
            ))}
          </div>
          <div className="text-xs text-slate-400">{exportMessage ?? 'Select an export to queue a download link.'}</div>
        </div>
      </footer>
      <UploadModal open={showUpload} onClose={() => setShowUpload(false)} />
    </div>
  );
};

const DisabledCard: React.FC<{ label: string }> = ({ label }) => (
  <div className="module-card text-xs text-slate-400">
    {label} module disabled by environment flag.
  </div>
);

const App: React.FC = () => (
  <FeatureFlagsProvider>
    <AppShell />
  </FeatureFlagsProvider>
);

export default App;
