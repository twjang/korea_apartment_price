import * as React from 'react';
import * as MUI from '@mui/material'
import * as MUIIcon from '@mui/icons-material'
import FavoriteService from '../../../services/FavoriteSerivce';
import ApartmentService, { AggregatedOrderbookEntry, ApartmentIdWithSize, RentHistoryEntry, TradeHistoryEntry } from '../../../services/ApartmentService';

import { usePageHierarchyInfo } from '../..';
import { useAuthInfo } from '../../../contexts/AuthContext';
import debounce from '../../../misc/debounce';
import { useNavigate } from 'react-router-dom';

const Page: React.FC= ()=>{
  const pageInfo = usePageHierarchyInfo();
  const authInfo = useAuthInfo();
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [dateRangeScale, setDateRangeScale] = React.useState<number[]>([0.8, 1.0]);
  const [apartIdWithSize, setApartIdWithSize] = React.useState<ApartmentIdWithSize | null>(null);
  const [needDataUpdate, setNeedDataUpdate] = React.useState<boolean>(true);
  const [rents, setRents] = React.useState<RentHistoryEntry[]| null>(null);
  const [trades, setTrades] = React.useState<TradeHistoryEntry[]| null>(null);
  const [orderbook, setOrderbook] = React.useState<AggregatedOrderbookEntry[] | null>(null);
  const navigate = useNavigate();

  let now = new Date();
  now.setHours(23, 59, 59)

  const minDate = (new Date(2011, 0, 1)).getTime() / 1000;
  const maxDate = now.getTime() / 1000;
  const dateFromTs = new Date(((maxDate - minDate) * dateRangeScale[0] + minDate) * 1000);
  const dateToTs   = new Date(((maxDate - minDate) * dateRangeScale[1] + minDate) * 1000);
  const dateFromSerial = dateFromTs.getFullYear() * 10000 + (1+dateFromTs.getMonth()) * 100 + dateFromTs.getDate();
  const dateToSerial = dateToTs.getFullYear() * 10000 + (1+dateToTs.getMonth()) * 100 + dateToTs.getDate();

  const favId = parseInt((pageInfo.matchedParams.favid || '0'));

  React.useEffect(()=>{
    (async()=>{
      const accessToken = authInfo.bearerToken as string;
      const detail = await FavoriteService.get({accessToken, id: favId});
      if (detail.result && detail.success){
        setApartIdWithSize(detail.result);
      }
    })();
  }, [pageInfo]);

  React.useEffect(()=>{
    const accessToken = authInfo.bearerToken as string;
    if (needDataUpdate && apartIdWithSize && accessToken) {
      setNeedDataUpdate(false);
      setIsLoading(true);

      (async ()=>{
        const rents = await ApartmentService.rents({accessToken, apartIdWithSize, dateFrom: dateFromSerial, dateTo: dateToSerial})
        const trades = await ApartmentService.trades({accessToken, apartIdWithSize, dateFrom: dateFromSerial, dateTo: dateToSerial})
        const orderbook = await ApartmentService.orderbook({accessToken, apartIdWithSize, dateFrom: dateFromSerial, dateTo: dateToSerial})
        if (rents.success && rents.result) { setRents(rents.result); }
        if (trades.success && trades.result) { setTrades(trades.result); }
        if (orderbook.success && orderbook.result) { setOrderbook(orderbook.result); }
        setIsLoading(false);
      })();
    }
  }, [needDataUpdate, apartIdWithSize]);

  const updateGraph = debounce('report/:favid/updateGraph', ()=>{ setNeedDataUpdate(true);}, 2000);

  const handleDateRangeChange = (event: Event, v: number | number[], activeThumb: number) => {
    updateGraph();
    if (!Array.isArray(v)) {
      return;
    }
    const rangeValue = v as number[];
    const minDistance = 3600 * 24 * 30 * 6/ (maxDate - minDate);

    if (rangeValue[1] - rangeValue[0] < minDistance) {
      if (activeThumb === 0) {
        const clamped = Math.min(rangeValue[0], 1.0 - minDistance);
        setDateRangeScale([clamped, clamped + minDistance]);
      } else {
        const clamped = Math.max(rangeValue[1], minDistance);
        setDateRangeScale([clamped - minDistance, clamped]);
      }
    } else {
      setDateRangeScale(rangeValue);
    }
  };

  const dateRangeText = (x: number) => {
    const sliderDateFromTs = new Date(((maxDate - minDate) * x + minDate) * 1000);
    const txt = `${sliderDateFromTs.getFullYear()}/${(1+sliderDateFromTs.getMonth())}/${sliderDateFromTs.getDate()}`;
    return txt
  }

  return <MUI.Box sx={{ textAlign: 'left' }}>
    <MUI.Button onClick={()=>{ navigate(-1); }}><MUIIcon.ArrowLeft/>돌아가기</MUI.Button>
    <MUI.Typography>{apartIdWithSize?.address}</MUI.Typography>
    <MUI.Typography variant='h6' sx={{marginBottom: 1}}>{apartIdWithSize?.name}</MUI.Typography>
    <MUI.Box>
      <MUI.Box>
        <MUI.Slider
          value={dateRangeScale}
          onChange={handleDateRangeChange}
          valueLabelDisplay="auto"
          valueLabelFormat={dateRangeText}
          min={0}
          max={1}
          step={0.001}
        />
      </MUI.Box>
      <MUI.Box sx={{display:'flex', flexDirection:'row', justifyContent:'space-between'}}>
        <MUI.Typography sx={{display: 'inline', fontSize: '0.7em'}}>{dateRangeText(dateRangeScale[0])}</MUI.Typography>
        <MUI.Typography sx={{display: 'inline', fontSize: '0.7em'}}>{dateRangeText(dateRangeScale[1])}</MUI.Typography>
      </MUI.Box>
    </MUI.Box>
    
    {(isLoading?(<MUI.CircularProgress />):(
      <></>
    ))}
  </MUI.Box>
}

export default Page;