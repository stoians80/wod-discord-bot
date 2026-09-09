
import {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder
} from "discord.js";

import {
  validateProfileUrl,
  fetchProfileUrl,
  buildProfileData,
  enrichEquipmentImages
} from "./wod-core.mjs";

import { buildDiscordPages, BOT_VERSION } from "./discord-format.mjs";
import { addPairImages } from "./pair-images.mjs";

const DISCORD_TOKEN=(process.env.DISCORD_TOKEN || "").trim();
const BOT_OWNER_ID=(process.env.BOT_OWNER_ID || "").trim();

if(!DISCORD_TOKEN){
  throw new Error("Missing DISCORD_TOKEN");
}

const client=new Client({
  intents:[
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials:[Partials.Channel]
});

function extractGearUrl(content){
  const text=String(content || "").trim();

  // Primary syntax requested by the user:
  // /gear https://warofdragons.com/user_info.php?nick=...
  //
  // !gear is accepted only as a fallback in case a Discord client
  // locally intercepts slash-looking text.
  const m=text.match(/^[/!]gear\s+(.+)$/i);
  if(!m)return null;

  let url=m[1].trim();

  // Discord often wraps pasted links in <...> to suppress embeds.
  if(url.startsWith("<") && url.endsWith(">")){
    url=url.slice(1,-1).trim();
  }

  return url;
}

function discordPayloadToReply(payload){
  const reply={};

  if(Array.isArray(payload.embeds)){
    reply.embeds=payload.embeds.map(x=>EmbedBuilder.from(x));
  }

  if(Array.isArray(payload.components)){
    reply.components=payload.components;
  }

  if(payload.content){
    reply.content=payload.content;
  }

  if(Array.isArray(payload.files)){
    reply.files=payload.files;
  }

  return reply;
}


function isOwner(message){
  return Boolean(BOT_OWNER_ID) && String(message.author?.id || "")===BOT_OWNER_ID;
}

async function handleGuilds(message){
  if(!isOwner(message))return;

  const guilds=[...client.guilds.cache.values()]
    .sort((a,b)=>String(a.name).localeCompare(String(b.name)));

  if(!guilds.length){
    await message.reply({content:`GearMate v${BOT_VERSION} is not connected to any servers.`,allowedMentions:{repliedUser:false}});
    return;
  }

  const rows=await Promise.all(guilds.map(async guild=>{
    let ownerId=String(guild.ownerId || "");
    if(!ownerId){
      try{ ownerId=String((await guild.fetchOwner())?.id || ""); }catch{}
    }
    return `**${guild.name}**\nID: \`${guild.id}\` · Members: ${guild.memberCount ?? "?"} · Owner: \`${ownerId || "unknown"}\``;
  }));

  const chunks=[];
  let current="";
  for(const row of rows){
    const add=(current?"\n\n":"")+row;
    if((current+add).length>1800){
      chunks.push(current);
      current=row;
    }else current+=add;
  }
  if(current)chunks.push(current);

  await message.reply({
    content:`**GearMate v${BOT_VERSION} — servers (${guilds.length})**\n\n${chunks[0]}`,
    allowedMentions:{repliedUser:false}
  });
  for(const chunk of chunks.slice(1)){
    await message.channel.send({content:chunk,allowedMentions:{parse:[]}});
  }
}

async function handleLeaveGuild(message,guildId){
  if(!isOwner(message))return;

  const id=String(guildId||"").trim();
  if(!/^\d{15,22}$/.test(id)){
    await message.reply({content:"Usage: `/leaveguild <server ID>`",allowedMentions:{repliedUser:false}});
    return;
  }

  const guild=client.guilds.cache.get(id);
  if(!guild){
    await message.reply({content:`GearMate is not currently connected to server \`${id}\`.`,allowedMentions:{repliedUser:false}});
    return;
  }

  const name=guild.name;
  await message.reply({
    content:`Leaving **${name}** (\`${guild.id}\`).`,
    allowedMentions:{repliedUser:false}
  });
  await guild.leave();
}

async function handleGear(message, rawUrl){
  let progress;

  try{
    progress=await message.reply({
      content:"Loading equipment…",
      allowedMentions:{repliedUser:false}
    });

    const exactUrl=validateProfileUrl(rawUrl);
    const {html}=await fetchProfileUrl(exactUrl);
    const data=buildProfileData(exactUrl,html);
    await enrichEquipmentImages(data);
    await addPairImages(data);

    if(!data.equipped.length){
      await progress.edit({
        content:
          `Loaded the profile, but found **0 equipped items**.\n`+
          `${exactUrl}\n`+
          `art_alt assignments found: ${data.assignmentsFound}`,
        embeds:[],
        components:[]
      });
      return;
    }

    const pages=buildDiscordPages(data);
    const first=pages[0];

    await progress.edit({
      ...discordPayloadToReply(first),
      allowedMentions:{repliedUser:false}
    });

    for(const page of pages.slice(1)){
      await message.channel.send({
        ...discordPayloadToReply(page),
        allowedMentions:{repliedUser:false}
      });
    }

  }catch(e){
    const msg=`❌ ${String(e?.message || e).slice(0,1800)}`;

    if(progress){
      await progress.edit({
        content:msg,
        embeds:[],
        components:[]
      }).catch(()=>{});
    }else{
      await message.reply({
        content:msg,
        allowedMentions:{repliedUser:false}
      }).catch(()=>{});
    }
  }
}

client.once("ready",()=>{
  console.log(`Discord bot online as ${client.user.tag} · GearMate v${BOT_VERSION}`);
  console.log("Command: /gear <full War of Dragons profile URL>");
  console.log("Owner commands: /guilds · /leaveguild <server ID>");
  if(!BOT_OWNER_ID)console.warn("BOT_OWNER_ID is not set; owner commands are disabled.");
});

client.on("messageCreate",async message=>{
  if(message.author?.bot)return;

  const text=String(message.content || "").trim();

  if(/^[/!]guilds$/i.test(text)){
    await handleGuilds(message);
    return;
  }

  const leave=text.match(/^[/!]leaveguild\s+(\d+)$/i);
  if(leave){
    await handleLeaveGuild(message,leave[1]);
    return;
  }

  const url=extractGearUrl(text);
  if(!url)return;

  await handleGear(message,url);
});

await client.login(DISCORD_TOKEN);
