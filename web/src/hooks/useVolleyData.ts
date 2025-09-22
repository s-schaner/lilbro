import { useEffect, useState } from 'react';
import { EventRecord, FormationSnapshot, Player } from '../data/types';

interface VolleyDataState {
  players: Player[];
  events: EventRecord[];
  formation?: FormationSnapshot;
  loading: boolean;
  error?: string;
}

const initialState: VolleyDataState = {
  players: [],
  events: [],
  loading: true,
};

export const useVolleyData = (): VolleyDataState => {
  const [state, setState] = useState<VolleyDataState>(initialState);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [eventRes, formationRes] = await Promise.all([
          fetch('/api/events'),
          fetch('/api/events/formation'),
        ]);
        if (!eventRes.ok) {
          throw new Error('Unable to load events');
        }
        const eventPayload = await eventRes.json();
        const formationPayload = formationRes.ok ? await formationRes.json() : undefined;
        if (cancelled) return;
        setState({
          players: eventPayload.players,
          events: eventPayload.events,
          formation: formationPayload?.formation,
          loading: false,
        });
      } catch (error) {
        if (cancelled) return;
        setState((prev) => ({ ...prev, loading: false, error: (error as Error).message }));
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
};
