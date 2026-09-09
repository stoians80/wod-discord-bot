
import sharp from "sharp";

async function fetchBuffer(url){
  if(!url)return null;
  try{
    const r=await fetch(url,{headers:{"user-agent":"Mozilla/5.0 (compatible; WOD-GearMate/2.5.3)"}});
    if(!r.ok)return null;
    return Buffer.from(await r.arrayBuffer());
  }catch{return null}
}
async function fit(buf){
  if(!buf)return null;
  try{
    return await sharp(buf,{animated:false})
      .resize(180,180,{fit:"contain",background:{r:0,g:0,b:0,alpha:0}})
      .png().toBuffer();
  }catch{return null}
}
export async function addPairImages(data){
  await Promise.all(data.groups.map(async(g,i)=>{
    const [sb,ab]=await Promise.all([
      fetchBuffer(g.style?._styleImage),
      fetchBuffer(g.real?._armorImage)
    ]);
    const [style,actual]=await Promise.all([fit(sb),fit(ab)]);
    if(!style&&!actual)return;

    const base=sharp({
      create:{width:760,height:190,channels:4,background:{r:0,g:0,b:0,alpha:0}}
    });
    const composite=[];
    if(style)composite.push({input:style,left:0,top:5});
    if(actual)composite.push({input:actual,left:580,top:5});
    const file=await base.composite(composite).png().toBuffer();
    const name=`gear-${i}.png`;
    g._pairImageName=name;
    g._pairImageFile={attachment:file,name};
  }));
  return data;
}
