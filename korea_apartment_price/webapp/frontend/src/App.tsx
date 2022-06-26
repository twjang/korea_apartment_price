import './App.css';
import { BrowserRouter, Routes } from 'react-router-dom';
import { rootPageRoutes } from './misc/routeConfig';

function App() {
  return (
    <div className='App'>
      <BrowserRouter>
        <Routes>
          {rootPageRoutes}
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
