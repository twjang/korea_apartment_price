import * as mePage from './me';
import * as accountsPage from './accounts';
import * as reportPage from './report';
import * as favoritesPage from './favorites';
import * as loginPage from './login';
import { Route, Navigate, useLocation, matchPath, Params } from 'react-router-dom';
import Frame from '../components/Frame';
import * as React from 'react';

export interface PageConfig {
  path: string
  title: string
  menuIcon?: JSX.Element
  menuName?: JSX.Element
  onlyForAdmin?: boolean
  notForGuest?: boolean
  isLoginPage?: boolean
  element: JSX.Element
  children?: PageConfig[]
  isDefaultPage?: boolean
}

export interface PageInfo extends PageConfig {
  fullPath: string
  matchedAsParent: boolean
  matched: boolean
  children?: PageInfo[]
  parent?: PageInfo
}

export const rootPageConfig: PageConfig[] = [
  favoritesPage.cfg,
  reportPage.cfg,
  mePage.cfg,
  accountsPage.cfg,
  loginPage.cfg,
];

export const getRouteElements = ():JSX.Element[] => {
  const traverse = (parentUrls:string[], cfg:PageConfig[]): JSX.Element[] => {
    const defaultPage = cfg.filter(e=>e.isDefaultPage);
    const elems = cfg.map(e=>{
      const childrenRoutes: JSX.Element[] = [];
      if (e.children) { 
        childrenRoutes.push(...traverse([...parentUrls, e.path], e.children));
      }
      return (<Route key={`route-${parentUrls.join('-')}-${e.path}`} path={e.path} element={<Frame />}>
        {childrenRoutes}
      </Route>);
    })
    if (defaultPage.length > 0) {
      elems.push((<Route
       key={`defpage-${defaultPage[0].path}`}
        path=""
        element={ <Navigate to={defaultPage[0].path} /> }
      />))
    }
    return elems;
  }
  return traverse([], rootPageConfig);
}

export type PageHierarchyProp =  {
  pageInfo: PageInfo[],
  loginPageInfo: PageInfo | null,
  matchedParams: Params<string>,
  matchedPageInfo: PageInfo | null,
};


export const PageHierarchyContext = React.createContext({} as PageHierarchyProp);

export const PageHierarchyProvider: React.FC<{children?:JSX.Element}> = ({children}) => {
  const locInfo = useLocation();
  let matchedParams: Params<string> = {};
  let matchedPageInfo: PageInfo | null = null;
  let loginPageInfo: PageInfo | null = null;

  const traverse = (cfg:PageConfig[], stack:Record<string, any[]>): PageInfo[] => {
    const elems = cfg.map(e=>{
      let matched = false;
      const newStack = {...stack};
      newStack.url = [...(newStack.url || []), e.path];
      const curMatched = matchPath(newStack.url.join('/'), locInfo.pathname);
      if (curMatched) {
        matchedParams = curMatched?.params;
        matched = true;
      }

      let children: PageInfo[] | undefined = undefined;
      let matchedAsParent = false;
      let curMatchedAsGrandParent = false;
      let curMatchedAsParent = false;
      if (e.children) {
        children = traverse(e.children, newStack);
        curMatchedAsGrandParent = children.filter(e=>e.matchedAsParent).length > 0;
        curMatchedAsParent = children.filter(e=>e.matched).length > 0;
      }
      matchedAsParent = curMatchedAsGrandParent || curMatchedAsParent || matched;


      const curPageInfo = {
        ...e,
        fullPath: newStack.url.join('/'),
        matched,
        matchedAsParent,
        ...((children)?{children: children as PageInfo[]}: {}),
      } as PageInfo;

      if (curPageInfo.children) {
        curPageInfo.children = curPageInfo.children.map(child=>{ return {...child, parent: curPageInfo}})
      }

      if (matched) matchedPageInfo = curPageInfo;
      if (curPageInfo.isLoginPage) loginPageInfo = curPageInfo;
      return curPageInfo;
    });
    return elems;
  }

  const pageInfo = traverse(rootPageConfig, {});
  return <PageHierarchyContext.Provider value={{
    matchedParams,
    pageInfo,
    matchedPageInfo,
    loginPageInfo,
  }}>
    {children}
  </PageHierarchyContext.Provider>
}

export const usePageHierarchyInfo = ():PageHierarchyProp => {
  return React.useContext(PageHierarchyContext);
}

