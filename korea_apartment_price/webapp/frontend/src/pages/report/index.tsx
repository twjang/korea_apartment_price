import * as MUI from '@mui/material';
import * as MUIIcon from '@mui/icons-material';
import { PageConfig } from '..';
import Page from './Page';
import * as detail from './detail';

export const cfg: PageConfig = {
  path: '/report',
  title: '리포트',
  menuIcon: <MUIIcon.Apartment />,
  menuName: <MUI.Typography>단지 정보</MUI.Typography>,
  element: <Page />,
  notForGuest: true,
  children: [detail.cfg],
};
