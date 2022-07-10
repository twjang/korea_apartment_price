import { API_HOST } from "../constants";
import APICaller, { BaseResponse } from "./APICaller";

export interface ApartmentId{
  lawaddrcode: string
  address: string
  name: string
}

export interface ApartmentIdWithSize {
  lawaddrcode: string
  address: string
  name: string
  size: number
}

export interface TradeHistoryEntry {
  price: number
  date_serial: number
  floor: number
  is_canceled: boolean
  canceled_date: string
}



export interface RentHistoryEntry {
  price_deposit: number
  price_monthly: number
  date_serial: number
  floor: number
}


export interface AggregatedOrderbookEntry {
  fetched_date: string
  items: {
    price: number
    homes: string[]
  }[]
}


const search = async ({accessToken, address, name}:{accessToken: string, address:string, name:string}): Promise<BaseResponse<ApartmentId[]>> => {
  const caller = new APICaller(API_HOST, accessToken);
  const resp = await caller.call({
    method: 'GET',
    path: '/api/apart/search',
    query: {
      addr: address,
      apt_name: name
    },
    isJson: true
  });

  const respJson = (await resp.json()) as BaseResponse<ApartmentId[]>;
  if (resp.status === 200) {
    return respJson;
  } else {
    respJson.success = false;
    return respJson;
  }
}


const sizes = async ({accessToken, apartId}:{accessToken: string, apartId: ApartmentId}): Promise<BaseResponse<number[]>> => {
  const caller = new APICaller(API_HOST, accessToken);
  const resp = await caller.call({
    method: 'POST',
    path: '/api/apart/sizes',
    payload: apartId,
    isJson: true
  });

  const respJson = (await resp.json()) as BaseResponse<number[]>;
  if (resp.status === 200) {
    return respJson;
  } else {
    respJson.success = false;
    return respJson;
  }
}

const info = async ({accessToken, apartId}:{accessToken: string, apartId: ApartmentId}): Promise<BaseResponse<any>> => {
  const caller = new APICaller(API_HOST, accessToken);
  const resp = await caller.call({
    method: 'POST',
    path: '/api/apart/info',
    payload: apartId,
    isJson: true
  });

  const respJson = (await resp.json()) as BaseResponse<number[]>;
  if (resp.status === 200) {
    return respJson;
  } else {
    respJson.success = false;
    return respJson;
  }
}

const trades = async ({accessToken, apartIdWithSize, dateFrom, dateTo}:{accessToken: string, apartIdWithSize: ApartmentIdWithSize, dateFrom?:number, dateTo?:number}): Promise<BaseResponse<TradeHistoryEntry[]>> => {
  const caller = new APICaller(API_HOST, accessToken);
  const resp = await caller.call({
    method: 'POST',
    path: '/api/apart/trades',
    payload: {
      ...apartIdWithSize,
      ...(dateFrom !== undefined? {date_from: dateFrom}: {}),
      ...(dateTo !== undefined? {date_to: dateTo}: {}),
    },
    isJson: true
  });

  const respJson = (await resp.json()) as BaseResponse<TradeHistoryEntry[]>;
  if (resp.status === 200) {
    return respJson;
  } else {
    respJson.success = false;
    return respJson;
  }
}

const rents = async ({accessToken, apartIdWithSize, dateFrom, dateTo}:{accessToken: string, apartIdWithSize: ApartmentIdWithSize, dateFrom?:number, dateTo?:number}): Promise<BaseResponse<RentHistoryEntry[]>> => {
  const caller = new APICaller(API_HOST, accessToken);
  const resp = await caller.call({
    method: 'POST',
    path: '/api/apart/rents',
    payload: {
      ...apartIdWithSize,
      ...(dateFrom !== undefined? {date_from: dateFrom}: {}),
      ...(dateTo !== undefined? {date_to: dateTo}: {}),
    },
    isJson: true
  });

  const respJson = (await resp.json()) as BaseResponse<RentHistoryEntry[]>;
  if (resp.status === 200) {
    return respJson;
  } else {
    respJson.success = false;
    return respJson;
  }
}

const orderbook = async ({accessToken, apartIdWithSize, dateFrom, dateTo}:{accessToken: string, apartIdWithSize: ApartmentIdWithSize, dateFrom?:number, dateTo?:number}): Promise<BaseResponse<AggregatedOrderbookEntry[]>> => {
  const caller = new APICaller(API_HOST, accessToken);
  const resp = await caller.call({
    method: 'POST',
    path: '/api/apart/orderbook',
    payload: {
      ...apartIdWithSize,
      ...(dateFrom !== undefined? {date_from: dateFrom}: {}),
      ...(dateTo !== undefined? {date_to: dateTo}: {}),
    },
    isJson: true
  });

  const respJson = (await resp.json()) as BaseResponse<AggregatedOrderbookEntry[]>;
  if (resp.status === 200) {
    return respJson;
  } else {
    respJson.success = false;
    return respJson;
  }
}

export default {
  search,
  sizes,
  trades,
  rents,
  orderbook,
  info
}