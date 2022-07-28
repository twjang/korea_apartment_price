import * as qs from 'qs';
import * as React from 'react';
import * as MUI from '@mui/material';
import { useAuthInfo } from '../../contexts/AuthContext';
import { Navigate, useLocation } from 'react-router-dom';

const Page: React.FC = () => {
  const [inProgress, setInProgress] = React.useState<boolean>(false);
  const emailRef = React.useRef<HTMLInputElement>(null);
  const passwordRef = React.useRef<HTMLInputElement>(null);
  const formRef = React.useRef<HTMLFormElement>(null);
  const authInfo = useAuthInfo();
  const locInfo = useLocation();
  const queries = qs.parse(locInfo.search);
  const nextUrl = (queries.next || '/').toString();

  const handleSubmit = () => {
    setInProgress(true);
    (async () => {
      if (emailRef.current && passwordRef.current) {
        const email = emailRef.current.value || '';
        const password = passwordRef.current.value || '';
        const result = await authInfo.login(email, password);
        if (!result) {
          passwordRef.current.focus();
          passwordRef.current.value = '';
        }
      }
      setInProgress(false);
    })();
  };

  const handleEmailKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (emailRef.current && passwordRef.current) {
        passwordRef.current.focus();
      }
    }
  };

  const handlePasswordKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (formRef.current) {
        formRef.current.requestSubmit();
      }
    }
  };

  if (!authInfo.isGuest) {
    return <Navigate to={nextUrl} />;
  }

  return (
    <MUI.Box
      sx={{
        maxWidth: '25em',
        width: '100%',
        '& .MuiTextField-root': { m: 1, width: '100%' },
        display: 'flex',
        flexDirection: 'column',
        '& .MuiButton-root': { m: 1 },
      }}
    >
      <form
        name="login"
        ref={formRef}
        method="POST"
        onSubmit={(e: React.FormEvent) => {
          e.preventDefault();
          handleSubmit();
        }}
        noValidate
      >
        <MUI.TextField
          inputRef={emailRef}
          name="username"
          label="E-mail"
          size="small"
          disabled={inProgress}
          onKeyDown={handleEmailKeyDown}
        />
        <MUI.TextField
          inputRef={passwordRef}
          name="password"
          label="Password"
          size="small"
          type="password"
          autoComplete="current-password"
          disabled={inProgress}
          onKeyDown={handlePasswordKeyDown}
        />
        <MUI.Button
          variant="contained"
          disabled={inProgress}
          onClick={() => {
            if (formRef.current) formRef.current.requestSubmit();
          }}
        >
          Login
        </MUI.Button>
      </form>
      <MUI.Button disabled={inProgress}>Register</MUI.Button>
    </MUI.Box>
  );
};

export default Page;
