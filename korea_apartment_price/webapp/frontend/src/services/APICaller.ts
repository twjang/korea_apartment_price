
export interface BaseResponse<T> {
  success: boolean,
  result?: T,
  msg?: string
}

export interface TokenInformation {
  access_token: string
  token_type: string
}

export interface Paginated {
  num_items: number
  pageidx: number
  items_per_page: number
}


class APICaller {
  constructor(
    protected host: string,
    protected accessToken?: string
  ) {

  }

  setBearerToken(accessToken?: string) {
    this.accessToken = accessToken;
  }

  async call({
    method, 
    path, 
    query, 
    payload,
    isJson
  } :{
    method?: string, 
    path: string, 
    query?: Record<string, string | string[]>, 
    payload?: Record<string, any>, 
    isJson?: boolean
  }):Promise<Response>{
    method = (method || 'GET')!.toUpperCase();
    query = query || {};
    payload = payload || {};
    isJson = isJson || false;

    const queryStr = Object.keys(query).map(key=>{ 
      const value = query![key];
      if (Array.isArray(value)) {
        const varName = encodeURI(key) + '[]';
        return (value as string[]).map(v=>{ return `${varName}=${encodeURI(v)}`; }).join('&');
      } else {
        const varName = encodeURI(key);
        return `${varName}=${(value as string)}`;
      }
    }).join('&');

    
    const url =  `${this.host}/${path.replace(/^[/]*/, '')}${(queryStr.length > 0 )? '?'+ queryStr : ''}` ;
    let body = null;
    let headers = null;

    if (method.toUpperCase() !== 'GET') {
     if (isJson){
        // json
        body = new Blob([JSON.stringify(payload, null, 0)], {type: 'application/json'});
        headers= {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        };
      }else{
        // no json
        const formData = new FormData();
        Object.keys(payload).forEach(key=>{
          formData.append(key, payload![key]);
        });
        body = formData;
      }
    }

    const req = new Request(url, { 
      method,
      ...((body)? {body}:{}),
      ...((headers)? {headers}:{})
    });

    if (this.accessToken) {
      req.headers.append('Authorization', `Bearer ${this.accessToken}`);
    }
    return await fetch(req);
  }

}

export default APICaller;