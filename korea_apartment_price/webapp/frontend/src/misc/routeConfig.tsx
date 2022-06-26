import * as accountPage from '../pages/account';
import * as reportPage from '../pages/report';
import * as favoritesPage from '../pages/favorites';
import * as loginPage from '../pages/login';
import { Route } from 'react-router-dom';
import Frame from '../components/Frame';

export interface PageConfig {
  path: string
  title: string
  menuIcon?: JSX.Element
  menuName?: JSX.Element
  onlyForAdmin?: boolean
  isLoginPage?: boolean
  element: JSX.Element
  children?: PageConfig[]
}

const rootPageConfig: PageConfig[] = [
  favoritesPage.cfg,
  reportPage.cfg,
  accountPage.cfg,
  loginPage.cfg,
];

const buildRoutesFromConfig = (cfg:PageConfig[]): JSX.Element[] => {
  const elems = cfg.map(e=>{
    const childrenRoutes: JSX.Element[] = [];
    if (e.children) { 
      childrenRoutes.push(...buildRoutesFromConfig(e.children));
    }
    return <Route path={e.path} element={<Frame title={e.title} page={e.element}></Frame>}>{childrenRoutes}</Route>
  })
  return elems;
}

export const rootPageRoutes = buildRoutesFromConfig(rootPageConfig);