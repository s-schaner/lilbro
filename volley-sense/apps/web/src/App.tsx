import { EventBusProvider } from '@context/EventBusContext';
import { ModuleProvider } from '@context/ModuleContext';
import Dashboard from '@pages/Dashboard';

const App = () => {
  return (
    <ModuleProvider>
      <EventBusProvider>
        <Dashboard />
      </EventBusProvider>
    </ModuleProvider>
  );
};

export default App;
