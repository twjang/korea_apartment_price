import * as THREE from 'three';

export interface DashTypeEntry {
  pattern: number[]; // [5, 3, 4, 2] means 5 pixels to be filled / 3 pixels to be left blank / 4 pixels to be filled .. and repeat
}

export interface TextureFromDashTypes {
  texture: THREE.DataTexture;
  width: number;
  height: number;
  bbox: Record<string, number[]>; // A UV coordinate of left, top, right, bottom
  patternSize: Record<string, number>; // total pixel length of a pattern
}

export const fromDashType = async (
  dashTypes: Record<string, DashTypeEntry>
): Promise<TextureFromDashTypes> => {
  const dtKeys = Object.keys(dashTypes);
  const patternSize: Record<string, number> = {};

  const maxPatternLength = Math.floor(
    Math.max(
      ...Object.keys(dashTypes).map((key) => {
        const pat = dashTypes[key].pattern;
        return pat.reduce((p, v) => {
          return p + v;
        }, 0);
      })
    )
  );

  const heightPerDashType = 8;
  const minSize = 128;
  const textureWidth = Math.max(
    minSize,
    Math.pow(2, Math.ceil(Math.log2(maxPatternLength)))
  );
  const textureHeight = Math.max(
    minSize,
    Math.pow(2, Math.ceil(Math.log2(dtKeys.length * heightPerDashType)))
  );

  const buffer = new Uint8Array(textureWidth * textureHeight * 4);

  dtKeys.forEach((dtKey, dtKeyIdx) => {
    let pixelRange: number[] = [0.0];
    dashTypes[dtKey].pattern.forEach((v, idx) =>
      pixelRange.push(pixelRange[idx] + v)
    );
    patternSize[dtKey] = pixelRange[pixelRange.length - 1];
    pixelRange = pixelRange.map((v) => {
      return Math.floor((v / patternSize[dtKey]) * textureWidth);
    });
    const yStart = heightPerDashType * dtKeyIdx;
    const yEnd = yStart + heightPerDashType;

    for (let y = yStart; y < yEnd; y++) {
      const baseIdx = y * textureWidth;
      for (
        let dashElemIdx = 0;
        dashElemIdx < dashTypes[dtKey].pattern.length;
        dashElemIdx++
      ) {
        if (dashElemIdx % 2 === 1) continue; // odd indexed pattern value indicates blank length
        const fillStartIdx = baseIdx + pixelRange[dashElemIdx];
        const fillEndIdx = baseIdx + pixelRange[dashElemIdx + 1];
        for (let fillIdx = fillStartIdx; fillIdx < fillEndIdx; fillIdx++) {
          buffer[fillIdx * 4] = 255;
          buffer[fillIdx * 4 + 1] = 255;
          buffer[fillIdx * 4 + 2] = 255;
          buffer[fillIdx * 4 + 3] = 255;
        }
      }
    }
  });

  const texture = new THREE.DataTexture(
    buffer,
    textureWidth,
    textureHeight,
    THREE.RGBAFormat,
    THREE.UnsignedByteType
  );
  texture.flipY = true;
  texture.needsUpdate = true;

  /*
   uv coordinate
    (0, 1) ----- (1, 1)
       |            |
       |            |
    (0, 0) ---- (1, 0)
  */
  const bbox: Record<string, number[]> = {};
  dtKeys.forEach((dtKey, dtKeyIdx) => {
    const x1 = 0;
    const y1 = dtKeyIdx * heightPerDashType;
    const x2 = textureWidth;
    const y2 = y1 + heightPerDashType;
    const u1 = x1 / textureWidth;
    const v1 = 1.0 - y1 / textureHeight;
    const u2 = x2 / textureWidth;
    const v2 = 1.0 - y2 / textureHeight;
    bbox[dtKey] = [u1, v1, u2, v2];
  });

  return {
    texture,
    width: textureWidth,
    height: textureHeight,
    bbox,
    patternSize,
  };
};
