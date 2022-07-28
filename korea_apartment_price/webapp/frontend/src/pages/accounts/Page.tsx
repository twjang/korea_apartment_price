import * as React from 'react';
import * as MUI from '@mui/material';
import AccountService, { UserInfo } from '../../services/AccountService';
import { useAuthInfo } from '../../contexts/AuthContext';
import { Paginated } from '../../services/APICaller';
import DenseTable from '../../components/DenseTable';

const Page: React.FC = () => {
  const [userList, setUserList] = React.useState<UserInfo[] | null>(null);
  const [currentPageIdx, setCurrentPageIdx] = React.useState<number>(1);
  const [paginated, setPaginated] = React.useState<Paginated | null>(null);
  const authInfo = useAuthInfo();
  const columns = [
    {
      field: 'id',
      headerName: 'ID',
      width: 100,
    },
    {
      field: 'email',
      headerName: 'E-Mail',
      width: 250,
    },
    {
      field: 'is_admin',
      headerName: 'Admin',
      width: 100,
    },
    {
      field: 'is_active',
      headerName: 'Active',
      width: 100,
    },
    {
      field: 'date_created',
      headerName: 'Registered at',
      width: 250,
    },
    {
      field: 'opts',
      headerName: 'Operations',
      width: 400,
    },
  ];

  React.useEffect(() => {
    (async () => {
      const users = await AccountService.listUsers({
        accessToken: authInfo.bearerToken as string,
        pageidx: currentPageIdx,
        itemsPerPage: 20,
      });
      if (users.success && users.result) {
        setUserList(users.result.users);
        setPaginated(users.result);
      } else {
        setUserList(null);
        setPaginated(null);
      }
    })();
  }, [currentPageIdx]);

  const handleChangePageIdx = (
    e: React.ChangeEvent<unknown>,
    pageIdx: number
  ) => {
    setCurrentPageIdx(pageIdx);
  };

  if (userList && currentPageIdx && paginated) {
    return (
      <MUI.Box>
        <MUI.Pagination
          count={Math.ceil(paginated?.num_items / paginated?.items_per_page)}
          page={currentPageIdx}
          onChange={handleChangePageIdx}
          sx={{ margin: 'auto', marginBottom: 2 }}
        />

        <MUI.Box sx={{ height: '80vh', width: '100%' }}>
          <DenseTable
            rows={userList.map((e) => {
              return {
                id: e.id,
                email: e.email,
                is_admin: <MUI.Checkbox checked={e.is_admin} />,
                is_active: <MUI.Checkbox checked={e.is_active} />,
                date_created: e.date_created,
                opts: [
                  <MUI.Button>Delete</MUI.Button>,
                  <MUI.Button>Reset password</MUI.Button>,
                ],
              };
            })}
            columns={columns}
          />
        </MUI.Box>
      </MUI.Box>
    );
  }

  return <MUI.CircularProgress sx={{ margin: 'auto', marginTop: 2 }} />;
};

export default Page;
