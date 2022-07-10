import * as MUI from '@mui/material'
import * as MUIIcon from '@mui/icons-material';

import { PageConfig } from "..";
import Page from './Page';

export const cfg: PageConfig = {
  path: "/account",
  title: "계정 관리",
  menuIcon: <MUIIcon.Group />,
  menuName: <MUI.Typography>계정 관리</MUI.Typography>,
  element: (<Page />),
  notForGuest: true,
  onlyForAdmin: true,
}