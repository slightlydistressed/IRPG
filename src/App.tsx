import { AppProvider } from './context/AppContext';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import PDFViewer from './components/PDFViewer';

function App() {
  return (
    <AppProvider>
      <div className="app-shell">
        <Header />
        <div className="app-body">
          <Sidebar />
          <main className="main-content">
            <PDFViewer />
          </main>
        </div>
      </div>
    </AppProvider>
  );
}

export default App;
