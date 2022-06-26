import * as React from 'react';

export type AuthContextProp = {
  bearer: string,
}

export const AuthContext = React.createContext({} as AuthContextProp);

export const AuthProvider: React.FC<{children:JSX.Element}> = ({ children }) => {
  return <AuthContext.Provider value={{
    bearer: '',
  }}>{children}</AuthContext.Provider>
}

export const useAuthInfo = (): AuthContextProp => {
  return React.useContext(AuthContext);
};
