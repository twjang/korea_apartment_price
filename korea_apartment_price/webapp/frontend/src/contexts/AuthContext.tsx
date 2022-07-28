import * as React from 'react';
import AccountService from '../services/AccountService';
import { useSnackbar } from 'notistack';

export type AuthContextProp = {
  isGuest: boolean;
  isAdmin: boolean;
  bearerToken: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  register: (email: string, password: string) => Promise<boolean>;
};

export const AuthContext = React.createContext({} as AuthContextProp);

export const AuthProvider: React.FC<{
  children?: (JSX.Element | null)[] | JSX.Element;
}> = ({ children }) => {
  const [bearerToken, setBearerToken] = React.useState<string | null>(null);
  const [isAdmin, setIsAdmin] = React.useState<boolean>(true);
  const [isGuest, setIsGuest] = React.useState<boolean>(true);
  const snackbar = useSnackbar();

  React.useEffect(() => {
    const savedToken = localStorage.getItem('token');
    if (savedToken && !bearerToken) {
      setBearerToken(savedToken);
      updateUserFromBearerToken(savedToken);
    }
  }, []);

  const updateUserFromBearerToken = (token: string | null) => {
    if (token && token !== '') {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        window
          .atob(base64)
          .split('')
          .map(function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
          })
          .join('')
      );

      const parsed = JSON.parse(jsonPayload);

      setIsAdmin(parsed?.user?.is_admin || false);
      setIsGuest(false);
    } else {
      setIsAdmin(false);
      setIsGuest(true);
    }
  };

  const logout = async () => {
    if (bearerToken) {
      setBearerToken(null);
      updateUserFromBearerToken(null);
      localStorage.removeItem('token');
      snackbar.enqueueSnackbar('Logged out successfully', {
        variant: 'success',
      });
    }
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    let token = null;
    try {
      token = await AccountService.login({ username: email, password });
    } catch (e) {
      token = null;
    }

    if (token) {
      localStorage.setItem('token', token);
      setBearerToken(token);
      updateUserFromBearerToken(token);
      snackbar.enqueueSnackbar('Logged in successfully', {
        variant: 'success',
      });
      return true;
    } else {
      setBearerToken(null);
      updateUserFromBearerToken(null);
      snackbar.enqueueSnackbar('Login failed', { variant: 'error' });
    }
    return false;
  };

  const register = async (
    email: string,
    password: string
  ): Promise<boolean> => {
    return true;
  };

  return (
    <AuthContext.Provider
      value={{
        bearerToken,
        isAdmin,
        isGuest,
        login,
        logout,
        register,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthInfo = (): AuthContextProp => {
  return React.useContext(AuthContext);
};
