/* ======================== Konstanta ======================= */
const ALPHA  = 0.4;  // kekuatan embed (sama dgn DEFAULT_ALPHA python)
const LEVEL  = 1;    // level DWT (1‑level, sesuai script python)

/* ===================== Elemen DOM ========================= */
const coverInput        = document.getElementById("coverInput");
const watermarkImageInp = document.getElementById("watermarkImageInput");
const wmTextArea        = document.getElementById("watermarkText");
const watermarkedSelBtn = document.getElementById("selectWatermarkedBtn");

const embedBtn      = document.getElementById("embedBtn");
const retrieveBtn   = document.getElementById("retrieveBtn");
const downloadBtn   = document.getElementById("downloadBtn");

const coverCan      = document.getElementById("coverCanvas");
const wmCan         = document.getElementById("watermarkCanvas");
const watermarkedCan= document.getElementById("watermarkedCanvas");
const retrievedCan  = document.getElementById("retrievedCanvas");

/* ====================== State ============================= */
let coverGray = null;          // Float32Array
let coverW = 0, coverH = 0;    // even dimensions
let wmBits  = null;            // Uint8Array (0/1)
let watermarkedGray = null;    // Float32Array
let watermarkedLoaded = false; // true jika user load manual stego

/* ===================== Utility ============================ */
function toGrayArray(img, targetW, targetH){
  const cvs=document.createElement("canvas");
  cvs.width=targetW; cvs.height=targetH;
  cvs.getContext("2d").drawImage(img,0,0,targetW,targetH);
  const data=cvs.getContext("2d").getImageData(0,0,targetW,targetH).data;
  const g=new Float32Array(targetW*targetH);
  for(let i=0;i<g.length;i++){
    const r=data[i*4], g0=data[i*4+1], b=data[i*4+2];
    g[i]=0.299*r+0.587*g0+0.114*b;
  }
  return g;
}
function drawGrayToCanvas(gray, w, h, canvas){
  canvas.width=w; canvas.height=h;
  const ctx=canvas.getContext("2d");
  const imgData=ctx.createImageData(w,h);
  for(let i=0;i<gray.length;i++){
    const v=Math.max(0,Math.min(255,gray[i]));
    imgData.data[i*4]=imgData.data[i*4+1]=imgData.data[i*4+2]=v;
    imgData.data[i*4+3]=255;
  }
  ctx.putImageData(imgData,0,0);
}
function resizeBits(bits, srcW, srcH, dstW, dstH){
  // nearest‑neighbor resize for binary bits
  const out=new Uint8Array(dstW*dstH);
  for(let y=0;y<dstH;y++){
    for(let x=0;x<dstW;x++){
      const ys=Math.floor(y*srcH/dstH);
      const xs=Math.floor(x*srcW/dstW);
      out[y*dstW+x]=bits[ys*srcW+xs];
    }
  }
  return out;
}
function textToBits(text, sizeW, sizeH){
  // render text to binary canvas sizeW×sizeH (default 128×128)
  const cvs=document.createElement("canvas");
  cvs.width=sizeW; cvs.height=sizeH;
  const ctx=cvs.getContext("2d");
  ctx.fillStyle="#fff"; ctx.fillRect(0,0,sizeW,sizeH);
  ctx.fillStyle="#000"; ctx.font="20px Arial"; ctx.textAlign="center"; ctx.textBaseline="middle";
  ctx.fillText(text,sizeW/2,sizeH/2);
  const data=ctx.getImageData(0,0,sizeW,sizeH).data;
  const bits=new Uint8Array(sizeW*sizeH);
  for(let i=0;i<bits.length;i++) bits[i]=data[i*4]<128?1:0;
  return bits;
}

/* ============== Load Cover Image ========================= */
coverInput.addEventListener("change", e=>{
  const file=e.target.files[0]; if(!file) return;
  const img=new Image();
  img.onload=()=>{
    // ensure even dimensions <=256x256 for performance
    const maxSide=256;
    let w=img.width, h=img.height;
    const scale=Math.min(1, maxSide/Math.max(w,h));
    w=Math.floor(w*scale)&~1; h=Math.floor(h*scale)&~1;
    coverW=w; coverH=h;
    coverGray=toGrayArray(img,w,h);
    drawGrayToCanvas(coverGray,w,h,coverCan);
    watermarkedGray=null; watermarkedLoaded=false;
  };
  img.src=URL.createObjectURL(file);
});

/* ============== Load Watermark =========================== */
watermarkImageInp.addEventListener("change", e=>{
  const file=e.target.files[0]; if(!file) return;
  const img=new Image();
  img.onload=()=>{
    const targetW=Math.max(64, coverW>>LEVEL), targetH=Math.max(64, coverH>>LEVEL);
    const gray=toGrayArray(img,targetW,targetH);
    wmBits=Uint8Array.from(gray, v=>v<128?1:0);
    drawGrayToCanvas(gray,targetW,targetH,wmCan);
  };
  img.src=URL.createObjectURL(file);
});

wmTextArea.addEventListener("input", ()=>{
  if(wmTextArea.value.trim()){
    const w=Math.max(64, coverW>>LEVEL);
    const h=Math.max(64, coverH>>LEVEL);
    wmBits=textToBits(wmTextArea.value.trim(), w, h);
    drawGrayToCanvas(wmBits, w, h, wmCan);
  }
});

/* ============== Select external watermarked image ========= */
watermarkedSelBtn.addEventListener("click", ()=>{
  const inp=document.createElement("input");
  inp.type="file"; inp.accept="image/*";
  inp.onchange=e=>{
    const file=e.target.files[0]; if(!file) return;
    const img=new Image();
    img.onload=()=>{
      // resize same as cover dims for processing
      const w=img.width&~1, h=img.height&~1;
      coverW=w; coverH=h;
      watermarkedGray=toGrayArray(img,w,h);
      drawGrayToCanvas(watermarkedGray,w,h,watermarkedCan);
      watermarkedLoaded=true;
    };
    img.src=URL.createObjectURL(file);
  };
  inp.click();
});

/* ============== EMBED ===================================== */
embedBtn.onclick=()=>{
  if(!coverGray){ alert("Please load cover image first"); return; }
  if(!wmBits){ alert("Provide watermark (text or image)"); return; }
  // Ensure watermark size matches HH band size
  const hhW=coverW>>LEVEL, hhH=coverH>>LEVEL;
  let wmAdj=wmBits;
  const wmW=Math.sqrt(wmBits.length)|0; // assume square
  if(wmW!==hhW||wmBits.length!==hhW*hhH) wmAdj=resizeBits(wmBits, wmW, wmW, hhW, hhH);

  // DWT decomp
  const coeff=DWT.dwt2D(coverGray,coverH,coverW,LEVEL);
  const HH=coeff.details[0][2]; // level-1 HH
  for(let i=0;i<HH.length;i++) HH[i]+=ALPHA*(wmAdj[i]?1:-1);
  // reconstruct
  watermarkedGray=DWT.idwt2D(coeff,coverH,coverW,LEVEL);
  drawGrayToCanvas(watermarkedGray,coverW,coverH,watermarkedCan);
  watermarkedLoaded=true;
};

/* ============== DOWNLOAD ================================== */
downloadBtn.onclick=()=>{
  if(!watermarkedLoaded){ alert("No watermarked image"); return; }
  const link=document.createElement("a");
  link.download="watermarked.png";
  link.href=watermarkedCan.toDataURL("image/png");
  link.click();
};

/* ============== RETRIEVAL ================================= */
retrieveBtn.onclick=()=>{
  if(!watermarkedLoaded){ alert("Load or embed watermarked image first"); return; }
  // Use watermarkedGray array (if null, get from canvas)
  if(!watermarkedGray){ watermarkedGray=toGrayArray(watermarkedCan, coverW, coverH); }
  const coeff=DWT.dwt2D(watermarkedGray,coverH,coverW,LEVEL);
  const HH=coeff.details[0][2];
  // Estimate watermark
  const est=new Float32Array(HH.length);
  for(let i=0;i<HH.length;i++) est[i]=HH[i]/ALPHA;
  // Normalize to 0‑255
  const min=Math.min(...est), max=Math.max(...est);
  const norm=Uint8Array.from(est,x=>255*(x-min)/(max-min));
  const sizeW=coverW>>LEVEL, sizeH=coverH>>LEVEL;
  drawGrayToCanvas(norm,sizeW,sizeH,retrievedCan);
};
