import * as qs from 'qs';
import * as React from 'react';
import * as MUI from '@mui/material'
import { useAuthInfo } from '../../contexts/AuthContext';
import { Navigate, useLocation } from 'react-router-dom';

const Page: React.FC= ()=>{
  const [inProgress, setInProgress] = React.useState<boolean>(false);
  const [email, setEmail] = React.useState<string>('');
  const [password, setPassword] = React.useState<string>('');
  const authInfo = useAuthInfo();
  const locInfo = useLocation();
  const queries = qs.parse(locInfo.search);
  const nextUrl = (queries.next || '/').toString();

  const handleSubmit = ()=>{
    setInProgress(true);
    (async ()=>{
      const result = await authInfo.login(email, password);
      setInProgress(false);
    })();
  };

  const handleEmailChange=(e:React.ChangeEvent<HTMLInputElement>)=>{
    setEmail(e.target.value);
  }


  const handlePasswordChange=(e:React.ChangeEvent<HTMLInputElement>)=>{
    setPassword(e.target.value);
  }

  if (!authInfo.isGuest) {
    return (<Navigate to={nextUrl}/>) 
  }

  return (
    <MUI.Box
      component="form"
      sx={{
        maxWidth: '25em',
        width: '100%',
        '& .MuiTextField-root': { m: 1, width: '100%' },
        display: 'flex',
        flexDirection: 'column',
        '& .MuiButton-root': { m: 1 },
      }}
      noValidate
      onSubmit={handleSubmit}
    >
      <MUI.TextField name="username" label="E-mail" id="outlined-size-small" size="small"  disabled={inProgress} value={email} onChange={handleEmailChange}/>
      <MUI.TextField name="password" label="Password" id="outlined-size-small" size="small" type="password" autoComplete="current-password" disabled={inProgress} value={password} onChange={handlePasswordChange} />
      <MUI.Button variant="contained" disabled={inProgress} onClick={handleSubmit}>Login</MUI.Button>
      <MUI.Button disabled={inProgress}>Register</MUI.Button>
    </MUI.Box>
  )
}

export default Page;