import { render } from '@testing-library/react';
import RightPanel from '../RightPanel';
import { EventMarker, InsightPayload, ModuleStatus, Player, ScreenSnapResult } from '@lib/types';

describe('RightPanel', () => {
  const players: Player[] = [
    {
      jersey: 7,
      name: 'A. Ramos',
      stats: { kills: 4, digs: 6, blocks: 1, aces: 2 }
    }
  ];
  const events: EventMarker[] = [
    { t: 12, label: 'Serve Ace', kind: 'serve', jersey: 12, conf: 0.93 }
  ];
  const modules: ModuleStatus[] = [
    { id: 'stats', name: 'Stats', version: '0.1.0', optional: true, enabled: true, status: 'healthy', failure_count: 0 },
    { id: 'timeline', name: 'Timeline', version: '0.1.0', optional: true, enabled: true, status: 'healthy', failure_count: 0 },
    { id: 'overlays', name: 'Overlays', version: '0.1.0', optional: true, enabled: true, status: 'healthy', failure_count: 0 },
    { id: 'llm-insights', name: 'Insights', version: '0.1.0', optional: true, enabled: true, status: 'healthy', failure_count: 0 },
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
  const insights: InsightPayload = {
    game_id: 'demo-1',
    recap: 'Team A surged in Set 2 behind #12’s 3 service aces.',
    momentum: ['Team A surged in Set 2 behind #12’s 3 service aces.'],
    spotlights: ['#7 Ramos recorded seven digs.'],
    coach_notes: ['Focus on rotation timing.']
  };
  const analysis: ScreenSnapResult[] = [
    {
      focus: 'Blocking technique',
      summary: '#14’s hands are late closing at the antenna',
      observations: ['Hands below tape'],
      corrections: ['Press thumbs over the tape'],
      confidence: 0.73,
      timestamp: 104.2
    }
  ];

  it('matches snapshot', () => {
    const { container } = render(
      <RightPanel
        players={players}
        events={events}
        onSeek={() => undefined}
        modules={modules}
        insights={insights}
        insightsLoading={false}
        onRefreshInsights={() => undefined}
        imageAnalyses={analysis}
        onRetryModule={() => undefined}
      />
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});
