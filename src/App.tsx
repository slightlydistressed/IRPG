import { AppProvider, useApp } from '@/context/AppContext';
import ReaderShell from '@/components/ReaderShell';
import HomeView from '@/components/HomeView';

function AppShell() {
  const { view } = useApp();

  if (view === 'home') {
    return <HomeView />;
  }

  return <ReaderShell />;
}

function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}

export default App;
