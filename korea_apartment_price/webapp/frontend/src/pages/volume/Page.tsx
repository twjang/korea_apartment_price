import * as React from 'react';
import * as MUI from '@mui/material';

import Grid from '@mui/material/Grid';
import TextField from '@mui/material/TextField';
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import Plot from 'react-plotly.js';


import debounce from '../../misc/debounce';
import RegionCodeService, { RegionCode } from '../../services/RegionCodeService';
import VolumeDataService from '../../services/VolumeService';
import { useAuthInfo } from '../../contexts/AuthContext';
import { VolumeData } from '../../services/VolumeService';


interface SearchAddressCodeDialogProp {
  open: boolean;
  initialAddresses?: RegionCode[];
  handleClose?: ()=>unknown;
  handleChangeAddresses?: (addrs:RegionCode[])=>any;
}

const SearchAddressCodeDialog: React.FC<SearchAddressCodeDialogProp> = (prop: SearchAddressCodeDialogProp) => {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<RegionCode[]>([]);
  const [selectedAddresses, setSelectedAddresses] = React.useState<Record<string, RegionCode>>(
    (prop.initialAddresses)? (()=>{
      const res: Record<string, RegionCode> = {};
      prop.initialAddresses.forEach(e=>{
        res[e.lawaddrcode] = e;
      });
      return res;
    })() : {});

  const [isSearchLoading, setIsSearchLoading] = React.useState<boolean>(false);
  const authInfo = useAuthInfo();

  React.useEffect(()=>{
    if (prop.open) {
      if (prop.initialAddresses) {
        const res: Record<string, RegionCode> = {};
        prop.initialAddresses.forEach(e=>{
          res[e.lawaddrcode] = e;
        });
        setSelectedAddresses(res);
      } else {
        setSelectedAddresses({});
      }
    }
  }, [prop.open]);

  const searchAddress = debounce(
    'volume/addrSearch',
    ()=>{
      setIsSearchLoading(true);
      (async()=>{
        const resp = await RegionCodeService.searchRegionCode({
          accessToken: authInfo.bearerToken as string,
          address: searchTerm,
        });
        if (resp.success && resp.result) {
          console.log(resp);
          const searchRes = resp.result.filter(e=>e.lawaddrcode.endsWith('00000'));
          setSearchResults(searchRes);
        }
        setIsSearchLoading(false);
      })();
    },
    1000
  );

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    setSearchTerm(value);
    searchAddress();
  };

  const RegionCodeItem = (props: {item: RegionCode} ) => {
    const item = props.item;
    const itemSelected = !!(selectedAddresses[item.lawaddrcode]);

    const toggleItem = () => {
      if (!itemSelected) {
        const newSelectedAddresses = Object.assign({}, selectedAddresses);
        newSelectedAddresses[item.lawaddrcode] = item;
        setSelectedAddresses(newSelectedAddresses);
      } else {
        const newSelectedAddresses = Object.assign({}, selectedAddresses);
        delete newSelectedAddresses[item.lawaddrcode];
        setSelectedAddresses(newSelectedAddresses);
      }
    }

    return  (<MUI.ListItemButton role={undefined} onClick={toggleItem} dense>
              <MUI.ListItemIcon>
                <Checkbox
                  edge="start"
                  checked={itemSelected}
                  tabIndex={-1}
                  disableRipple
                />
              </MUI.ListItemIcon>
              <MUI.ListItemText id={item.lawaddrcode} primary={item.address} />
            </MUI.ListItemButton>);
  };

  const addAllSearchResults = () => {
      const newSelectedAddresses = Object.assign({}, selectedAddresses);
      searchResults.forEach((item)=>{
        newSelectedAddresses[item.lawaddrcode] = item;
      });
      setSelectedAddresses(newSelectedAddresses);
  };
  const removeAllSelected = () => {
    setSelectedAddresses({});
  }


  return (
    <MUI.Dialog
      open={prop.open}
      onClose={prop.handleClose}
      aria-labelledby="scroll-dialog-title"
      aria-describedby="scroll-dialog-description"
      maxWidth={'xl'}
      fullWidth={true}
    >

    <MUI.DialogTitle id="scroll-dialog-title">주소 변경</MUI.DialogTitle>
      <MUI.DialogContent>
        <MUI.DialogContentText id="scroll-dialog-description" tabIndex={-1}>
          <Grid container rowSpacing={1} style={{ paddingTop: '1em', margin: 'auto' }}>
           <Grid item xs={12}>
            <TextField
              label="주소 검색"
              value={searchTerm}
              onChange={handleSearchChange} fullWidth />
           </Grid>
           <Grid item xs={6}>
            <MUI.Paper style={{ padding: '1em' }}>
              <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5em'  }}>
                <MUI.Typography fontStyle={{ fontWeight: 'bold' }}>검색 결과</MUI.Typography>
                <MUI.Button variant="outlined" onClick={()=>{ addAllSearchResults(); }}>모두 추가</MUI.Button>
              </div>
            {isSearchLoading ? (
              <MUI.CircularProgress />
            ) : (
              <List style={{ height: '40vh', overflow: 'auto'}}>
                {searchResults.map((item) => (
                  <RegionCodeItem item={item} key={item.lawaddrcode}/>
                ))}
              </List>
            )}
            </MUI.Paper>
          </Grid>
         <Grid item xs={6}>
            <MUI.Paper style={{ padding: '1em' }}>
              <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5em' }}>
                <MUI.Typography fontStyle={{ fontWeight: 'bold' }}>선택된 주소</MUI.Typography>
                <MUI.Button variant="outlined" onClick={()=>{ removeAllSelected(); }}>모두 삭제</MUI.Button>
              </div>
            <List style={{ height: '40vh', overflow: 'auto'}}>
              {Object.keys(selectedAddresses).sort().map((addrcode) => {
                const item = selectedAddresses[addrcode];
                return (
                  <RegionCodeItem item={item} key={item.lawaddrcode}/>
                );
              })}
            </List>
            </MUI.Paper>
        </Grid>
        </Grid>
      </MUI.DialogContentText>
    </MUI.DialogContent>
    <MUI.DialogActions>
        <MUI.Button onClick={()=>{
          if (prop.handleClose) {
            prop.handleClose();
          }
          }}>취소</MUI.Button>
        <MUI.Button variant="contained" onClick={()=>{
          if (prop.handleChangeAddresses) {
            const res = Object.keys(selectedAddresses).map(k=>{
              return selectedAddresses[k];
            });
            prop.handleChangeAddresses(res);
          }
          if (prop.handleClose) {
            prop.handleClose();
          }
        }}>확인</MUI.Button>
      </MUI.DialogActions>
    </MUI.Dialog>
  );
};

interface VolumeParams {
  sizeFrom?: number;
  sizeTo?: number;
  priceFrom?: number;
  priceTo?: number;
  dateFrom?: number;
  dateTo?: number;
}

interface ParamEditDialogProp {
  open: boolean;
  handleClose?: () => unknown;
  handleChangeParams?: (v: VolumeParams) => unknown;
  initialParams?: VolumeParams;
}

const ParamEditDialog: React.FC<ParamEditDialogProp> = (prop: ParamEditDialogProp) => {
  const [sizeFrom, setSizeFrom] = React.useState<number | null>(prop.initialParams?.sizeFrom || null);
  const [sizeTo, setSizeTo] = React.useState<number | null>(prop.initialParams?.sizeTo || null);
  const [priceFrom, setPriceFrom] = React.useState<number | null>(prop.initialParams?.priceFrom || null);
  const [priceTo, setPriceTo] = React.useState<number | null>(prop.initialParams?.priceTo || null);
  const [dateFrom, setStartDate] = React.useState<number | null>(prop.initialParams?.dateFrom || null);
  const [dateTo, setEndDate] = React.useState<number | null>(prop.initialParams?.dateTo || null);

  React.useEffect(()=>{
    if (prop.open) {
      if (prop.initialParams?.sizeFrom) setSizeFrom(prop.initialParams?.sizeFrom);
      if (prop.initialParams?.sizeTo) setSizeTo(prop.initialParams?.sizeTo);
      if (prop.initialParams?.priceFrom) setPriceFrom(prop.initialParams?.priceFrom);
      if (prop.initialParams?.priceTo) setPriceTo(prop.initialParams?.priceTo);
      if (prop.initialParams?.dateFrom) setStartDate(prop.initialParams?.dateFrom);
      if (prop.initialParams?.dateTo) setEndDate(prop.initialParams?.dateTo);
    }
  }, [prop.open])

  const handleSizeFromChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const v = (event.target.value)? Number(event.target.value): null;
    setSizeFrom(v);
  };

  const handleSizeToChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const v = (event.target.value)? Number(event.target.value): null;
    setSizeTo(v);
  };

  const handlePriceFromChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const v = (event.target.value)? Number(event.target.value): null;
    setPriceFrom(v);
  };

  const handlePriceToChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const v = (event.target.value)? Number(event.target.value): null;
    setPriceTo(v);
  };

  const handleStartDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const v = (event.target.value)? Number(event.target.value): null;
    setStartDate(v);
  };

  const handleEndDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const v = (event.target.value)? Number(event.target.value): null;
    setEndDate(v);
  };

  return (
    <MUI.Dialog
      open={prop.open}
      onClose={prop.handleClose}
      aria-labelledby="scroll-dialog-title"
      aria-describedby="scroll-dialog-description"
      maxWidth={'xl'}
      fullWidth={true}
    >

      <MUI.DialogTitle id="scroll-dialog-title">범위 변경</MUI.DialogTitle>
      <MUI.DialogContent>
        <MUI.DialogContentText id="scroll-dialog-description" tabIndex={-1}>
          <Grid container rowSpacing={3} style={{ paddingTop: '1em', margin: 'auto' }}>
              <Grid item xs={5}>
                <TextField
                  label="전용면적(평, 최소)"
                  value={sizeFrom}
                  onChange={handleSizeFromChange}
                  type="number"
                  fullWidth
                />
              </Grid>
              <Grid item xs={1} style={{ fontSize: '20pt', textAlign: 'center'}}>~</Grid>
              <Grid item xs={5}>
                <TextField
                  label="전용면적(평, 최대)"
                  value={sizeTo}
                  onChange={handleSizeToChange}
                  type="number"
                  fullWidth
                />
              </Grid>
              <Grid item xs={5}>
                <TextField
                  label="가격(최소)"
                  value={priceFrom}
                  onChange={handlePriceFromChange}
                  type="number"
                  fullWidth
                />
              </Grid>
              <Grid item xs={1} style={{ fontSize: '20pt', textAlign: 'center'}}>~</Grid>
              <Grid item xs={5}>
                <TextField
                  label="가격(최대)"
                  value={priceTo}
                  onChange={handlePriceToChange}
                  type="number"
                  fullWidth
                />
              </Grid>
              <Grid item xs={5}>
                <TextField
                  label="시작일 (yyyymmdd)"
                  value={dateFrom}
                  onChange={handleStartDateChange}
                  fullWidth
                />
              </Grid>
              <Grid item xs={1} style={{ fontSize: '20pt', textAlign: 'center'}}>~</Grid>
              <Grid item xs={5}>
                <TextField
                  label="종료일 (yyyymmdd)"
                  value={dateTo}
                  onChange={handleEndDateChange}
                  fullWidth
                />
              </Grid>
          </Grid>
        </MUI.DialogContentText>
      </MUI.DialogContent>
      <MUI.DialogActions>
        <MUI.Button onClick={()=>{
          if (prop.handleClose) {
            prop.handleClose();
          }
          }}>취소</MUI.Button>
        <MUI.Button variant="contained" onClick={()=>{
          if (prop.handleChangeParams) {
            const res: VolumeParams = {
              ...(sizeTo?   {sizeTo}: {}),
              ...(sizeFrom? {sizeFrom}: {}),
              ...(priceTo?   {priceTo}: {}),
              ...(priceFrom? {priceFrom}: {}),
              ...(dateFrom?   {dateFrom}: {}),
              ...(dateTo? {dateTo}: {}),
            };
            prop.handleChangeParams(res);
          }
          if (prop.handleClose) {
            prop.handleClose();
          }
        }}>확인</MUI.Button>
      </MUI.DialogActions>
    </MUI.Dialog>
  );
} 

const Page: React.FC = () => {
  const [isParamEditDialogOpen, setParamEditDialogOpen] = React.useState<boolean>(false);
  const [isSearchAddressCodeDialogOpen, setSearchAddressCodeDialogOpen] = React.useState<boolean>(false);
  const [selectedAddresses, setSelectedAddresses] = React.useState<RegionCode[]>([]);
  const [volumeParams, setVolumeParams] = React.useState<VolumeParams>({});
  const [isGraphLoading, setIsGraphLoading] = React.useState<boolean>(false);
  const [data, setData] = React.useState<VolumeData | null>(null);
  const [graphTitle, setGraphTitle] = React.useState<string>('');
  const authInfo = useAuthInfo();

  const handleSearchAddressCodeDialogOpen = () => {  setSearchAddressCodeDialogOpen(true); };
  const handleSearchAddressCodeDialogClose = () => { setSearchAddressCodeDialogOpen(false); };

  const handleParamEditDialogOpen = () => {
    setParamEditDialogOpen(true);
  };

  const handleParamEditDialogClose = () => {
    setParamEditDialogOpen(false);
  };

  const showGraph = () => {
    setIsGraphLoading(true);
    console.log('clicked');
    (async() => {
      const resp = await VolumeDataService.getVolume({
        accessToken: authInfo.bearerToken as string,
        addressCodes: selectedAddresses.map(e=>{ return e.lawaddrcode.slice(0, 5); }),
        ...volumeParams
      });
      console.log(resp);

      if (resp.success && resp.result) {
        let title = `${selectedAddresses[0].address}`
        title += (selectedAddresses.length > 1)? (" 외 " + (selectedAddresses.length -1) + "개 지역 ") : " ";
        title += '주간 거래량';

        setGraphTitle(title);
        setData(resp.result);
      }

      setIsGraphLoading(false);     
    })();
  }

  const showButtonEnabled = (selectedAddresses.length > 0);

  return (
    <MUI.Box style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <MUI.Paper style={{ flexGrow: 0, flexShrink: 0 }}>
        <div style={{ padding: '1em' }}>
          {(volumeParams?.sizeFrom || volumeParams?.sizeTo)?
          <div style={{ display:'flex', flexDirection:'row' }}>
            <MUI.Typography fontStyle={{ fontWeight: 'bold'}} style={{ width: '10em'}}>전용 면적</MUI.Typography>
            <MUI.Typography style={{ marginLeft: '1em' }}>
            {(volumeParams?.sizeFrom)? `${volumeParams.sizeFrom} 평`: ``} ~ 
            {(volumeParams?.sizeTo)? `${volumeParams.sizeTo} 평`: ``}
            </MUI.Typography>
          </div>: <></>} 

          {(volumeParams?.priceFrom || volumeParams?.priceTo)?
          <div style={{ display:'flex', flexDirection:'row' }}>
            <MUI.Typography fontStyle={{ fontWeight: 'bold'}} style={{ width: '10em'}}>가격</MUI.Typography>
            <MUI.Typography style={{ marginLeft: '1em' }}>
            {(volumeParams?.priceFrom)? `${volumeParams.priceFrom} 억`: ``} ~ 
            {(volumeParams?.priceTo)? `${volumeParams.priceTo} 억`: ``}
            </MUI.Typography>
          </div>: <></>} 

          {(volumeParams?.dateFrom || volumeParams?.dateTo )?
          <div style={{ display:'flex', flexDirection:'row' }}>
            <MUI.Typography fontStyle={{ fontWeight: 'bold'}} style={{ width: '10em'}}>날짜 범위</MUI.Typography>
            <MUI.Typography style={{ marginLeft: '1em' }}>
            {(volumeParams?.dateFrom)? `${volumeParams.dateFrom}`: ``} ~ 
            {(volumeParams?.dateTo)? `${volumeParams.dateTo}`: ``}
            </MUI.Typography>
          </div>: <></>} 

          <div style={{ display:'flex', flexDirection:'row' }}>
            <MUI.Typography fontStyle={{ fontWeight: 'bold'}} style={{ width: '10em', flexShrink: 0, flexGrow: 0}}>지역</MUI.Typography>
            <MUI.Typography style={{ marginLeft: '1em', flexShrink: 1, flexGrow: 1, textAlign: 'left'}}>
              {(selectedAddresses.length > 0)? selectedAddresses.map(e=>{ return e.address }).join(', '): '지역을 선택해주세요'}
            </MUI.Typography>
          </div>

        </div>
        <MUI.Divider />
        <div style={{ padding: '1em', display: 'flex', flexDirection: 'row', justifyContent: 'space-between' }}>
          <div>
            <MUI.Button variant="outlined" onClick={()=>{handleSearchAddressCodeDialogOpen(); }}>지역 변경</MUI.Button>
            <MUI.Button variant="outlined" onClick={()=>{handleParamEditDialogOpen();}} style={{ marginLeft: '0.5em'}}>범위 변경</MUI.Button>
          </div>
          <div>
            <MUI.Button variant="contained" onClick={()=>{ showGraph(); }} disabled={!showButtonEnabled}>조회</MUI.Button>
          </div>
        </div>
      </MUI.Paper>
      <MUI.Box style={{ flexGrow: 1, flexShrink: 1, marginTop: '2em', height: '60vh'}}>
      {
        (isGraphLoading)? 
        <MUI.CircularProgress />:
         ((data)? <>
            <Plot
              data={[
                {
                  x: data.dates,
                  y: data.count,
                  type: 'scatter',
                  mode: 'lines',
                  name: '거래량(건)'
                },
                {
                  x: data.dates,
                  y: data.total_price,
                  type: 'scatter',
                  mode: 'lines',
                  name: '거래량(억원)'
                },
                {
                  x: data.dates,
                  y: data.avg_price,
                  type: 'scatter',
                  mode: 'lines',
                  name: '평균거래가(억원)'
                },
              ]}
              layout={{
                title: graphTitle
              }}
              useResizeHandler={true}
              style={{width: '100%', height: '100%' }}
            />
         </>: <MUI.Typography>데이터 없음</MUI.Typography>)
      }
      </MUI.Box>
      <SearchAddressCodeDialog 
        open={isSearchAddressCodeDialogOpen}
        handleClose={handleSearchAddressCodeDialogClose}
        initialAddresses={selectedAddresses}
        handleChangeAddresses={(addrs)=>{
          setSelectedAddresses(addrs);
        }}
      />
      <ParamEditDialog
        open={isParamEditDialogOpen}
        handleClose={handleParamEditDialogClose}
        initialParams={volumeParams}
        handleChangeParams={(p)=>{
          setVolumeParams(p);
        }}
      />
    </MUI.Box>
  )
}


export default Page;

