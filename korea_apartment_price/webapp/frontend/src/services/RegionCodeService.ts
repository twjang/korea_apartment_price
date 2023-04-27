import { API_HOST } from "../constants";
import APICaller, { BaseResponse } from "./APICaller";

export interface RegionCode {
    lawaddrcode: string
    address: string
}

const searchRegionCode = async ({
    accessToken,
    address
}: {
    accessToken: string;
    address: string;
}): Promise<BaseResponse<RegionCode[]>> => {
    const caller = new APICaller(API_HOST, accessToken);
    const resp = await caller.call({
        method: 'GET',
        path: `/api/region_code/`,
        query: { address }
    })
    const res = await resp.json() as BaseResponse<RegionCode[]>;
    return res;
};

export default {
    searchRegionCode
};