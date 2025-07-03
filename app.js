import {haar2D, inverseHaar2D, embedWatermark, extractWatermark} from "./dwt.js";

const origCan = document.getElementById("origCan");
const wmCan   = document.getElementById("wmCan");
const retrCan = document.getElementById("retrCan");
const ctxO = origCan.getContext("2d");
const ctxW = wmCan.getContext("2d");
const ctxR = retrCan.getContext("2d");

let origImgData, origH, origW;
let wmBin = []; // array 0/1

// util konversi teks ke biner
function textToBits(txt){
  return txt.split("").flatMap(c=>{
    const bin = c.charCodeAt(0).toString(2).padStart(8,"0");
    return [...bin].map(b=>+b);
  });
}
// pilih gambar utama
document.getElementById("btnAdd").onclick = ()=>imgInput.click();
imgInput.onchange = e=>{
  const file = e.target.files[0];
  if(!file) return;
  const img = new Image();
  img.onload = ()=>{
    origCan.width = img.width;  origCan.height = img.height;
    ctxO.drawImage(img,0,0);
    const d = ctxO.getImageData(0,0,img.width,img.height).data;
    // ambil grayscale channel Y
    origH = img.height; origW = img.width;
    origImgData = new Float32Array(origH*origW);
    for(let i=0;i<origImgData.length;i++){
      const r=d[i*4], g=d[i*4+1], b=d[i*4+2];
      origImgData[i]=0.299*r+0.587*g+0.114*b;
    }
  };
  img.src = URL.createObjectURL(file);
};

// pilih watermark
document.getElementById("btnSelWM").onclick = ()=>wmImgInput.click();
wmImgInput.onchange = e=>{
  const file = e.target.files[0];
  if(!file) return;
  const img = new Image();
  img.onload = ()=>{
    const temp = document.createElement("canvas");
    temp.width = 32; temp.height = 32;
    temp.getContext("2d").drawImage(img,0,0,32,32);
    const d = temp.getContext("2d").getImageData(0,0,32,32).data;
    wmBin = [];
    for(let i=0;i<32*32;i++){
      const r=d[i*4],g=d[i*4+1],b=d[i*4+2];
      wmBin.push( (r+g+b)/3 > 128 ? 1 : 0);
    }
    ctxW.drawImage(img,0,0,wmCan.width,wmCan.height);
  };
  img.src = URL.createObjectURL(file);
};

// embedding
btnEmbed.onclick = ()=>{
  if(wmText.value && !wmBin.length) wmBin = textToBits(wmText.value);
  if(!origImgData || !wmBin.length) return alert("Masukkan gambar & watermark.");
  const watermarked = embedWatermark(origImgData, wmBin, origH, origW, 10);
  // tulis balik ke kanvas
  const outImg = ctxO.getImageData(0,0,origW,origH);
  for(let i=0;i<watermarked.length;i++){
    outImg.data[i*4] = outImg.data[i*4+1] = outImg.data[i*4+2] =
      Math.max(0,Math.min(255,watermarked[i])); // grayscale
  }
  ctxO.putImageData(outImg,0,0);
};

// download
btnDownload.onclick=()=>{
  const link=document.createElement("a");
  link.download="embedded.png";
  link.href=origCan.toDataURL("image/png");
  link.click();
};

// retrieval
btnRetrieve.onclick=()=>{
  if(!origImgData) return;
  const embData = new Float32Array(origImgData.length);
  const d = ctxO.getImageData(0,0,origW,origH).data;
  for(let i=0;i<embData.length;i++){
    embData[i]=0.299*d[i*4]+0.587*d[i*4+1]+0.114*d[i*4+2];
  }
  const bits = extractWatermark(origImgData, embData, origH, origW, 10);
  // render 32×32
  retrCan.width = retrCan.height = 128;
  const w=32; const scale=4;
  for(let y=0;y<w;y++){
    for(let x=0;x<w;x++){
      ctxR.fillStyle = bits[y*w+x] ? "#000" : "#fff";
      ctxR.fillRect(x*scale,y*scale,scale,scale);
    }
  }
  ctxW.clearRect(0,0,wmCan.width,wmCan.height); // ganti tampilan
};
