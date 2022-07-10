import * as THREE from 'three';

export interface DashTypeEntry {
  pattern: number[] // [5, 3, 4, 2] means 5 pixels to be filled / 3 pixels to be left blank / 4 pixels to be filled .. and repeat
};

export interface TextureFromDashTypes {
  texture: THREE.DataTexture;
  width: number;
  height: number;
  bbox: Record<string, number[]> // A UV coordinate of left, top, right, bottom
  patternSize: Record<string, number> // total pixel length of a pattern
};


export const fromDashType = async (dashTypes: Record<string, DashTypeEntry>): Promise<TextureFromDashTypes>=> {
  const dtKeys = Object.keys(dashTypes);
  const patternSize: Record<string, number> = {};


  const textureWidth = 256;
  const heightPerDashType = 8;

  let textureHeight = Math.max(textureWidth, dtKeys.length * heightPerDashType);
  textureHeight += (textureHeight % 32)?(32 - (textureHeight % 32)): 0;

  const buffer = new Uint8Array(textureWidth * textureHeight);
  buffer.fill(0);

  dtKeys.forEach((dtKey,dtKeyIdx) =>{
    let pixelRange: number[] = [0.0];
    dashTypes[dtKey].pattern.forEach((v, idx) => pixelRange.push(pixelRange[idx] + v));
    patternSize[dtKey] = pixelRange[pixelRange.length - 1];
    pixelRange = pixelRange.map(v=>{ return Math.floor(v / patternSize[dtKey] * textureWidth); });
    const yStart = heightPerDashType * dtKeyIdx;
    const yEnd = yStart + heightPerDashType;

    for (let y=yStart; y < yEnd; y++) {
      const baseIdx = y * textureWidth;
      for (let dashElemIdx=0; dashElemIdx < dashTypes[dtKey].pattern.length; dashElemIdx++) {
        if (dashElemIdx % 2 == 1) continue; // odd indexed pattern value indicates blank length
        let fillStartIdx = baseIdx + pixelRange[dashElemIdx];
        let fillEndIdx = baseIdx + pixelRange[dashElemIdx + 1];
        for (let fillIdx = fillStartIdx; fillIdx < fillEndIdx; fillIdx++) {
          buffer[fillIdx] = 255;
        }
      }
    }
  })


  const texture = new THREE.DataTexture(buffer, textureWidth, textureHeight);

  /*
   uv coordinate
    (-1, 1) ----- (1, 1)
       |            |
       |            |
    (-1, -1) ---- (1, -1)
  */
  const bbox: Record<string, number[]> = {};
  dtKeys.forEach((dtKey, dtKeyIdx) =>{
    const x1 = 0
    const y1 = dtKeyIdx * heightPerDashType;
    const x2 = textureWidth;
    const y2 = y1 + heightPerDashType;
    const u1 = -1.0 + 2 * x1 / textureWidth;
    const v1 = 1.0 - 2 * y1 / textureHeight; 
    const u2 = -1.0 + 2 * x2 / textureWidth;
    const v2 = 1.0 - 2 * y2 / textureHeight; 
    bbox[dtKey] = [u1, v1, u2, v2];
  });

  return {
    texture,
    width: textureWidth,
    height: textureHeight,
    bbox,
    patternSize,
  }
};