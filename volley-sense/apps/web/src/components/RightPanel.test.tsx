import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import RightPanel from './RightPanel';
import { EventMarker, ModuleStatus, Player } from '@lib/types';

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
  { id: 'stats', name: 'Stats', version: '0.1.0', optional: false, enabled: true, status: 'healthy', failure_count: 0 },
  { id: 'timeline', name: 'Timeline', version: '0.1.0', optional: false, enabled: true, status: 'healthy', failure_count: 0 },
  { id: 'overlays', name: 'Overlays', version: '0.1.0', optional: true, enabled: true, status: 'healthy', failure_count: 0 },
  {
    id: 'llm-insights',
    name: 'Insights',
    version: '0.1.0',
    optional: true,
    enabled: true,
    status: 'healthy',
    failure_count: 0
  },
  {
    id: 'screensnap-insights',
    name: 'ScreenSnap',
    version: '0.1.0',
    optional: true,
    enabled: true,
    status: 'healthy',
    failure_count: 0
  }
];

describe('RightPanel', () => {
  it('renders player and event data', () => {
    render(
      <RightPanel
        players={players}
        events={events}
        modules={modules}
        imageAnalyses={[]}
        onSeek={() => undefined}
      />
    );
    expect(screen.getByText('A. Ramos')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Events' }));
    expect(screen.getByText('Spike Kill')).toBeInTheDocument();
  });
});
