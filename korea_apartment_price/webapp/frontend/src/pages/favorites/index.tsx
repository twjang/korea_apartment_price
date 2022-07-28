import * as MUI from '@mui/material';
import * as MUIIcon from '@mui/icons-material';
import { PageConfig } from '..';
import Page from './Page';

export const cfg: PageConfig = {
  path: '/fav',
  title: '관심 단지',
  menuIcon: <MUIIcon.Star />,
  menuName: <MUI.Typography>관심 단지</MUI.Typography>,
  element: <Page />,
  isDefaultPage: true,
  notForGuest: true,
};
