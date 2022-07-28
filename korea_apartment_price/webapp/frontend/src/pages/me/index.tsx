import * as MUI from '@mui/material';
import * as MUIIcon from '@mui/icons-material';

import { PageConfig } from '..';
import Page from './Page';

export const cfg: PageConfig = {
  path: '/me',
  title: '내 정보',
  menuIcon: <MUIIcon.AccountCircle />,
  menuName: <MUI.Typography>내 정보</MUI.Typography>,
  element: <Page />,
  notForGuest: true,
};
