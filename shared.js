/* ============================================================
   Darsh Fitness — Shared JS (Firebase + state + auth + utils)
   Loaded by app.html, fasting.html, goals.html, insights.html
   Each page defines `window.pageRender()` to redraw its UI
   when state is loaded or changes.
   ============================================================ */

/* ---------- Firebase config ---------- */
const firebaseConfig = {
  apiKey: "AIzaSyALpiO5-ehBVVvXDyBJigWF0oACN0DwiqY",
  authDomain: "darshfitness-abfea.firebaseapp.com",
  projectId: "darshfitness-abfea",
  storageBucket: "darshfitness-abfea.firebasestorage.app",
  messagingSenderId: "516217530416",
  appId: "1:516217530416:web:aa734f8bdc5d92b357a5f5",
  measurementId: "G-NH3BWPSDYE"
};
const FIREBASE_ENABLED = firebaseConfig.apiKey && firebaseConfig.apiKey.indexOf("PASTE_") === -1;

/* ---------- Constants ---------- */
const AI_NUTRITION_URL = "https://billowing-water-d051darshfitness.darshanjoshi9.workers.dev";
const SESSION_KEY = "calTracker_guest_session";
const DEFAULT_GOALS = {protein:120,carbs:250,fat:65,fiber:30,sugar:36};
const FAST_PROTOCOLS = {"12:12":12,"13:11":13,"14:10":14,"16:8":16,"18:6":18,"19:5":19,"20:4":20,"OMAD":23,"24h":24,"36h":36,"48h":48,"72h":72};
const DEFAULT_FASTING = {protocol:"16:8", current:null, history:[]};
const FAST_STAGES = [
  {atH:0,  name:"Digestion & blood sugar rise",      body:"Carbs from your last meal are being broken down into glucose. Insulin is high; the body is in fed mode."},
  {atH:4,  name:"Blood sugar settles",                body:"Digestion winding down. Insulin starts to fall. You're transitioning out of fed state."},
  {atH:8,  name:"Glycogen burning",                   body:"Liver glycogen is now the main energy source. The body hasn't switched to fat yet."},
  {atH:12, name:"Fat burning begins",                 body:"Glycogen tank getting low. The body starts breaking down fat for fuel. Welcome to lipolysis."},
  {atH:14, name:"Ketone production rising",           body:"Fat breakdown is accelerating. Your liver starts producing ketones — alternative brain fuel."},
  {atH:16, name:"Ketosis ramp",                       body:"Now in light ketosis. Many people report mental clarity here. Hunger usually drops."},
  {atH:18, name:"Autophagy begins",                   body:"Cellular cleanup mode. Damaged proteins and organelles get recycled. The famous longevity stage."},
  {atH:24, name:"Deep autophagy + HGH surge",         body:"Human growth hormone rises sharply. Insulin sensitivity peaks. Cellular cleanup deepens."},
  {atH:36, name:"Reduced inflammation",               body:"Inflammatory markers drop. Stem cell production starts. Body is in deep maintenance mode."},
  {atH:48, name:"Stem cell boost + immune reset",     body:"Old immune cells are being recycled. New stem cells produced. Longevity research territory."},
  {atH:72, name:"Maximum autophagy",                  body:"Nearly every system is in repair mode. Stop here if you've never gone this long — break gently."}
];

/* ---------- Global state ---------- */
let MODE = "local";            // "cloud" | "local"
let currentUser = null;        // {id, name, email, picture}
let isGuest = false;
let auth=null, db=null;
let state = {goal:2000, goals:{...DEFAULT_GOALS}, profile:null, fasting:null, favourites:[], entries:[]};

/* ---------- Boot / Auth ---------- */
function hasStoredFirebaseAuth(){
  // Firebase persists auth in localStorage under keys like "firebase:authUser:{apiKey}:[DEFAULT]"
  try{
    for(let i=0; i<localStorage.length; i++){
      const k = localStorage.key(i);
      if(k && k.indexOf('firebase:authUser:') === 0) return true;
    }
  }catch(e){}
  return false;
}
function boot(){
  if(FIREBASE_ENABLED){
    try{
      firebase.initializeApp(firebaseConfig);
      auth=firebase.auth(); db=firebase.firestore();
      // Decide synchronously whether to show the overlay, to avoid flashing it
      // between page navigations when the user is already signed in.
      const hasCloudAuth = hasStoredFirebaseAuth();
      let guestSaved=null; try{ guestSaved=JSON.parse(localStorage.getItem(SESSION_KEY)); }catch(e){}
      if(!hasCloudAuth && !(guestSaved && guestSaved.id)){
        showOverlay();
      }
      auth.onAuthStateChanged(async (u)=>{
        if(u){ isGuest=false; await setUserCloud(u); }
        else if(!isGuest){
          // No cloud user, no guest session — fall back to overlay
          if(!(guestSaved && guestSaved.id)) showOverlay();
        }
      });
    }catch(e){ showOverlay(); showNotice("Firebase failed to start. Use guest mode. ("+e.message+")"); }
  }else{
    showOverlay();
    const gb=document.getElementById('googleBtn'); if(gb) gb.classList.add('hidden');
    const sub=document.getElementById('signinSub'); if(sub) sub.textContent="Cloud sync isn't configured yet — use guest mode for now.";
    showNotice("Add your Firebase config in the file (see SETUP-deploy.md) to turn on Google Sign-In and cross-device sync.");
    let saved=null; try{ saved=JSON.parse(localStorage.getItem(SESSION_KEY)); }catch(e){}
    if(saved && saved.id) setUserLocal(saved);
  }
}
function showNotice(msg){ const n=document.getElementById('signinNotice'); if(!n) return; n.classList.remove('hidden'); n.textContent=msg; }
function showOverlay(){ const a=document.getElementById('app'); const o=document.getElementById('overlay'); if(a) a.classList.add('hidden'); if(o) o.classList.remove('hidden'); }
function showApp(){ const o=document.getElementById('overlay'); const a=document.getElementById('app'); if(o) o.classList.add('hidden'); if(a) a.classList.remove('hidden'); }

function cloudSignIn(){
  if(!FIREBASE_ENABLED || !auth){ alert("Cloud sync isn't configured yet. See SETUP-deploy.md, or use guest mode."); return; }
  auth.signInWithPopup(new firebase.auth.GoogleAuthProvider())
    .catch(e=>{ showNotice("Sign-in failed: "+e.message); });
}
function signInGuest(){ isGuest=true; setUserLocal({id:"guest", name:"Guest", email:"", picture:""}); }

async function setUserCloud(u){
  MODE="cloud";
  currentUser={id:u.uid, name:u.displayName||u.email, email:u.email||"", picture:u.photoURL||""};
  paintUser(); showApp();
  await loadState();
  if(typeof window.pageRender === 'function') window.pageRender();
}
function setUserLocal(u){
  MODE="local";
  currentUser=u;
  try{ localStorage.setItem(SESSION_KEY, JSON.stringify(u)); }catch(e){}
  paintUser(); showApp();
  loadStateLocal();
  if(typeof window.pageRender === 'function') window.pageRender();
}
function paintUser(){
  const ub=document.getElementById('userBox');
  if(ub) ub.innerHTML=(currentUser.picture?`<img src="${currentUser.picture}">`:"")+`<span>${escapeHtml(currentUser.name)}</span>`;
  const mp=document.getElementById('modePill');
  if(mp){
    if(MODE==="cloud"){ mp.textContent="Cloud synced"; mp.className="pill cloud"; }
    else{ mp.textContent="Local only"; mp.className="pill local"; }
  }
  const ft=document.getElementById('footer');
  if(ft) ft.textContent = MODE==="cloud"
    ? "Signed in as "+currentUser.email+" — data synced across your devices."
    : "Guest mode — data stored only in this browser. Sign in for cross-device sync.";
}
function signOut(){
  if(MODE==="cloud" && auth){ auth.signOut(); }
  try{ localStorage.removeItem(SESSION_KEY); }catch(e){}
  isGuest=false; currentUser=null; MODE="local";
  showOverlay();
}

/* ---------- Storage ---------- */
function localKey(){ return "calorieTracker_v3_"+(currentUser?currentUser.id:"none"); }
function loadStateLocal(){
  try{ const raw=localStorage.getItem(localKey()); if(raw){ const s=JSON.parse(raw); state={goal:s.goal||2000, goals:s.goals||{...DEFAULT_GOALS}, profile:s.profile||null, fasting:s.fasting||null, favourites:s.favourites||[], entries:s.entries||[]}; return; } }catch(e){}
  state={goal:2000, goals:{...DEFAULT_GOALS}, profile:null, fasting:null, favourites:[], entries:[]};
}
function saveStateLocal(){ try{ localStorage.setItem(localKey(), JSON.stringify(state)); }catch(e){ alert("Could not save locally (storage full). Use Export to back up."); } }

async function loadState(){
  if(MODE==="cloud"){
    setSync("Loading from cloud…");
    try{
      const uref=db.collection("users").doc(currentUser.id);
      const meta=await uref.get();
      const md=meta.exists?meta.data():null;
      state.goal=(md&&md.goal)||2000;
      state.goals=(md&&md.goals)||{...DEFAULT_GOALS};
      state.profile=(md&&md.profile)||null;
      state.fasting=(md&&md.fasting)||null;
      state.favourites=(md&&md.favourites)||[];
      const snap=await uref.collection("entries").get();
      state.entries=snap.docs.map(d=>({id:d.id, ...d.data()}));
      setSync("");
    }catch(e){ setSync("Cloud load error: "+e.message); }
  }else{
    loadStateLocal();
  }
}
async function persistGoals(){
  if(MODE==="cloud"){
    setSync("Saving…");
    try{ await db.collection("users").doc(currentUser.id).set({goal:state.goal, goals:state.goals, profile:state.profile||null, fasting:state.fasting||null, favourites:state.favourites||[]}, {merge:true}); setSync("Saved ✓"); }
    catch(e){ setSync("Save error: "+e.message); }
  }else saveStateLocal();
}
async function persistAddEntry(entry){
  if(MODE==="cloud"){
    setSync("Saving meal…");
    try{
      const {id, ...data}=entry;
      const ref=await db.collection("users").doc(currentUser.id).collection("entries").add(data);
      entry.id=ref.id;
      setSync("Saved ✓");
    }catch(e){ setSync("Save error: "+e.message); }
  }else saveStateLocal();
}
async function persistDeleteEntry(id){
  if(MODE==="cloud"){
    try{ await db.collection("users").doc(currentUser.id).collection("entries").doc(id).delete(); }
    catch(e){ setSync("Delete error: "+e.message); }
  }else saveStateLocal();
}
async function persistUpdateEntry(entry){
  if(MODE==="cloud" && entry.id && entry.id.indexOf("tmp_")!==0){
    setSync("Updating…");
    try{ const {id, ...data}=entry; await db.collection("users").doc(currentUser.id).collection("entries").doc(id).set(data); setSync("Saved ✓"); }
    catch(e){ setSync("Update error: "+e.message); }
  }else saveStateLocal();
}
function setSync(msg){ const el=document.getElementById('syncMsg'); if(el) el.textContent=msg; if(msg==="Saved ✓") setTimeout(()=>{ if(el&&el.textContent==="Saved ✓") el.textContent=""; },1500); }

/* ---------- Date helpers ---------- */
function todayStr(){ return localISO(new Date()); }
function localISO(d){ return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,'0')+"-"+String(d.getDate()).padStart(2,'0'); }
function nowTime(){ const d=new Date(); return String(d.getHours()).padStart(2,'0')+":"+String(d.getMinutes()).padStart(2,'0'); }
function prettyDate(s){ const [y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'}); }

/* ---------- Generic helpers ---------- */
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function numVal(id){ const v=parseInt(document.getElementById(id).value,10); return isNaN(v)?0:Math.max(0,v); }
function defaultMealForTime(timeStr){
  if(!timeStr) return "snack";
  const [hh] = timeStr.split(':').map(Number);
  if(hh>=5 && hh<11) return "breakfast";
  if(hh>=11 && hh<16) return "lunch";
  if(hh>=18 && hh<23) return "dinner";
  return "snack";
}
function mealLabel(m){ return m ? (m.charAt(0).toUpperCase()+m.slice(1)) : ""; }
function favKey(name){ return (name||'').trim().toLowerCase(); }
function isFavourite(name){ return !!(state.favourites||[]).find(f=>favKey(f.name)===favKey(name)); }

/* ---------- Day aggregation ---------- */
function dayEntries(date){ return state.entries.filter(e=>e.date===date); }
function totalFor(date){ return dayEntries(date).reduce((s,e)=>s+(e.calories||0),0); }
function macroTotals(date){ return dayEntries(date).reduce((a,e)=>({p:a.p+(e.protein||0),c:a.c+(e.carbs||0),f:a.f+(e.fat||0),fb:a.fb+(e.fiber||0),sg:a.sg+(e.sugar||0)}),{p:0,c:0,f:0,fb:0,sg:0}); }

/* ---------- Fasting helpers (used by Fasting page + small streak chip elsewhere) ---------- */
function ensureFasting(){
  if(!state.fasting) state.fasting = {protocol:"16:8", current:null, history:[]};
  if(!state.fasting.history) state.fasting.history = [];
  return state.fasting;
}
function currentStage(elapsedH){
  let stage = FAST_STAGES[0];
  for(const s of FAST_STAGES) if(elapsedH >= s.atH) stage = s;
  return stage;
}
function computeStreak(history){
  const hits = (history || []).filter(h => h.achievedHours >= h.targetHours);
  if(!hits.length) return 0;
  const days = new Set(hits.map(h => (h.end || '').slice(0, 10)));
  const today = new Date(); today.setHours(0,0,0,0);
  let streak = 0;
  for(let i = 0; i < 365; i++){
    const d = new Date(today); d.setDate(d.getDate() - i);
    const dStr = localISO(d);
    if(days.has(dStr)) streak++;
    else if(i === 0) continue;
    else break;
  }
  return streak;
}

/* ---------- Export to Excel-compatible CSV (used by every page's toolbar) ---------- */
function exportData(){
  if(!state.entries || !state.entries.length){ alert("No meals to export yet."); return; }
  const header = ['Date','Time','Dish','Servings','Calories (kcal)','Protein (g)','Carbs (g)','Fat (g)','Fiber (g)','Sugar (g)'];
  const sorted = state.entries.slice().sort((a,b)=>{
    const ad=(a.date||'')+'T'+(a.time||''); const bd=(b.date||'')+'T'+(b.time||'');
    return ad.localeCompare(bd);
  });
  const csvEscape = v => {
    const s = (v==null ? '' : String(v));
    return /[",\n\r]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s;
  };
  const rows = [header];
  for(const e of sorted){
    rows.push([
      e.date||'', e.time||'', e.name||'',
      e.qty||1,
      e.calories||0, e.protein||0, e.carbs||0, e.fat||0, e.fiber||0, e.sugar||0
    ]);
  }
  const totCal = sorted.reduce((s,e)=>s+(e.calories||0),0);
  const totP = sorted.reduce((s,e)=>s+(e.protein||0),0);
  const totC = sorted.reduce((s,e)=>s+(e.carbs||0),0);
  const totF = sorted.reduce((s,e)=>s+(e.fat||0),0);
  const totFb = sorted.reduce((s,e)=>s+(e.fiber||0),0);
  const totSg = sorted.reduce((s,e)=>s+(e.sugar||0),0);
  rows.push([]);
  rows.push(['TOTAL','','','',totCal,totP,totC,totF,totFb,totSg]);
  rows.push(['Daily goal','','','',state.goal,state.goals.protein,state.goals.carbs,state.goals.fat,state.goals.fiber,state.goals.sugar||36]);
  const csv = rows.map(r => r.map(csvEscape).join(',')).join('\r\n');
  const blob = new Blob(['﻿'+csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = "darsh-fitness-"+todayStr()+".csv";
  a.click();
  URL.revokeObjectURL(url);
}

/* ---------- Update the goal pill in the header (used by all pages) ---------- */
function paintGoalPill(){
  const el = document.getElementById('goalPill');
  if(el) el.textContent = `Goal: ${state.goal} kcal`;
}

/* ---------- Anonymous visit counter (one ping per browser, ever) ---------- */
(function trackVisit(){
  try{
    if(localStorage.getItem('df_visited_v1')) return;
    localStorage.setItem('df_visited_v1','1');
    fetch(AI_NUTRITION_URL.replace(/\/$/,'')+'/visit',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).catch(()=>{});
  }catch(e){}
})();

/* ---------- Auto-boot on every page ---------- */
window.addEventListener('load', boot);
