import './App.css';
import { BrowserRouter, Routes } from 'react-router-dom';
import { getRouteElements, PageHierarchyProvider } from './pages';
import { AuthProvider } from './contexts/AuthContext';
import { SnackbarProvider } from 'notistack';
import { SimpleQuestionModalProvider } from './components/SimpleQuestionModal';
import ChartDemo from './components/ChartCanvas/demo';


function AppOrig() {
  return (
    <div className='App'>
      <SimpleQuestionModalProvider>
        <BrowserRouter>
          <SnackbarProvider maxSnack={5}>
            <AuthProvider>
              <PageHierarchyProvider>
                <Routes>
                  {getRouteElements()}
                </Routes>
              </PageHierarchyProvider>
            </AuthProvider>
          </SnackbarProvider>
        </BrowserRouter>
      </SimpleQuestionModalProvider>
    </div>
  );
}

function App() {
  return <div style={{ width: '1280px', height: '720px', border: '1px solid #000'}}>
    <ChartDemo />
   </div>
}

export default App;
