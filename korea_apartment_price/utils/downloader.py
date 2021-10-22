import os
import requests
from tqdm import tqdm


def download(resp: requests.Response, dst_path: str, overwrite:bool=False)->bool:
    if os.path.exists(dst_path) and not overwrite:
      return False

    resp.raise_for_status()
    chunksz = 8149

    transfer_encoding = resp.headers.get('Trasnfer-Encoding', None)
    if transfer_encoding is not None and transfer_encoding.lower().strip() == 'chunked':
        chunksz = None

    pbar = tqdm(desc=f'Downloading {dst_path}', unit='MB')

    with open(dst_path, 'wb') as f:
        for chunk in resp.iter_content(chunk_size=chunksz):
            if chunk:
                pbar.update(len(chunk) / 1024 / 1024)
                f.write(chunk)

    return True
