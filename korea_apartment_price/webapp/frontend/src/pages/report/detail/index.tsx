import { PageConfig } from '../..';
import Page from './Page';

export const cfg: PageConfig = {
  path: ':favid',
  title: '상세 정보',
  element: <Page />,
  notForGuest: true,
};
