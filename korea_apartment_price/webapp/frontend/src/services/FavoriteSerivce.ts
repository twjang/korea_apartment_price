import { API_HOST } from "../constants";
import { ApartmentIdWithSize } from "./ApartmentService";
import APICaller, { BaseResponse } from "./APICaller";


export type FavoriteList = {
  [key: string]: {
    id: number,
    name: string,
    size: number
  }[]
};


const list = async ({accessToken}:{accessToken: string}): Promise<BaseResponse<FavoriteList>> => {
  const caller = new APICaller(API_HOST, accessToken);
  const resp = await caller.call({
    method: 'GET',
    path: '/api/fav/',
  });

  const respJson = (await resp.json()) as BaseResponse<FavoriteList>;
  if (resp.status === 200) {
    return respJson;
  } else {
    respJson.success = false;
    return respJson;
  }
}

const add = async ({accessToken, apartIdWithSize}:{accessToken: string, apartIdWithSize: ApartmentIdWithSize}): Promise<BaseResponse<any>> => {
  const caller = new APICaller(API_HOST, accessToken);
  const resp = await caller.call({
    method: 'POST',
    path: '/api/fav/',
    payload: apartIdWithSize,
    isJson: true
  });

  const respJson = (await resp.json()) as BaseResponse<any>;
  if (resp.status === 200) {
    return respJson;
  } else {
    respJson.success = false;
    return respJson;
  }
}

const get = async ({accessToken, id}:{accessToken: string, id: number}): Promise<BaseResponse<ApartmentIdWithSize>> => {
  const caller = new APICaller(API_HOST, accessToken);
  const resp = await caller.call({
    method: 'GET',
    path: `/api/fav/${id}`,
    isJson: true
  });

  const respJson = (await resp.json()) as BaseResponse<ApartmentIdWithSize>;
  if (resp.status === 200) {
    return respJson;
  } else {
    respJson.success = false;
    return respJson;
  }
}

const remove = async ({accessToken, id}:{accessToken: string, id: number}): Promise<BaseResponse<any>> => {
  const caller = new APICaller(API_HOST, accessToken);
  const resp = await caller.call({
    method: 'DELETE',
    path: `/api/fav/${id}`,
  });

  const respJson = (await resp.json()) as BaseResponse<ApartmentIdWithSize>;
  if (resp.status === 200) {
    return respJson;
  } else {
    respJson.success = false;
    return respJson;
  }
}



export default {
  list,
  add,
  get,
  remove,
}