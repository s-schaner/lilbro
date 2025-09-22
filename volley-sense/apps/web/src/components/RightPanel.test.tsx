import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import RightPanel from './RightPanel';
import { EventMarker, ModuleStatus, Player } from '@lib/types';
import { ModuleContext } from '@context/ModuleContext';

const players: Player[] = [
  {
    jersey: 7,
    name: 'A. Ramos',
    stats: { kills: 4, digs: 6, blocks: 1, aces: 2 }
  },
  {
    jersey: 12,
    name: 'K. Lin',
    stats: { kills: 8, digs: 3, blocks: 2, aces: 1 }
  }
];

const events: EventMarker[] = [
  { t: 12, label: 'Serve Ace', kind: 'serve', jersey: 12, conf: 0.93 },
  { t: 37, label: 'Spike Kill', kind: 'kill', jersey: 14, conf: 0.88 }
];

const modules: ModuleStatus[] = [
  {
    id: 'stats',
    name: 'Stats',
    version: '0.1.0',
    status: 'healthy',
    enabled: true,
    optional: false,
    last_error: null
  },
  {
    id: 'timeline',
    name: 'Timeline',
    version: '0.1.0',
    status: 'healthy',
    enabled: true,
    optional: false,
    last_error: null
  },
  {
    id: 'overlays',
    name: 'Overlays',
    version: '0.1.0',
    status: 'healthy',
    enabled: true,
    optional: true,
    last_error: null
  },
  {
    id: 'llm-insights',
    name: 'Insights',
    version: '0.1.0',
    status: 'healthy',
    enabled: true,
    optional: true,
    last_error: null
  },
  {
    id: 'screensnap-insights',
    name: 'ScreenSnap',
    version: '0.1.0',
    status: 'healthy',
    enabled: true,
    optional: true,
    last_error: null
  }
];

describe('RightPanel', () => {
  it('matches snapshot', () => {
    const { container } = render(
      <ModuleContext.Provider
        value={{
          modules,
          loading: false,
          error: null,
          refresh: async () => {},
          setModuleEnabled: async () => modules[0]
        }}
      >
        <RightPanel
          players={players}
          events={events}
          onSeek={() => undefined}
          insights={{
            summary: 'Team A surged in Set 2 behind #12’s 3 service aces.',
            momentum: ['Set 1 opened evenly'],
            spotlights: ['#7’s defense (7 digs) kept rallies alive in the final set.'],
            coach_tips: ['Tighten rotation communication to prevent the 104s formation violation.']
          }}
          imageAnalyses={[]}
        />
      </ModuleContext.Provider>
    );
    expect(container).toMatchSnapshot();
  });
});
