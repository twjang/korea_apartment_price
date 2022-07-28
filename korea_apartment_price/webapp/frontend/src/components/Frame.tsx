import React from 'react';
import { PageInfo, usePageHierarchyInfo } from '../pages';
import { styled, useTheme, Theme, CSSObject } from '@mui/material/styles';
import Box from '@mui/material/Box';
import MuiDrawer from '@mui/material/Drawer';
import MuiAppBar, { AppBarProps as MuiAppBarProps } from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import List from '@mui/material/List';
import CssBaseline from '@mui/material/CssBaseline';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import { useAuthInfo } from '../contexts/AuthContext';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Button } from '@mui/material';

const drawerWidth = 240;

const openedMixin = (theme: Theme): CSSObject => ({
  width: drawerWidth,
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen,
  }),
  overflowX: 'hidden',
});

const closedMixin = (theme: Theme): CSSObject => ({
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  overflowX: 'hidden',
  width: `calc(${theme.spacing(7)} + 1px)`,
  [theme.breakpoints.up('sm')]: {
    width: `calc(${theme.spacing(8)} + 1px)`,
  },
});

const DrawerHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  padding: theme.spacing(0, 1),
  // necessary for content to be below app bar
  ...theme.mixins.toolbar,
}));

interface AppBarProps extends MuiAppBarProps {
  open?: boolean;
}

const AppBar = styled(MuiAppBar, {
  shouldForwardProp: (prop) => prop !== 'open',
})<AppBarProps>(({ theme, open }) => ({
  zIndex: theme.zIndex.drawer + 1,
  transition: theme.transitions.create(['width', 'margin'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  ...(open && {
    marginLeft: drawerWidth,
    width: `calc(100% - ${drawerWidth}px)`,
    transition: theme.transitions.create(['width', 'margin'], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
  }),
}));

const Drawer = styled(MuiDrawer, {
  shouldForwardProp: (prop) => prop !== 'open',
})(({ theme, open }) => ({
  width: drawerWidth,
  flexShrink: 0,
  whiteSpace: 'nowrap',
  boxSizing: 'border-box',
  ...(open && {
    ...openedMixin(theme),
    '& .MuiDrawer-paper': openedMixin(theme),
  }),
  ...(!open && {
    ...closedMixin(theme),
    '& .MuiDrawer-paper': closedMixin(theme),
  }),
}));

const Frame: React.FC = () => {
  const theme = useTheme();
  const [open, setOpen] = React.useState(false);
  const authInfo = useAuthInfo();
  const pageInfo = usePageHierarchyInfo();
  const navigate = useNavigate();

  const handleDrawerOpen = () => {
    setOpen(true);
  };

  const handleDrawerClose = () => {
    setOpen(false);
  };

  const handleLoginLogout = () => {
    if (authInfo.isGuest && pageInfo.loginPageInfo) {
      navigate(pageInfo.loginPageInfo?.fullPath);
    } else {
      authInfo.logout();
    }
  };

  const hasNoPermission =
    (pageInfo.matchedPageInfo?.notForGuest && authInfo.isGuest) ||
    (pageInfo.matchedPageInfo?.onlyForAdmin && !authInfo.isAdmin);
  if (hasNoPermission && pageInfo.loginPageInfo) {
    return <Navigate to={pageInfo.loginPageInfo?.fullPath} />;
  }

  const menuItems: JSX.Element[] = [];
  const generateMenuItems = (
    parentPaths: string[],
    depth: number,
    cfg: PageInfo[]
  ) => {
    cfg.forEach((e) => {
      let needToDraw = true;
      if (e.menuIcon && e.menuName) {
        if (e.onlyForAdmin && !authInfo.isAdmin) {
          needToDraw = false;
        }
        if (e.notForGuest && authInfo.isGuest) {
          needToDraw = false;
        }
      } else {
        needToDraw = false;
      }
      if (needToDraw) {
        const isSelected = e.matchedAsParent;
        const itemUrl = e.fullPath;
        const item = (
          <ListItem key={itemUrl} disablePadding sx={{ display: 'block' }}>
            <ListItemButton
              sx={{
                minHeight: 48,
                justifyContent: open ? 'initial' : 'center',
                px: 2.5,
              }}
              selected={isSelected}
              component={Link}
              to={itemUrl}
            >
              <ListItemIcon
                sx={{
                  minWidth: 0,
                  mr: open ? 3 : 'auto',
                  justifyContent: 'center',
                }}
              >
                {e.menuIcon}
              </ListItemIcon>
              <ListItemText
                primary={e.menuName}
                sx={{ opacity: open ? 1 : 0 }}
              />
            </ListItemButton>
          </ListItem>
        );
        menuItems.push(item);
      }
    });
  };
  generateMenuItems([], 0, pageInfo.pageInfo);

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar position="fixed" open={open}>
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            onClick={handleDrawerOpen}
            edge="start"
            sx={{
              marginRight: 5,
              ...(open && { display: 'none' }),
            }}
          >
            <MenuIcon />
          </IconButton>
          <Typography
            variant="h6"
            noWrap
            component="div"
            sx={{ flexGrow: 1, textAlign: 'left' }}
          >
            {pageInfo?.matchedPageInfo?.title}
          </Typography>
          <Button color="inherit" onClick={handleLoginLogout}>
            {authInfo.isGuest ? 'Login' : 'Logout'}
          </Button>
        </Toolbar>
      </AppBar>
      <Drawer variant="permanent" open={open}>
        <DrawerHeader>
          <IconButton onClick={handleDrawerClose}>
            {theme.direction === 'rtl' ? (
              <ChevronRightIcon />
            ) : (
              <ChevronLeftIcon />
            )}
          </IconButton>
        </DrawerHeader>
        <Divider />
        <List>{menuItems}</List>
      </Drawer>
      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <DrawerHeader />
        {pageInfo?.matchedPageInfo?.element}
      </Box>
    </Box>
  );
};

export default Frame;
