
export const BOT_VERSION="2.3.0";

function decodeTextEntities(s){
  return String(s??"")
    .replace(/&#x([0-9a-f]+);/gi,(_,h)=>String.fromCodePoint(parseInt(h,16)))
    .replace(/&#([0-9]+);/g,(_,n)=>String.fromCodePoint(parseInt(n,10)))
    .replace(/&nbsp;/gi," ")
    .replace(/&amp;/gi,"&")
    .replace(/&quot;/gi,'"')
    .replace(/&#39;|&apos;/gi,"'")
    .replace(/&lt;/gi,"<")
    .replace(/&gt;/gi,">");
}
function clean(v){
  return decodeTextEntities(String(v ?? ""))
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ")
    .replace(/<[^>]+>/g," ")
    .replace(/\s+/g," ")
    .trim();
}
function md(s){return clean(s).replace(/([\\`*_{}\[\]()#+\-.!|>])/g,"\\$1");}
function itemUrl(x){
  const id=String(x?.id||x?.artifact_id||"").replace(/\D/g,"");
  return id?`https://warofdragons.com/artifact_info.php?artifact_id=${id}`:null;
}
function linkItem(x){
  if(!x)return "—";
  const name=md(x.title||"Unknown item"), url=itemUrl(x);
  return url?`[${name}](${url})`:`**${name}**`;
}
function enhValue(v){
  if(!v)return "";
  if(typeof v==="string")return clean(v);
  return clean(v.value||v.name||v.title||"");
}
function enhancementLines(x){
  const out=[]; if(!x)return out;
  const rune=enhValue(x.enchant); if(rune)out.push(`🔹 **Rune:** ${md(rune)}`);
  const bezel=enhValue(x.enchant3); if(bezel)out.push(`🔸 **Bezel:** ${md(bezel)}`);
  if(x.enchant5){
    const probe=String(x.enchant5?.description||"")+" "+String(x.enchant5?.title||"");
    const value=enhValue(x.enchant5);
    if(value){
      if(/plate|пластина/i.test(probe))out.push(`🟪 **Plate:** ${md(value)}`);
      else if(/gem|gemstone|jewel|драгоцен|камень/i.test(probe))out.push(`💎 **Gem:** ${md(value)}`);
      else if(/sharpen|заточ/i.test(probe))out.push(`⚔️ **Sharpening:** ${md(value)}`);
      else out.push(`➕ **Enhancement:** ${md(value)}`);
    }
  }
  const syms=Array.isArray(x.symbols)?x.symbols.map(enhValue).filter(Boolean):[];
  if(syms.length)out.push(`✨ **Symbol:** ${syms.map(md).join(", ")}`);
  return out;
}
function flattenStats(v,out=[],prefix=""){
  if(v==null || v==="")return out;
  if(Array.isArray(v)){
    for(const item of v)flattenStats(item,out,prefix);
    return out;
  }
  if(typeof v==="object"){
    for(const [k,val] of Object.entries(v)){
      const key=clean(k).replace(/_/g," ");
      if(val!=null && typeof val==="object")flattenStats(val,out,key);
      else{
        const value=clean(val);
        if(value && value!=="0" && value!=="false")out.push(`${key}: ${value}`);
      }
    }
    return out;
  }
  const text=clean(v);
  if(text)out.push(prefix?`${prefix}: ${text}`:text);
  return out;
}
function statLines(x){
  if(!x)return [];
  const out=[];
  if(x.dur)out.push(`**Durability:** ${md(x.dur)}`);
  const raw=x.skills_e||x.skills;
  const stats=flattenStats(raw).filter(s=>s && !/^\[object Object\]$/i.test(s));
  if(stats.length)out.push(`**Stats:** ${stats.map(md).join(" · ")}`);
  return out;
}
function body(g){
  const lines=[];
  if(g.style)lines.push(`🎭 **Style:** ${linkItem(g.style)}`);
  if(g.real){
    lines.push(`🛡️ **Actual:** ${linkItem(g.real)}`);
    for(const s of statLines(g.real))lines.push(`↳ ${s}`);
    for(const e of enhancementLines(g.real))lines.push(`↳ ${e}`);
  }
  return lines.join("\n").slice(0,4096);
}

export function buildDiscordPages(data){
  const embeds=[];
  for(const g of data.groups){
    if(!g.style&&!g.real)continue;
    const e={
      title:String(g.slot||"Equipment").slice(0,256),
      description:body(g),
      color:0x167c79
    };
    if(g.style?._styleImage){
      e.author={name:"Style",icon_url:g.style._styleImage};
    }
    if(g.real?._armorImage)e.thumbnail={url:g.real._armorImage};
    embeds.push(e);
  }

  const pages=[];
  for(let i=0;i<embeds.length;i+=10){
    pages.push({
      content:i===0?`**${data.nick} — Equipment · GearMate v${BOT_VERSION}**`:null,
      embeds:embeds.slice(i,i+10),
      components:i===0?[{
        type:1,
        components:[{type:2,style:5,label:"Open profile",url:data.source}]
      }]:[]
    });
  }
  return pages;
}
