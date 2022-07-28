import { API_HOST } from '../constants';
import APICaller, {
  BaseResponse,
  Paginated,
  TokenInformation,
} from './APICaller';

const login = async ({
  username,
  password,
}: {
  username: string;
  password: string;
}): Promise<string | null> => {
  const caller = new APICaller(API_HOST);
  const resp = await caller.call({
    method: 'POST',
    path: '/api/account/token',
    payload: {
      grant_type: '',
      username,
      password,
      scope: '',
      client_id: '',
      client_secret: '',
    },
    isJson: false,
  });

  if (resp.status === 200) {
    const respJson = (await resp.json()) as TokenInformation;
    return respJson.access_token;
  } else {
    return null;
  }
};

const refresh = async ({
  accessToken,
}: {
  accessToken: string;
}): Promise<string | null> => {
  const caller = new APICaller(API_HOST, accessToken);
  const resp = await caller.call({
    method: 'GET',
    path: '/api/account/token_refresh',
    isJson: true,
  });

  if (resp.status === 200) {
    const respJson = (await resp.json()) as TokenInformation;
    return respJson.access_token;
  } else {
    return null;
  }
};

const register = async ({
  email,
  password,
}: {
  email: string;
  password: string;
}): Promise<BaseResponse<any>> => {
  // returns null for successful registration
  const caller = new APICaller(API_HOST);
  const resp = await caller.call({
    method: 'POST',
    path: '/api/account/register',
    payload: {
      grant_type: '',
      email,
      password,
      scope: '',
      client_id: '',
      client_secret: '',
    },
    isJson: true,
  });

  const respJson = (await resp.json()) as BaseResponse<any>;

  if (resp.status === 200) {
    return respJson;
  }
  respJson.success = false;
  return respJson;
};

const setInfo = async ({
  id,
  accessToken,
  isActive,
  isAdmin,
  password,
}: {
  id: number;
  accessToken: string;
  isActive?: boolean;
  isAdmin?: boolean;
  password?: string;
}): Promise<BaseResponse<any>> => {
  const caller = new APICaller(API_HOST, accessToken);
  const resp = await caller.call({
    method: 'POST',
    path: `/api/account/${id}/set`,
    payload: {
      ...(password !== undefined ? { password } : {}),
      ...(isActive !== undefined ? { is_active: isActive } : {}),
      ...(isAdmin !== undefined ? { is_admin: isAdmin } : {}),
    },
    isJson: true,
  });

  const respJson = (await resp.json()) as BaseResponse<any>;

  if (resp.status === 200) {
    return respJson;
  }
  respJson.success = false;
  return respJson;
};

export interface UserInfo {
  id: number;
  date_created: string;
  email: string;
  is_admin: boolean;
  is_active?: boolean;
  settings: Record<string, any>;
}

const getMyInfo = async ({
  accessToken,
}: {
  accessToken: string;
}): Promise<BaseResponse<UserInfo>> => {
  const caller = new APICaller(API_HOST, accessToken);
  const resp = await caller.call({
    method: 'GET',
    path: `/api/account/me`,
    isJson: true,
  });

  const respJson = (await resp.json()) as BaseResponse<UserInfo>;
  if (resp.status === 200) {
    return respJson;
  }
  respJson.success = false;
  return respJson;
};

const getUserDetail = async ({
  id,
  accessToken,
}: {
  id: number;
  accessToken: string;
}): Promise<BaseResponse<UserInfo>> => {
  const caller = new APICaller(API_HOST, accessToken);
  const resp = await caller.call({
    method: 'GET',
    path: `/api/account/${id}`,
    isJson: true,
  });

  const respJson = (await resp.json()) as BaseResponse<UserInfo>;
  if (resp.status === 200) {
    return respJson;
  }
  respJson.success = false;
  return respJson;
};

const listUsers = async ({
  accessToken,
  pageidx,
  itemsPerPage,
}: {
  accessToken: string;
  itemsPerPage: number;
  pageidx: number;
}): Promise<BaseResponse<Paginated & { users: UserInfo[] }>> => {
  const caller = new APICaller(API_HOST, accessToken);
  const resp = await caller.call({
    method: 'GET',
    query: {
      pageidx: pageidx.toString(),
      items_per_page: itemsPerPage.toString(),
    },
    path: `/api/account/`,
    isJson: true,
  });

  const respJson = (await resp.json()) as BaseResponse<
    Paginated & { users: UserInfo[] }
  >;
  if (resp.status === 200) {
    return respJson;
  }
  respJson.success = false;
  return respJson;
};

export default {
  login,
  refresh,
  register,
  setInfo,
  getMyInfo,
  listUsers,
  getUserDetail,
};
