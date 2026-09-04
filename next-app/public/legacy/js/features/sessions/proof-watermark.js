export async function watermarkProof(file){
  if(!file?.type?.startsWith('image/'))return file;
  const bitmap=await createImageBitmap(file),canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;
  const ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0);ctx.save();ctx.translate(canvas.width/2,canvas.height/2);ctx.rotate(-Math.PI/7);ctx.globalAlpha=.32;ctx.fillStyle='#fff';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`600 ${Math.max(28,Math.round(canvas.width/18))}px Arial`;
  const label='PROVA · RANGEL SANTOS';for(let y=-canvas.height;y<canvas.height;y+=Math.max(120,canvas.height/4))for(let x=-canvas.width;x<canvas.width;x+=Math.max(420,canvas.width/2))ctx.fillText(label,x,y);ctx.restore();bitmap.close();
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('Falha ao criar marca de água.')),'image/jpeg',.9));
  return new File([blob],file.name.replace(/\.[^.]+$/,'.jpg'),{type:'image/jpeg',lastModified:Date.now()});
}
