
function clean(v){
  return String(v ?? "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ")
    .replace(/<[^>]+>/g," ")
    .replace(/&nbsp;/gi," ")
    .replace(/&amp;/gi,"&")
    .replace(/&quot;/gi,'"')
    .replace(/\s+/g," ")
    .trim();
}
function md(s){return clean(s).replace(/([\\`*_{}\[\]()#+\-.!|>])/g,"\\$1");}
function itemUrl(x){
  const id=String(x?.id || x?.artifact_id || "").replace(/\D/g,"");
  return id ? `https://warofdragons.com/artifact_info.php?artifact_id=${id}` : null;
}
function linkItem(x){
  if(!x)return "—";
  const name=md(x.title || "Unknown item");
  const url=itemUrl(x);
  return url ? `[${name}](${url})` : `**${name}**`;
}
function enhValue(v){
  if(!v)return "";
  if(typeof v==="string")return clean(v);
  return clean(v.value || v.name || v.title || "");
}
function enhancementLines(x){
  if(!x)return [];
  const out=[];
  const rune=enhValue(x.enchant);
  if(rune)out.push(`🔹 **Rune:** ${md(rune)}`);
  const bezel=enhValue(x.enchant3);
  if(bezel)out.push(`🔸 **Bezel:** ${md(bezel)}`);
  if(x.enchant5){
    const probe=String(x.enchant5?.description||"")+" "+String(x.enchant5?.title||"");
    const value=enhValue(x.enchant5);
    if(value){
      if(/plate|пластина/i.test(probe))out.push(`🟪 **Plate:** ${md(value)}`);
      else if(/gem|gemstone|jewel|драгоцен|камень/i.test(probe))out.push(`💎 **Gem:** ${md(value)}`);
      else if(/sharpen|заточ/i.test(probe))out.push(`⚔️ **Sharpening:** ${md(value)}`);
    }
  }
  const symbols=Array.isArray(x.symbols)?x.symbols.map(enhValue).filter(Boolean):[];
  if(symbols.length)out.push(`✨ **Symbol:** ${symbols.map(md).join(", ")}`);
  return out;
}
function itemBlock(prefix,x,includeEnhancements=true){
  if(!x)return "";
  const lines=[`${prefix} ${linkItem(x)}`];
  if(includeEnhancements)for(const line of enhancementLines(x))lines.push(`↳ ${line}`);
  return lines.join("\n");
}

export function buildDiscordPayloads(data){
  const embeds=[];

  for(const g of data.groups){
    if(!g.style && !g.real)continue;
    const blocks=[];
    if(g.style)blocks.push(itemBlock("🎭 **Style:**",g.style,false));
    if(g.real)blocks.push(itemBlock("🛡️ **Actual:**",g.real,true));

    const e={
      title:String(g.slot||"Equipment").slice(0,256),
      description:blocks.join("\n").slice(0,4096),
      color:0x167c79
    };
    if(g.real?._armorImage)e.thumbnail={url:g.real._armorImage};
    embeds.push(e);
  }

  // Discord allows max 10 embeds per message.
  const pages=[];
  for(let i=0;i<embeds.length;i+=10){
    pages.push({
      embeds:embeds.slice(i,i+10),
      components:i===0?[{
        type:1,
        components:[{type:2,style:5,label:"Open profile",url:data.source}]
      }]:[]
    });
  }
  return pages;
}
