import * as React from 'react';
import * as MUI from '@mui/material'
import * as MUIIcon from '@mui/icons-material'
import FavoriteService from '../../../services/FavoriteSerivce';
import ApartmentService, { AggregatedOrderbookEntry, ApartmentIdWithSize, RentHistoryEntry, TradeHistoryEntry } from '../../../services/ApartmentService';

import { usePageHierarchyInfo } from '../..';
import { useAuthInfo } from '../../../contexts/AuthContext';
import debounce from '../../../misc/debounce';
import { useNavigate } from 'react-router-dom';
import ChartCanvas from '../../../components/ChartCanvas';
import ChartPointMarkerGroup from '../../../components/ChartCanvas/objects/PointMarkerGroup';
import ChartDemo from '../../../components/ChartCanvas/demo';
import ChartLineGroup from '../../../components/ChartCanvas/objects/LineGroup';
import ChartStyledPathGroup, { Path } from '../../../components/ChartCanvas/objects/StyledPathGroup';

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
      setRents(null);
      setTrades(null);
      setOrderbook(null);

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

  const dateSerialToDay = (x: number): number => {
    const xString = x.toString();
    const xDate = new Date(`${xString.slice(0, 4)}-${xString.slice(4, 6)}-${xString.slice(6)}`);
    const dateFrom0 = Math.floor(xDate.getTime() / 1000 / 3600 / 24);
    return dateFrom0;
  }

  const [chartTradesX, chartTradesY, minTradesY, maxTradesY] = React.useMemo<[Float32Array | null, Float32Array | null, number, number]>(()=>{
    let x: Float32Array | null = null;
    let y: Float32Array | null = null;
    let minY: number = 0;
    let maxY: number = 1;

    if (trades && trades.length > 0) {
      x = new Float32Array(trades.length);
      y = new Float32Array(trades.length);
      trades.forEach((e, idx) => {
        x![idx] = (dateSerialToDay(e.date_serial) - dateSerialToDay(dateFromSerial)) / 30;
        y![idx] = (e.price / 10000);
        if (minY === 0 || minY > y![idx]) minY = y![idx];
        if (maxY === 1 || maxY < y![idx]) maxY = y![idx];
      })
    }
    return [x, y, minY, maxY];
  }, [trades]);

  const [chartRentsX, chartRentsY, minRentsY, maxRentsY] = React.useMemo<[Float32Array | null, Float32Array | null, number, number]>(()=>{
    let x: Float32Array | null = null;
    let y: Float32Array | null = null;
    let minY: number = 0;
    let maxY: number = 1;

    if (rents && rents.length > 0) {
      x = new Float32Array(rents.length);
      y = new Float32Array(rents.length);
      rents.forEach((e, idx) => {
        x![idx] = (dateSerialToDay(e.date_serial) - dateSerialToDay(dateFromSerial)) / 30;
        y![idx] = (e.price_deposit + (e.price_monthly * 12 / 0.042)) / 10000;
        if (minY === 0 || minY > y![idx]) minY = y![idx];
        if (maxY === 1 || maxY < y![idx]) maxY = y![idx];
      })
    }
    return [x, y, minY, maxY];
  }, [rents]);

  const [chartOrderbookPaths, minOrderbookY, maxOrderbookY] = React.useMemo<[Path[], number, number]>(()=>{
    let paths: Path[] = [];
    let minY: number = 0;
    let maxY: number = 1;

    if (orderbook && orderbook.length > 0) {
      let prevX: number | null = null;
      let maxCnt = 1;

      orderbook.forEach((egroup, idx) => {
        egroup.items.forEach(e => {
          maxCnt = Math.max(maxCnt, e.homes.length);
        })
      });

      orderbook.forEach((egroup, idx) => {
        const x = (dateSerialToDay(parseInt(egroup.fetched_date)) - dateSerialToDay(dateFromSerial)) / 30;
        egroup.items.forEach(e => {
          const xStart = (prevX !== null)? prevX: x - 1 / 30;
          const xEnd = x;
          const y = e.price;
          const cnt = e.homes.length;
          if (minY === 0 || minY > y) minY = y;
          if (maxY === 1 || maxY < y) maxY = y;
          paths.push({
            x: new Float32Array([xStart-1, xEnd + 1]),
            y: new Float32Array([y, y]),
            // color: 0xFF000000 + Math.floor(200 * cnt / maxCnt + 50)
          });
        })
        prevX = x;
      })
    }
    return [paths.slice(0, 1), minY, maxY];
  }, [orderbook]);

  let minDataX = 0;
  let maxDataX = (dateSerialToDay(dateToSerial) - dateSerialToDay(dateFromSerial)) / 30;
  let minDataY = Math.max(Math.min(minTradesY, minRentsY, minOrderbookY) - 1, 0);
  let maxDataY = Math.max(maxTradesY, maxRentsY, maxOrderbookY) + 1;

  return <MUI.Box sx={{ textAlign: 'left' }}>
    <MUI.Button onClick={()=>{ navigate(-1); }}><MUIIcon.ArrowLeft/>돌아가기</MUI.Button>
    <MUI.Typography>{apartIdWithSize?.address}</MUI.Typography>
    <MUI.Typography variant='h6' sx={{marginBottom: 1}}>{apartIdWithSize?.name} 
      <MUI.Typography variant='body1' sx={{ color: '#888', display:'inline', marginLeft: '1em' }}>전용 {apartIdWithSize?.size} 평</MUI.Typography>
    </MUI.Typography>
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
    
    <div style={{
      width: '100%',
      height: '80vh'
    }}>
    {(isLoading)?
      (<MUI.CircularProgress />): 
      (<ChartCanvas chartRegion={[0.1, 0.1, 0.9, 0.9]} dataRange={[minDataX, minDataY, maxDataX, maxDataY]}>
         
          {(chartTradesX && chartTradesY &&
            <ChartPointMarkerGroup x={chartTradesX!} y={chartTradesY!} size={10}
              fillColor={0x0000FFFF}
              borderColor={0x000000FF}
              borderWidth={2}
              zOrder={2}
              markerType="o" />)}
          {(chartRentsX && chartRentsY && 
            <ChartPointMarkerGroup x={chartRentsX!} y={chartRentsY!} size={10}
              fillColor={0xFFFF00FF}
              borderColor={0x000000FF}
              borderWidth={2}
              zOrder={1}
              markerType="triangle" />)}
          {(chartOrderbookPaths && 
            <ChartStyledPathGroup
              paths={chartOrderbookPaths}
              width={3}
              color={0xFF0000FF}
              dashType={[10]}
              zOrder={0}
            />)}
        
      </ChartCanvas>)
      }
    </div>
  </MUI.Box>
}

/*


      (
        (chartTradesX && chartTradesY) ?
            <ChartPointMarkerGroup x={chartTradesX!} y={chartTradesY!} size={13}
              fillColor={0x0000FFFF}
              borderColor={0x000101FF}
              borderWidth={1}
              markerType="o" />
          </ChartCanvas> : 
        <></>
      )
*/

export default Page;