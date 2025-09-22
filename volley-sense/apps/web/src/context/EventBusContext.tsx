import mitt, { Emitter } from 'mitt';
import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { EventMarker, ScreenSnapResponse } from '@lib/types';

type BusEvents = {
  'timeline:pin': EventMarker;
  'analysis:add': { note: ScreenSnapResponse & { focus: string; timestamp: number } };
  snackbar: string;
};

const EventBusContext = createContext<Emitter<BusEvents> | null>(null);

export const EventBusProvider = ({ children }: { children: ReactNode }) => {
  const bus = useMemo(() => mitt<BusEvents>(), []);
  return <EventBusContext.Provider value={bus}>{children}</EventBusContext.Provider>;
};

export const useEventBus = () => {
  const context = useContext(EventBusContext);
  if (!context) {
    throw new Error('useEventBus must be used within an EventBusProvider');
  }
  return context;
};
