import { exportDocumentAsPng } from '../src/lib/utils/exportPng.ts';
import { exportDocumentAsSvg } from '../src/lib/utils/exportSvg.ts';
import { loadImageFile } from '../src/lib/utils/image.ts';
import { normalizeDocument } from '../src/lib/utils/documentState.ts';
import type { DocumentState, TextItem } from '../src/lib/types/document.ts';

const results = document.querySelector('#results')!;
const status = document.querySelector('#status')!;
const preview = document.querySelector('#preview')!;
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
function toBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> { return new Promise(resolve => canvas.toBlob(blob => resolve(blob!), type)); }
async function decode(blob: Blob) {
  const url = URL.createObjectURL(blob); const image = new Image(); image.src = url;
  try { await image.decode(); return image; } finally { URL.revokeObjectURL(url); }
}
async function check(name: string, run: () => Promise<void> | void) {
  const li = document.createElement('li'); results.append(li);
  try { await run(); li.textContent = `PASS — ${name}`; li.className = 'pass'; }
  catch (error) { li.textContent = `FAIL — ${name}: ${error instanceof Error ? error.message : error}`; li.className = 'fail'; }
}
(document.querySelector('#run') as HTMLButtonElement).onclick = async () => {
  results.replaceChildren(); preview.replaceChildren(); status.textContent = 'Running…';
  const canvas = document.createElement('canvas'); canvas.width = 120; canvas.height = 80;
  const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#ef4444'; ctx.fillRect(0,0,60,80); ctx.fillStyle='#2563eb'; ctx.fillRect(60,0,60,80);
  const text: TextItem = {id:'text',type:'text',name:'Test text',text:'Print-ready text\nA < B & C',xMm:5,yMm:4,widthMm:70,heightMm:15,rotationDeg:0,lockedAspectRatio:false,fontSizeMm:4,fontFamily:'Arial, sans-serif',fontWeight:'700',textAlign:'left',color:'#111827'};
  const state: DocumentState = normalizeDocument({version:2,page:{templateId:'custom',name:'Export test',widthMm:80,heightMm:60},items:[text]});
  for (const type of ['image/png','image/jpeg','image/webp']) {
    await check(`${type} import preserves dimensions`, async () => {
      const blob = await toBlob(canvas, type); const loaded = await loadImageFile(new File([blob], `sample.${type.split('/')[1]}`,{type}));
      assert(loaded.naturalWidthPx === 120 && loaded.naturalHeightPx === 80, 'Wrong image dimensions');
      if (type === 'image/png') state.items.push({id:'raster',name:'Cropped PNG',type:'image',...loaded,xMm:5,yMm:25,widthMm:20,heightMm:25,rotationDeg:15,lockedAspectRatio:false,crop:{left:0.5,top:0,right:1,bottom:1}});
    });
  }
  await check('SVG image import and rotated layer export', async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#16a34a"/><circle cx="50" cy="50" r="30" fill="#facc15"/></svg>';
    const loaded = await loadImageFile(new File([svg],'sample.svg',{type:'image/svg+xml'}));
    assert(loaded.naturalWidthPx === 100, 'SVG did not load');
    state.items.push({id:'vector',name:'SVG artwork',type:'image',...loaded,xMm:40,yMm:25,widthMm:25,heightMm:25,rotationDeg:-15,lockedAspectRatio:true,crop:{left:0,top:0,right:1,bottom:1}});
  });
  await check('corrupt image is rejected', async () => {
    let rejected = false; try { await loadImageFile(new File(['broken'],'bad.png',{type:'image/png'})); } catch { rejected=true; }
    assert(rejected, 'Corrupt image was accepted');
  });
  await check('unsupported image is rejected', async () => {
    let rejected = false; try { await loadImageFile(new File(['broken'],'bad.gif',{type:'image/gif'})); } catch { rejected=true; }
    assert(rejected, 'Unsupported file was accepted');
  });
  await check('SVG is well-formed, layered, and contains native editable text', async () => {
    const svg = exportDocumentAsSvg(state); const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml');
    assert(!parsed.querySelector('parsererror'), 'SVG is not valid XML');
    assert(parsed.querySelectorAll('g[data-layer-index]').length === 3, 'Missing layer');
    assert(parsed.querySelector('text')?.textContent?.includes('A < B & C'), 'Escaped text was lost');
    assert(!parsed.querySelector('foreignObject'), 'Text still uses foreignObject');
    const blob = new Blob([svg], {type:'image/svg+xml'}); await decode(blob);
    const link = document.createElement('a'); link.href=URL.createObjectURL(blob); link.download='trimkit-browser-check.svg'; link.textContent='Download test SVG'; preview.append(link);
  });
  for (const dpi of [300,600,1200]) {
    await check(`PNG at ${dpi} DPI includes text and cropped/rotated images`, async () => {
      const blob = await exportDocumentAsPng(state,dpi); const image = await decode(blob);
      assert(image.naturalWidth === Math.round(80*dpi/25.4) && image.naturalHeight === Math.round(60*dpi/25.4), 'PNG size mismatch');
      const read = document.createElement('canvas'); read.width=image.naturalWidth; read.height=image.naturalHeight;
      const context = read.getContext('2d')!; context.drawImage(image,0,0);
      const pixel=(x:number,y:number)=>context.getImageData(Math.round(x*dpi/25.4),Math.round(y*dpi/25.4),1,1).data;
      const blue=pixel(15,37), yellow=pixel(52.5,37.5);
      assert(blue[2] > 150 && blue[0] < 100,'Cropped PNG image missing or crop wrong');
      assert(yellow[0] > 150 && yellow[1] > 150 && yellow[2] < 100,'Nested SVG image missing');
      const textPixels=context.getImageData(0,0,read.width,Math.round(19*dpi/25.4)).data;
      let dark=0; for(let i=0;i<textPixels.length;i+=4) if(textPixels[i]<80 && textPixels[i+1]<80) dark++;
      assert(dark>100,'Text was missing from PNG');
      const bytes=new Uint8Array(await blob.arrayBuffer()); let offset=8; let density=0;
      while(offset<bytes.length){const view=new DataView(bytes.buffer);const length=view.getUint32(offset);if(String.fromCharCode(...bytes.slice(offset+4,offset+8))==='pHYs')density=view.getUint32(offset+8);offset+=length+12;}
      assert(density===Math.round(dpi/0.0254),'PNG density metadata mismatch');
      if(dpi===300){const img=new Image();img.src=URL.createObjectURL(blob);img.alt='Verified PNG with multiline text and cropped, rotated images';preview.append(document.createElement('br'),img);}
    });
  }
  const failed=results.querySelectorAll('.fail').length;
  status.textContent=`${results.children.length-failed}/${results.children.length} browser checks passed${failed ? `; ${failed} failed` : ''}`;
};
