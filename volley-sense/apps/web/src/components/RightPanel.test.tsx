import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import RightPanel from './RightPanel';
import { EventMarker, Player } from '@lib/types';

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

describe('RightPanel', () => {
  it('matches snapshot', () => {
    const { container } = render(<RightPanel players={players} events={events} onSeek={() => undefined} />);
    expect(container).toMatchSnapshot();
  });
});
