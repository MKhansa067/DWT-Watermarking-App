(function(global){
  "use strict";

  // 1‑D forward Haar (even length)
  function haar1D(data){
    const n = data.length;
    const half = n >> 1;
    const avg  = new Float32Array(half);
    const diff = new Float32Array(half);
    for(let i=0;i<half;i++){
      const a = data[i*2], b = data[i*2+1];
      avg[i]  = (a+b)/2;
      diff[i] = (a-b)/2;
    }
    return {avg, diff};
  }
  // 1‑D inverse Haar
  function ihaar1D(avg,diff){
    const n = avg.length*2;
    const out = new Float32Array(n);
    for(let i=0;i<avg.length;i++){
      const a = avg[i], d = diff[i];
      out[i*2]   = a + d;
      out[i*2+1] = a - d;
    }
    return out;
  }

  // 2‑D forward Haar single level
  function haar2D(mat,h,w){
    const halfH=h>>1, halfW=w>>1;
    const tmpA = new Float32Array(h*halfW); // row averages
    const tmpD = new Float32Array(h*halfW); // row diffs

    // row transform
    for(let y=0;y<h;y++){
      const base=y*w;
      for(let x=0;x<halfW;x++){
        const a=mat[base+(x<<1)], b=mat[base+(x<<1)+1];
        tmpA[y*halfW+x]=(a+b)/2;
        tmpD[y*halfW+x]=(a-b)/2;
      }
    }
    // column transform
    const LL=new Float32Array(halfH*halfW), LH=new Float32Array(halfH*halfW),
          HL=new Float32Array(halfH*halfW), HH=new Float32Array(halfH*halfW);
    for(let y=0;y<halfH;y++){
      for(let x=0;x<halfW;x++){
        const a1=tmpA[(y<<1)*halfW+x], a2=tmpA[((y<<1)+1)*halfW+x];
        const d1=tmpD[(y<<1)*halfW+x], d2=tmpD[((y<<1)+1)*halfW+x];
        const idx=y*halfW+x;
        LL[idx]=(a1+a2)/2;
        LH[idx]=(a1-a2)/2;
        HL[idx]=(d1+d2)/2;
        HH[idx]=(d1-d2)/2;
      }
    }
    return {LL,LH,HL,HH};
  }

  // 2‑D inverse Haar single level
  function ihaar2D(coeff,h,w){
    const halfH=h>>1, halfW=w>>1;
    const tmpA = new Float32Array(h*halfW);
    const tmpD = new Float32Array(h*halfW);

    for(let y=0;y<halfH;y++){
      for(let x=0;x<halfW;x++){
        const i=y*halfW+x;
        const ll=coeff.LL[i], lh=coeff.LH[i], hl=coeff.HL[i], hh=coeff.HH[i];
        tmpA[(y<<1)*halfW+x]     = ll+lh;
        tmpA[((y<<1)+1)*halfW+x] = ll-lh;
        tmpD[(y<<1)*halfW+x]     = hl+hh;
        tmpD[((y<<1)+1)*halfW+x] = hl-hh;
      }
    }
    const out=new Float32Array(h*w);
    for(let y=0;y<h;y++){
      for(let x=0;x<halfW;x++){
        const a=tmpA[y*halfW+x], d=tmpD[y*halfW+x];
        out[y*w+(x<<1)]   = a+d;
        out[y*w+(x<<1)+1] = a-d;
      }
    }
    return out;
  }

  // multi‑level decomposition (returns object mimicking pywt.wavedec2 order)
  function dwt2D(src,h,w,level=1){
    let LL=src; let currH=h, currW=w;
    const details=[]; // will hold arrays [LH,HL,HH] per level
    for(let l=0;l<level;l++){
      const coeff=haar2D(LL,currH,currW);
      details.push([coeff.LH,coeff.HL,coeff.HH]);
      LL=coeff.LL; currH>>=1; currW>>=1;
    }
    return {LL,details};
  }

  // multi‑level reconstruction
  function idwt2D(coeffs,h,w,level=1){
    let LL=coeffs.LL; let currH=h>>level, currW=w>>level;
    for(let l=level-1;l>=0;l--){
      const [LH,HL,HH]=coeffs.details[l];
      const full={LL,LH,HL,HH};
      LL=ihaar2D(full,currH<<1,currW<<1);
      currH<<=1; currW<<=1;
    }
    return LL; // reconstructed image size h*w
  }

  // expose
  global.DWT={dwt2D,idwt2D,haar2D:haar2D,ihaar2D:ihaar2D};
})(window);
