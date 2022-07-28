import * as THREE from 'three';

export interface SVGEntry {
  svg: string;
  width?: number;
  height?: number;
}

export interface TextureFromSVGs {
  texture: THREE.DataTexture;
  width: number;
  height: number;
  bbox: Record<string, number[]>; // A UV coordinate of left, top, right, bottom
}

export const fromSVGs = async (
  svgEntries: Record<string, SVGEntry>
): Promise<TextureFromSVGs> => {
  // render SVGs to <img> tags
  const seKeys = Object.keys(svgEntries);
  const imgs = await Promise.all(
    seKeys.map(async (seKey) => {
      const img = document.createElement('img');
      const svgDataUrl = `data:image/svg+xml;base64,${window.btoa(
        svgEntries[seKey].svg
      )}`;
      img.src = svgDataUrl;

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });
      return img;
    })
  );

  const svgImages: Record<string, HTMLImageElement> = {};
  seKeys.forEach((seKey, idx) => {
    svgImages[seKey] = imgs[idx];
  });

  // get sizes of svgs
  const svgSizes: Record<string, { width: number; height: number }> = {};
  seKeys.forEach((seKey, idx) => {
    const width = svgEntries[seKey].width || imgs[idx].naturalWidth;
    const height = svgEntries[seKey].height || imgs[idx].naturalHeight;
    return (svgSizes[seKey] = { width, height });
  });

  // sort svgs in the order of decreasing height
  const heightKeyPairs: [number, string][] = seKeys.map((seKey) => {
    return [svgSizes[seKey].height, seKey];
  });
  heightKeyPairs.sort((a, b) => {
    return b[0] - a[0];
  });

  // place them with several configurations
  const textureWidths = [128, 256, 512, 1024, 2048];
  const placements: {
    textureWidth: number;
    textureHeight: number;
    placement: Record<string, { left: number; top: number }>;
  }[] = textureWidths.map((textureWidth) => {
    let curTop = 0;
    let curLeft = 0;
    let curRowHeight: number | null = null;
    let textureHeight = textureWidth;
    const placement: Record<string, { left: number; top: number }> = {};
    heightKeyPairs.forEach(([height, seKey]) => {
      if (curRowHeight === null) curRowHeight = height;
      if (curLeft + svgSizes[seKey].width < textureWidth) {
        placement[seKey] = { left: curLeft, top: curTop };
      } else {
        curTop += curRowHeight;
        curLeft = 0;
        curRowHeight = svgSizes[seKey].height;
        placement[seKey] = { left: curLeft, top: curTop };
      }
      textureHeight = Math.max(
        textureHeight,
        placement[seKey].top + svgSizes[seKey].height
      );
    });
    if (textureHeight % 32 > 0) textureHeight += 32 - (textureHeight % 32);
    return { textureWidth, textureHeight, placement };
  });

  placements.sort((a, b) => {
    return a.textureHeight * a.textureWidth - b.textureHeight * b.textureWidth;
  });
  const bestPlacement = placements[0];

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (ctx === null) {
    throw new Error('context of canvas should not be null');
  }
  canvas.width = bestPlacement.textureWidth;
  canvas.height = bestPlacement.textureHeight;

  seKeys.forEach((seKey) => {
    const left = bestPlacement.placement[seKey].left;
    const top = bestPlacement.placement[seKey].top;
    const width = svgSizes[seKey].width;
    const height = svgSizes[seKey].height;
    ctx.drawImage(svgImages[seKey], left, top, width, height);
  });

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const buffer = new Uint8Array(imgData.data);
  const texture = new THREE.DataTexture(
    buffer,
    bestPlacement.textureWidth,
    bestPlacement.textureHeight,
    THREE.RGBAFormat,
    THREE.UnsignedByteType
  );
  texture.flipY = true;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;

  /*
   uv coordinate
    (0, 1) ----- (1, 1)
       |            |
       |            |
    (0, 0) ----- (1, 0)
  */
  const bbox: Record<string, number[]> = {};
  seKeys.forEach((seKey) => {
    const x1 = bestPlacement.placement[seKey].left;
    const y1 = bestPlacement.placement[seKey].top;
    const x2 = x1 + svgSizes[seKey].width;
    const y2 = y1 + svgSizes[seKey].height;
    const u1 = x1 / bestPlacement.textureWidth;
    const v1 = 1.0 - y1 / bestPlacement.textureHeight;
    const u2 = x2 / bestPlacement.textureWidth;
    const v2 = 1.0 - y2 / bestPlacement.textureHeight;
    bbox[seKey] = [u1, v1, u2, v2];
  });

  return {
    texture,
    width: bestPlacement.textureWidth,
    height: bestPlacement.textureHeight,
    bbox,
  };
};
