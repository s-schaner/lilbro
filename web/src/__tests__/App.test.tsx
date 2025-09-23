import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import App from '../App';

const eventsPayload = {
  players: [
    { id: 'p1', name: 'Test Player', position: 'Setter' },
    { id: 'p2', name: 'Another Player', position: 'Libero' },
  ],
  events: [
    { id: 'e1', label: 'Serve', outcome: 'ace', timestamp: 10, player_id: 'p1', video_time: '' },
  ],
};

const formationPayload = { formation: { front_row: ['p1'], back_row: ['p2'] } };
const modulesPayload = {
  modules: [
    { name: 'analysis', status: 'healthy', enabled: true },
    { name: 'ingest', status: 'healthy', enabled: true },
  ],
};

type FetchArgs = [input: RequestInfo | URL, init?: RequestInit];

beforeEach(() => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (...args: FetchArgs) => {
    const [input] = args;
    const url = typeof input === 'string' ? input : input.url;
    if (url.endsWith('/events')) {
      return new Response(JSON.stringify(eventsPayload), { status: 200 });
    }
    if (url.endsWith('/events/formation')) {
      return new Response(JSON.stringify(formationPayload), { status: 200 });
    }
    if (url.endsWith('/modules/health')) {
      return new Response(JSON.stringify(modulesPayload), { status: 200 });
    }
    if (url.endsWith('/ingest/health')) {
      return new Response(JSON.stringify({ ok: true, module: 'ingest' }), { status: 200 });
    }
    if (url.includes('/ingest/status')) {
      return new Response(
        JSON.stringify({ status: 'ready', stage: 'ready', progress: 100 }),
        { status: 200 },
      );
    }
    return new Response('{}', { status: 200 });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

test('renders VolleySense layout snapshot', async () => {
  const { asFragment } = render(<App />);
  await screen.findByText('VolleySense Console');
  await screen.findByText('Ingest: ready');
  expect(asFragment()).toMatchSnapshot();
});
