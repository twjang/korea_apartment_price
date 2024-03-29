import * as React from 'react';
import * as MUI from '@mui/material';
import * as MUIIcon from '@mui/icons-material';
import { useSnackbar } from 'notistack';

import DenseTable from '../../components/DenseTable';
import { useAuthInfo } from '../../contexts/AuthContext';
import FavoriteSerivce, { FavoriteList } from '../../services/FavoriteSerivce';
import ApartmentService, {
  ApartmentIdWithSize,
} from '../../services/ApartmentService';
import { ApartmentId } from '../../services/ApartmentService';
import debounce from '../../misc/debounce';
import { useSimpleQuestionModal } from '../../components/SimpleQuestionModal';
import { useNavigate } from 'react-router-dom';

interface FavAddDialogProp {
  open: boolean;
  handleClose?: (e: React.MouseEvent<HTMLButtonElement>) => unknown;
  handleReload?: () => unknown;
}

const reloadDelay = 1000;

const FavAddDialog: React.FC<FavAddDialogProp> = (prop: FavAddDialogProp) => {
  const [address, setAddress] = React.useState<string>('');
  const [name, setName] = React.useState<string>('');
  const [inProgress, setInProgress] = React.useState<boolean>(false);
  const [aptList, setAptList] = React.useState<ApartmentId[]>([]);
  const [sizes, setSizes] = React.useState<number[][]>([]);
  const snackbar = useSnackbar();
  const authInfo = useAuthInfo();

  const handleSearch = () => {
    setInProgress(true);
    setSizes([]);

    (async () => {
      const resp = await ApartmentService.search({
        accessToken: authInfo.bearerToken as string,
        address,
        name,
      });
      if (resp.success && resp.result) {
        const curAptLst = resp.result;
        const allSizes = await Promise.all(
          curAptLst.map((apartId) => {
            return ApartmentService.sizes({
              accessToken: authInfo.bearerToken as string,
              apartId,
            });
          })
        );
        setAptList(curAptLst);
        setSizes(
          allSizes.map((e) => {
            if (e.result && e.success) return e.result;
            return [];
          })
        );
      }
      setInProgress(false);
    })();
  };

  const clearResult = () => {
    setAptList([]);
    setSizes([]);
  };

  const searchOnChange = debounce(
    'fav/searchApartment',
    () => {
      if (address.length > 1 && name.length > 1) handleSearch();
      else clearResult();
    },
    1000
  );

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAddress(e.target.value);
    searchOnChange();
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
    searchOnChange();
  };

  const handleAddFav = (apartIdWithSize: ApartmentIdWithSize) => {
    (async () => {
      const resp = await FavoriteSerivce.add({
        accessToken: authInfo.bearerToken as string,
        apartIdWithSize,
      });
      if (resp.success) {
        snackbar.enqueueSnackbar(
          `${apartIdWithSize.name}이 관심단지로 추가되었습니다.`,
          { variant: 'success' }
        );
      } else {
        snackbar.enqueueSnackbar(
          `${apartIdWithSize.name} 관심단지 추가가 실패했습니다.`,
          { variant: 'error' }
        );
      }
    })();
    if (prop.handleReload) {
      prop.handleReload();
    }
  };

  const columns = [
    {
      field: 'address',
      headerName: '주소/단지',
      width: 400,
    },
    {
      field: 'sizes',
      headerName: '전용면적',
      width: 150,
    },
  ];

  return (
    <MUI.Dialog
      open={prop.open}
      onClose={prop.handleClose}
      aria-labelledby="scroll-dialog-title"
      aria-describedby="scroll-dialog-description"
      maxWidth={'xl'}
      fullWidth={true}
    >
      <MUI.DialogTitle id="scroll-dialog-title">관심단지 추가</MUI.DialogTitle>
      <MUI.DialogContent>
        <MUI.DialogContentText id="scroll-dialog-description" tabIndex={-1}>
          <MUI.Box
            sx={{ display: 'flex', flexDirection: 'row', my: 1, width: '100%' }}
          >
            <MUI.TextField
              sx={{ mx: 1, flexGrow: 1 }}
              label="주소"
              id="outlined-size-small"
              size="small"
              value={address}
              onChange={handleAddressChange}
            />
            <MUI.TextField
              sx={{ mx: 1, flexGrow: 1 }}
              label="단지명"
              id="outlined-size-small"
              size="small"
              value={name}
              onChange={handleNameChange}
            />
          </MUI.Box>

          <MUI.Box
            sx={{
              display: 'flex',
              flexDirection: 'row',
              my: 0.5,
              height: '50vh',
              overflowY: 'scroll',
            }}
          >
            {inProgress ? (
              <MUI.CircularProgress />
            ) : (
              <DenseTable
                columns={columns}
                rows={aptList.map((e, idx) => {
                  return {
                    address: (
                      <>
                        <MUI.Typography>{e.address}</MUI.Typography>
                        <MUI.Typography fontWeight="bold">
                          {e.name}
                        </MUI.Typography>
                      </>
                    ),
                    sizes: (sizes[idx] || []).map((sizeElem) => {
                      const aptIdWithSize = {
                        ...e,
                        size: sizeElem,
                      };
                      return (
                        <MUI.Button
                          key={`${JSON.stringify(aptIdWithSize)}`}
                          onClick={() => handleAddFav(aptIdWithSize)}
                        >
                          {sizeElem}
                        </MUI.Button>
                      );
                    }),
                  };
                })}
              />
            )}
          </MUI.Box>
        </MUI.DialogContentText>
      </MUI.DialogContent>
      <MUI.DialogActions>
        <MUI.Button onClick={prop.handleClose}>닫기</MUI.Button>
      </MUI.DialogActions>
    </MUI.Dialog>
  );
};

const Page: React.FC = () => {
  const [isAddDialogOpen, setAddDialogOpen] = React.useState<boolean>(false);
  const [favList, setFavList] = React.useState<FavoriteList | null>(null);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const authInfo = useAuthInfo();
  const simpleQuestionModal = useSimpleQuestionModal();
  const navigate = useNavigate();

  React.useEffect(() => {
    const onScroll = debounce(
      'fav-scrollUpdate',
      () => {
        localStorage.setItem('fav-scroll', window.scrollY.toString());
      },
      500
    );
    window.addEventListener('scroll', onScroll);

    if (!isLoading) {
      const scrollYStr = localStorage.getItem('fav-scroll');
      if (scrollYStr) {
        window.scrollTo(0, parseFloat(scrollYStr));
      }
    }

    return () => window.removeEventListener('scroll', onScroll);
  }, [isLoading]);

  const columns = [
    {
      field: 'entry',
      headerName: '항목',
      sx: {
        display: 'flow',
        flowDirection: 'row',
        padding: 0,
        margin: 0,
      },
    },
  ];

  React.useEffect(() => {
    if (isLoading) {
      (async () => {
        const favs = await FavoriteSerivce.list({
          accessToken: authInfo.bearerToken as string,
        });
        if (favs.success && favs.result) {
          setFavList(favs.result);
        } else {
          setFavList(null);
        }
        setIsLoading(false);
      })();
    }
  }, [isLoading]);

  const handleDeleteClick = (id: number, name: string, size: number) => {
    simpleQuestionModal.openModal({
      title: <MUI.Typography>관심단지 삭제</MUI.Typography>,
      body: (
        <MUI.Typography>{`${name} ${size}평을 삭제하시겠습니까?`}</MUI.Typography>
      ),
      choices: [
        {
          button: <span style={{ fontWeight: 'bold' }}>삭제</span>,
          handler: () => {
            (async () => {
              if (authInfo.bearerToken) {
                await FavoriteSerivce.remove({
                  accessToken: authInfo.bearerToken,
                  id,
                });
                handleReload();
              }
            })();
          },
        },
        {
          button: <span>취소</span>,
        },
      ],
    });
  };

  const rows: { entry: JSX.Element }[] = [];

  if (favList) {
    const addrNameToIdSize: Record<string, number[][]> = {};
    const addrGroupToAptEnt: Record<
      string,
      { addrRemainder: string; name: string; idSizes: number[][] }[]
    > = {};

    Object.keys(favList).forEach((address) => {
      favList[address].forEach((e) => {
        const key = `${address}/${e.name}`;

        if (!addrNameToIdSize[key]) {
          addrNameToIdSize[key] = [];
        }
        addrNameToIdSize[key].push([e.id, e.size]);
      });
    });

    Object.keys(addrNameToIdSize).forEach((addressName) => {
      const [address, name] = addressName.split('/');
      const addrSplit = address.split(' ');
      const addrGroup = addrSplit.slice(0, 2).join(' ');
      const addrRemainder = addrSplit.slice(2).join(' ');
      if (!addrGroupToAptEnt[addrGroup]) {
        addrGroupToAptEnt[addrGroup] = [];
      }
      addrGroupToAptEnt[addrGroup].push({
        addrRemainder,
        name,
        idSizes: addrNameToIdSize[addressName],
      });
    });

    Object.keys(addrGroupToAptEnt).forEach((addrGroup) => {
      const curAptEntList = addrGroupToAptEnt[addrGroup];
      rows.push({
        entry: (
          <MUI.Box
            sx={{
              px: 1,
              py: 1,
              background: '#EEE',
            }}
          >
            <MUI.Typography sx={{ fontWeight: 'bold' }}>
              {addrGroup}
            </MUI.Typography>
          </MUI.Box>
        ),
      });

      const curRows = curAptEntList.map((e) => {
        const idSizeList = e.idSizes;
        return {
          entry: (
            <MUI.Box
              sx={{
                my: 2,
                mx: 2,
                display: 'flex',
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <MUI.Typography
                sx={{
                  flexGrow: 2,
                  maxWidth: '25em',
                  m: 0,
                  marginRight: 0.4,
                }}
              >
                <span style={{ color: '#888', marginRight: '0.5em' }}>
                  {e.addrRemainder}
                </span>
                <span>{e.name}</span>{' '}
              </MUI.Typography>
              <MUI.Box
                sx={{
                  flexGrow: 1,
                  maxWidth: `${idSizeList.length * 10}em`,
                  textAlign: 'right',
                }}
              >
                {idSizeList.map((idSize) => {
                  const id = idSize[0];
                  const size = idSize[1];
                  return (
                    <MUI.ButtonGroup
                      key={`${id}`}
                      variant="contained"
                      aria-label="outlined primary button group"
                      sx={{ marginRight: 1, marginBottom: 1 }}
                    >
                      <MUI.Button
                        variant="text"
                        sx={{ width: '2em' }}
                        onClick={() => {
                          navigate(`/report/${id}`);
                        }}
                      >
                        {size}
                      </MUI.Button>
                      <MUI.Button
                        onClick={() => {
                          handleDeleteClick(id, e.name, size);
                        }}
                        color="warning"
                      >
                        {' '}
                        <MUIIcon.Delete fontSize="small" />{' '}
                      </MUI.Button>
                    </MUI.ButtonGroup>
                  );
                })}
              </MUI.Box>
            </MUI.Box>
          ),
        };
      });
      rows.push(...curRows);
    });
  }

  const handleAddDialogClose = () => {
    setAddDialogOpen(false);
  };

  const handleAddDialogOpen = () => {
    setAddDialogOpen(true);
  };

  const handleReload = () => {
    setTimeout(() => {
      setIsLoading(true);
    }, reloadDelay);
  };

  return (
    <MUI.Box>
      {isLoading ? (
        <MUI.CircularProgress sx={{ margin: 'auto', marginTop: 2 }} />
      ) : (
        <MUI.Box sx={{ width: '100%' }}>
          <MUI.Fab
            color="primary"
            aria-label="add"
            sx={{
              position: 'fixed',
              bottom: 30,
              left: 100,
            }}
            onClick={handleAddDialogOpen}
          >
            <MUIIcon.Add />
          </MUI.Fab>
          <DenseTable
            rows={rows}
            columns={columns}
            hideTitle
            sx={{ maxWidth: '100%', marginBottom: 10 }}
          />
        </MUI.Box>
      )}
      <FavAddDialog
        open={isAddDialogOpen}
        handleClose={handleAddDialogClose}
        handleReload={handleReload}
      />
    </MUI.Box>
  );
};

export default Page;
