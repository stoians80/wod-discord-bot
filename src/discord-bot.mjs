
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
});

client.on("messageCreate",async message=>{
  if(message.author?.bot)return;

  const url=extractGearUrl(message.content);
  if(!url)return;

  await handleGear(message,url);
});

await client.login(DISCORD_TOKEN);
