
export const BOT_VERSION="2.5.2";

function decodeTextEntities(s){
  return String(s??"")
    .replace(/&#x([0-9a-f]+);/gi,(_,h)=>String.fromCodePoint(parseInt(h,16)))
    .replace(/&#([0-9]+);/g,(_,n)=>String.fromCodePoint(parseInt(n,10)))
    .replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"')
    .replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,"<").replace(/&gt;/gi,">");
}
function clean(v){
  return decodeTextEntities(String(v??""))
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ")
    .replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
}
function md(s){return clean(s).replace(/([\\`*_{}\[\]()#+\-.!|>])/g,"\\$1");}
function itemUrl(x){
  const id=String(x?.id||x?.artifact_id||"").replace(/\D/g,"");
  return id?`https://warofdragons.com/artifact_info.php?artifact_id=${id}`:null;
}
function linkItem(x){
  if(!x)return "—";
  const name=md(x.title||"Unknown item"),url=itemUrl(x);
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

export function buildDiscordPages(data){
  const embeds=[];
  for(let idx=0;idx<data.groups.length;idx++){
    const g=data.groups[idx];
    if(!g.style&&!g.real)continue;

    const lines=[];
    if(g.style)lines.push(`🎭 **Style:** ${linkItem(g.style)}`);
    if(g.real){
      lines.push(`🛡️ **Actual:** ${linkItem(g.real)}`);
      for(const e of enhancementLines(g.real))lines.push(`↳ ${e}`);
    }

    const e={
      title:String(g.slot||"Equipment").slice(0,256),
      description:lines.join("\n").slice(0,4096),
      color:0x167c79
    };
    if(g._pairImageName)e.image={url:`attachment://${g._pairImageName}`};
    embeds.push({embed:e,file:g._pairImageFile||null});
  }

  // Keep one /gear result; Discord limit is 10 embeds/message, so continuation messages only if required.
  const pages=[];
  for(let i=0;i<embeds.length;i+=10){
    const chunk=embeds.slice(i,i+10);
    pages.push({
      content:i===0?`**${data.nick} — Equipment · GearMate v${BOT_VERSION}**`:null,
      embeds:chunk.map(x=>x.embed),
      files:chunk.map(x=>x.file).filter(Boolean),
      components:i===0?[{
        type:1,components:[{type:2,style:5,label:"Open profile",url:data.source}]
      }]:[]
    });
  }
  return pages;
}
