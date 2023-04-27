import { API_HOST } from "../constants";
import APICaller, { BaseResponse } from "./APICaller";

export interface VolumeData {
    dates: string[]
    count: number[]
    total_price: number[]
    avg_price: number[]
}

const getVolume = async ({
    accessToken,
    addressCodes,
    dateFrom,
    dateTo,
    sizeFrom,
    sizeTo,
    priceFrom,
    priceTo,
}: {
    accessToken: string;
    addressCodes: string[];
    dateFrom?: number;
    dateTo?: number;
    sizeFrom?: number;
    sizeTo?: number;
    priceFrom?: number;
    priceTo?: number;
}): Promise<BaseResponse<VolumeData>> => {
    const caller = new APICaller(API_HOST, accessToken);
    const resp = await caller.call({
        method: 'POST',
        path: `/api/volume/`,
        query: {
            ...(dateFrom ? { date_from: dateFrom.toFixed(0) } : {}),
            ...(dateTo ? { date_to: dateTo.toFixed(0) } : {}),
            ...(priceFrom ? { price_from: (priceFrom * 10000).toString() } : {}),
            ...(priceTo ? { price_to: (priceTo * 10000).toString() } : {}),
            ...(sizeFrom ? { size_from: sizeFrom.toFixed(0) } : {}),
            ...(sizeTo ? { size_to: sizeTo.toFixed(0) } : {}),
        },
        payload: {
            addrcodes: addressCodes
        },
        isJson: true
    })
    const res = await resp.json() as BaseResponse<VolumeData>;
    return res;
};

export default {
    getVolume
};