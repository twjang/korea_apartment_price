import './App.css';
import { BrowserRouter, Routes } from 'react-router-dom';
import { getRouteElements, PageHierarchyProvider } from './pages';
import { AuthProvider } from './contexts/AuthContext';
import { SnackbarProvider } from 'notistack';
import { SimpleQuestionModalProvider } from './components/SimpleQuestionModal';
import ChartDemo from './components/ChartCanvas/demo';

function AppOrig() {
  return (
    <div className="App">
      <SimpleQuestionModalProvider>
        <BrowserRouter>
          <SnackbarProvider maxSnack={5}>
            <AuthProvider>
              <PageHierarchyProvider>
                <Routes>{getRouteElements()}</Routes>
              </PageHierarchyProvider>
            </AuthProvider>
          </SnackbarProvider>
        </BrowserRouter>
      </SimpleQuestionModalProvider>
    </div>
  );
}

function AppDemo() {
  return (
    <div style={{ width: 1280, height: 720 }}>
      <ChartDemo />
    </div>
  );
}

const App = AppOrig;

export default App;
