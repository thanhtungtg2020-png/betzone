const DEFAULT_BALANCE = 10000;
let balance = Number(localStorage.getItem("bz_balance") || DEFAULT_BALANCE);
let history = JSON.parse(localStorage.getItem("bz_history") || "[]");
let selected = null;
let diceChoice = null;
let coinChoice = null;
let soundOn = localStorage.getItem("bz_sound") !== "off";
let audioCtx = null;
let liveMatches = [];
let liveFilter = "all";
let liveRefreshTimer = null;
let updateCount = Number(localStorage.getItem("bz_updates") || 0);
let rollingDice = false;
let flippingCoin = false;
let drawingCard = false;

// ===== Virtual economy: inventory / items / skins / virtual cashout =====
const WITHDRAW_LIMIT = 80000;
const WITHDRAW_WINDOW = 120000; // 2 minutes
const ITEM_DEFS = {
  predictor: {name:"Máy dự đoán bài", icon:"🔮", price:1200, desc:"Khi đang ở Xì Dách, xem trước lá bài kế tiếp bạn sẽ rút."},
  repair: {name:"Máy chữa lỗ", icon:"🛠️", price:2500, desc:"Kích hoạt 1 lần: hoàn lại đúng tiền cược nếu lượt kế tiếp bị thua."},
  beer: {name:"BIA", icon:"🍺", price:6500, desc:"Kích hoạt 1 lần: biến lượt game kế tiếp thành thắng trong demo."}
};
const SKIN_DEFS = {
  rem: {name:"Rem", price:0, icon:"💙", image:"rem.png", desc:"Skin trợ lý nửa thân • mặc định"},
  furina: {name:"Furina", price:45000, icon:"💧", image:"furina.png", desc:"Skin Furina • premium"},
  hoshino: {name:"Hoshino", price:38000, icon:"🌙", image:"hoshino.png", desc:"Skin Hoshino • ảnh local từ máy bạn", fanStyle:true},
  fern: {name:"Fern", price:42000, icon:"🪻", image:"fern.png", desc:"Skin Fern • ảnh local từ máy bạn", fanStyle:true},
  bibi: {name:"Bibi Neon", price:18000, icon:"🐰", image:"bibi.png", desc:"Skin trợ lý original • neon cute"},
  mira: {name:"Mira Neon", price:32000, icon:"✨", image:"mira.png", desc:"Trợ lý mới • ảnh local từ máy bạn"},
  betzone_80: {name:"BETZONE Sovereign", price:0, icon:"👑", image:"mup.jpg", desc:"SKIN ĐỘC QUYỀN • mở tại Level 80", exclusive:true, requiredLevel:80, unlock:()=>progressData.level>=80}
};
let inventory = JSON.parse(localStorage.getItem("bz_inventory") || '{"predictor":1,"repair":0,"beer":0}');
let ownedSkins = JSON.parse(localStorage.getItem("bz_skins") || '["rem"]');
let equippedSkin = localStorage.getItem("bz_equipped_skin") || "rem";
let guaranteedWin = localStorage.getItem("bz_beer_active") === "1";
let repairActive = localStorage.getItem("bz_repair_active") === "1";
let withdrawLog = JSON.parse(localStorage.getItem("bz_withdraw_log") || "[]");

// ===== Player profile =====
const DEFAULT_PROFILE = { username: "Player 01", email: "Demo account", avatar: "U" };
let profileData = (() => {
  try { return {...DEFAULT_PROFILE, ...(JSON.parse(localStorage.getItem("bz_profile") || "{}"))}; }
  catch (_) { return {...DEFAULT_PROFILE}; }
})();

// ===== BETZONE V5 PROGRESSION / XP / TITLES =====
const MAX_LEVEL = 99;
const LEVEL_UP_REWARD = 2000;
const DAILY_ITEM_LIMIT_BASE = 3;
const DAILY_ITEM_LIMIT_LV40 = 4;
const V5_EXCLUSIVE_SKIN_KEY = "betzone_80";
const DEFAULT_PROGRESS = {
  level: 1,
  xp: 0,
  wins: 0,
  losses: 0,
  draws: 0,
  totalGames: 0,
  winStreak: 0,
  lossStreak: 0,
  bestWinStreak: 0,
  bestLossStreak: 0,
  lifetimeWon: 0,
  lifetimeLost: 0
};
let progressData = (() => {
  try {
    const saved = JSON.parse(localStorage.getItem("bz_progress") || "{}");
    return {...DEFAULT_PROGRESS, ...saved};
  } catch (_) {
    return {...DEFAULT_PROGRESS};
  }
})();
let equippedTitle = localStorage.getItem("bz_equipped_title") || "newbie";
let earnedTitles = (() => {
  try {
    const saved = JSON.parse(localStorage.getItem("bz_earned_titles") || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch (_) { return []; }
})();
let dailyItemPurchases = (() => {
  try {
    const saved = JSON.parse(localStorage.getItem("bz_daily_item_purchases") || "{}");
    return saved && typeof saved === "object" ? saved : {};
  } catch (_) {
    return {};
  }
})();

const TITLE_DEFS = {
  newbie:      {name:"Người mới", tier:"basic", icon:"🌱", desc:"Danh hiệu mặc định của mọi người chơi.", unlock:()=>true},
  balance50:   {name:"Có 50,000 tiền", tier:"basic", icon:"🪙", desc:"Số dư đạt ít nhất 50,000 coin ảo.", unlock:()=>balance>=50000},
  balance100:  {name:"Có 100,000 tiền", tier:"basic", icon:"💰", desc:"Số dư đạt ít nhất 100,000 coin ảo.", unlock:()=>balance>=100000},
  level10:     {name:"Cấp 10", tier:"basic", icon:"🔰", desc:"Đạt level 10.", unlock:()=>progressData.level>=10},
  win3:       {name:"Thắng 3 trận liên tiếp", tier:"normal", icon:"🔥", desc:"Thắng 3 lượt liên tiếp.", unlock:()=>progressData.bestWinStreak>=3},
  lose5:      {name:"Thua 5 trận liên tiếp", tier:"normal", icon:"💀", desc:"Thua 5 lượt liên tiếp.", unlock:()=>progressData.bestLossStreak>=5},
  legend:     {name:"Huyền thoại", tier:"normal", icon:"👑", desc:"Thắng tổng cộng 25 lượt.", unlock:()=>progressData.wins>=25},
  level80:    {name:"Cấp 80", tier:"legend", icon:"⚡", desc:"Đạt level 80 và mở khóa skin độc quyền.", unlock:()=>progressData.level>=80},
  win10:      {name:"Siêu bá khí", tier:"legend", icon:"👹", desc:"Thắng 10 trận liên tiếp.", unlock:()=>progressData.bestWinStreak>=10},
  god:        {name:"Huyền Thần", tier:"legend", icon:"🌌", desc:"Thắng tổng cộng 50 lượt.", unlock:()=>progressData.wins>=50},
  god99:      {name:"God of Casino", tier:"special", icon:"☄️", desc:"Đạt level 99 — danh hiệu đặc biệt.", unlock:()=>progressData.level>=99}
};

function levelNeed(level){
  // Mỗi level đòi hỏi nhiều XP hơn level trước. Level 99 là level tối đa.
  const n=Math.max(1, Number(level)||1);
  return Math.floor(120 + n*80 + Math.pow(n, 1.55)*10);
}
function currentLevelPercent(){
  if(progressData.level>=MAX_LEVEL)return 100;
  return Math.max(0, Math.min(100, progressData.xp/levelNeed(progressData.level)*100));
}
function getDailyItemLimit(){
  return progressData.level>=40 ? DAILY_ITEM_LIMIT_LV40 : DAILY_ITEM_LIMIT_BASE;
}
function todayKey(){
  const d=new Date();
  const mm=String(d.getMonth()+1).padStart(2,"0"), dd=String(d.getDate()).padStart(2,"0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}
function ensureDailyPurchases(){
  const today=todayKey();
  if(!dailyItemPurchases[today]) dailyItemPurchases[today]={};
  // Chỉ giữ 8 ngày gần nhất để localStorage không phình vô hạn.
  const keys=Object.keys(dailyItemPurchases).sort().slice(-8);
  const keep={}; keys.forEach(k=>keep[k]=dailyItemPurchases[k]);
  dailyItemPurchases=keep;
  return dailyItemPurchases[today];
}
function dailyItemCount(key){
  return Number(ensureDailyPurchases()[key]||0);
}
function syncEarnedTitles(){
  for(const [key,t] of Object.entries(TITLE_DEFS)){
    if(t.unlock() && !earnedTitles.includes(key)) earnedTitles.push(key);
  }
  if(!earnedTitles.includes("newbie")) earnedTitles.push("newbie");
  localStorage.setItem("bz_earned_titles", JSON.stringify(earnedTitles));
  return earnedTitles;
}
function unlockedTitleKeys(){ return syncEarnedTitles(); }
function activeTitleKey(){
  syncEarnedTitles();
  if(!TITLE_DEFS[equippedTitle] || !earnedTitles.includes(equippedTitle)) return "newbie";
  return equippedTitle;
}
function activeTitle(){ return TITLE_DEFS[activeTitleKey()] || TITLE_DEFS.newbie; }
function saveProgressData(){
  localStorage.setItem("bz_progress", JSON.stringify(progressData));
  localStorage.setItem("bz_daily_item_purchases", JSON.stringify(dailyItemPurchases));
  syncEarnedTitles();
  localStorage.setItem("bz_earned_titles", JSON.stringify(earnedTitles));
  equippedTitle=activeTitleKey();
  localStorage.setItem("bz_equipped_title", equippedTitle);
}
function renderProgressUI(){
  const need=progressData.level>=MAX_LEVEL?0:levelNeed(progressData.level);
  if($("playerLevel")) $("playerLevel").textContent=`Lv.${progressData.level}`;
  if($("playerXP")) $("playerXP").textContent=progressData.level>=MAX_LEVEL?"MAX LEVEL":`${fmt(progressData.xp)} / ${fmt(need)} XP`;
  if($("playerXPBar")) $("playerXPBar").style.width=`${currentLevelPercent()}%`;
  if($("playerXPBarHome")) $("playerXPBarHome").style.width=`${currentLevelPercent()}%`;
  if($("titleBadge")) $("titleBadge").textContent=unlockedTitleKeys().length;
  if($("slotBalanceText")) $("slotBalanceText").textContent=`${fmt(balance)} 🪙`;
  if($("profileLevel")) $("profileLevel").textContent=`LV.${progressData.level}`;
  if($("profileTitle")) $("profileTitle").textContent=`${activeTitle().icon} ${activeTitle().name}`;
  if($("profileTopTitle")) $("profileTopTitle").textContent=activeTitle().name;
  if($("progressWins")) $("progressWins").textContent=progressData.wins;
  if($("progressLosses")) $("progressLosses").textContent=progressData.losses;
  if($("progressStreak")) $("progressStreak").textContent=`${progressData.winStreak} / ${progressData.bestWinStreak}`;
  if($("dailyItemLimitText")) $("dailyItemLimitText").textContent=`Mua tối đa ${getDailyItemLimit()} lần / món / ngày`;
}
function applyLevelRewards(oldLevel, newLevel){
  const events=[];
  for(let lv=oldLevel+1;lv<=newLevel;lv++){
    let reward=LEVEL_UP_REWARD;
    if(lv===10) reward=20000;
    if(lv===20) reward=30000;
    balance+=reward;
    events.push(`Level ${lv}: +${fmt(reward)} coin`);
    if(lv===40) events.push("Level 40: giới hạn mua vật phẩm tăng lên 4 lần/món/ngày");
    if(lv===80){
      if(!ownedSkins.includes(V5_EXCLUSIVE_SKIN_KEY)) ownedSkins.push(V5_EXCLUSIVE_SKIN_KEY);
      events.push("Level 80: mở khóa skin độc quyền BETZONE");
    }
    if(lv===99) events.push("Level 99: mở khóa title God of Casino");
  }
  return events;
}
function awardGameProgress(result, amount){
  const before=progressData.level;
  const safeAmount=Math.max(1, Number(amount)||1);
  let gain=75 + Math.min(175, Math.floor(safeAmount/150));
  if(result==="win") gain+=50;
  else if(result==="push") gain+=25;
  progressData.totalGames++;
  if(result==="win"){
    progressData.wins++;
    progressData.winStreak++;
    progressData.lossStreak=0;
    progressData.bestWinStreak=Math.max(progressData.bestWinStreak,progressData.winStreak);
    progressData.lifetimeWon+=safeAmount;
  }else if(result==="lose"){
    progressData.losses++;
    progressData.lossStreak++;
    progressData.winStreak=0;
    progressData.bestLossStreak=Math.max(progressData.bestLossStreak,progressData.lossStreak);
    progressData.lifetimeLost+=safeAmount;
  }else{
    progressData.draws++;
    progressData.winStreak=0;
    progressData.lossStreak=0;
  }
  if(progressData.level<MAX_LEVEL){
    progressData.xp+=gain;
    const rewards=[];
    while(progressData.level<MAX_LEVEL && progressData.xp>=levelNeed(progressData.level)){
      progressData.xp-=levelNeed(progressData.level);
      progressData.level++;
      rewards.push(...applyLevelRewards(progressData.level-1,progressData.level));
    }
    if(progressData.level>=MAX_LEVEL){progressData.xp=0;}
    if(progressData.level>before){
      toast("LEVEL UP!",`Lv.${before} → Lv.${progressData.level} • +${gain} XP` ,"success");
      rewards.forEach((msg,i)=>setTimeout(()=>toast("Phần thưởng cấp",msg,"success"),260+i*300));
    }
  }
  saveProgressData();
  renderProgressUI();
  renderTitles();
  return gain;
}

// ===== Assistant position (mouse drag) =====
let assistantPosition = (() => {
  try {
    const p = JSON.parse(localStorage.getItem("bz_assistant_position") || "null");
    return p && Number.isFinite(p.x) && Number.isFinite(p.y) ? p : null;
  } catch (_) { return null; }
})();

const $ = id => document.getElementById(id);
const esc = value => String(value ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;"}[c]));
function fmt(n){ return Math.floor(n).toLocaleString("vi-VN"); }
function save(){
  localStorage.setItem("bz_balance", balance);
  localStorage.setItem("bz_history", JSON.stringify(history));
  localStorage.setItem("bz_sound", soundOn ? "on" : "off");
  localStorage.setItem("bz_updates", updateCount);
  localStorage.setItem("bz_inventory", JSON.stringify(inventory));
  localStorage.setItem("bz_skins", JSON.stringify(ownedSkins));
  localStorage.setItem("bz_equipped_skin", equippedSkin);
  localStorage.setItem("bz_beer_active", guaranteedWin ? "1" : "0");
  localStorage.setItem("bz_repair_active", repairActive ? "1" : "0");
  localStorage.setItem("bz_withdraw_log", JSON.stringify(withdrawLog));
  localStorage.setItem("bz_profile", JSON.stringify(profileData));
  saveProgressData();
  if(assistantPosition) localStorage.setItem("bz_assistant_position", JSON.stringify(assistantPosition));
  updateUI();
  renderHistory();
}
function renderProfile(){
  const name = (profileData.username || DEFAULT_PROFILE.username).trim() || DEFAULT_PROFILE.username;
  const email = (profileData.email || DEFAULT_PROFILE.email).trim() || DEFAULT_PROFILE.email;
  const avatar = (profileData.avatar || name.slice(0,1) || "U").trim().slice(0,2).toUpperCase();
  profileData.username = name; profileData.email = email; profileData.avatar = avatar;
  ["profileName","profilePreviewName"].forEach(id => { if($(id)) $(id).textContent = name; });
  if($("profileEmail")) $("profileEmail").textContent = email;
  ["profileAvatar","profilePreviewAvatar","profileOpenTop"].forEach(id => { if($(id)) $(id).textContent = avatar; });
  if($("profileTitle")) $("profileTitle").textContent = `${activeTitle().icon} ${activeTitle().name}`;
  if($("profileTopTitle")) $("profileTopTitle").textContent = activeTitle().name;
  if($("profileLevel")) $("profileLevel").textContent = `LV.${progressData.level}`;
  if($("profileUsername")) $("profileUsername").value = name;
  if($("profileEmailInput")) $("profileEmailInput").value = email === "Demo account" ? "" : email;
  if($("profileAvatarInput")) $("profileAvatarInput").value = avatar;
}
function updateUI(){
  renderProfile();
  ["balance","statBalance"].forEach(id => { if($(id)) $(id).textContent = fmt(balance); });
  if($("shopBalance")) $("shopBalance").textContent = `${fmt(balance)} 🪙`;
  if($("statBets")) $("statBets").textContent = history.length;
  if($("updateCount")) $("updateCount").textContent = updateCount;
  if($("inventoryBadge")) $("inventoryBadge").textContent = Object.values(inventory).reduce((a,b)=>a+Number(b||0),0);
  renderProgressUI();
}
updateUI();

function beep(type="click"){
  if(!soundOn) return;
  try{
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.connect(g); g.connect(audioCtx.destination);
    o.type = type === "win" ? "sine" : type === "lose" ? "triangle" : "square";
    o.frequency.value = type === "win" ? 720 : type === "lose" ? 150 : type === "tick" ? 520 : 430;
    g.gain.setValueAtTime(.0001, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(.045, audioCtx.currentTime + .01);
    g.gain.exponentialRampToValueAtTime(.0001, audioCtx.currentTime + .13);
    o.start(); o.stop(audioCtx.currentTime + .14);
  }catch(e){}
}
function toast(title, message, type="normal"){
  const wrap = $("toastStack");
  if(!wrap) return;
  const el = document.createElement("div");
  el.className = `toast ${type === "success" ? "success" : type === "error" ? "error" : ""}`;
  el.innerHTML = `<b>${esc(title)}</b><small>${esc(message)}</small>`;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 3600);
}

const titles = {
  home: "Trang chủ",
  football: "Bóng đá LIVE",
  dice: "Tài / Xỉu",
  games: "Mini Games",
  blackjack: "Xì Dách",
  tienlen: "Tiến Lên 4 người",
  shop: "Cửa hàng",
  history: "Lịch sử",
  pachinko: "Pachinko • Slot Machine",
  titlesPage: "Sảnh Danh Hiệu"
};
function showPage(page){
  document.querySelectorAll(".page").forEach(x => x.classList.remove("active"));
  const target = $(page); if(target) target.classList.add("active");
  document.querySelectorAll(".side-btn").forEach(x => x.classList.toggle("active", x.dataset.page === page));
  $("topTitle").innerHTML = `${titles[page] || page} <small>Virtual betting experience</small>`;
  beep();
  window.scrollTo({top:0, behavior:"smooth"});
  if(innerWidth <= 620 && $("sidebar")) $("sidebar").classList.remove("open");
  if(page === "football") renderLiveBoard();
  if(page === "tienlen") renderTienLen();
  if(page === "shop") renderStore();
  if(page === "history") renderHistory();
}
document.querySelectorAll(".side-btn").forEach(b => b.onclick = () => showPage(b.dataset.page));
$("mobileMenu").onclick = () => $("sidebar").classList.toggle("open");
$("addCoins").onclick = () => {
  balance += 1000; save(); beep("win");
  toast("+1,000 coin ảo", "Số dư đã được cộng trong phiên demo.", "success");
  $("addCoins").animate([{transform:"scale(1.2) rotate(90deg)"},{transform:"scale(1) rotate(0)"}],{duration:300});
};
// ----- Virtual cashout limiter: max 80,000 coin in any rolling 2-minute window -----
function cleanWithdrawLog(){
  const cutoff=Date.now()-WITHDRAW_WINDOW;
  withdrawLog=withdrawLog.filter(x=>Number(x.at)>cutoff);
}
function withdrawnInWindow(){cleanWithdrawLog();return withdrawLog.reduce((sum,x)=>sum+Number(x.amount||0),0);}
function withdrawRemaining(){return Math.max(0,WITHDRAW_LIMIT-withdrawnInWindow());}
function formatRemaining(ms){
  const sec=Math.max(0,Math.ceil(ms/1000));
  const m=Math.floor(sec/60), s=sec%60;
  return m?`${m}m ${String(s).padStart(2,"0")}s`:`${s}s`;
}
function updateWithdrawUI(){
  cleanWithdrawLog();
  const used=withdrawnInWindow(), left=WITHDRAW_LIMIT-used;
  if($("withdrawUsed")) $("withdrawUsed").textContent=`${fmt(used)} / ${fmt(WITHDRAW_LIMIT)}`;
  if($("withdrawBar")) $("withdrawBar").style.width=`${Math.min(100,used/WITHDRAW_LIMIT*100)}%`;
  const first=withdrawLog.sort((a,b)=>a.at-b.at)[0];
  const wait=first?Math.max(0,WITHDRAW_WINDOW-(Date.now()-first.at)):0;
  if($("withdrawTimer")) $("withdrawTimer").textContent=left>0?`Còn ${fmt(left)} 🪙`:`Mở lại sau ${formatRemaining(wait)}`;
}
if($("withdrawBtn")) $("withdrawBtn").onclick=()=>{
  updateWithdrawUI(); $("withdrawModal").classList.remove("hidden"); beep();
};
if($("confirmWithdraw")) $("confirmWithdraw").onclick=()=>{
  const amount=Math.floor(Number($("withdrawAmount").value));
  const remaining=withdrawRemaining();
  if(!amount||amount<1)return toast("Số coin không hợp lệ","Nhập số lớn hơn 0.","error");
  if(amount>balance)return toast("Không đủ coin","Đây vẫn là coin ảo trong demo.","error");
  if(amount>remaining)return toast("Vượt hạn mức",`Bạn chỉ còn ${fmt(remaining)} coin trong cửa sổ 2 phút này.`,"error");
  balance-=amount;
  withdrawLog.push({amount,at:Date.now()});
  history.unshift({type:"⇩ Rút coin ảo",title:"Cashout demo",choice:"Virtual",amount,odds:1,result:"Đã xử lý",time:new Date().toLocaleString("vi-VN")});
  $("withdrawAmount").value=""; save(); updateWithdrawUI();
  toast("Rút coin ảo thành công",`- ${fmt(amount)} coin • Hạn mức còn ${fmt(withdrawRemaining())}`,"success");
};
// Close any utility modal by data-close or clicking the backdrop.
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>$(b.dataset.close)?.classList.add("hidden"));
document.querySelectorAll(".modal-backdrop").forEach(m=>m.addEventListener("click",e=>{if(e.target===m)m.classList.add("hidden")}));
setInterval(updateWithdrawUI,1000);

$("soundBtn").onclick = () => {
  soundOn = !soundOn; save();
  $("soundBtn").innerHTML = soundOn ? "🔊 Âm thanh <b>ON</b>" : "🔇 Âm thanh <b>OFF</b>";
  if(soundOn) beep();
};
$("closeSlip").onclick = () => { selected = null; $("betslip").classList.add("hidden"); };

function setConnection(mode, message){
  const box = $("connectionStatus");
  const note = $("dataNote");
  const dot = box?.querySelector("span");
  if(box){ box.querySelector("b").textContent = mode === "live" ? "LIVE DATA" : mode === "loading" ? "SYNCING" : "OFFLINE"; box.querySelector("small").textContent = message; }
  if(note) note.textContent = message;
  if(dot) dot.style.background = mode === "error" ? "#ff6474" : mode === "loading" ? "#ffd166" : "#19e878";
}

// Public scoreboard endpoints. They are used only to display live sports data in the demo.
const LEAGUES = [
  {key:"eng.1", name:"Premier League", icon:"🏴", endpoint:"https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard"},
  {key:"esp.1", name:"La Liga", icon:"🇪🇸", endpoint:"https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/scoreboard"},
  {key:"ita.1", name:"Serie A", icon:"🇮🇹", endpoint:"https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1/scoreboard"},
  {key:"ger.1", name:"Bundesliga", icon:"🇩🇪", endpoint:"https://site.api.espn.com/apis/site/v2/sports/soccer/ger.1/scoreboard"}
];
const FALLBACK_MATCHES = [
  {id:"demo-1", leagueKey:"eng.1", league:"Premier League", leagueIcon:"🏴", home:"Manchester City", away:"Liverpool", homeScore:null, awayScore:null, state:"pre", status:"Lịch thi đấu demo", time:"Hôm nay • 19:30"},
  {id:"demo-2", leagueKey:"esp.1", league:"La Liga", leagueIcon:"🇪🇸", home:"Barcelona", away:"Real Madrid", homeScore:null, awayScore:null, state:"pre", status:"Lịch thi đấu demo", time:"Hôm nay • 21:00"},
  {id:"demo-3", leagueKey:"ita.1", league:"Serie A", leagueIcon:"🇮🇹", home:"Inter", away:"AC Milan", homeScore:null, awayScore:null, state:"pre", status:"Lịch thi đấu demo", time:"Ngày mai • 20:00"},
  {id:"demo-4", leagueKey:"ger.1", league:"Bundesliga", leagueIcon:"🇩🇪", home:"Bayern Munich", away:"Borussia Dortmund", homeScore:null, awayScore:null, state:"pre", status:"Lịch thi đấu demo", time:"Ngày mai • 22:00"}
];
function getTeam(comp, idx){
  const t = comp?.competitors?.[idx];
  return {name:t?.team?.displayName || t?.team?.shortDisplayName || `Team ${idx+1}`, score:t?.score == null ? null : Number(t.score)};
}
function parseEvent(event, league){
  const comp = event?.competitions?.[0];
  const competitors = comp?.competitors || [];
  const home = competitors.find(x => x.homeAway === "home") || competitors[0];
  const away = competitors.find(x => x.homeAway === "away") || competitors[1];
  const st = event?.status?.type || {};
  const state = st.state === "in" ? "live" : st.completed ? "post" : "pre";
  const details = st.shortDetail || st.detail || st.description || "";
  const date = event?.date ? new Date(event.date) : null;
  const time = date && state === "pre" ? date.toLocaleString("vi-VN", {day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}) : "";
  return {
    id:event?.id || `${league.key}-${Math.random()}`,
    leagueKey:league.key, league:league.name, leagueIcon:league.icon,
    home:home?.team?.displayName || "Home", away:away?.team?.displayName || "Away",
    homeScore:home?.score == null ? null : Number(home.score), awayScore:away?.score == null ? null : Number(away.score),
    state, status:details, time:time || (state === "live" ? "Đang diễn ra" : state === "post" ? "Đã kết thúc" : "Sắp bắt đầu"),
    broadcast:comp?.broadcasts?.[0]?.names?.[0] || ""
  };
}
function dateKey(offsetDays=0){
  const d = new Date();
  d.setDate(d.getDate()+offsetDays);
  return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`;
}
async function fetchLeague(league){
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6500);
  try{
    const url = `${league.endpoint}?dates=${dateKey()}&limit=200`;
    const res = await fetch(url, {signal:controller.signal, cache:"no-store"});
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return (data.events || []).map(e => parseEvent(e, league));
  } finally { clearTimeout(timer); }
}
async function loadLiveData(initial=false){
  setConnection("loading", "Đang đồng bộ tỷ số…");
  try{
    const settled = await Promise.allSettled(LEAGUES.map(fetchLeague));
    const all = settled.filter(x => x.status === "fulfilled").flatMap(x => x.value);
    liveMatches = all.length ? all : FALLBACK_MATCHES;
    if(all.length){
      updateCount += 1;
      const now = new Date().toLocaleTimeString("vi-VN", {hour:"2-digit",minute:"2-digit",second:"2-digit"});
      localStorage.setItem("bz_updates", updateCount);
      setConnection("live", `Đã cập nhật ${now}`);
      if($("lastUpdatedText")) $("lastUpdatedText").textContent = `Live data • ${now}`;
    } else throw new Error("No events");
  }catch(error){
    liveMatches = FALLBACK_MATCHES;
    setConnection("error", "Không lấy được live feed • đang dùng dữ liệu demo");
    if($("lastUpdatedText")) $("lastUpdatedText").textContent = "Fallback demo • kiểm tra kết nối";
  }
  updateFootballCount();
  renderTicker();
  renderHomeFeatured();
  renderLiveBoard();
}
function scheduleLiveRefresh(){
  clearInterval(liveRefreshTimer);
  liveRefreshTimer = setInterval(() => loadLiveData(false), 30000);
}
$("refreshLive").onclick = () => { beep(); loadLiveData(false); toast("Đang làm mới", "Kiểm tra dữ liệu bóng đá mới nhất."); };
$("footballRefresh").onclick = () => { beep(); loadLiveData(false); };

document.querySelectorAll(".league-filter").forEach(btn => btn.onclick = () => {
  document.querySelectorAll(".league-filter").forEach(x => x.classList.remove("active"));
  btn.classList.add("active");
  liveFilter = btn.dataset.league;
  renderLiveBoard(); beep();
});
function filteredMatches(){ return liveFilter === "all" ? liveMatches : liveMatches.filter(x => x.leagueKey === liveFilter); }
function updateFootballCount(){
  const count = liveMatches.filter(x => x.state === "live").length;
  if($("footballCount")) $("footballCount").textContent = count;
}
function renderTicker(){
  const track = $("tickerTrack"); if(!track) return;
  const items = liveMatches.filter(x => x.state === "live").slice(0,8);
  if(!items.length){ track.innerHTML = `<span>Chưa có trận đang diễn ra • dữ liệu sẽ tự cập nhật sau 30 giây</span>`; return; }
  track.innerHTML = items.map(m => `<span>🔴 ${esc(m.home)} <b>${m.homeScore ?? 0}-${m.awayScore ?? 0}</b> ${esc(m.away)}</span>`).join("");
}
function renderHomeFeatured(){
  const box = $("homeFeatured"); if(!box) return;
  const featured = liveMatches.filter(x => x.state !== "post").slice(0,2);
  if(!featured.length){ box.innerHTML = `<div class="feature-card"><b>Chưa có trận nổi bật.</b></div>`; return; }
  box.innerHTML = featured.map((m,i) => {
    const status = m.state === "live" ? `<span class="live-tag">● LIVE</span>` : `<span class="open">● OPEN</span>`;
    const locked = m.state !== "pre";
    return `<div class="feature-card ${i===1 ? "dice-card" : "football-card"}">
      <div class="card-top"><span class="league">${m.leagueIcon} ${esc(m.league)}</span>${status}</div>
      <small>${esc(m.time || m.status)}</small>
      <div class="teams"><div><div class="team-logo blue">${esc(m.home.slice(0,1))}</div><b>${esc(m.home)}</b></div><strong>${m.state === "pre" ? "VS" : `${m.homeScore ?? 0} - ${m.awayScore ?? 0}`}</strong><div><div class="team-logo red">${esc(m.away.slice(0,1))}</div><b>${esc(m.away)}</b></div></div>
      <div class="mini-odds">${oddsButtons(m, locked, true)}</div>
    </div>`;
  }).join("");
}
function oddsFor(m){
  const seed = [...m.home, ...m.away].reduce((a,c)=>a+c.charCodeAt(0),0);
  const a = 1.55 + (seed % 35) / 100;
  const b = 3.05 + (seed % 45) / 100;
  const c = 1.65 + ((seed * 3) % 45) / 100;
  return [Number(a.toFixed(2)),Number(b.toFixed(2)),Number(c.toFixed(2))];
}
function oddsButtons(m, locked=false, mini=false){
  const [a,b,c] = oddsFor(m);
  return [
    [`${esc(m.home)}`,a,m.home],
    ["Hòa",b,"Hòa"],
    [`${esc(m.away)}`,c,m.away]
  ].map(([label,odds,choice]) => `<button ${locked?"disabled":""} onclick="openBetFromUI('${encodeURIComponent(m.id)}','${encodeURIComponent(m.home+" vs "+m.away)}','${encodeURIComponent(choice)}',${odds})">${label}<b>${odds.toFixed(2)}</b></button>`).join("");
}
function renderLiveBoard(){
  const box = $("liveBoard"); if(!box) return;
  const items = filteredMatches();
  if(!items.length){ box.innerHTML = `<div class="empty-state">Không có dữ liệu cho giải đang chọn.</div>`; return; }
  box.innerHTML = items.slice(0,28).map(m => {
    const live = m.state === "live", post = m.state === "post";
    const locked = live || post;
    const statePill = live ? `<span class="live-pill-small">● LIVE</span>` : `<span class="upcoming-pill">${post ? "FT" : "OPEN"}</span>`;
    const score = (m.homeScore != null || m.awayScore != null) ? `${m.homeScore ?? 0} - ${m.awayScore ?? 0}` : "VS";
    return `<article class="live-match ${live?"is-live":""}">
      <div class="match-main">
        <div class="match-meta"><span>${m.leagueIcon} ${esc(m.league)}</span>${statePill}<span>${esc(m.time || m.status)}</span></div>
        <div class="match-title">${esc(m.home)} <i>vs</i> ${esc(m.away)}</div>
        <div class="scoreline"><div class="score-team"><b>${esc(m.home)}</b><small>Home</small></div><div class="score">${score}</div><div class="score-team"><b>${esc(m.away)}</b><small>Away</small></div></div>
        <div class="match-status">${live?'<span class="live-orb"></span>':''}${esc(m.status || (post ? "Trận đã kết thúc" : "Sẵn sàng"))}${m.broadcast?` • ${esc(m.broadcast)}`:""}</div>
      </div>
      <div><div class="match-actions">${oddsButtons(m, locked)}</div><div class="locked-note">${live ? "Đang diễn ra • lựa chọn mới bị khóa" : post ? "Đã kết thúc" : "Tỷ lệ chỉ là mô phỏng cho coin ảo"}</div></div>
    </article>`;
  }).join("");
}
function openBetFromUI(id, match, choice, odds){
  selected = {id:decodeURIComponent(id), match:decodeURIComponent(match), choice:decodeURIComponent(choice), odds:Number(odds)};
  $("selectedText").textContent = `${selected.match} — ${selected.choice}`;
  $("selectedOdds").textContent = selected.odds.toFixed(2);
  $("betslip").classList.remove("hidden");
  beep();
  document.querySelector("#betAmount")?.focus();
}
window.openBetFromUI = openBetFromUI;

$("placeBet").onclick = () => {
  if(!selected) return;
  const amount = Number($("betAmount").value);
  if(!amount || amount <= 0) return toast("Coin không hợp lệ", "Nhập số coin lớn hơn 0.", "error");
  if(amount > balance) return toast("Không đủ coin", "Hãy nhận thêm coin ảo bằng nút +.", "error");
  const fresh = liveMatches.find(x => x.id === selected.id);
  if(fresh && fresh.state !== "pre"){
    return toast("Lựa chọn đã khóa", "Trận đã bắt đầu hoặc kết thúc theo live feed.", "error");
  }
  balance -= amount;
  history.unshift({type:"⚽ Bóng đá",title:selected.match,choice:selected.choice,amount,odds:selected.odds,result:"Đang chờ",time:new Date().toLocaleString("vi-VN")});
  $("betAmount").value = ""; $("betslip").classList.add("hidden"); selected = null;
  save(); beep();
  toast("Đã lưu lựa chọn demo", `Trừ ${fmt(amount)} coin ảo.`, "success");
  showPage("history");
};

// Dice / Tài Xỉu — waiting sequence with visible stages + countdown
const diceFaceMap = {1:"⚀",2:"⚁",3:"⚂",4:"⚃",5:"⚄",6:"⚅"};
function setDiceStage(index){
  const steps = document.querySelectorAll("#diceSteps span");
  steps.forEach((x,i)=>x.classList.toggle("active", i===index));
}
document.querySelectorAll(".dice-choice button").forEach(b => b.onclick = () => {
  if(rollingDice) return;
  document.querySelectorAll(".dice-choice button").forEach(x => x.classList.remove("selected"));
  b.classList.add("selected"); diceChoice = b.dataset.choice; beep();
  $("diceStatus").textContent = `Đã chọn ${diceChoice} • nhập coin rồi bắt đầu`;
  $("diceStatus").className = "dice-status";
});
function wait(ms){ return new Promise(resolve => setTimeout(resolve,ms)); }

// Active item effects are deliberately local and virtual.
function resolvePerks(baseWin, baseDraw=false){
  let win=baseWin, draw=baseDraw, beerUsed=false;
  if(guaranteedWin){
    guaranteedWin=false;
    beerUsed=true;
    win=true; draw=false;
  }
  return {win,draw,beerUsed};
}
function refundLoss(amount){
  if(!repairActive) return false;
  repairActive=false;
  balance+=amount;
  return true;
}

async function diceCountdown(){
  const el=$("diceCountdown");
  for(const n of [3,2,1]){
    el.textContent=n;
    el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop");
    beep(n===1?"win":"tick");
    await wait(650);
  }
  el.textContent="GO!";
  beep("win");
  await wait(520);
  el.textContent="";
}
async function runDice(){
  if(rollingDice) return;
  const amount = Number($("diceAmount").value);
  if(!diceChoice) return toast("Chưa chọn cửa", "Chọn Tài hoặc Xỉu trước.", "error");
  if(!amount || amount <= 0) return toast("Coin không hợp lệ", "Nhập số coin lớn hơn 0.", "error");
  if(amount > balance) return toast("Không đủ coin", "Hãy nhận thêm coin ảo bằng nút +.", "error");

  rollingDice = true;
  const btn=$("rollDice"), machine=$("diceMachine"), bar=$("diceProgressBar");
  btn.disabled=true; machine.classList.add("rolling"); machine.classList.remove("reveal");
  $("diceMessage").textContent=""; $("diceStatus").className="dice-status working";
  $("diceResult").textContent="⚀ • ⚀ • ⚀";
  $("diceText").textContent="Đang kết nối bàn xúc xắc…";
  setDiceStage(0); bar.style.width="8%"; beep("tick"); await wait(500);

  setDiceStage(1); $("diceStatus").textContent="Bước 2/5 • Lắc xúc xắc…"; $("diceText").textContent="Âm thanh lắc xúc xắc đang phát…";
  bar.style.width="28%"; beep("tick"); await wait(900);

  setDiceStage(2); $("diceStatus").textContent="Bước 3/5 • Kiểm tra kết quả…"; $("diceText").textContent="Đang khóa kết quả…";
  bar.style.width="50%"; beep("tick"); await wait(800);

  setDiceStage(3); $("diceStatus").textContent="Bước 4/5 • Countdown công bố…"; $("diceText").textContent="Chuẩn bị mở kết quả";
  bar.style.width="72%"; await diceCountdown();

  const a=1+Math.floor(Math.random()*6), b=1+Math.floor(Math.random()*6), c=1+Math.floor(Math.random()*6);
  const total=a+b+c, result=total>=11?"Tài":"Xỉu";
  const naturalWin=result===diceChoice;
  const perk=resolvePerks(naturalWin,false);
  const win=perk.win;
  const payout=win?Math.floor(amount*2.0):0;
  [$("die1"),$("die2"),$("die3")].forEach((el,i)=>{el.textContent=diceFaceMap[[a,b,c][i]]; el.classList.add("landed"); setTimeout(()=>el.classList.remove("landed"),450)});
  balance-=amount; if(win) balance+=payout;
  const repaired=!win?refundLoss(amount):false;
  bar.style.width="100%"; setDiceStage(4);
  machine.classList.remove("rolling"); machine.classList.add("reveal");
  $("diceResult").textContent=`${a} • ${b} • ${c}`;
  $("diceText").textContent=`Tổng ${total} → ${result}${perk.beerUsed?" • 🍺 BIA kích hoạt":""}`;
  $("diceStatus").textContent=win?(perk.beerUsed?"BIA đã bẻ hướng lượt chơi → thắng":"Kết quả khớp lựa chọn"):(repaired?"Máy chữa lỗ đã hoàn lại cược":"Kết quả không khớp lựa chọn");
  $("diceStatus").className=`dice-status ${win?"success":repaired?"success":"fail"}`;
  $("diceMessage").textContent=win?`🎉 Thắng! +${fmt(payout-amount)} coin${perk.beerUsed?" • BIA":""}`:repaired?`🛠️ Thua nhưng đã hoàn ${fmt(amount)} coin`:`😵 Thua ${fmt(amount)} coin`;
  $("diceMessage").className=win||repaired?"win":"lose";
  const diceOutcome=win?"win":"lose";
  awardGameProgress(diceOutcome,amount);
  history.unshift({type:"🎲 Tài/Xỉu",title:"3 xúc xắc",choice:diceChoice,amount,odds:2.0,result:win?"Thắng":repaired?"Thua • hoàn cược":"Thua",time:new Date().toLocaleString("vi-VN")});
  $("diceAmount").value=""; save(); beep(win?"win":"lose");
  await wait(950);
  bar.style.width="0%"; machine.classList.remove("reveal"); btn.disabled=false; rollingDice=false; setDiceStage(0);
}
$("rollDice").onclick=runDice;

// Coin Flip — real two-sided coin so NGỬA / SẤP are visually unambiguous.
$("coinPanel").querySelectorAll("[data-coin]").forEach(btn=>btn.onclick=()=>{
  if(flippingCoin) return;
  $("coinPanel").querySelectorAll("[data-coin]").forEach(x=>x.classList.remove("selected"));
  btn.classList.add("selected"); coinChoice=btn.dataset.coin; beep();
  $("coinResult").textContent=`Đã chọn: ${coinChoice}`;
});
async function runCoinFlip(){
  if(flippingCoin) return;
  const amount=Number($("coinAmount").value);
  if(!coinChoice) return toast("Chưa chọn mặt", "Chọn Ngửa hoặc Sấp.", "error");
  if(!amount||amount<=0) return toast("Coin không hợp lệ", "Nhập số coin lớn hơn 0.", "error");
  if(amount>balance) return toast("Không đủ coin", "Bạn không có đủ coin ảo.", "error");
  flippingCoin=true; $("flipCoin").disabled=true;
  const coin=$("bigCoin"), result=$("coinResult");
  coin.classList.remove("flip-heads","flip-tails"); void coin.offsetWidth; coin.classList.add("flipping");
  result.textContent="Đang tung đồng xu…"; beep("tick"); await wait(1250);
  const out=Math.random()<.5?"Ngửa":"Sấp";
  const perk=resolvePerks(out===coinChoice,false);
  const win=perk.win, payout=win?Math.floor(amount*2.0):0;
  coin.classList.remove("flipping"); coin.classList.add(out==="Ngửa"?"flip-heads":"flip-tails");
  result.innerHTML=`Kết quả: <strong>${out}</strong>`;
  balance-=amount; if(win) balance+=payout;
  const repaired=!win?refundLoss(amount):false;
  const coinOutcome=win?"win":"lose";
  awardGameProgress(coinOutcome,amount);
  history.unshift({type:"🪙 Coin Flip",title:"Lật đồng xu",choice:coinChoice,amount,odds:2.0,result:win?"Thắng":repaired?"Thua • hoàn cược":"Thua",time:new Date().toLocaleString("vi-VN")});
  $("coinAmount").value=""; save(); beep(win?"win":"lose");
  toast(win?"Bạn thắng":repaired?"Máy chữa lỗ kích hoạt":"Bạn thua",win?`+${fmt(payout-amount)} coin ảo${perk.beerUsed?" • BIA": ""}`:repaired?`Hoàn ${fmt(amount)} coin ảo`:`-${fmt(amount)} coin ảo`,win||repaired?"success":"error");
  await wait(450); $("flipCoin").disabled=false; flippingCoin=false;
}
$("flipCoin").onclick=runCoinFlip;

// High Card
const SUITS=["♠","♥","♦","♣"];
function cardText(value,suit){return `${value}${suit}`;}
function cardRank(){return 2+Math.floor(Math.random()*13);}
function rankName(v){return v===14?"A":v===13?"K":v===12?"Q":v===11?"J":String(v);}
async function runHighCard(){
  if(drawingCard)return;
  const amount=Number($("cardAmount").value);
  if(!amount||amount<=0)return toast("Coin không hợp lệ","Nhập số coin lớn hơn 0.","error");
  if(amount>balance)return toast("Không đủ coin","Bạn không có đủ coin ảo.","error");
  drawingCard=true; $("drawCard").disabled=true; $("cardResult").textContent="Đang rút bài…";
  const u=$("userCard"),c=$("cpuCard");[u,c].forEach(x=>{x.classList.remove("draw","red-card");void x.offsetWidth;x.classList.add("draw");x.textContent="?";});
  beep("tick"); await wait(650);
  const ur=cardRank(),cr=cardRank(),us=SUITS[Math.floor(Math.random()*4)],cs=SUITS[Math.floor(Math.random()*4)];
  u.textContent=cardText(rankName(ur),us);c.textContent=cardText(rankName(cr),cs);
  if(["♥","♦"].includes(us))u.classList.add("red-card");if(["♥","♦"].includes(cs))c.classList.add("red-card");
  const naturalWin=ur>cr, naturalDraw=ur===cr;
  const perk=resolvePerks(naturalWin,naturalDraw);
  const win=perk.win, draw=perk.draw, payout=win?Math.floor(amount*2.0):draw?amount:0;
  balance-=amount;if(payout)balance+=payout;
  const repaired=!win&&!draw?refundLoss(amount):false;
  $("cardResult").textContent=draw?"🤝 Hòa — hoàn lại coin":win?`🎉 Bạn thắng! +${fmt(payout-amount-0)} coin${perk.beerUsed?" • BIA":""}`:repaired?`🛠️ Thua nhưng hoàn ${fmt(amount)} coin`:`😵 Máy thắng — mất ${fmt(amount)} coin`;
  $("cardResult").className=`game-result ${draw||win||repaired?"win":"lose"}`;
  awardGameProgress(draw?"push":win?"win":"lose",amount);
  history.unshift({type:"🃏 High Card",title:"Rút bài",choice:"Bạn",amount,odds:2.0,result:draw?"Hòa":win?"Thắng":repaired?"Thua • hoàn cược":"Thua",time:new Date().toLocaleString("vi-VN")});
  $("cardAmount").value="";save();beep(win?"win":draw?"click":"lose");
  await wait(250);$("drawCard").disabled=false;drawingCard=false;
}
$("drawCard").onclick=runHighCard;

// ===== V5 PACHINKO / SLOT MACHINE =====
const SLOT_SYMBOLS=["🍒","🍋","🔔","⭐","💎","7️⃣","BZ"];
const SLOT_WEIGHTS=[24,20,18,15,10,8,5];
let slotSpinning=false;
function weightedSlotSymbol(){
  const total=SLOT_WEIGHTS.reduce((a,b)=>a+b,0); let r=Math.random()*total;
  for(let i=0;i<SLOT_SYMBOLS.length;i++){r-=SLOT_WEIGHTS[i];if(r<=0)return SLOT_SYMBOLS[i];}
  return SLOT_SYMBOLS[0];
}
function slotPayout(a,b,c){
  if(a===b&&b===c){
    return ({"🍒":5,"🍋":6,"🔔":8,"⭐":10,"💎":14,"7️⃣":20,"BZ":25}[a]||5);
  }
  if(a===b||b===c||a===c)return 2;
  return 0;
}
async function runPachinko(){
  if(slotSpinning)return;
  const amount=Math.floor(Number($("slotAmount")?.value));
  if(!amount||amount<=0)return toast("Coin không hợp lệ","Nhập số coin lớn hơn 0.","error");
  if(amount>balance)return toast("Không đủ coin","Bạn không có đủ coin ảo.","error");
  slotSpinning=true;
  $("slotSpin").disabled=true;
  $("slotMachine").classList.add("spinning");
  $("slotResult").textContent="PACHINKO ĐANG QUAY…";
  balance-=amount; save();
  const reels=[$("slot1"),$("slot2"),$("slot3")];
  const timers=[];
  reels.forEach((el,i)=>{
    let ticks=0;
    const timer=setInterval(()=>{el.textContent=SLOT_SYMBOLS[Math.floor(Math.random()*SLOT_SYMBOLS.length)];beep("tick");ticks++;if(ticks>=13+i*5){clearInterval(timer);}},70);
    timers.push(timer);
  });
  await wait(1150);
  timers.forEach(clearInterval);
  const result=[weightedSlotSymbol(),weightedSlotSymbol(),weightedSlotSymbol()];
  reels.forEach((el,i)=>{el.textContent=result[i];});
  const mult=slotPayout(...result);
  const win=mult>0;
  if(win)balance+=amount*mult;
  const outcome=win?"win":"lose";
  awardGameProgress(outcome,amount);
  history.unshift({type:"🎰 Pachinko",title:"BETZONE Slot Machine",choice:result.join(" • "),amount,odds:mult||0,result:win?`Thắng ×${mult}`:"Thua",time:new Date().toLocaleString("vi-VN")});
  $("slotResult").textContent=win?`🎉 JACKPOT! ${result.join(" • ")} • ×${mult}`:`${result.join(" • ")} • Chưa trúng combo`;
  $("slotResult").className=`slot-result ${win?"win":"lose"}`;
  $("slotWinText").textContent=win?`+${fmt(amount*mult-amount)} coin`:`-${fmt(amount)} coin`;
  $("slotAmount").value="";
  save(); beep(win?"win":"lose");
  toast(win?"Pachinko trúng thưởng":"Pachinko chưa trúng",win?`Combo ${result.join(" ")} • ×${mult}`:`-${fmt(amount)} coin ảo`,win?"success":"error");
  setTimeout(()=>{$("slotMachine").classList.remove("spinning");$("slotSpin").disabled=false;slotSpinning=false;},420);
}
if($("slotSpin"))$("slotSpin").onclick=runPachinko;

// Xì Dách / Blackjack — standard 52-card deck, virtual coins only.
let bjDeck=[], bjPlayer=[], bjDealer=[], bjRound=false, bjWager=0, bjDealerHidden=true;
const BJ_SUITS=["♠","♥","♦","♣"];
const BJ_RANKS=["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
function buildBJDeck(){
  const deck=[]; for(const suit of BJ_SUITS) for(const rank of BJ_RANKS) deck.push({rank,suit});
  for(let i=deck.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]];} return deck;
}
function bjValue(hand){
  let total=0, aces=0;
  for(const card of hand){if(card.rank==="A"){total+=11;aces++;}else total+=/[JQK]/.test(card.rank)?10:Number(card.rank);}
  while(total>21&&aces>0){total-=10;aces--;} return total;
}
function bjCardHTML(card,hidden=false){
  if(hidden)return `<div class="bj-card hidden-card"><span>?</span></div>`;
  const red=["♥","♦"].includes(card.suit)?" red-card":"";
  return `<div class="bj-card${red}"><b>${esc(card.rank)}</b><span>${card.suit}</span></div>`;
}
function renderBJ(hideDealer=true){
  $("playerHand").innerHTML=bjPlayer.map(c=>bjCardHTML(c)).join("");
  $("dealerHand").innerHTML=bjDealer.map((c,i)=>bjCardHTML(c,hideDealer&&i===0)).join("");
  $("bjPlayerScore").textContent=bjValue(bjPlayer);
  $("bjDealerScore").textContent=hideDealer&&bjDealer.length>0?"?":bjValue(bjDealer);
  $("bjWager").textContent=`${fmt(bjWager)} 🪙`;
}
function bjSetActions(deal,hit,stand){$("bjDeal").disabled=!deal;$("bjHit").disabled=!hit;$("bjStand").disabled=!stand;}
function bjSetMessage(msg,type=""){ $("bjMessage").textContent=msg; $("bjMessage").className=`bj-message ${type}`; }
function bjSettle(result,mult=0){
  const perk=resolvePerks(result==="win", result==="push");
  if(perk.beerUsed && result!=="win"){ result="win"; mult=2.0; }
  let payout=0;
  if(result==="win")payout=Math.floor(bjWager*mult);
  else if(result==="push")payout=bjWager;
  if(payout)balance+=payout;
  const repaired=result==="lose"?refundLoss(bjWager):false;
  const delta=payout-bjWager;
  const label=result==="win"?"Thắng":result==="push"?"Hòa":repaired?"Thua • hoàn cược":"Thua";
  awardGameProgress(result,bjWager);
  history.unshift({type:"🃏 Xì Dách",title:"Bàn blackjack",choice:"Player",amount:bjWager,odds:mult||1,result:label,time:new Date().toLocaleString("vi-VN")});
  save(); beep(result==="win"?"win":result==="lose"?"lose":"click");
  if(result==="win")toast("Xì Dách thắng",`+${fmt(delta)} coin ảo${perk.beerUsed?" • 🍺 BIA": ""}`,"success");
  else if(repaired)toast("Máy chữa lỗ",`Hoàn ${fmt(bjWager)} coin ảo` ,"success");
  else if(result==="lose")toast("Nhà cái thắng",`-${fmt(bjWager)} coin ảo`,"error");
  else toast("Hòa","Cược được hoàn lại.");
  bjRound=false; bjDealerHidden=false; bjWager=0; renderBJ(false); bjSetActions(true,false,false); $("bjAmount").value=""; $("bjPhase").textContent="KẾT THÚC";
}
function bjStart(){
  if(bjRound)return;
  const amount=Number($("bjAmount").value);
  if(!amount||amount<=0)return toast("Coin không hợp lệ","Nhập số coin lớn hơn 0.","error");
  if(amount>balance)return toast("Không đủ coin","Bạn không có đủ coin ảo.","error");
  balance-=amount; bjWager=amount; bjDeck=buildBJDeck(); bjPlayer=[bjDeck.pop(),bjDeck.pop()]; bjDealer=[bjDeck.pop(),bjDeck.pop()]; bjRound=true; bjDealerHidden=true;
  $("bjPhase").textContent="ĐANG CHƠI"; renderBJ(true); bjSetActions(false,true,true); bjSetMessage("Rút thêm để đến gần 21, hoặc dừng khi thấy đủ.");
  // Natural blackjack.
  const playerBJ=bjValue(bjPlayer)===21, dealerBJ=bjValue(bjDealer)===21;
  if(playerBJ||dealerBJ){
    renderBJ(false);
    if(playerBJ&&dealerBJ)bjSettle("push",1);
    else if(playerBJ)bjSettle("win",2.0);
    else bjSettle("lose");
  } else { save(); beep("tick"); }
}
async function bjHit(){
  if(!bjRound)return; bjPlayer.push(bjDeck.pop()); renderBJ(true); beep("click");
  const score=bjValue(bjPlayer);
  if(score>21){bjSetMessage("Bạn đã quắc! Nhà cái thắng.","lose"); renderBJ(false); await wait(450); bjSettle("lose");}
  else if(score===21){bjSetMessage("Bạn đạt 21! Nhà cái đang mở bài…","success"); await wait(500); bjStand();}
  else bjSetMessage(`Bạn có ${score} điểm. Rút thêm hoặc dừng.`);
}
async function bjStand(){
  if(!bjRound)return;
  bjDealerHidden=false; renderBJ(false); bjSetActions(false,false,false); $("bjPhase").textContent="NHÀ CÁI ĐANG RÚT";
  while(bjValue(bjDealer)<17){ await wait(520); bjDealer.push(bjDeck.pop()); renderBJ(false); beep("tick"); }
  const p=bjValue(bjPlayer), d=bjValue(bjDealer);
  if(d>21 || p>d){bjSetMessage(`Bạn ${p} • Nhà cái ${d} — bạn thắng!`,"success");bjSettle("win",2.0);}
  else if(p===d){bjSetMessage(`Cùng ${p} — hòa.`,"draw");bjSettle("push",1);}
  else {bjSetMessage(`Bạn ${p} • Nhà cái ${d} — nhà cái thắng.` ,"lose");bjSettle("lose");}
}
$("bjDeal").onclick=bjStart; $("bjHit").onclick=bjHit; $("bjStand").onclick=bjStand;

// ===== Inventory / Store / Skins =====
function itemCount(key){ return Math.max(0, Number(inventory[key]||0)); }
function buyItem(key){
  const item=ITEM_DEFS[key]; if(!item)return;
  const dailyLimit=getDailyItemLimit();
  const todayCount=dailyItemCount(key);
  if(todayCount>=dailyLimit)return toast("Hết lượt mua hôm nay",`${item.name}: ${todayCount}/${dailyLimit}. Ngày mai sẽ reset lượt mua.` ,"error");
  if(balance<item.price)return toast("Không đủ coin",`Cần ${fmt(item.price)} coin để mua ${item.name}.`,"error");
  balance-=item.price;
  inventory[key]=itemCount(key)+1;
  const today=ensureDailyPurchases(); today[key]=todayCount+1;
  save(); renderStore(); renderInventory(); beep("win");
  toast("Đã mua vật phẩm",`${item.icon} ${item.name} • hôm nay ${today[key]}/${dailyLimit}` ,"success");
}
function useItem(key){
  if(itemCount(key)<=0)return toast("Không có vật phẩm","Hãy ghé cửa hàng để mua thêm.","error");
  if(key==="predictor"){
    if(!bjRound || !bjDeck.length)return toast("Chưa thể dự đoán","Mở một ván Xì Dách trước, rồi dùng máy để xem lá kế tiếp.","error");
    const next=bjDeck[bjDeck.length-1];
    inventory[key]--;
    save(); renderInventory();
    assistantSay(`🔮 Lá kế tiếp bro sẽ rút là ${next.rank}${next.suit}. Hãy cân nhắc RÚT THÊM nha~`,false);
    toast("Máy dự đoán bài",`Lá kế tiếp: ${next.rank}${next.suit}`,"success");
    return;
  }
  if(key==="repair"){
    if(repairActive)return toast("Máy chữa lỗ đang bật","Lượt thua kế tiếp đã được bảo vệ.","error");
    repairActive=true; inventory[key]--; save(); renderInventory(); beep();
    assistantSay("🛠️ Máy chữa lỗ online! Nếu lượt kế tiếp thua, cược sẽ được hoàn lại trong demo.",false);
    toast("Đã kích hoạt máy chữa lỗ","Lần thua kế tiếp sẽ được hoàn tiền cược.","success");
    return;
  }
  if(key==="beer"){
    if(guaranteedWin)return toast("BIA đang có hiệu lực","Lượt game kế tiếp đã được bảo đảm trong demo.","error");
    guaranteedWin=true; inventory[key]--; save(); renderInventory(); beep("win");
    assistantSay("🍺 BIA đã vào kho hiệu lực! Game kế tiếp: thắng trong demo =))",false);
    toast("BIA kích hoạt","Game kế tiếp được bảo đảm thắng trong demo.","success");
  }
}
function skinArtHTML(key, className="") {
  const s=SKIN_DEFS[key];
  const fallback = key === "rem" ? REM_FALLBACK_SVG_DATA : key === "furina" ? FURINA_FALLBACK_SVG_DATA : key === "hoshino" ? HOSHINO_FALLBACK_SVG_DATA : key === "fern" ? FERN_FALLBACK_SVG_DATA : key === "mira" ? MIRA_FALLBACK_SVG_DATA : key === V5_EXCLUSIVE_SKIN_KEY ? BETZONE80_FALLBACK_SVG_DATA : BIBI_SVG_DATA;
  if(!s.image) return `<div class="skin-art ${esc(className)}"><img src="${fallback}" alt="Skin ${esc(s.name)}"></div>`;
  return `<div class="skin-art ${esc(className)}"><img src="${esc(s.image)}" alt="Skin ${esc(s.name)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='${fallback}'"></div>`;
}
function renderStore(){
  const itemBox=$("itemShopGrid"), skinBox=$("skinShopGrid");
  const dailyLimit=getDailyItemLimit();
  if($("shopBalance"))$("shopBalance").textContent=`${fmt(balance)} 🪙`;
  if($("dailyItemLimitText"))$("dailyItemLimitText").textContent=`Mua tối đa ${dailyLimit} lần / món / ngày${progressData.level>=40?" • LEVEL 40+":""}`;
  if(itemBox) itemBox.innerHTML=Object.entries(ITEM_DEFS).map(([key,it])=>{
    const count=itemCount(key), todayCount=dailyItemCount(key), full=todayCount>=dailyLimit;
    return `<article class="store-card item-store-card"><div class="store-icon">${it.icon}</div><div class="store-title"><h3>${esc(it.name)}</h3><span>Kho x${count}</span></div><p>${esc(it.desc)}</p><div class="daily-buy-meter"><span>HÔM NAY</span><b>${todayCount}/${dailyLimit}</b></div><div class="store-bottom"><b>${fmt(it.price)} 🪙</b><button class="green-btn store-buy" data-buy-item="${key}" ${full?"disabled":""}>${full?"HẾT LƯỢT":"MUA"}</button></div></article>`;
  }).join("");
  if(skinBox) skinBox.innerHTML=Object.entries(SKIN_DEFS).map(([key,sk])=>{
    const owned=ownedSkins.includes(key), equipped=equippedSkin===key, locked=typeof sk.unlock === "function" && !sk.unlock();
    return `<article class="skin-card ${equipped?"equipped":""} ${locked?"skin-locked":""}">${skinArtHTML(key)}<div class="skin-card-body"><div class="skin-title"><h3>${esc(sk.name)}</h3>${equipped?'<span class="skin-equipped">ĐANG DÙNG</span>':sk.exclusive?'<span class="skin-exclusive">ĐỘC QUYỀN</span>':''}</div><p>${esc(sk.desc)}</p><div class="store-bottom"><b>${locked?"🔒 Lv."+sk.requiredLevel:sk.price?fmt(sk.price)+" 🪙":"FREE"}</b><button class="outline-btn skin-btn" data-skin="${key}" ${locked?"disabled":""}>${locked?"CHƯA MỞ":equipped?"ĐANG DÙNG":owned?"TRANG BỊ":"MUA"}</button></div></div></article>`;
  }).join("");
  document.querySelectorAll("[data-buy-item]").forEach(b=>b.onclick=()=>buyItem(b.dataset.buyItem));
  document.querySelectorAll("[data-skin]").forEach(b=>b.onclick=()=>toggleSkin(b.dataset.skin));
}
function renderInventory(){
  const box=$("inventoryGrid"); if(!box)return;
  const active=[];
  if(repairActive)active.push('<span class="active-perk repair">🛠️ Chữa lỗ: ON</span>');
  if(guaranteedWin)active.push('<span class="active-perk beer">🍺 BIA: ON</span>');
  box.innerHTML=Object.entries(ITEM_DEFS).map(([key,it])=>{
    const count=itemCount(key), activeNow=key==="repair"?repairActive:key==="beer"?guaranteedWin:false;
    return `<article class="inventory-card"><div class="inventory-icon">${it.icon}</div><div><h3>${esc(it.name)} <span>x${count}</span></h3><p>${esc(it.desc)}</p>${activeNow?'<small class="item-active">● ĐANG KÍCH HOẠT</small>':''}</div><button class="outline-btn inventory-use" data-use-item="${key}" ${count<=0||activeNow?"disabled":""}>${activeNow?"ĐANG DÙNG":key==="predictor"?"DỰ ĐOÁN":"SỬ DỤNG"}</button></article>`;
  }).join("");
  if(active.length)box.insertAdjacentHTML("afterbegin",`<div class="active-perks">${active.join("")}</div>`);
  const total=Object.values(inventory).reduce((a,b)=>a+Number(b||0),0);
  if($("inventoryCount"))$("inventoryCount").textContent=`${total} món`;
  document.querySelectorAll("[data-use-item]").forEach(b=>b.onclick=()=>useItem(b.dataset.useItem));
  if($("inventoryBadge"))$("inventoryBadge").textContent=total;
}
function toggleSkin(key){
  const sk=SKIN_DEFS[key]; if(!sk)return;
  if(sk.unlock && !sk.unlock()) return toast("Skin chưa mở",`Cần level ${sk.requiredLevel}. Hiện tại: Lv.${progressData.level}.`,`error`);
  if(!ownedSkins.includes(key)){
    if(balance<sk.price)return toast("Chưa đủ coin",`Cần ${fmt(sk.price)} coin để mở ${sk.name}.`,`error`);
    if(sk.price>0)balance-=sk.price;
    ownedSkins.push(key); toast("Đã mở skin",`✨ ${sk.name} đã vào bộ sưu tập.`,`success`);
  }
  equippedSkin=key; save(); applyAssistantSkin(); renderStore();
  assistantSay(`✨ Đã trang bị ${sk.name}! Nhìn ổn áp chưa bro =))`,false);
}

const BIBI_SVG_DATA="data:image/svg+xml;charset=UTF-8,"+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="360" height="420" viewBox="0 0 360 420"><defs><linearGradient id="g" x1="0" x2="1"><stop stop-color="#ffffff"/><stop offset="1" stop-color="#caffdf"/></linearGradient></defs><path fill="url(#g)" stroke="#1b4731" stroke-width="6" d="M95 130C58 55 68 12 96 28c34 20 42 56 47 74 7-20 18-57 51-74 31-16 34 32-1 102 40 20 65 62 65 119 0 91-55 130-124 130S80 340 80 249c0-53 15-95 45-119z"/><circle cx="138" cy="230" r="10" fill="#15241b"/><circle cx="222" cy="230" r="10" fill="#15241b"/><path d="M165 257q15 14 30 0" fill="none" stroke="#173a29" stroke-width="7" stroke-linecap="round"/><ellipse cx="115" cy="267" rx="18" ry="8" fill="#ffb5c8" opacity=".7"/><ellipse cx="245" cy="267" rx="18" ry="8" fill="#ffb5c8" opacity=".7"/></svg>`);
// Offline fallback for the extra shop assistant. Replace mira.png with your own local image.
const MIRA_FALLBACK_SVG_DATA="data:image/svg+xml;charset=UTF-8,"+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="420" height="520" viewBox="0 0 420 520"><defs><linearGradient id="mh" x1="0" x2="1"><stop stop-color="#ffd7f7"/><stop offset="1" stop-color="#8ac8ff"/></linearGradient><linearGradient id="md" x1="0" x2="0" y2="1"><stop stop-color="#ffffff"/><stop offset="1" stop-color="#c9ddff"/></linearGradient></defs><ellipse cx="210" cy="493" rx="118" ry="16" fill="#000" opacity=".18"/><path d="M105 470Q116 304 210 274q94 30 105 196z" fill="url(#md)" stroke="#5675b8" stroke-width="8"/><ellipse cx="210" cy="193" rx="72" ry="84" fill="#ffe0cf"/><path d="M136 187Q119 94 210 66q91 28 74 121-25-47-74-49-49 2-74 49z" fill="url(#mh)" stroke="#6174bd" stroke-width="7"/><path d="M146 109q30-33 64-34t64 34l-21 29q-43-18-86 0z" fill="#f6fbff"/><ellipse cx="181" cy="207" rx="10" ry="14" fill="#5c85ce"/><ellipse cx="239" cy="207" rx="10" ry="14" fill="#5c85ce"/><circle cx="183" cy="210" r="4" fill="#fff"/><circle cx="241" cy="210" r="4" fill="#fff"/><path d="M190 246q20 13 40 0" fill="none" stroke="#b76c7e" stroke-width="5" stroke-linecap="round"/><path d="M140 352q70 52 140 0" fill="none" stroke="#6687d0" stroke-width="8"/><path d="M151 332l59 35 59-35" fill="none" stroke="#3d568c" stroke-width="7"/></svg>`);

// Reliable offline fallback: blue-haired maid-like half-body so Rem is still visible
// when the external PNG host is unavailable or the user opens the ZIP offline.
const REM_FALLBACK_SVG_DATA="data:image/svg+xml;charset=UTF-8,"+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="420" height="520" viewBox="0 0 420 520"><defs><linearGradient id="hair" x1="0" x2="1"><stop stop-color="#75d8ff"/><stop offset="1" stop-color="#6d89ee"/></linearGradient><linearGradient id="dress" x1="0" x2="0" y2="1"><stop stop-color="#f8fbff"/><stop offset="1" stop-color="#b8c9dc"/></linearGradient></defs><ellipse cx="210" cy="493" rx="118" ry="16" fill="#000" opacity=".18"/><path d="M120 270Q210 195 300 270L335 480Q210 515 85 480z" fill="#1d2639" stroke="#0e1422" stroke-width="7"/><path d="M128 292Q210 245 292 292L275 468Q210 488 145 468z" fill="url(#dress)"/><path d="M108 304Q210 248 312 304L285 336Q210 301 135 336z" fill="#26324b"/><path d="M95 325q28-77 115-84t115 84l-28 89q-26-61-87-61t-87 61z" fill="url(#hair)" stroke="#384fa5" stroke-width="6"/><ellipse cx="210" cy="205" rx="73" ry="82" fill="#ffd9c8"/><path d="M138 191Q131 93 210 78q79 15 72 113-22-45-72-47-50 2-72 47z" fill="url(#hair)" stroke="#384fa5" stroke-width="6"/><path d="M145 110q22-48 65-48t65 48q-34-20-65-18t-65 18z" fill="#eef6ff" stroke="#38549f" stroke-width="6"/><path d="M137 188q22 30 29 101l-43 74-32-23 30-151z" fill="url(#hair)"/><path d="M283 188q-22 30-29 101l43 74 32-23-30-151z" fill="url(#hair)"/><ellipse cx="183" cy="207" rx="10" ry="14" fill="#3c6dba"/><ellipse cx="237" cy="207" rx="10" ry="14" fill="#3c6dba"/><circle cx="185" cy="210" r="4" fill="#fff"/><circle cx="239" cy="210" r="4" fill="#fff"/><path d="M191 244q19 13 38 0" fill="none" stroke="#b76c7e" stroke-width="5" stroke-linecap="round"/><path d="M161 334l49 30 49-30" fill="none" stroke="#6a7890" stroke-width="7"/><path d="M151 332q19 20 59 30 40-10 59-30" fill="#0d1525" opacity=".8"/></svg>`);
const HOSHINO_FALLBACK_SVG_DATA="data:image/svg+xml;charset=UTF-8,"+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="420" height="520" viewBox="0 0 420 520"><defs><linearGradient id="h1" x1="0" x2="1"><stop stop-color="#d9d2ff"/><stop offset="1" stop-color="#f1b6c7"/></linearGradient></defs><ellipse cx="210" cy="492" rx="118" ry="16" fill="#000" opacity=".18"/><path d="M106 472Q118 298 210 270q92 28 104 202z" fill="#c7d2ff" stroke="#725ab0" stroke-width="8"/><ellipse cx="210" cy="190" rx="72" ry="84" fill="#ffe0ce"/><path d="M136 190Q116 93 210 66q94 27 74 124-22-49-74-50-52 1-74 50z" fill="url(#h1)" stroke="#7a61aa" stroke-width="7"/><path d="M142 111q33-37 68-35t68 35l-25 26q-43-17-86 0z" fill="#fff6ff"/><ellipse cx="181" cy="205" rx="10" ry="14" fill="#6f77b9"/><ellipse cx="239" cy="205" rx="10" ry="14" fill="#6f77b9"/><circle cx="183" cy="208" r="4" fill="#fff"/><circle cx="241" cy="208" r="4" fill="#fff"/><path d="M191 245q19 12 38 0" fill="none" stroke="#b76c7e" stroke-width="5" stroke-linecap="round"/><path d="M120 359q44-82 90-88 46 6 90 88l-35 111H155z" fill="#eff2ff"/><path d="M142 356q68 50 136 0" fill="none" stroke="#8b7cd1" stroke-width="8"/></svg>`);
const FERN_FALLBACK_SVG_DATA="data:image/svg+xml;charset=UTF-8,"+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="420" height="520" viewBox="0 0 420 520"><defs><linearGradient id="h2" x1="0" x2="1"><stop stop-color="#7c5ca8"/><stop offset="1" stop-color="#a974c9"/></linearGradient></defs><ellipse cx="210" cy="492" rx="118" ry="16" fill="#000" opacity=".18"/><path d="M105 473Q118 306 210 274q92 32 105 199z" fill="#e1d7f3" stroke="#5a426e" stroke-width="8"/><ellipse cx="210" cy="192" rx="72" ry="84" fill="#ffe1d0"/><path d="M135 186Q124 93 210 64q86 29 75 122-23-43-75-46-52 3-75 46z" fill="url(#h2)" stroke="#60426f" stroke-width="7"/><path d="M143 109q34-34 67-33t67 33l-23 28q-44-18-88 0z" fill="#efe8ff"/><ellipse cx="182" cy="207" rx="9" ry="14" fill="#6d559b"/><ellipse cx="238" cy="207" rx="9" ry="14" fill="#6d559b"/><circle cx="184" cy="210" r="4" fill="#fff"/><circle cx="240" cy="210" r="4" fill="#fff"/><path d="M193 245q17 11 34 0" fill="none" stroke="#ad7286" stroke-width="5" stroke-linecap="round"/><path d="M112 383q42-82 98-88 56 6 98 88l-35 97H147z" fill="#f5f0ff"/><path d="M140 359q70 51 140 0" fill="none" stroke="#705589" stroke-width="8"/></svg>`);
const BETZONE80_FALLBACK_SVG_DATA="data:image/svg+xml;charset=UTF-8,"+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="420" height="520" viewBox="0 0 420 520"><defs><radialGradient id="g80"><stop stop-color="#fff6c8"/><stop offset="1" stop-color="#a987ff"/></radialGradient></defs><ellipse cx="210" cy="492" rx="118" ry="16" fill="#000" opacity=".22"/><path d="M98 478Q115 285 210 258q95 27 112 220z" fill="url(#g80)" stroke="#f0c86f" stroke-width="10"/><circle cx="210" cy="184" r="80" fill="#ffe1ca" stroke="#f5d16f" stroke-width="9"/><path d="M132 187Q118 72 210 50q92 22 78 137-28-53-78-53t-78 53z" fill="#17151f" stroke="#f7d977" stroke-width="9"/><path d="M159 113h102" stroke="#f7d977" stroke-width="14" stroke-linecap="round"/><circle cx="180" cy="205" r="11" fill="#9a67ff"/><circle cx="240" cy="205" r="11" fill="#9a67ff"/><circle cx="182" cy="207" r="4" fill="#fff"/><circle cx="242" cy="207" r="4" fill="#fff"/><path d="M178 261q32 23 64 0" fill="none" stroke="#b26a77" stroke-width="7" stroke-linecap="round"/><path d="M142 347l68 36 68-36" fill="none" stroke="#f5d16f" stroke-width="12"/><text x="210" y="421" text-anchor="middle" fill="#fff7ce" font-size="27" font-family="Arial" font-weight="900">BETZONE</text></svg>`);
const FURINA_FALLBACK_SVG_DATA="data:image/svg+xml;charset=UTF-8,"+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="420" height="520" viewBox="0 0 420 520"><defs><linearGradient id="h" x1="0" x2="1"><stop stop-color="#9cdcff"/><stop offset="1" stop-color="#6d6ce8"/></linearGradient></defs><ellipse cx="210" cy="494" rx="118" ry="16" fill="#000" opacity=".18"/><path d="M105 470Q115 300 210 275q95 25 105 195z" fill="#dfe8ff" stroke="#5c63b6" stroke-width="8"/><ellipse cx="210" cy="196" rx="72" ry="84" fill="#ffe0cf"/><path d="M140 183Q123 91 210 67q87 24 70 116-25-42-70-45-45 3-70 45z" fill="url(#h)" stroke="#555cb3" stroke-width="7"/><path d="M146 108q26-35 64-36t64 36l-22 28q-42-19-84 0z" fill="#edf5ff"/><ellipse cx="182" cy="205" rx="10" ry="14" fill="#5866c7"/><ellipse cx="238" cy="205" rx="10" ry="14" fill="#5866c7"/><circle cx="184" cy="208" r="4" fill="#fff"/><circle cx="240" cy="208" r="4" fill="#fff"/><path d="M192 244q18 12 36 0" fill="none" stroke="#b76c7e" stroke-width="5" stroke-linecap="round"/><path d="M111 383q42-82 99-87 57 5 99 87l-36 98H147z" fill="#f3f6ff"/><path d="M140 358q70 54 140 0" fill="none" stroke="#7f86db" stroke-width="8"/></svg>`);
function setAssistantPosition(x,y,saveIt=true){
  const root=$("cuteAssistant"); if(!root)return;
  const pad=8,w=root.offsetWidth||154,h=root.offsetHeight||208;
  const nx=Math.max(pad,Math.min(window.innerWidth-w-pad,x));
  const ny=Math.max(pad,Math.min(window.innerHeight-h-pad,y));
  root.style.left=`${nx}px`;root.style.top=`${ny}px`;root.style.right="auto";root.style.bottom="auto";
  if(saveIt){assistantPosition={x:nx,y:ny};localStorage.setItem("bz_assistant_position",JSON.stringify(assistantPosition));}
}
function applySavedAssistantPosition(){
  if(!assistantPosition)return;
  requestAnimationFrame(()=>setAssistantPosition(assistantPosition.x,assistantPosition.y,false));
}
function applyAssistantSkin(){
  const sk=SKIN_DEFS[equippedSkin]||SKIN_DEFS.rem;
  const img=$("assistantImage");
  if(img){
    const fallback=equippedSkin==="rem"?REM_FALLBACK_SVG_DATA:equippedSkin==="furina"?FURINA_FALLBACK_SVG_DATA:equippedSkin==="hoshino"?HOSHINO_FALLBACK_SVG_DATA:equippedSkin==="fern"?FERN_FALLBACK_SVG_DATA:equippedSkin==="mira"?MIRA_FALLBACK_SVG_DATA:equippedSkin===V5_EXCLUSIVE_SKIN_KEY?BETZONE80_FALLBACK_SVG_DATA:BIBI_SVG_DATA;
    img.onerror=()=>{img.onerror=null;img.src=fallback;img.classList.add("assistant-image-fallback");};
    img.classList.toggle("assistant-image-fallback",false);
    img.src=sk.image||fallback; img.alt=`Trợ lý ${sk.name} nửa thân`;
  }
  if($("assistantSkinName"))$("assistantSkinName").textContent=sk.name.toUpperCase();
  if($("assistantSkinDot"))$("assistantSkinDot").textContent=sk.icon;
}
if($("inventoryFab"))$("inventoryFab").onclick=()=>{renderInventory();$("inventoryModal").classList.remove("hidden");beep();};
if($("shopRefresh"))$("shopRefresh").onclick=()=>{renderStore();beep();toast("Cửa hàng đã cập nhật","Kho và skin hiện tại đã được làm mới.");};

// ===== Cute anime assistant: free mouse movement + Vietnamese voice =====
let assistantVoiceOn=localStorage.getItem("bz_assistant_voice")!=="off";
let assistantVoices=[];
const BIBI_LINES=[
  "Hí bro~ Mình là trợ lý BETZONE nè ✨",
  "Bro kéo mình đi đâu cũng được nha~",
  "Nhớ nha: toàn bộ coin trong đây chỉ là coin ảo thôi ✨",
  "Bình tĩnh bro =)) hiệu ứng đang chạy, kết quả sắp tới!",
  "Túi đồ có item mới thì nhớ mở ra xem nha 🎒",
  "Muốn đổi sang Furina không? Mua skin ở cửa hàng nè 💧"
];
function chooseVietnameseVoice(){
  if(!assistantVoices.length && "speechSynthesis" in window) assistantVoices=speechSynthesis.getVoices()||[];
  const vi=assistantVoices.filter(v=>{
    const lang=String(v.lang||"").toLowerCase(), name=String(v.name||"").toLowerCase();
    return /^vi(?:-|$)/i.test(lang)||name.includes("vietnam")||name.includes("tiếng việt")||name.includes("vietnamese");
  });
  const preferredNames=["hoai my","hoài my","google vietnamese","google tiếng việt","mai","linh","ngoc","ngọc","female","girl"];
  const female=vi.find(v=>preferredNames.some(k=>String(v.name||"").toLowerCase().includes(k)))||vi.find(v=>/microsoft|google/i.test(v.name))||vi[0];
  return female||null;
}
function speakAssistant(text){
  if(!assistantVoiceOn||!("speechSynthesis" in window))return false;
  try{
    speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(text); u.lang="vi-VN"; u.rate=.92; u.pitch=1.28; u.volume=1;
    const voice=chooseVietnameseVoice(); if(voice)u.voice=voice; speechSynthesis.speak(u); return !!voice;
  }catch(e){return false;}
}
function assistantSay(text,speak=true){
  const bubble=$("assistantBubble"); if(!bubble)return;
  bubble.innerHTML=`${esc(text)}`; bubble.classList.remove("show"); void bubble.offsetWidth; bubble.classList.add("show");
  if(speak){
    const hasVi=speakAssistant(text);
    if(!hasVi && assistantVoiceOn && $("assistantVoice")){
      $("assistantVoice").textContent="⚠️";
      setTimeout(()=>{if($("assistantVoice"))$("assistantVoice").textContent="🇻🇳";},1800);
      toast("Chưa thấy giọng Việt","Chrome/Windows chưa có voice vi-VN. Cài thêm giọng Vietnamese rồi mở lại trình duyệt.","error");
    }
  }
}
function assistantContextLine(){
  const active=document.querySelector(".page.active")?.id||"home";
  const map={home:"Chào mừng về nhà~",football:"Đi xem tỷ số LIVE thôi ⚽",dice:"Đến giờ rung xúc xắc rồi 🎲",games:"Mini game time! 🪙",blackjack:"Bàn Xì Dách đã mở 🃏",tienlen:"Tiến Lên 4 người đã mở ♠ Nhớ giữ 3♠ ở ván đầu nha!",shop:"Shop mở rồi! Có skin xịn đó nha ✨",pachinko:"Pachinko đang sáng đèn rồi 🎰",titlesPage:"Sảnh danh hiệu — xem title đã mở 🏆",history:"Xem lại chiến tích nè 📜"};
  return map[active]||BIBI_LINES[Math.floor(Math.random()*BIBI_LINES.length)];
}
function initAssistant(){
  const root=$("cuteAssistant"),character=$("assistantCharacter"); if(!root||!character)return;
  applyAssistantSkin(); applySavedAssistantPosition();
  if("speechSynthesis" in window){
    assistantVoices=speechSynthesis.getVoices()||[];
    speechSynthesis.onvoiceschanged=()=>{assistantVoices=speechSynthesis.getVoices()||[];};
  }
  $("assistantVoice").textContent=assistantVoiceOn?"🇻🇳":"🔇";
  let drag=false,moved=false,dx=0,dy=0;
  const beginDrag=e=>{
    if(e.button!==undefined && e.button!==0)return;
    drag=true;moved=false;
    const r=root.getBoundingClientRect(); dx=e.clientX-r.left; dy=e.clientY-r.top;
    root.classList.add("dragging"); character.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  };
  const moveDrag=e=>{
    if(!drag)return; moved=true;
    const pad=8,w=root.offsetWidth||154,h=root.offsetHeight||208;
    const x=Math.max(pad,Math.min(innerWidth-w-pad,e.clientX-dx)); const y=Math.max(pad,Math.min(innerHeight-h-pad,e.clientY-dy));
    root.style.left=`${x}px`;root.style.top=`${y}px`;root.style.right="auto";root.style.bottom="auto";
  };
  const release=e=>{
    if(!drag)return; drag=false; root.classList.remove("dragging");
    try{character.releasePointerCapture?.(e.pointerId)}catch(_){ }
    if(moved){
      const r=root.getBoundingClientRect(); assistantPosition={x:r.left,y:r.top}; localStorage.setItem("bz_assistant_position",JSON.stringify(assistantPosition));
      toast("Đã di chuyển trợ lý","Vị trí nhân vật đã được lưu lại.","success");
    }else{beep();assistantSay(assistantContextLine(),true);}
  };
  character.addEventListener("pointerdown",beginDrag); character.addEventListener("pointermove",moveDrag); character.addEventListener("pointerup",release); character.addEventListener("pointercancel",release);
  $("assistantTalk").onclick=()=>{beep();assistantSay(assistantContextLine(),true);};
  $("assistantVoice").onclick=()=>{
    assistantVoiceOn=!assistantVoiceOn; localStorage.setItem("bz_assistant_voice",assistantVoiceOn?"on":"off"); $("assistantVoice").textContent=assistantVoiceOn?"🇻🇳":"🔇";
    if(assistantVoiceOn)assistantSay("Đã bật giọng Việt nha bro~",true); else {if("speechSynthesis" in window)speechSynthesis.cancel();assistantSay("Okie, Bibi sẽ nhắn bằng bong bóng thôi 💬",false);}
  };
  setTimeout(()=>assistantSay(BIBI_LINES[0],true),900);
  setInterval(()=>{if(!drag)assistantSay(BIBI_LINES[Math.floor(Math.random()*BIBI_LINES.length)],false);},22000);
}


// =========================================================
// TIẾN LÊN MIỀN NAM — 4 NGƯỜI
// Bộ luật lõi phổ biến: 52 lá, 13 lá/người, 3♠ mở ván đầu,
// ván sau người thắng mở; lẻ/đôi/sám/sảnh/tứ quý/đôi thông;
// chặt 2 bằng tứ quý và đôi thông theo quy ước phổ biến.
// =========================================================
const TL_RANKS=["3","4","5","6","7","8","9","10","J","Q","K","A","2"];
const TL_SUITS=["♠","♣","♦","♥"]; // thứ tự chất thấp -> cao
const TL_NAMES=["BẠN","MÁY 1","MÁY 2","MÁY 3"];
let tlGame=null;
let tlBotTimer=null;
let tlNextStarter=Number(localStorage.getItem("bz_tl_next_starter") ?? -1);
if(!Number.isInteger(tlNextStarter) || tlNextStarter<0 || tlNextStarter>3) tlNextStarter=-1;

function tlBuildDeck(){
  const deck=[];
  for(let r=0;r<TL_RANKS.length;r++){
    for(let s=0;s<TL_SUITS.length;s++){
      deck.push({id:`${r}-${s}`,rank:TL_RANKS[r],value:r,suit:TL_SUITS[s],suitValue:s});
    }
  }
  return deck;
}
function tlShuffle(deck){
  const a=[...deck];
  for(let i=a.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}
function tlSort(cards){
  return [...cards].sort((a,b)=>a.value-b.value || a.suitValue-b.suitValue);
}
function tlCombo(cards){
  const a=tlSort(cards);
  if(!a.length)return null;
  const len=a.length;
  const counts={};
  a.forEach(c=>counts[c.value]=(counts[c.value]||0)+1);
  const vals=Object.keys(counts).map(Number).sort((x,y)=>x-y);

  if(len===1)return {type:"single",cards:a,length:1,highRank:a[0].value,highSuit:a[0].suitValue,label:`Lẻ ${a[0].rank}${a[0].suit}`};
  if(len===2 && vals.length===1 && counts[vals[0]]===2)return {type:"pair",cards:a,length:2,highRank:vals[0],label:`Đôi ${a[0].rank}`};
  if(len===3 && vals.length===1 && counts[vals[0]]===3)return {type:"triple",cards:a,length:3,highRank:vals[0],label:`Sám ${a[0].rank}`};
  if(len===4 && vals.length===1 && counts[vals[0]]===4)return {type:"four",cards:a,length:4,highRank:vals[0],label:`Tứ quý ${a[0].rank}`};

  // Sảnh: từ 3 lá liên tiếp, không chứa 2.
  if(len>=3 && vals.length===len && vals[vals.length-1] < 12 && vals.every((v,i)=>i===0 || v===vals[i-1]+1)){
    return {type:"straight",cards:a,length:len,highRank:vals[vals.length-1],label:`Sảnh ${a[0].rank}–${a[len-1].rank}`};
  }

  // Đôi thông: 3 đôi trở lên liên tiếp.
  if(len>=6 && len%2===0 && vals.length===len/2 && vals.every(v=>counts[v]===2) && vals.every((v,i)=>i===0 || v===vals[i-1]+1)){
    return {type:"pairseq",cards:a,length:len,highRank:vals[vals.length-1],label:`${len/2} đôi thông`};
  }
  return null;
}
function tlStrength(c){
  if(!c)return -1;
  if(c.type==="single")return c.highRank*10+c.highSuit;
  return c.highRank*10+c.length;
}
function tlContains3Sp(cards){
  return cards.some(c=>c.value===0 && c.suit==="♠");
}
function tlCanBeat(next,prev){
  if(!next)return false;
  if(!prev)return true;

  // Luật chặt 2 phổ biến:
  // - 3 đôi thông hoặc tứ quý chặt 1 con 2.
  // - 4 đôi thông chặt đôi 2 và tứ quý.
  if(prev.type==="single" && prev.highRank===12){
    if(next.type==="four")return true;
    if(next.type==="pairseq" && next.length>=6)return true;
  }
  if(prev.type==="pair" && prev.highRank===12){
    if(next.type==="pairseq" && next.length>=8)return true;
  }
  if(prev.type==="four"){
    if(next.type==="pairseq" && next.length>=8)return true;
  }

  if(next.type!==prev.type)return false;

  // Với bộ thông, bộ dài hơn có thể chặt bộ thông ngắn hơn.
  if(next.type==="pairseq"){
    if(next.length<prev.length)return false;
    if(next.length>prev.length)return true;
  }

  if(next.length!==prev.length)return false;
  return tlStrength(next)>tlStrength(prev);
}
function tlAllMoves(hand){
  const out=[];
  const n=hand.length;
  for(let mask=1;mask<(1<<n);mask++){
    const chosen=[];
    for(let i=0;i<n;i++)if(mask&(1<<i))chosen.push(hand[i]);
    const c=tlCombo(chosen);
    if(c)out.push(c);
  }
  return out;
}
function tlMoveScore(c){
  const typeWeight={single:0,pair:1,triple:2,straight:3,pairseq:4,four:5};
  // Máy ưu tiên giữ các bộ mạnh và dùng lá nhỏ trước.
  return (typeWeight[c.type]||0)*10000 + c.highRank*100 + c.length;
}
function tlChooseBotMove(playerIndex){
  const hand=tlGame.players[playerIndex].hand;
  let moves=tlAllMoves(hand);
  if(tlGame.firstTurn){
    moves=moves.filter(m=>tlContains3Sp(m.cards));
  }
  if(tlGame.currentCombo){
    moves=moves.filter(m=>tlCanBeat(m,tlGame.currentCombo));
  }
  if(!moves.length)return null;
  moves.sort((a,b)=>tlMoveScore(a)-tlMoveScore(b));
  return moves[0];
}
function tlCardLabel(c){return `${c.rank}${c.suit}`;}
function tlCardsHTML(cards, selectedSet){
  return tlSort(cards).map((c,idx)=>{
    const realIndex=tlGame.players[0].hand.findIndex(x=>x.id===c.id);
    const red=(c.suit==="♥"||c.suit==="♦");
    const sel=selectedSet.has(c.id)?" selected":"";
    return `<button class="tl-card${red?" red":""}${sel}" data-tl-card="${esc(c.id)}" data-tl-index="${realIndex}" ${tlGame.active&&tlGame.currentTurn===0?"":"disabled"}><b>${esc(c.rank)}</b><span>${esc(c.suit)}</span></button>`;
  }).join("");
}
function tlSeatClass(i){
  return tlGame && tlGame.currentTurn===i ? " is-turn" : "";
}
function tlLog(message){
  if(!tlGame)return;
  tlGame.log.unshift(message);
  tlGame.log=tlGame.log.slice(0,8);
}
function tlRenderPlay(){
  const box=$("tlPlayArea"), comboText=$("tlComboText");
  if(!box)return;
  if(!tlGame || !tlGame.currentCombo){
    box.innerHTML='<span class="tl-empty">Bàn trống — người mở lượt được đánh bất kỳ tổ hợp hợp lệ.</span>';
    if(comboText)comboText.textContent="—";
    return;
  }
  const c=tlGame.currentCombo;
  box.innerHTML=c.cards.map(card=>`<span class="tl-table-card${(card.suit==="♥"||card.suit==="♦")?" red":""}"><b>${esc(card.rank)}</b>${esc(card.suit)}</span>`).join("");
  if(comboText)comboText.textContent=c.label;
}
function tlRender(){
  const myCards=$("tlMyCards");
  if(!myCards)return;
  const active=!!tlGame;
  if($("tlStatus"))$("tlStatus").textContent=!active?"Sẵn sàng":tlGame.finished?tlGame.resultText:(tlGame.currentTurn===0?"Đến lượt BẠN":`Đến lượt ${TL_NAMES[tlGame.currentTurn]}`);
  if($("tlTurnText"))$("tlTurnText").textContent=!active?"Chưa chia bài":tlGame.finished?"VÁN ĐÃ KẾT THÚC":`Lượt: ${TL_NAMES[tlGame.currentTurn]}`;
  if($("tlLastPlay"))$("tlLastPlay").textContent=tlGame?.currentCombo?.label||"Bàn trống";
  if($("tlRuleHint"))$("tlRuleHint").textContent=!active?"Nhập cược rồi bấm CHIA BÀI.":tlGame.firstTurn?"Ván đầu: tổ hợp mở phải chứa 3♠.":tlGame.currentCombo?"Phải đánh cùng loại và mạnh hơn, hoặc dùng bộ chặt hợp lệ.":"Lượt mới: bạn có thể mở bất kỳ tổ hợp hợp lệ.";
  if($("tlMyName"))$("tlMyName").textContent=profileData.username||"BẠN";
  tlRenderPlay();

  for(let i=0;i<4;i++){
    const count=active?tlGame.players[i].hand.length:0;
    if($(`tlCount${i}`))$(`tlCount${i}`).textContent=`${count} lá`;
    const seat=$(`tlSeat${i}`); if(seat)seat.classList.toggle("is-turn",active&&tlGame.currentTurn===i);
  }
  const selectedSet=new Set(tlGame?.selected||[]);
  if(!active)myCards.innerHTML='<div class="tl-empty-hand">Nhấn “CHIA BÀI” để nhận 13 lá.</div>';
  else myCards.innerHTML=tlCardsHTML(tlGame.players[0].hand,selectedSet);

  document.querySelectorAll("[data-tl-card]").forEach(btn=>btn.onclick=()=>{
    if(!tlGame||!tlGame.active||tlGame.currentTurn!==0)return;
    const id=btn.dataset.tlCard;
    const set=new Set(tlGame.selected||[]);
    if(set.has(id))set.delete(id);else set.add(id);
    tlGame.selected=[...set];
    tlRender();
  });

  if($("tlDeal"))$("tlDeal").disabled=active&&!tlGame.finished;
  if($("tlPlay"))$("tlPlay").disabled=!active||tlGame.finished||tlGame.currentTurn!==0;
  if($("tlPass"))$("tlPass").disabled=!active||tlGame.finished||tlGame.currentTurn!==0||!tlGame.currentCombo;
  if($("tlNewRound"))$("tlNewRound").disabled=active&&!tlGame.finished;
  const logBox=$("tlLog");
  if(logBox)logBox.innerHTML=(tlGame?.log||["Nhập cược rồi chia bài."]).map(x=>`<div>${esc(x)}</div>`).join("");
}
function tlNewGame(){
  const input=Number($("tlAmount")?.value||0);
  const stake=Math.floor(input);
  if(!stake||stake<1)return toast("Thiếu cược","Nhập số coin ảo lớn hơn 0.","error");
  if(stake>balance)return toast("Không đủ coin",`Bạn chỉ có ${fmt(balance)} coin ảo.`,"error");

  clearTimeout(tlBotTimer);
  const deck=tlShuffle(tlBuildDeck());
  const hands=[[],[],[],[]];
  deck.forEach((card,i)=>hands[i%4].push(card));
  hands.forEach(h=>h.splice(0,h.length,...tlSort(h)));

  let starter=tlNextStarter;
  if(starter<0){
    starter=hands.findIndex(h=>h.some(c=>c.value===0&&c.suit==="♠"));
  }
  if(starter<0)starter=0;

  tlGame={
    active:true,finished:false,stake,players:hands.map((hand,i)=>({name:TL_NAMES[i],hand})),
    currentTurn:starter,leadPlayer:starter,currentCombo:null,passCount:0,firstTurn:!localStorage.getItem("bz_tl_has_played"),
    selected:[],log:[],resultText:""
  };
  localStorage.setItem("bz_tl_has_played","1");
  tlLog(`Chia đủ 52 lá • 13 lá/người • ${fmt(stake)} coin ảo.`);
  tlLog(tlGame.firstTurn?`Ván đầu: ${TL_NAMES[starter]} có 3♠ và phải mở bằng tổ hợp chứa 3♠.`:`Người thắng ván trước là ${TL_NAMES[starter]}, được mở ván.`);
  tlLog(`Thứ tự chất: ♠ < ♣ < ♦ < ♥ • Số: 3 → 4 → … → A → 2.`);
  if(starter!==0)tlLog(`${TL_NAMES[starter]} đang đánh trước…`);
  tlRender();
  tlProcessTurn();
}
function tlStartFromPlayer(cardList){
  if(!tlGame||!tlGame.active)return;
  const player=tlGame.players[0];
  const selected=(cardList||[]).map(id=>player.hand.find(c=>c.id===id)).filter(Boolean);
  const combo=tlCombo(selected);
  if(!combo)return toast("Bài không hợp lệ","Chỉ nhận lẻ, đôi, sám, sảnh 3+, tứ quý hoặc 3+ đôi thông.","error");
  if(tlGame.firstTurn && !tlContains3Sp(selected))return toast("Phải có 3♠","Ở ván đầu, tổ hợp đầu tiên bắt buộc phải chứa 3♠.","error");
  if(tlGame.currentCombo && !tlCanBeat(combo,tlGame.currentCombo))return toast("Không chặn được","Hãy đánh cùng loại mạnh hơn hoặc dùng bộ chặt hợp lệ.","error");
  tlExecuteMove(0,selected,combo);
}
function tlExecuteMove(playerIndex,cards,combo){
  if(!tlGame||!tlGame.active)return;
  const p=tlGame.players[playerIndex];
  const ids=new Set(cards.map(c=>c.id));
  p.hand=p.hand.filter(c=>!ids.has(c.id));
  tlGame.players[playerIndex].hand=tlSort(p.hand);
  tlGame.currentCombo=combo;
  tlGame.leadPlayer=playerIndex;
  tlGame.passCount=0;
  tlGame.firstTurn=false;
  tlGame.selected=[];
  tlLog(`${TL_NAMES[playerIndex]} đánh ${combo.label}: ${combo.cards.map(tlCardLabel).join(" ")}`);
  beep("win");

  if(p.hand.length===0){
    tlFinish(playerIndex);
    return;
  }

  tlGame.currentTurn=(playerIndex+1)%4;
  tlRender();
  tlProcessTurn();
}
function tlPassPlayer(playerIndex){
  if(!tlGame||!tlGame.active||!tlGame.currentCombo)return;
  tlGame.passCount++;
  tlLog(`${TL_NAMES[playerIndex]} bỏ lượt.`);
  if(tlGame.passCount>=3){
    tlLog(`Ba người còn lại đã bỏ — ${TL_NAMES[tlGame.leadPlayer]} được mở bộ mới.`);
    tlGame.currentCombo=null;
    tlGame.passCount=0;
    tlGame.currentTurn=tlGame.leadPlayer;
  }else{
    tlGame.currentTurn=(playerIndex+1)%4;
  }
  tlRender();
  tlProcessTurn();
}
function tlProcessTurn(){
  if(!tlGame||!tlGame.active||tlGame.finished)return;
  clearTimeout(tlBotTimer);
  if(tlGame.currentTurn===0)return;
  tlBotTimer=setTimeout(()=>{
    if(!tlGame||!tlGame.active||tlGame.finished)return;
    const i=tlGame.currentTurn;
    const move=tlChooseBotMove(i);
    if(move)tlExecuteMove(i,move.cards,move);
    else tlPassPlayer(i);
  },650);
}
function tlFinish(winner){
  if(!tlGame)return;
  clearTimeout(tlBotTimer);
  tlGame.active=false;tlGame.finished=true;
  const humanHand=tlGame.players[0].hand;
  const thoi2=humanHand.filter(c=>c.value===12).length;
  const humanWon=winner===0;
  const stake=tlGame.stake;

  if(humanWon){
    balance+=stake*3;
    tlGame.resultText=`BẠN THẮNG • +${fmt(stake*3)} coin ảo`;
    tlLog(`🏆 BẠN về nhất! Nhận ${fmt(stake*3)} coin ảo.`);
    awardGameProgress("win",stake);
    history.unshift({type:"♠ Tiến Lên",title:"Tiến Lên Miền Nam 4P",choice:"BẠN về nhất",amount:stake,odds:4,result:"Thắng",time:new Date().toLocaleString("vi-VN")});
  }else{
    balance-=stake;
    tlGame.resultText=`${TL_NAMES[winner]} THẮNG • -${fmt(stake)} coin ảo`;
    tlLog(`🏆 ${TL_NAMES[winner]} hết bài trước.`);
    if(thoi2)tlLog(`💥 Bạn còn ${thoi2} con 2 — THỐI 2 được ghi nhận.`);
    awardGameProgress("lose",stake);
    history.unshift({type:"♠ Tiến Lên",title:"Tiến Lên Miền Nam 4P",choice:`${TL_NAMES[winner]} về nhất`,amount:stake,odds:0,result:"Thua",time:new Date().toLocaleString("vi-VN")});
  }

  tlNextStarter=winner;
  localStorage.setItem("bz_tl_next_starter",String(winner));
  tlLog(winner===0?"Ván sau BẠN được quyền đi trước.":`Ván sau ${TL_NAMES[winner]} được quyền đi trước.`);
  save();
  tlRender();
  toast(humanWon?"Tiến Lên • BẠN thắng":"Tiến Lên • Ván kết thúc",tlGame.resultText,humanWon?"success":"error");
}
if($("tlDeal"))$("tlDeal").onclick=tlNewGame;
if($("tlPlay"))$("tlPlay").onclick=()=>tlStartFromPlayer(tlGame?.selected||[]);
if($("tlPass"))$("tlPass").onclick=()=>tlPassPlayer(0);
if($("tlNewRound"))$("tlNewRound").onclick=tlNewGame;

// ===== V5 TITLE HALL =====
function titleTierLabel(tier){return tier==="basic"?"CƠ BẢN":tier==="normal"?"BÌNH THƯỜNG":tier==="legend"?"HUYỀN THOẠI":"ĐẶC BIỆT";}
function titleCardHTML(key){
  const t=TITLE_DEFS[key], unlocked=earnedTitles.includes(key), equipped=activeTitleKey()===key;
  return `<article class="title-card tier-${t.tier} ${unlocked?"unlocked":"locked"} ${equipped?"selected-title":""}"><div class="title-icon">${t.icon}</div><div class="title-main"><div class="title-card-top"><span>${esc(titleTierLabel(t.tier))}</span>${equipped?'<b class="title-equipped">ĐANG DÙNG</b>':unlocked?'<b class="title-unlocked">ĐÃ ĐẠT</b>':'<b class="title-locked">🔒 CHƯA ĐẠT</b>'}</div><h3>${esc(t.name)}</h3><p>${esc(t.desc)}</p></div><button class="outline-btn title-use" data-title="${key}" ${!unlocked?"disabled":""}>${equipped?"ĐANG DÙNG":unlocked?"TRANG BỊ":"---"}</button></article>`;
}
function renderTitles(){
  syncEarnedTitles();
  const grid=$("titleGrid"); if(!grid)return;
  const order=["basic","normal","legend","special"];
  let out="";
  for(const tier of order){
    const keys=Object.keys(TITLE_DEFS).filter(k=>TITLE_DEFS[k].tier===tier);
    out+=`<div class="title-tier-head"><span>${esc(titleTierLabel(tier))}</span><small>${keys.filter(k=>earnedTitles.includes(k)).length}/${keys.length} đã đạt</small></div>`;
    out+=keys.map(titleCardHTML).join("");
  }
  grid.innerHTML=out;
  document.querySelectorAll("[data-title]").forEach(btn=>btn.onclick=()=>equipTitle(btn.dataset.title));
  if($("titleProgressText"))$("titleProgressText").textContent=`${unlockedTitleKeys().length}/${Object.keys(TITLE_DEFS).length} danh hiệu đã đạt`;
  if($("titleActiveName"))$("titleActiveName").textContent=`${activeTitle().icon} ${activeTitle().name}`;
}
function equipTitle(key){
  syncEarnedTitles();
  if(!TITLE_DEFS[key] || !earnedTitles.includes(key))return toast("Chưa đạt danh hiệu","Danh hiệu này vẫn đang bị khóa.","error");
  equippedTitle=key; save(); renderTitles(); renderProfile(); beep("win");
  toast("Đã trang bị danh hiệu",`${TITLE_DEFS[key].icon} ${TITLE_DEFS[key].name}`,"success");
}

// ===== Profile editor =====
function openProfileModal(){
  renderProfile();
  const select=$("profileTitleSelect");
  if(select){
    syncEarnedTitles();
    select.innerHTML=earnedTitles.map(k=>`<option value="${k}">${TITLE_DEFS[k].icon} ${esc(TITLE_DEFS[k].name)}</option>`).join("");
    select.value=activeTitleKey();
  }
  if($("adminCodeInput")) $("adminCodeInput").value="";
  $("profileModal")?.classList.remove("hidden");
  beep();
}
if($("profileOpen"))$("profileOpen").onclick=openProfileModal;
if($("profileOpenTop"))$("profileOpenTop").onclick=openProfileModal;
if($("saveProfile"))$("saveProfile").onclick=()=>{
  const name=($("profileUsername")?.value||"").trim();
  const email=($("profileEmailInput")?.value||"").trim();
  const avatar=($("profileAvatarInput")?.value||"").trim().slice(0,2).toUpperCase();
  const adminCode=($("adminCodeInput")?.value||"").trim().toLowerCase();
  if(name.length<2)return toast("Tên chưa hợp lệ","Tên hiển thị cần ít nhất 2 ký tự.","error");
  if(email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return toast("Email chưa hợp lệ","Kiểm tra lại địa chỉ email.","error");
  profileData={username:name,email:email||"Demo account",avatar:avatar||name.slice(0,1).toUpperCase()};
  let adminUsed=false;
  if(adminCode==="admin"){
    progressData.level=MAX_LEVEL;
    progressData.xp=0;
    if(!ownedSkins.includes(V5_EXCLUSIVE_SKIN_KEY))ownedSkins.push(V5_EXCLUSIVE_SKIN_KEY);
    syncEarnedTitles();
    if(!earnedTitles.includes("god99"))earnedTitles.push("god99");
    equippedTitle="god99";
    adminUsed=true;
  }else if(adminCode){
    toast("Code không hợp lệ","Code quản trị không đúng.","error");
  }
  const titleKey=$("profileTitleSelect")?.value;
  syncEarnedTitles();
  if(!adminUsed && titleKey && TITLE_DEFS[titleKey] && earnedTitles.includes(titleKey)) equippedTitle=titleKey;
  save(); renderTitles(); $("profileModal")?.classList.add("hidden"); beep("win");
  toast(adminUsed?"ADMIN CODE đã kích hoạt":"Đã lưu hồ sơ",adminUsed?"Level 99 • God of Casino • Skin Level 80 đã mở khóa":`${profileData.username} • ${activeTitle().name}`,"success");
};

function renderHistory(){
  const box=$("historyList"); if(!box) return;
  if(!history.length){ box.innerHTML='<div class="history-item"><span>Chưa có hoạt động nào.</span><small>Hãy thử một game demo!</small></div>'; return; }
  box.innerHTML=history.slice(0,100).map(h=>`<div class="history-item"><div><b>${esc(h.type)}</b><br>${esc(h.title)} — ${esc(h.choice)}<br><small>${esc(h.time)}</small></div><div style="text-align:right"><span class="amount">${fmt(h.amount)} 🪙</span><br><span class="${h.result==="Thắng"?"win":h.result==="Thua"?"lose":""}">${esc(h.result)}</span></div></div>`).join("");
}
$("clearHistory").onclick=()=>{history=[];save();beep();toast("Đã xóa lịch sử","Danh sách trong phiên demo đã được làm sạch.")};

function startClock(){
  const tick=()=>{ const now=new Date(); if($("liveClock")) $("liveClock").textContent=now.toLocaleTimeString("vi-VN",{hour12:false}); };
  tick(); setInterval(tick,1000);
}

// Modal close buttons + backdrop click
document.querySelectorAll("[data-close]").forEach(btn=>btn.onclick=()=>$(btn.dataset.close)?.classList.add("hidden"));
document.querySelectorAll(".modal-backdrop").forEach(backdrop=>backdrop.addEventListener("click",e=>{if(e.target===backdrop)backdrop.classList.add("hidden");}));

// Boot
renderProfile();
renderTitles();
renderProgressUI();
initAssistant();
$("soundBtn").innerHTML = soundOn ? "🔊 Âm thanh <b>ON</b>" : "🔇 Âm thanh <b>OFF</b>";
renderHistory();
renderStore();
renderInventory();
updateWithdrawUI();
startClock();
loadLiveData(true);
scheduleLiveRefresh();
