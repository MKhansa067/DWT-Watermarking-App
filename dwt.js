/*  Single‑level 2D Haar DWT & inverse  – cukup untuk demo  */
export function haar2D(mat, h, w) {
  // h, w genap
  const tmp = new Float32Array(h*w);

  // baris
  for (let y=0; y<h; y++){
    for (let x=0; x<w; x+=2){
      const a = mat[y*w + x], b = mat[y*w + x +1];
      tmp[y*w/2 + x/2]         = (a + b) / 2;          // LL+LH (sementara)
      tmp[y*w/2 + x/2 + w*h/4] = (a - b) / 2;          // HL+HH (sementara)
    }
  }
  // kolom
  const res = new Float32Array(h*w);
  for (let x=0; x<w; x++){
    for (let y=0; y<h; y+=2){
      const a = tmp[y*w + x], b = tmp[(y+1)*w + x];
      const i = (y/2)*w + x;
      res[i]                = (a + b) / 2;             // LL
      res[i + (h*w)/4]      = (a - b) / 2;             // HL
      res[i + (h*w)/2]      = tmp[i + w*h/4];          // LH (dari baris)
      res[i + (3*h*w)/4]    = tmp[i + w*h/4 + (h*w)/4];// HH
    }
  }
  return res;
}

export function inverseHaar2D(coeff, h, w) {
  const tmp = new Float32Array(h*w);

  // kolom inverse
  for (let x=0; x<w; x++){
    for (let y=0; y<h/2; y++){
      const ll = coeff[y*w + x];
      const hl = coeff[y*w + x + (h*w)/4];
      tmp[2*y  *w + x] = ll + hl;
      tmp[(2*y+1)*w + x] = ll - hl;
    }
  }
  // baris inverse
  const res = new Float32Array(h*w);
  for (let y=0; y<h; y++){
    for (let x=0; x<w/2; x++){
      const a = tmp[y*w + x];
      const b = tmp[y*w + x + w/2];
      res[y*w + 2*x]   = a + b;
      res[y*w + 2*x+1] = a - b;
    }
  }
  return res;
}

/*  Embed watermark (wmData 0/1) ke LH band  */
export function embedWatermark(imgData, wmData, h, w, alpha=10){
  const coeff = haar2D(imgData, h, w);
  const offset = (h*w)/2; // LH start
  for(let i=0; i<wmData.length; i++){
    coeff[offset + i] += alpha * (wmData[i]?1:-1);
  }
  return inverseHaar2D(coeff, h, w);
}

/* Extract watermark  */
export function extractWatermark(origData, embData, h, w, alpha=10){
  const cOrig = haar2D(origData, h, w);
  const cEmb  = haar2D(embData,  h, w);
  const offset = (h*w)/2;
  const wm = [];
  for(let i=0; i<cOrig.length/4 && i<1024; i++){
    wm.push( (cEmb[offset+i] - cOrig[offset+i]) > 0 ? 1 : 0 );
  }
  return wm;
}
