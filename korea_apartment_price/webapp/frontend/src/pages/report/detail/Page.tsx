import * as React from 'react';
import * as MUI from '@mui/material';
import * as MUIIcon from '@mui/icons-material';
import FavoriteService from '../../../services/FavoriteSerivce';
import ApartmentService, {
  AggregatedOrderbookEntry,
  ApartmentIdWithSize,
  RentHistoryEntry,
  TradeHistoryEntry,
} from '../../../services/ApartmentService';

import { usePageHierarchyInfo } from '../..';
import { useAuthInfo } from '../../../contexts/AuthContext';
import debounce from '../../../misc/debounce';
import { useNavigate } from 'react-router-dom';
import ChartCanvas, {
  ChartClickEvent,
  LabelInfo,
} from '../../../components/ChartCanvas';
import ChartPointMarkerGroup from '../../../components/ChartCanvas/objects/PointMarkerGroup';
import ChartStyledPathGroup, {
  Path,
} from '../../../components/ChartCanvas/objects/StyledPathGroup';

type TradeDetail = {
  date: string;
  detail: {
    floor: string;
    price: number;
  }[];
};

type RentDetail = {
  date: string;
  detail: {
    floor: string;
    priceDeposit: number;
    priceRent: number;
    price: number;
    depositInterestRate: string;
  }[];
};

type OrderbookDetail = {
  date: string;
  detail: {
    price: number;
    homes: string[];
  }[];
};

const currentOrderbookLineLengthPortion = 0.01;
const highlightColor = {
  sellChip: '#ffbdf8',
  sellChart: 0xff00e4ff,
};

function binarySearch<V, E>(
  toFind: V,
  entries: E[],
  valueFromEntry: (e: E) => V,
  cmp: (a: V, b: V) => number
): number {
  let sidx = 0;
  let eidx = entries.length;
  while (eidx - sidx > 1) {
    const midx = Math.floor((sidx + eidx) / 2);
    const ment = entries[midx];
    const compared = cmp(toFind, valueFromEntry(ment));
    if (compared <= 0) {
      eidx = midx;
    } else {
      sidx = midx;
    }
  }
  return sidx;
}

const Page: React.FC = () => {
  const pageInfo = usePageHierarchyInfo();
  const authInfo = useAuthInfo();
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [dateRangeScale, setDateRangeScale] = React.useState<number[]>([
    0.8, 1.0,
  ]);
  const [apartIdWithSize, setApartIdWithSize] =
    React.useState<ApartmentIdWithSize | null>(null);
  const [needDataUpdate, setNeedDataUpdate] = React.useState<boolean>(true);
  const [rents, setRents] = React.useState<RentHistoryEntry[] | null>(null);
  const [trades, setTrades] = React.useState<TradeHistoryEntry[] | null>(null);
  const [orderbook, setOrderbook] = React.useState<
    AggregatedOrderbookEntry[] | null
  >(null);

  const [detailDate, setDetailDate] = React.useState<number | null>(null);
  const [detailPrice, setDetailPrice] = React.useState<number | null>(null);
  const [detailDateRange, setDetailDateRange] = React.useState<number | null>(
    null
  );
  const [detailPriceRange, setDetailPriceRange] = React.useState<number | null>(
    null
  );

  const [highlightedSell, setHighlightedSell] = React.useState<string | null>(
    null
  );

  const navigate = useNavigate();

  const now = new Date();
  now.setHours(23, 59, 59);

  const minDate = new Date(2011, 0, 1).getTime() / 1000;
  const maxDate = now.getTime() / 1000 + 1;
  const dateFromTs = new Date(
    ((maxDate - minDate) * dateRangeScale[0] + minDate) * 1000
  );
  const dateToTs = new Date(
    ((maxDate - minDate) * dateRangeScale[1] + minDate) * 1000
  );
  const dateFromSerial =
    dateFromTs.getFullYear() * 10000 +
    (1 + dateFromTs.getMonth()) * 100 +
    dateFromTs.getDate();
  const dateToSerial =
    dateToTs.getFullYear() * 10000 +
    (1 + dateToTs.getMonth()) * 100 +
    dateToTs.getDate();

  const favId = parseInt(pageInfo.matchedParams.favid || '0');

  React.useEffect(() => {
    (async () => {
      const accessToken = authInfo.bearerToken as string;
      const detail = await FavoriteService.get({ accessToken, id: favId });
      if (detail.result && detail.success) {
        setApartIdWithSize(detail.result);
      }
    })();
  }, [pageInfo]);

  React.useEffect(() => {
    const accessToken = authInfo.bearerToken as string;
    if (needDataUpdate && apartIdWithSize && accessToken) {
      setNeedDataUpdate(false);
      setIsLoading(true);
      setRents(null);
      setTrades(null);
      setOrderbook(null);

      (async () => {
        const rents = await ApartmentService.rents({
          accessToken,
          apartIdWithSize,
          dateFrom: dateFromSerial,
          dateTo: dateToSerial,
        });
        const trades = await ApartmentService.trades({
          accessToken,
          apartIdWithSize,
          dateFrom: dateFromSerial,
          dateTo: dateToSerial,
        });
        const orderbook = await ApartmentService.orderbook({
          accessToken,
          apartIdWithSize,
          dateFrom: dateFromSerial,
          dateTo: dateToSerial,
        });
        if (rents.success && rents.result) {
          setRents(
            rents.result.sort((a, b) => {
              return a.date_serial - b.date_serial;
            })
          );
        }
        if (trades.success && trades.result) {
          setTrades(
            trades.result.sort((a, b) => {
              return a.date_serial - b.date_serial;
            })
          );
        }
        if (orderbook.success && orderbook.result) {
          setOrderbook(
            orderbook.result.sort((a, b) => {
              return parseInt(a.fetched_date) - parseInt(b.fetched_date);
            })
          );
        }
        setIsLoading(false);
      })();
    }
  }, [needDataUpdate, apartIdWithSize]);

  const updateGraph = debounce(
    'report/:favid/updateGraph',
    () => {
      setNeedDataUpdate(true);
    },
    2000
  );

  const handleDateRangeChange = (
    event: Event,
    v: number | number[],
    activeThumb: number
  ) => {
    updateGraph();
    if (!Array.isArray(v)) {
      return;
    }
    const rangeValue = v as number[];
    const minDistance = (3600 * 24 * 30 * 6) / (maxDate - minDate);

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
    const sliderDateFromTs = new Date(
      ((maxDate - minDate) * x + minDate) * 1000
    );
    const txt = `${sliderDateFromTs.getFullYear()}/${
      1 + sliderDateFromTs.getMonth()
    }/${sliderDateFromTs.getDate()}`;
    return txt;
  };

  const dateSerialToDayOffset = (x: number): number => {
    const xString = x.toString();
    const xDate = new Date(
      `${xString.slice(0, 4)}-${xString.slice(4, 6)}-${xString.slice(6)}`
    );
    const dateFrom0 = Math.floor(xDate.getTime() / 1000 / 3600 / 24);
    return dateFrom0;
  };

  const dayOffsetTodateSerial = (x: number): number => {
    const xDate = new Date(x * 1000 * 3600 * 24);
    const res =
      xDate.getFullYear() * 10000 +
      (xDate.getMonth() + 1) * 100 +
      xDate.getDate();
    return res;
  };

  const dateSerialToString = (x: number): string => {
    const year = Math.floor(x / 10000);
    const month = Math.floor(x / 100) % 100;
    const date = x % 100;
    return `${year}-${month.toString().padStart(2, '0')}-${date
      .toString()
      .padStart(2, '0')}`;
  };

  const [
    chartTradesX,
    chartTradesY,
    chartCancelX,
    chartCancelY,
    minTradesY,
    maxTradesY,
  ] = React.useMemo<
    [
      Float32Array | null,
      Float32Array | null,
      Float32Array | null,
      Float32Array | null,
      number,
      number
    ]
  >(() => {
    let x: Float32Array | null = null;
    let y: Float32Array | null = null;
    let canceledX: Float32Array | null = null;
    let canceledY: Float32Array | null = null;
    let minY = 0;
    let maxY = 1;

    if (trades && trades.length > 0) {
      const tmpX: number[] = [];
      const tmpY: number[] = [];
      const tmpCancelX: number[] = [];
      const tmpCancelY: number[] = [];
      trades.forEach((e) => {
        const curX =
          (dateSerialToDayOffset(e.date_serial) -
            dateSerialToDayOffset(dateFromSerial)) /
          30;
        const curY = e.price / 10000;
        if (minY === 0 || minY > curY) minY = curY;
        if (maxY === 1 || maxY < curY) maxY = curY;
        if (e.is_canceled) {
          tmpCancelX.push(curX);
          tmpCancelY.push(curY);
        } else {
          tmpX.push(curX);
          tmpY.push(curY);
        }
      });

      x = new Float32Array(tmpX);
      y = new Float32Array(tmpY);
      canceledX = new Float32Array(tmpCancelX);
      canceledY = new Float32Array(tmpCancelY);
    }
    return [x, y, canceledX, canceledY, minY, maxY];
  }, [trades]);

  const [chartRentsX, chartRentsY, minRentsY, maxRentsY] = React.useMemo<
    [Float32Array | null, Float32Array | null, number, number]
  >(() => {
    let x: Float32Array | null = null;
    let y: Float32Array | null = null;
    let minY = 0;
    let maxY = 1;

    if (rents && rents.length > 0) {
      x = new Float32Array(rents.length);
      y = new Float32Array(rents.length);
      rents.forEach((e, idx) => {
        x![idx] =
          (dateSerialToDayOffset(e.date_serial) -
            dateSerialToDayOffset(dateFromSerial)) /
          30;
        y![idx] =
          (e.price_deposit +
            (e.price_monthly / e.deposit_interest_rate) * 100.0 * 12) /
          10000;
        if (minY === 0 || minY > y![idx]) minY = y![idx];
        if (maxY === 1 || maxY < y![idx]) maxY = y![idx];
      });
    }
    return [x, y, minY, maxY];
  }, [rents]);

  const [chartHighlightedOrderbookPaths] = React.useMemo<
    [Path[] | null]
  >(() => {
    let paths: Path[] | null = null;
    if (highlightedSell && orderbook && orderbook.length > 0) {
      paths = [];
      let prevX: number | null = null;
      let maxCnt = 1;

      orderbook.forEach((egroup) => {
        egroup.items.forEach((e) => {
          maxCnt = Math.max(maxCnt, e.homes.length);
        });
      });

      orderbook.forEach((egroup) => {
        const x =
          (dateSerialToDayOffset(parseInt(egroup.fetched_date)) -
            dateSerialToDayOffset(dateFromSerial)) /
          30;
        egroup.items.forEach((e) => {
          const xStart = prevX !== null ? prevX : x - 1 / 30;
          const xEnd = x;
          const y = e.price;
          if (paths && e.homes.includes(highlightedSell)) {
            paths.push({
              x: new Float32Array([xStart, xEnd]),
              y: new Float32Array([y, y]),
            });
          }
        });
        prevX = x;
      });
    }
    return [paths];
  }, [orderbook, highlightedSell]);

  const [
    chartOrderbookPaths,
    chartLatestOrderbookPaths,
    minOrderbookY,
    maxOrderbookY,
  ] = React.useMemo<[Path[], Path[], number, number]>(() => {
    const paths: Path[] = [];
    const latestPaths: Path[] = [];
    let minY = 0;
    let maxY = 1;

    if (orderbook && orderbook.length > 0) {
      let prevX: number | null = null;
      let maxCnt = 1;

      let last_fetched_date: number | null = null;
      orderbook.forEach((egroup) => {
        egroup.items.forEach((e) => {
          maxCnt = Math.max(maxCnt, e.homes.length);
        });
        if (
          last_fetched_date === null ||
          last_fetched_date < parseInt(egroup.fetched_date)
        )
          last_fetched_date = parseInt(egroup.fetched_date);
      });

      orderbook.forEach((egroup) => {
        const x =
          (dateSerialToDayOffset(parseInt(egroup.fetched_date)) -
            dateSerialToDayOffset(dateFromSerial)) /
          30;
        const isLatest = last_fetched_date === parseInt(egroup.fetched_date);

        egroup.items.forEach((e) => {
          const xStart = prevX !== null ? prevX : x - 1 / 30;
          const xEnd = x;
          const y = e.price;
          const cnt = e.homes.length;
          if (minY === 0 || minY > y) minY = y;
          if (maxY === 1 || maxY < y) maxY = y;
          paths.push({
            x: new Float32Array([xStart, xEnd]),
            y: new Float32Array([y, y]),
            color: 0xff000000 + Math.floor((200 * cnt) / maxCnt + 50),
          });
        });

        if (isLatest) {
          egroup.items.forEach((e) => {
            const xStart = x;
            const xEnd = x * (1 + currentOrderbookLineLengthPortion);
            const y = e.price;
            const cnt = e.homes.length;
            if (minY === 0 || minY > y) minY = y;
            if (maxY === 1 || maxY < y) maxY = y;
            latestPaths.push({
              x: new Float32Array([xStart, xEnd]),
              y: new Float32Array([y, y]),
              color: 0x00bd1f00 + Math.floor((200 * cnt) / maxCnt + 50),
            });
          });
        }
        prevX = x;
      });
    }
    return [paths, latestPaths, minY, maxY];
  }, [orderbook]);

  const detailedTrades = React.useMemo<TradeDetail[]>(() => {
    let res: TradeDetail[] = [];
    if (
      trades &&
      trades.length > 0 &&
      detailDate &&
      detailPrice &&
      detailDateRange &&
      detailPriceRange
    ) {
      const idx = binarySearch(
        detailDate,
        trades,
        (e) => {
          return e.date_serial;
        },
        (a, b) => {
          return a - b;
        }
      );
      const chosenOffset = dateSerialToDayOffset(detailDate);
      let startIdx = idx;
      let endIdx = idx;

      while (startIdx > 0) {
        const curOffset = dateSerialToDayOffset(
          trades[startIdx - 1].date_serial
        );
        if (chosenOffset - curOffset < detailDateRange) startIdx--;
        else break;
      }

      while (endIdx < trades.length - 1) {
        const curOffset = dateSerialToDayOffset(trades[endIdx + 1].date_serial);
        if (curOffset - chosenOffset < detailDateRange) endIdx++;
        else break;
      }

      res = [];
      let curEnt: TradeDetail | null = null;
      for (let i = startIdx; i <= endIdx; i++) {
        const curDateStr = dateSerialToString(trades[i].date_serial);
        const curPrice = trades[i].price / 10000;
        if (
          curPrice < detailPrice - detailPriceRange ||
          curPrice > detailPrice + detailPriceRange
        )
          continue;

        const curOffset = dateSerialToDayOffset(trades[i].date_serial);
        if (
          curOffset < chosenOffset - detailDateRange ||
          curOffset > chosenOffset + detailDateRange
        )
          continue;

        if (curEnt === null || (curEnt && curEnt.date !== curDateStr)) {
          if (curEnt) res.push(curEnt);
          curEnt = {
            date: curDateStr,
            detail: [
              {
                floor: `${trades[i].floor}층`,
                price: parseFloat(curPrice.toFixed(2)),
              },
            ],
          };
        } else {
          curEnt.detail.push({
            floor: `${trades[i].floor}층`,
            price: parseFloat((trades[i].price / 10000).toFixed(2)),
          });
        }
      }
      if (curEnt) res.push(curEnt);
    }
    return res;
  }, [detailDate, detailPrice, trades]);

  const detailedRents = React.useMemo<RentDetail[]>(() => {
    let res: RentDetail[] = [];
    if (
      rents &&
      rents.length > 0 &&
      detailDate &&
      detailPrice &&
      detailDateRange &&
      detailPriceRange
    ) {
      const idx = binarySearch(
        detailDate,
        rents,
        (e) => {
          return e.date_serial;
        },
        (a, b) => {
          return a - b;
        }
      );
      const chosenOffset = dateSerialToDayOffset(detailDate);
      let startIdx = idx;
      let endIdx = idx;

      while (startIdx > 0) {
        const curOffset = dateSerialToDayOffset(
          rents[startIdx - 1].date_serial
        );
        if (chosenOffset - curOffset < detailDateRange) startIdx--;
        else break;
      }

      while (endIdx < rents.length - 1) {
        const curOffset = dateSerialToDayOffset(rents[endIdx + 1].date_serial);
        if (curOffset - chosenOffset < detailDateRange) endIdx++;
        else break;
      }

      res = [];
      let curEnt: RentDetail | null = null;
      for (let i = startIdx; i <= endIdx; i++) {
        const curDateStr = dateSerialToString(rents[i].date_serial);
        const curPrice =
          (rents[i].price_deposit +
            (rents[i].price_monthly / rents[i].deposit_interest_rate) *
              100 *
              12) /
          10000;
        if (
          curPrice < detailPrice - detailPriceRange ||
          curPrice > detailPrice + detailPriceRange
        )
          continue;

        const curOffset = dateSerialToDayOffset(rents[i].date_serial);
        if (
          curOffset < chosenOffset - detailDateRange ||
          curOffset > chosenOffset + detailDateRange
        )
          continue;

        const newDetail = {
          floor: `${rents[i].floor}층`,
          priceRent: parseFloat(rents[i].price_monthly.toFixed(2)),
          priceDeposit: parseFloat((rents[i].price_deposit / 10000).toFixed(2)),
          price: parseFloat(curPrice.toFixed(2)),
          depositInterestRate: rents[i].deposit_interest_rate.toFixed(2),
        };

        if (curEnt === null || (curEnt && curEnt.date !== curDateStr)) {
          if (curEnt) res.push(curEnt);
          curEnt = {
            date: curDateStr,
            detail: [newDetail],
          };
        } else {
          curEnt.detail.push(newDetail);
        }
      }
      if (curEnt) res.push(curEnt);
    }
    return res;
  }, [detailDate, detailPrice, rents]);

  const detailedOrderbook = React.useMemo<OrderbookDetail[]>(() => {
    let res: OrderbookDetail[] = [];
    if (
      orderbook &&
      orderbook.length > 0 &&
      detailDate &&
      detailPrice &&
      detailPriceRange
    ) {
      let idx = binarySearch(
        detailDate,
        orderbook,
        (e) => {
          return parseInt(e.fetched_date);
        },
        (a, b) => {
          return a - b;
        }
      );
      while (
        parseInt(orderbook[idx].fetched_date) < detailDate &&
        idx < orderbook.length - 1
      )
        idx++;

      const curOrderbook = orderbook[idx];
      const curDateStr = dateSerialToString(
        parseInt(curOrderbook.fetched_date)
      );

      if (parseInt(curOrderbook.fetched_date) <= detailDate) {
        const newEnt: OrderbookDetail = {
          date: curDateStr,
          detail: [],
        };

        curOrderbook.items.forEach((e) => {
          if (
            e.price < detailPrice - detailPriceRange ||
            e.price > detailPrice + detailPriceRange
          )
            return;
          newEnt.detail.push(e);
        });

        if (newEnt.detail.length > 0) {
          res = [newEnt];
        }
      }
    }
    return res;
  }, [detailDate, detailPrice, orderbook]);

  const minDataX = 0;
  const maxDataX =
    (dateSerialToDayOffset(dateToSerial) -
      dateSerialToDayOffset(dateFromSerial)) /
    30;
  const minDataY = Math.max(
    Math.min(minTradesY, minRentsY, minOrderbookY) - 1,
    0
  );
  const maxDataY = Math.max(maxTradesY, maxRentsY, maxOrderbookY) + 1;
  const startDay = dateSerialToDayOffset(dateFromSerial);
  const endDay = dateSerialToDayOffset(dateToSerial);

  const xAxisLabelGenerator = (range: [number, number]): LabelInfo[] => {
    const res: LabelInfo[] = [];
    const duration = Math.floor((range[1] - range[0]) * 30);

    let interval = 7;
    if (duration < 60) {
      interval = 1;
    } else if (duration < 420) {
      interval = 7;
    } else if (duration < 1800) {
      interval = 30;
    } else {
      interval = 30 * 3;
    }

    const startDayOffset = Math.floor(range[0] * 30);
    const endDayOffset =
      endDay -
      startDay -
      Math.floor((endDay - startDay - range[1] * 30) / interval) * interval;

    for (
      let curOffset = endDayOffset;
      curOffset >= startDayOffset;
      curOffset -= interval
    ) {
      const value = curOffset / 30;
      if (range[0] < value && value < range[1]) {
        const d = new Date((startDay + curOffset) * 3600 * 24 * 1000);
        const curDateStr =
          value <= maxDataX
            ? `${d.getFullYear()}.${(d.getMonth() + 1)
                .toString()
                .padStart(2, '0')}.${d.getDate().toString().padStart(2, '0')}`
            : 'Latest';
        res.push({
          value,
          label: <span>{curDateStr}</span>,
          rotation: 90,
        });
      }
    }

    return res;
  };

  const handleClick = (e: ChartClickEvent) => {
    const { x, y, visibleRange } = e;
    const chosenDay = dayOffsetTodateSerial(
      Math.round(Math.min(maxDataX, x) * 30) + startDay
    );
    setDetailDate(chosenDay);
    setDetailPrice(y);
    setDetailDateRange((visibleRange[2] - visibleRange[0]) * 0.025 * 30);
    setDetailPriceRange((visibleRange[3] - visibleRange[1]) * 0.025);
  };

  return (
    <MUI.Box sx={{ textAlign: 'left' }}>
      <MUI.Button
        onClick={() => {
          navigate(-1);
        }}
      >
        <MUIIcon.ArrowLeft />
        돌아가기
      </MUI.Button>
      <MUI.Typography>{apartIdWithSize?.address}</MUI.Typography>
      <MUI.Typography variant="h6" sx={{ marginBottom: 1 }}>
        {apartIdWithSize?.name}
        <MUI.Typography
          variant="body1"
          sx={{ color: '#888', display: 'inline', marginLeft: '1em' }}
        >
          전용 {apartIdWithSize?.size} 평
        </MUI.Typography>
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
        <MUI.Box
          sx={{
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'space-between',
          }}
        >
          <MUI.Typography sx={{ display: 'inline', fontSize: '0.7em' }}>
            {dateRangeText(dateRangeScale[0])}
          </MUI.Typography>
          <MUI.Typography sx={{ display: 'inline', fontSize: '0.7em' }}>
            {dateRangeText(dateRangeScale[1])}
          </MUI.Typography>
        </MUI.Box>
      </MUI.Box>

      <div
        style={{
          width: 'calc(100% - 2em)',
          height: 'calc(50vh)',
        }}
      >
        {isLoading ? (
          <MUI.CircularProgress />
        ) : (
          <ChartCanvas
            chartRegion={[0.05, 0.05, 0.95, 0.9]}
            dataRange={[
              minDataX,
              minDataY,
              maxDataX * (1 + currentOrderbookLineLengthPortion),
              maxDataY,
            ]}
            onClick={handleClick}
            xAxisLabels={xAxisLabelGenerator}
          >
            {chartHighlightedOrderbookPaths && (
              <ChartStyledPathGroup
                key={highlightedSell}
                paths={chartHighlightedOrderbookPaths}
                width={4}
                color={highlightColor.sellChart}
                dashType={[10]}
                zOrder={-1}
              />
            )}
            {chartLatestOrderbookPaths && (
              <ChartStyledPathGroup
                paths={chartLatestOrderbookPaths}
                width={2}
                color={0x00bd1fff}
                dashType={[10]}
                zOrder={4}
              />
            )}
            {chartOrderbookPaths && (
              <ChartStyledPathGroup
                paths={chartOrderbookPaths}
                width={2}
                color={0xff0000ff}
                dashType={[10]}
                zOrder={3}
              />
            )}
            {chartTradesX && chartTradesY && (
              <ChartPointMarkerGroup
                x={chartTradesX!}
                y={chartTradesY!}
                size={10}
                fillColor={0x0000ffff}
                borderColor={0x000000ff}
                borderWidth={2}
                zOrder={2}
                markerType="o"
              />
            )}
            {chartCancelX && chartCancelY && (
              <ChartPointMarkerGroup
                x={chartCancelX!}
                y={chartCancelY!}
                size={10}
                fillColor={0xffae00ff}
                borderColor={0x000000ff}
                borderWidth={2}
                zOrder={1}
                markerType="x"
              />
            )}
            {chartRentsX && chartRentsY && (
              <ChartPointMarkerGroup
                x={chartRentsX!}
                y={chartRentsY!}
                size={10}
                fillColor={0xffff00ff}
                borderColor={0x000000ff}
                borderWidth={2}
                zOrder={0}
                markerType="triangle"
              />
            )}
          </ChartCanvas>
        )}
      </div>
      <MUI.Box>
        <MUI.Box>
          {detailedOrderbook.length > 0 && (
            <MUI.Box>
              {detailedOrderbook[0].detail.map((de) => {
                return (
                  <MUI.Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'left',
                      flexWrap: 'wrap',
                    }}
                  >
                    <MUI.Typography
                      color="red"
                      sx={{ marginRight: '0.3em' }}
                    >{`${de.price
                      .toFixed(2)
                      .replace(/[.]?0*$/, '')}억`}</MUI.Typography>
                    {de.homes.map((h) => {
                      return (
                        <MUI.Chip
                          variant="outlined"
                          size="small"
                          sx={{
                            margin: '2px',
                            cursor: 'pointer',
                            ...(h === highlightedSell
                              ? { backgroundColor: highlightColor.sellChip }
                              : {}),
                          }}
                          label={`${h}`}
                          onClick={() => {
                            if (h === highlightedSell) {
                              setHighlightedSell(null);
                            } else {
                              setHighlightedSell(h);
                            }
                          }}
                        />
                      );
                    })}
                  </MUI.Box>
                );
              })}
              <MUI.Typography
                sx={{ color: '#AAA', fontSize: '10px' }}
              >{`${detailedOrderbook[0].date}`}</MUI.Typography>
            </MUI.Box>
          )}
        </MUI.Box>
        <MUI.Box>
          {detailedTrades.length > 0 && (
            <MUI.Box>
              {detailedTrades.map((t) => {
                return (
                  <MUI.Box>
                    {t.detail.map((de) => {
                      return (
                        <MUI.Chip
                          variant="outlined"
                          size="small"
                          sx={{ margin: '2px' }}
                          label={
                            <span>
                              <span
                                style={{ color: 'blue', marginRight: '3px' }}
                              >{`${de.price
                                .toFixed(2)
                                .replace(/[.]?0*$/, '')}억`}</span>
                              {de.floor}
                            </span>
                          }
                        />
                      );
                    })}
                    <MUI.Typography
                      sx={{ color: '#AAA', fontSize: '10px' }}
                    >{`${t.date}`}</MUI.Typography>
                  </MUI.Box>
                );
              })}
            </MUI.Box>
          )}
        </MUI.Box>
        <MUI.Box>
          {detailedRents.length > 0 && (
            <MUI.Box>
              {detailedRents.map((t) => {
                return (
                  <MUI.Box>
                    {t.detail.map((de) => {
                      return (
                        <MUI.Chip
                          variant="outlined"
                          size="small"
                          sx={{ margin: '2px' }}
                          label={
                            <span>
                              <span
                                style={{ color: '#cca700', marginRight: '3px' }}
                              >{`${de.price
                                .toFixed(2)
                                .replace(/[.]?0*$/, '')}억`}</span>
                              {de.floor}
                              <span
                                style={{
                                  color: '#AAA',
                                  marginLeft: '3px',
                                  fontSize: '0.8em',
                                }}
                              >{`${de.priceDeposit
                                .toFixed(2)
                                .replace(/[.]?0*$/, '')}억${
                                de.priceRent > 0
                                  ? `/${de.priceRent}만원 (${de.depositInterestRate}%)`
                                  : ''
                              }`}</span>
                            </span>
                          }
                        />
                      );
                    })}
                    <MUI.Typography
                      sx={{ color: '#AAA', fontSize: '10px' }}
                    >{`${t.date}`}</MUI.Typography>
                  </MUI.Box>
                );
              })}
            </MUI.Box>
          )}
        </MUI.Box>
      </MUI.Box>
    </MUI.Box>
  );
};

export default Page;
