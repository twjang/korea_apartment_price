import * as MUI from '@mui/material';
import * as MUIIcon from '@mui/icons-material';

import { PageConfig } from '..';
import Page from './Page';

export const cfg: PageConfig = {
  path: '/volume',
  title: '주간 거래량 통계',
  menuIcon: <MUIIcon.SsidChart />,
  menuName: <MUI.Typography>주간 거래량 통계</MUI.Typography>,
  element: <Page />,
  notForGuest: true,
};

