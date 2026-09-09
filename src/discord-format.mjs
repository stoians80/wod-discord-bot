
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

function md(s){
  return clean(s).replace(/([\\`*_{}\[\]()#+\-.!|>])/g,"\\$1");
}

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
      if(/plate|пластина/i.test(probe)) out.push(`🟪 **Plate:** ${md(value)}`);
      else if(/gem|gemstone|jewel|драгоцен|камень/i.test(probe)) out.push(`💎 **Gem:** ${md(value)}`);
      else if(/sharpen|заточ/i.test(probe)) out.push(`⚔️ **Sharpening:** ${md(value)}`);
    }
  }

  const symbols=Array.isArray(x.symbols)
    ? x.symbols.map(enhValue).filter(Boolean)
    : [];
  if(symbols.length)out.push(`✨ **Symbol:** ${symbols.map(md).join(", ")}`);

  return out;
}

function itemBlock(prefix,x,includeEnhancements=true){
  if(!x)return "";
  const lines=[`${prefix} ${linkItem(x)}`];
  if(includeEnhancements){
    for(const line of enhancementLines(x)) lines.push(`↳ ${line}`);
  }
  return lines.join("\n");
}

function trimField(s,max=1024){
  s=String(s||"");
  return s.length<=max ? s : s.slice(0,max-1)+"…";
}

export function buildDiscordPayload(data){
  const fields=[];

  for(const g of data.groups){
    if(!g.style && !g.real)continue;

    const blocks=[];
    if(g.style) blocks.push(itemBlock("🎭 **Style:**",g.style,false));
    if(g.real) blocks.push(itemBlock("🛡️ **Actual:**",g.real,true));

    fields.push({
      name: String(g.slot || "Equipment").slice(0,256),
      value: trimField(blocks.join("\n")),
      inline: false
    });

    if(fields.length>=25)break;
  }

  const summary =
    `**${data.equipped.length} equipped** · `+
    `${data.styleCount} style · ${data.realCount} actual\n`+
    `🔹 ${data.enhancementCounts.runes} runes · `+
    `🔸 ${data.enhancementCounts.bezels} bezels · `+
    `🟪 ${data.enhancementCounts.plates} plates · `+
    `✨ ${data.enhancementCounts.symbols} symbols`;

  return {
    embeds:[{
      title:`${data.nick} — Equipment`,
      url:data.source,
      description:summary,
      color:0x167c79,
      fields,
      footer:{text:"War of Dragons equipment viewer"}
    }],
    components:[{
      type:1,
      components:[{
        type:2,
        style:5,
        label:"Open profile",
        url:data.source
      }]
    }]
  };
}
