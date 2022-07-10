import * as MUI from '@mui/material'
import * as MUIIcon from '@mui/icons-material';
import { PageConfig } from "..";
import Page from './Page';

export const cfg: PageConfig = {
  path: "/login",
  title: "로그인",
  isLoginPage: true,
  element: (<Page />)
}