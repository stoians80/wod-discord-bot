import { URL } from "node:url";

const PORT = Number(process.env.PORT || 3000);
const HOST = "127.0.0.1";
const WOD = "https://warofdragons.com";

function decodeEntities(s) {
  const map = {"&amp;":"&","&lt;":"<","&gt;":">","&quot;":'"',"&#39;":"'","&nbsp;":" "};
  return String(s ?? "")
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, m => map[m] ?? m)
    .replace(/&#(\d+);/g, (_,n)=>String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_,n)=>String.fromCodePoint(parseInt(n,16)));
}
function stripHtml(s) {
  return decodeEntities(String(s ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, ""))
    .replace(/\u00a0/g, " ")
    .trim();
}
function extractBalancedObjects(text) {
  const out = [];
  const re = /art_alt\s*\[\s*["']AA_?(\d+)["']\s*\]\s*=\s*/g;
  let m;
  while ((m = re.exec(text))) {
    let i = re.lastIndex;
    while (i < text.length && /\s/.test(text[i])) i++;
    if (text[i] !== "{") continue;
    const start = i;
    let depth=0, quote=null, escaped=false;
    for (; i<text.length; i++) {
      const c=text[i];
      if (quote) {
        if (escaped) escaped=false;
        else if (c==="\\") escaped=true;
        else if (c===quote) quote=null;
      } else {
        if (c==='"' || c==="'") quote=c;
        else if (c==="{") depth++;
        else if (c==="}" && --depth===0) {
          out.push({fallbackId:m[1], literal:text.slice(start,i+1)});
          re.lastIndex=i+1;
          break;
        }
      }
    }
  }
  return out;
}
function parseArtAlt(html) {
  const found=extractBalancedObjects(html), items=[], errors=[];
  for (const f of found) {
    try {
      const x=JSON.parse(f.literal);
      if (!x.id) x.id=f.fallbackId;
      items.push(x);
    } catch(e) {
      errors.push({id:f.fallbackId,error:String(e.message||e)});
    }
  }
  const uniq=new Map();
  for (const x of items) uniq.set(String(x.id ?? x.artifact_alt_id ?? Math.random()),x);
  return {items:[...uniq.values()],parseErrors:errors,assignmentsFound:found.length};
}

function hasCombatSignature(x){
  const skills = Array.isArray(x?.skills) ? x.skills.length : 0;
  const extra = Array.isArray(x?.skills_e) ? x.skills_e.length : 0;
  const hasEnchant = Object.keys(x || {}).some(k => /^enchant\d*$/.test(k) && x[k]);
  const hasSymbols = Array.isArray(x?.symbols) && x.symbols.length > 0;

  return Boolean(
    x?.dur || x?.dur_max ||
    skills || extra ||
    hasEnchant || hasSymbols ||
    x?.repair || x?.sharpening
  );
}

function equipped(x){
  // Strong signal used by normal equipped armour/weapons.
  if (x?.unequip === true || x?.action === "unequip") return true;

  const kind = String(x?.kind || "").toLowerCase();
  const title = String(x?.title || "").toLowerCase();

  // Jewelry can be displayed by the profile with action=info.
  const isJewelry = /amulet|necklace|амулет|ring|кольц|печат/.test(kind);

  if (isJewelry) {
    /*
      Do not whitelist type_id. Phoenix/Exotic rings can use their own type.
      Include jewelry only if the object itself looks like combat equipment.
      This keeps Phoenix-style combat rings and rejects purely ceremonial /
      wedding/profile rings that carry no combat equipment signature.
    */
    if (hasCombatSignature(x)) return true;
    if (isStyle(x)) return true;
    return false;
  }

  return false;
}
function listLen(v){return Array.isArray(v)?v.length:0;}

function styleScore(x){
  let s=0;
  if(String(x.type_id)==="111") s+=10;
  if(x.noweight) s+=3;
  if(String(x.quality)==="5" && String(x.color||"").toLowerCase()==="#016e71") s+=3;
  if(!x.dur && !x.dur_max && !listLen(x.skills) && !listLen(x.skills_e) &&
     !Object.keys(x).some(k=>/^enchant\d*$/.test(k) && x[k]) && !listLen(x.symbols)) s+=2;
  return s;
}
function realScore(x){
  let s=0;
  if(String(x.type_id)==="3") s+=5;
  if(x.dur||x.dur_max) s+=4;
  if(listLen(x.skills)+listLen(x.skills_e)) s+=4;
  if(Object.keys(x).some(k=>/^enchant\d*$/.test(k) && x[k])) s+=3;
  if(listLen(x.symbols)) s+=2;
  if(x.repair||x.sharpening) s+=1;
  return s;
}
function isStyle(x){return styleScore(x)>=6 && styleScore(x)>realScore(x);}

/*
  IMPORTANT:
  - Pair only slots we actually understand.
  - Unknown/effect items get a unique key, so Banner can NEVER be paired with Totem
    merely because both were formerly "Other".
*/
function slotInfo(x){
  const kind = String(x.kind || "").trim();
  const title = String(x.title || "").trim();
  const k = `${kind} ${title}`.toLowerCase();
  const kid = String(x.kind_id ?? "").trim();

  /*
    Primary rule: exact game slot identity.
    If style and real equipment share kind_id, they are the same slot.
    We do NOT merge visually-similar armor names (e.g. Chainmail vs Cuirass).
  */

  // Verified semantic alias requested by user: Banner and Totem are the same slot.
  if (/banner|standard|flag|стяг|знам|totem|тотем/.test(k)) {
    return { key:"slot:banner-totem", label:"Banner / Totem", pairable:true };
  }

  // Jewelry can be action=info/use on a profile. Keep exact game slot identity.
  if (/amulet|necklace|амулет/.test(k)) {
    return { key:"slot:amulet", label:"Amulet", pairable:true, multi:true, max:2 };
  }
  if (/ring|кольц|печат/.test(k)) {
    return { key:"slot:ring", label:"Ring", pairable:true, multi:true, max:2 };
  }

  // Weapon exception is handled later; keep the real game kind_id when possible.
  if (/left hand|левая рука|shield|щит/.test(k) || kid==="44") {
    return { key:`slot:${kid || "left-hand"}`, label:kind || "Left hand", pairable:true, hand:"left" };
  }
  if (/two.?hand|двуруч|main|основное|weapon|меч|молот|axe|hammer|sword/.test(k) || ["10","12"].includes(kid)) {
    return { key:`slot:${kid || "weapon"}`, label:kind || "Weapon", pairable:true, hand:"weapon" };
  }

  // Normal equipment: exact kind_id is the slot.
  if (kid) {
    return {
      key:`slot:${kid}`,
      label:kind || `kind_id ${kid}`,
      pairable:true
    };
  }

  // If the page ever omits kind_id, only then fall back to exact normalized kind text.
  if (kind) {
    return {
      key:`slot-name:${kind.toLowerCase()}`,
      label:kind,
      pairable:true
    };
  }

  // Truly unknown records are never guessed/paird.
  return {
    key:`unpaired:${x.id}`,
    label:title || "Unknown",
    pairable:false
  };
}
function groupEquipment(items){
  const map=new Map();

  for(const x of items){
    const info=slotInfo(x);
    if(!map.has(info.key)) map.set(info.key,{...info,items:[]});
    map.get(info.key).items.push(x);
  }

  /*
    Special weapon case:
    Cosmetic right-hand + left-hand style pieces may visually cover one real
    two-handed item. This is the only cross-kind_id weapon merge we perform.
  */
  const entries=[...map.values()];
  const styleHands=[];
  let realTwoHand=null;

  for(const entry of entries){
    for(const x of entry.items){
      const kid=String(x.kind_id ?? "");
      const kind=String(x.kind || "");
      if(isStyle(x) && (kid==="10" || kid==="44" || /left hand|main|основное|левая рука/i.test(kind))){
        styleHands.push(x);
      }
      if(!isStyle(x) && (kid==="12" || /two.?hand|двуруч/i.test(kind))){
        realTwoHand=x;
      }
    }
  }

  if(realTwoHand && styleHands.length){
    for(const entry of entries){
      entry.items=entry.items.filter(x=>!styleHands.includes(x) && x!==realTwoHand);
    }
    map.set("slot:weapon-visual-pair",{
      key:"slot:weapon-visual-pair",
      label:"Weapon",
      pairable:true,
      items:[...styleHands,realTwoHand]
    });
  }

  const groups=[];

  for(const entry of map.values()){
    const xs=entry.items.filter(Boolean);
    if(!xs.length) continue;

    const styles=xs.filter(isStyle).sort((a,b)=>styleScore(b)-styleScore(a));
    const reals=xs.filter(x=>!isStyle(x)).sort((a,b)=>realScore(b)-realScore(a));

    // Multiple identical slots (most commonly rings): pair by occurrence.
    if(entry.multi || Math.max(styles.length,reals.length)>1){
      const maxSlots=entry.max || Math.max(styles.length,reals.length);
      const useStyles=entry.max ? styles.slice(0,maxSlots) : styles;
      const useReals=entry.max ? reals.slice(0,maxSlots) : reals;
      const n=Math.min(maxSlots,Math.max(useStyles.length,useReals.length));
      for(let i=0;i<n;i++){
        groups.push({
          slot:n>1 ? `${entry.label} ${i+1}` : entry.label,
          pairable:entry.pairable,
          style:useStyles[i]||null,
          real:useReals[i]||null
        });
      }
      continue;
    }

    groups.push({
      slot:entry.label,
      pairable:entry.pairable,
      style:styles[0]||null,
      real:reals[0]||null
    });
  }

  return groups;
}

function extractActualArtifactImage(html){
  const source=String(html||"");
  const candidates=[];

  function add(raw,score,index=0){
    raw=decodeEntities(String(raw||"")).replace(/&amp;/g,"&").trim().replace(/^['"]|['"]$/g,"");
    if(!raw || /^data:/i.test(raw))return;
    let url=raw;
    try{url=new URL(raw,WOD).toString();}catch{}
    const low=url.toLowerCase();

    if(/tbl-shp|corner|spacer|\/d\.gif|m_game|logo|arrow|button|menu|rating|online|forum|avatar|clan/.test(low))score-=500;
    if(/\/images\/data\/artifacts?\//.test(low))score+=220;
    if(/\/images\/artifacts?\//.test(low))score+=200;
    if(/\/images\/data\/items?\//.test(low))score+=180;
    if(/\/images\/items?\//.test(low))score+=160;
    if(/artifact|item/.test(low))score+=45;
    if(/\.(?:png|gif|jpe?g|webp)(?:\?|$)/i.test(low))score+=20;
    candidates.push({url,score,index});
  }

  let m;
  const imgRe=/<img\b[^>]*>/gi;
  while((m=imgRe.exec(source))){
    const tag=m[0];
    for(const attr of ["src","data-src","data-original","data-lazy-src"]){
      const a=tag.match(new RegExp("\\b"+attr+"=[\"']([^\"']+)[\"']","i"));
      if(a)add(a[1],40,m.index);
    }
    const ss=tag.match(/\bsrcset=["']([^"']+)["']/i);
    if(ss)for(const part of ss[1].split(","))add(part.trim().split(/\s+/)[0],35,m.index);
  }
  const css=/url\(\s*(['"]?)([^)'"]+)\1\s*\)/gi;
  while((m=css.exec(source)))add(m[2],75,m.index);
  const direct=/["']([^"']+\.(?:png|gif|jpe?g|webp)(?:\?[^"']*)?)["']/gi;
  while((m=direct.exec(source)))add(m[1],15,m.index);

  candidates.sort((a,b)=>b.score-a.score || a.index-b.index);
  return candidates.find(x=>x.score>0)?.url||null;
}

const actualImageCache=new Map();

async function resolveActualArtifactImage(item){
  const id=String(item?.id||item?.artifact_id||"").replace(/\D/g,"");
  if(!id)return null;
  if(actualImageCache.has(id))return actualImageCache.get(id);

  let image=null;
  try{
    const r=await fetch(`${WOD}/artifact_info.php?artifact_id=${id}`,{
      headers:{
        "user-agent":"Mozilla/5.0 (compatible; WOD-GearMate/2.2.0)",
        "accept":"text/html,application/xhtml+xml"
      },
      redirect:"follow"
    });
    if(r.ok)image=extractActualArtifactImage(await r.text());
  }catch{}
  actualImageCache.set(id,image);
  return image;
}

async function enrichActualArmorImages(data){
  await Promise.all(data.groups.map(async g=>{
    if(g.real)g.real._armorImage=await resolveActualArtifactImage(g.real);
  }));
  return data;
}

function publicItem(x){
  if(!x)return null;
  return {...x,_classification:isStyle(x)?"style":"real",_slot:slotInfo(x).label};
}


function validateProfileUrl(input){
  let u;
  try { u = new URL(String(input || "").trim()); }
  catch { throw new Error("Invalid profile URL."); }

  if(u.protocol !== "https:") throw new Error("Profile URL must use https://");
  if(!["warofdragons.com","www.warofdragons.com"].includes(u.hostname.toLowerCase()))
    throw new Error("Only warofdragons.com profile links are allowed.");
  if(u.pathname !== "/user_info.php")
    throw new Error("The link must point to /user_info.php.");
  if(!u.searchParams.get("nick"))
    throw new Error("The profile link must contain ?nick=...");

  return u.toString();
}

async function fetchProfileUrl(profileUrl){
  const target = validateProfileUrl(profileUrl);
  const r = await fetch(target, {
    headers: {
      "user-agent":"Mozilla/5.0 (compatible; WOD-Discord-Bot/1.0)",
      "accept":"text/html,application/xhtml+xml"
    },
    redirect:"follow"
  });
  if(!r.ok) throw new Error(`warofdragons.com returned HTTP ${r.status}`);
  return {target, html: await r.text()};
}

function buildProfileData(profileUrl, html){
  const parsed = parseArtAlt(html);
  const eq = parsed.items.filter(equipped);
  const groups = groupEquipment(eq);

  let nick = "Unknown";
  try { nick = new URL(profileUrl).searchParams.get("nick") || nick; } catch {}

  return {
    nick,
    source: profileUrl,
    assignmentsFound: parsed.assignmentsFound,
    parseErrors: parsed.parseErrors.length,
    equipped: eq.map(publicItem),
    groups: groups.map(g => ({
      slot: g.slot,
      pairable: g.pairable,
      style: publicItem(g.style),
      real: publicItem(g.real)
    })),
    styleCount: eq.filter(isStyle).length,
    realCount: eq.filter(x => !isStyle(x)).length,
    enhancementCounts: {
      runes: eq.filter(x => x.enchant).length,
      bezels: eq.filter(x => x.enchant3).length,
      plates: eq.filter(x =>
        x.enchant5 &&
        /plate|пластина/i.test(
          String(x.enchant5?.description || "") + " " +
          String(x.enchant5?.title || "")
        )
      ).length,
      symbols: eq.reduce((n,x) =>
        n + (Array.isArray(x.symbols) ? x.symbols.length : 0), 0)
    }
  };
}

export {
  validateProfileUrl,
  fetchProfileUrl,
  buildProfileData,
  parseArtAlt,
  equipped,
  isStyle,
  slotInfo,
  groupEquipment,
  publicItem,
  enrichActualArmorImages
};
