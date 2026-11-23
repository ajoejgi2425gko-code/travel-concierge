(()=>{'use strict';
const $=id=>document.getElementById(id), KEY='travel-concierge-plans-v2', BACKUP_VERSION=2, BACKUP_STAMP='travel-concierge-last-backup-v25', BACKUP_RESTORE='travel-concierge-restore-pending-v26';
const uid=()=>globalThis.crypto?.randomUUID?.()||'id-'+Date.now()+'-'+Math.random().toString(36).slice(2);
const today=()=>localISO(new Date());
const localISO=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const nextDate=(s,days=1)=>{const d=new Date(s+'T12:00:00');d.setDate(d.getDate()+days);return localISO(d);};
const safe=s=>String(s??'').trim();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateOK=s=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T12:00:00');return !Number.isNaN(d.getTime())&&d.getFullYear()===+s.slice(0,4)&&d.getMonth()+1===+s.slice(5,7)&&d.getDate()===+s.slice(8,10);};
const timeOK=s=>/^([01]\d|2[0-3]):[0-5]\d$/.test(s);
const fmtDate=s=>dateOK(s)?new Date(s+'T00:00:00').toLocaleDateString('ja-JP',{month:'long',day:'numeric',weekday:'short'}):'日付未設定';
const newPlan=()=>({id:uid(),title:'新しい旅行プラン',start:'',end:'',destination:'',items:[],packing:[],created:Date.now(),updated:Date.now(),timezone:'Asia/Tokyo',travelInfo:'',tripContext:{},packPrefs:{mode:'auto',types:[],withKids:false,region:'domestic',regionMode:'follow'}});
let plans=[],active=null,importCandidates=[],lastPackPlan=null,lastPackSignature=null,pendingSync=null,shareAction=null,lastSuggestionContext=null,shareSnapshot=null;
const itemKey=x=>[x.date,x.time,x.title,x.place].map(v=>safe(v).replace(/\s+/g,'').toLowerCase()).join('|');
const stored=()=>{try{return JSON.stringify(plans)===localStorage.getItem(KEY);}catch{return false;}};
function normalizeContext(c){const x=c&&typeof c==='object'?c:{};return {interests:Array.isArray(x.interests)?x.interests.map(safe).slice(0,20):[],styles:Array.isArray(x.styles)?x.styles.map(safe).slice(0,20):[],transport:safe(x.transport).slice(0,80),area:['国内旅行','海外旅行','国内・海外どちらも候補'].includes(x.area)?x.area:'',children:Math.max(0,Math.min(30,parseInt(x.children,10)||0))};}
function captureTripContext(){return normalizeContext({interests:[...document.querySelectorAll('#interests input:checked')].map(x=>x.value),styles:[...document.querySelectorAll('#styles input:checked')].map(x=>x.value),transport:$('transport')?.value,area:$('area')?.value,children:$('children')?.value});}
function normalizePackPrefs(v,c){const x=v&&typeof v==='object'?v:{};const allowed=['snow','beach','outdoor','themepark'];return {mode:x.mode==='manual'?'manual':x.mode==='auto'?'auto':Array.isArray(x.types)&&x.types.length?'manual':'auto',types:[...new Set(Array.isArray(x.types)?x.types.filter(t=>allowed.includes(t)):[])],withKids:typeof x.withKids==='boolean'?x.withKids:!!c.children,region:['domestic','overseas'].includes(x.region)?x.region:'domestic',regionMode:x.regionMode==='manual'?'manual':'follow'};}
function normalizePlan(p){if(!p||typeof p!=='object')throw Error('プラン形式が不正です');return {id:safe(p.id)||uid(),title:safe(p.title).slice(0,120)||'旅行プラン',start:dateOK(p.start)?p.start:'',end:dateOK(p.end)?p.end:'',destination:safe(p.destination).slice(0,200),timezone:safe(p.timezone)||'Asia/Tokyo',travelInfo:safe(p.travelInfo).slice(0,3000),tripContext:normalizeContext(p.tripContext),packPrefs:normalizePackPrefs(p.packPrefs,normalizeContext(p.tripContext)),items:(Array.isArray(p.items)?p.items:[]).slice(0,300).map(x=>({id:safe(x.id)||uid(),date:dateOK(x.date)?x.date:'',time:timeOK(x.time)?x.time:'',endTime:timeOK(x.endTime)?x.endTime:'',title:safe(x.title).slice(0,250),place:safe(x.place).slice(0,250),note:safe(x.note).slice(0,2000)})).filter(x=>x.title),packing:(Array.isArray(p.packing)?p.packing:[]).slice(0,250).map(x=>({id:safe(x.id)||uid(),name:safe(x.name).slice(0,120),done:!!x.done})).filter(x=>x.name),created:Number(p.created)||Date.now(),updated:Number(p.updated)||Date.now()};}
function load(){try{const raw=localStorage.getItem(KEY);if(raw){const data=JSON.parse(raw);plans=(Array.isArray(data)?data:[]).slice(0,40).map(normalizePlan);}}catch(e){notify('保存データを読み込めませんでした。バックアップを確認してください。',true);}active=plans[0]?.id||null;}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(plans));return true;}catch(e){notify('保存に失敗しました。画面を閉じる前にバックアップを保存してください。',true);return false;}}
function notify(t,error=false){const el=$('plannerStatus');el.textContent=t;el.style.color=error?'#a83b3b':'#176b62';}
function current(){return plans.find(p=>p.id===active)||null;}
function update(fn){const p=current();if(!p){notify('先に旅行プランを作成してください。',true);return;}const before=JSON.stringify(plans);fn(p);p.updated=Date.now();if(!persist()){plans=JSON.parse(before);render();return false;}render();return true;}
function createFromForm(){const p=newPlan();p.start=$('startDate').value;p.end=$('endDate').value;p.destination=$('destination').value.trim();p.title=p.destination?(p.destination+'旅行'):'新しい旅行プラン';p.tripContext=captureTripContext();p.packPrefs=normalizePackPrefs(null,p.tripContext);if(p.tripContext.area==='海外旅行')p.packPrefs.region='overseas';plans.unshift(p);active=p.id;if(!persist()){plans.shift();active=plans[0]?.id||null;render();return false;}render();notify('旅行プランを作成しました。保存一覧の「バックアップを保存」から予備データを保管できます。');return true;}
// 新規プラン・予定取り込み時はAI相談の入力を引き継ぐ。既存値は自動上書きしない。
function fillMissingConsultation(plan){
 const incoming=consultationFields(),ctx=normalizeContext(plan.tripContext);
 const wasContextEmpty=!ctx.interests.length&&!ctx.styles.length&&!ctx.area&&!ctx.transport&&ctx.children===0;
 const filled=[];
 for(const key of ['destination','start','end']){
  const value=incoming[key];
  if(!safe(plan[key])&&safe(value)&&(!['start','end'].includes(key)||dateOK(value))){
   if(key==='end'&&plan.start&&value<plan.start)continue;
   if(key==='start'&&plan.end&&value>plan.end)continue;
   plan[key]=value;filled.push(key);
  }
 }
 for(const key of ['interests','styles','transport','area','children']){
  const value=incoming[key];
  if(key==='children'){
   // 0人も有効な入力。既存設定が未入力だったプランだけ補完。
   if(wasContextEmpty&&value>0){ctx.children=value;filled.push(key);}
  }else if(Array.isArray(value)){
   if(!ctx[key].length&&value.length){ctx[key]=[...value];filled.push(key);}
  }else if(!safe(ctx[key])&&safe(value)){
   ctx[key]=value;filled.push(key);
  }
 }
 plan.tripContext=ctx;
 if(ctx.children>0&&!plan.packPrefs.withKids)plan.packPrefs.withKids=true;
 if(plan.packPrefs.regionMode!=='manual'&&ctx.area==='海外旅行')plan.packPrefs.region='overseas';
 return filled;
}
function render(){const p=current();$('planPicker').innerHTML=plans.map(x=>`<option value="${esc(x.id)}">${esc(x.title)}（${x.items.length}件）</option>`).join('');$('planPicker').value=p?.id||'';$('planPicker').disabled=!p;
$('planEmpty').hidden=!!p;$('planEditor').hidden=!p;if(!p){renderBackupNotice();return;}
$('travelInfo').value=p.travelInfo||'';$('planTitle').value=p.title;$('planStart').value=p.start;$('planEnd').value=p.end;$('planDestination').value=p.destination;if($('calendarTimezone'))$('calendarTimezone').value=[...$('calendarTimezone').options].some(o=>o.value===p.timezone)?p.timezone:'Asia/Tokyo';
const sorted=[...p.items].sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999')||(a.time||'99').localeCompare(b.time||'99'));
const groups=new Map();sorted.forEach(x=>{const k=x.date||'日付未設定';if(!groups.has(k))groups.set(k,[]);groups.get(k).push(x);});
$('itineraryList').innerHTML=sorted.length?[...groups].map(([day,items])=>`<div class="tc-day"><h4>${esc(day==='日付未設定'?day:fmtDate(day))} <small>${items.length}件</small></h4>${items.map(x=>`<article class="tc-item"><div class="tc-time">${esc(x.time||'時刻未定')}${x.endTime?' – '+esc(x.endTime):''}</div><div class="tc-item-main"><strong>${esc(x.title)}</strong>${x.place?`<div class="tc-muted">📍 ${esc(x.place)}</div>`:''}${x.note?`<div class="tc-muted">${esc(x.note)}</div>`:''}</div><div class="tc-item-actions"><button type="button" data-edit="${esc(x.id)}">編集</button><button type="button" data-remove="${esc(x.id)}">削除</button></div></article>`).join('')}</div>`).join(''):'<p class="tc-muted">予定はまだありません。AI回答を取り込むか、手動で追加してください。</p>';
$('packingList').innerHTML=p.packing.length?p.packing.map(x=>`<div class="tc-pack-row"><label><input type="checkbox" data-pack="${esc(x.id)}" ${x.done?'checked':''}><span class="${x.done?'tc-done':''}">${esc(x.name)}</span></label><button type="button" data-packremove="${esc(x.id)}" aria-label="${esc(x.name)}を削除">削除</button></div>`).join(''):'<p class="tc-muted">持ち物を追加するか、テンプレートを使ってください。</p>';
const dates=[...new Set(p.items.map(x=>x.date).filter(dateOK))].sort();const picker=$('mapDay'),selected=picker.value;picker.innerHTML='<option value="all">全日程</option>'+dates.map(d=>`<option value="${d}">${esc(fmtDate(d))}</option>`).join('');picker.value=dates.includes(selected)?selected:(dates[0]||'all');renderPackContext(p);$('packCount').textContent=`${p.packing.filter(x=>x.done).length} / ${p.packing.length} 完了`;renderBackupNotice();
}
function renderBackupNotice(){const el=$('backupNotice');if(!el)return;let stamp=0;try{stamp=Number(localStorage.getItem(BACKUP_STAMP))||0;}catch{}const latest=Math.max(0,...plans.map(p=>Number(p.updated)||0));let restored=false;try{restored=localStorage.getItem(BACKUP_RESTORE)==='1';}catch{}el.textContent=restored?'バックアップから復元したデータです。現在のプランを改めてバックアップし、ダウンロード先のファイルを確認してください。':!stamp?'バックアップのダウンロード操作履歴がありません。大切な旅行プランはファイルを保存し、端末のダウンロード先で確認してください。':latest>stamp?'前回のバックアップ確認後に変更があります。もう一度バックアップを取得し、ファイルの保存を確認してください。':'前回のバックアップ保存確認：'+new Date(stamp).toLocaleString('ja-JP')+'（ファイルが実際に保存されたか、端末のダウンロード先をご確認ください）';}
const PACK_BASE=['財布・現金','スマートフォン・充電器','身分証・保険証','交通・宿泊の予約情報','着替え・下着','洗面用具・歯ブラシ','常備薬','雨具','ハンカチ・ティッシュ','飲み物','モバイルバッテリー'];
const PACK_TYPES={snow:['防寒着・インナー','防水手袋','雪用ブーツ・滑り止め','厚手の靴下・予備','ネックウォーマー','カイロ','保湿用品'],beach:['水着','ラッシュガード','日焼け止め','ビーチサンダル','大きめのタオル','防水バッグ','着替え用の袋'],outdoor:['歩きやすい靴','帽子','虫よけ','日焼け止め','レジャーシート','携帯用ごみ袋'],themepark:['入場チケット・QRコード','モバイルバッテリー','折りたたみ雨具','待ち時間用の飲み物','歩きやすい靴'],normal:[]};
const PACK_KIDS=['子どもの着替え・下着','子どもの飲み物・おやつ','ウェットティッシュ','子どもの保険証等','暇つぶしグッズ'];
const PACK_LABELS={snow:'雪遊び・スキー',beach:'海・プール',outdoor:'アウトドア',themepark:'テーマパーク'};
const PACK_RULES=[['snow',/スキー|雪遊び|スノー|スノボ|ski|snow/i],['beach',/海水浴|ビーチ|プール|シュノーケル|水遊び/i],['themepark',/ディズニー|usj|ユニバーサル|テーマパーク|遊園地/i],['outdoor',/登山|ハイキング|キャンプ|トレッキング|アウトドア/i]];
function autoPackTypes(p){const c=p.tripContext||{},parts=[['旅行先',p.destination],['プラン名',p.title],['興味',...(c.interests||[])],['旅行スタイル',...(c.styles||[])],['旅程',...p.items.map(x=>x.title+' '+x.place)]];const matches=[];for(const [type,pattern] of PACK_RULES){const reasons=parts.filter(([key,...vals])=>vals.some(v=>pattern.test(String(v||'')))).map(x=>x[0]);if(reasons.length)matches.push({type,reasons:[...new Set(reasons)]});}return matches;}
function formatPackValue(v){if(Array.isArray(v))return v.join('、')||'未設定';return safe(v)||'未設定';}
function savedPackFields(p){const c=p.tripContext||{};return [['destination','旅行先',p.destination],['start','出発日',p.start],['end','帰着日',p.end],['interests','興味',c.interests||[]],['styles','旅行スタイル',c.styles||[]],['transport','移動手段',c.transport],['area','旅行先の区分',c.area||'未設定'],['children','子どもの人数',String(c.children||0)+'人']];}
function renderPackContext(p){
 const suggestionContext=JSON.stringify([p.id,p.destination,p.start,p.end,p.tripContext,p.packPrefs,p.items.map(x=>[x.title,x.place])]);
 if(lastSuggestionContext!==null&&lastSuggestionContext!==suggestionContext){$('packSuggestions').hidden=true;$('packSuggestionList').innerHTML='';}
 lastSuggestionContext=suggestionContext;
 const fields=savedPackFields(p);$('packSavedContext').innerHTML=fields.map(([,label,value])=>`<div class="tc-pack-context-cell"><small>${esc(label)}</small><strong>${esc(formatPackValue(value))}</strong></div>`).join('');
 const signature=JSON.stringify(normalizePackPrefs(p.packPrefs,p.tripContext));
 if(lastPackPlan!==p.id||lastPackSignature!==signature){const pref=normalizePackPrefs(p.packPrefs,p.tripContext);document.querySelectorAll('[data-pack-type]').forEach(el=>{el.checked=pref.types.includes(el.value);});document.querySelectorAll('[name="packMode"]').forEach(el=>{el.checked=el.value===pref.mode;});$('packWithKids').checked=pref.withKids;$('packRegion').value=pref.region;$('packRegionMode').value=pref.regionMode;$('packSuggestions').hidden=true;clearPendingSync();$('packSyncResult').textContent='';lastPackPlan=p.id;lastPackSignature=signature;}
 const savedRegion=p.tripContext?.area==='海外旅行'?'overseas':p.tripContext?.area==='国内旅行'?'domestic':null;const regionMode=$('packRegionMode').value;const region=regionMode==='follow'?(savedRegion||'domestic'):$('packRegion').value;$('packRegion').disabled=regionMode==='follow';$('packRegion').value=region;
 $('packRegionNotice').textContent=regionMode==='follow'?(savedRegion?'保存中の旅行条件に連動しています。':'旅行先区分が未設定のため、国内旅行として提案します。必要なら手動で変更してください。'):(savedRegion&&savedRegion!==region?'注意：保存中の旅行条件と異なる区分を手動指定しています。持ち物候補には手動指定を使用します。':'手動指定した区分で持ち物を提案します。');
 const mode=document.querySelector('[name="packMode"]:checked')?.value||'auto';$('packManualTypes').hidden=mode!=='manual';$('packAutoResult').hidden=mode!=='auto';const matches=autoPackTypes(p);$('packAutoResult').innerHTML=matches.length?`<strong>自動判定：${esc(matches.map(x=>PACK_LABELS[x.type]).join('・'))}</strong><div class="tc-muted">${esc(matches.map(x=>PACK_LABELS[x.type]+'（判定元：'+x.reasons.join('・')+'）').join(' ／ '))}</div>`:'<strong>自動判定：一般的な旅行</strong><div class="tc-muted">該当する旅行タイプのキーワードがないため、基本の持ち物を提案します。</div>';
}
function packTypesFor(p){const mode=document.querySelector('[name="packMode"]:checked')?.value||'auto';return mode==='manual'?[...document.querySelectorAll('[data-pack-type]:checked')].map(x=>x.value):autoPackTypes(p).map(x=>x.type);}
function showPackSuggestions(){
 const p=current();if(!p){notify('先に旅行プランを作成してください。',true);return;}
 const types=packTypesFor(p),month=Number((p.start||'').slice(5,7));
 let names=[...PACK_BASE,...types.flatMap(type=>PACK_TYPES[type]||[])];
 const overseas=$('packRegion').value==='overseas';
 if(overseas){names.push('パスポート・有効期限確認','渡航先の入国条件・ビザ確認','海外旅行保険・緊急連絡先','現地通貨・決済手段','変換プラグ・充電器の電圧確認');}
 // Japanese calendar months alone cannot reliably determine climate abroad.
 if(!overseas){if(month>=6&&month<=9)names.push('日焼け止め・帽子');if([12,1,2].includes(month))names.push('防寒着');}
 if($('packWithKids').checked)names.push(...PACK_KIDS);
 const existing=new Set(p.packing.map(x=>x.name));names=[...new Set(names)].filter(x=>!existing.has(x));
 $('packSuggestionInfo').textContent=names.length?`${names.length}件の候補があります。必要なものだけ選んで追加してください。${overseas?'渡航条件・現地の気候・入国書類は必ず最新情報を確認してください。':'季節の判定は日本国内の目安です。現地の天候に合わせて調整してください。'}`:'候補はすべて登録済みです。';
 $('packSuggestionList').innerHTML=names.map(n=>`<label class="tc-pack-suggestion"><input type="checkbox" data-pack-suggest="${esc(n)}" checked><span>${esc(n)}</span></label>`).join('');
 $('packSuggestions').hidden=false;
}
function savePackPrefs(){if(!current())return;const types=[...document.querySelectorAll('[data-pack-type]:checked')].map(x=>x.value),mode=document.querySelector('[name="packMode"]:checked')?.value||'auto',withKids=$('packWithKids').checked,region=$('packRegion').value,regionMode=$('packRegionMode').value;const ok=update(p=>{p.packPrefs={mode,types,withKids,region,regionMode};});if(ok){$('packSuggestions').hidden=true;$('packSuggestionList').innerHTML='';notify('持ち物提案の設定を保存しました。候補を表示して確認してください。');}}
const SYNC_FIELDS=[['area','旅行先の区分'],['destination','旅行先'],['start','出発日'],['end','帰着日'],['interests','興味'],['styles','旅行スタイル'],['transport','移動手段'],['children','子どもの人数']];
function consultationFields(){const c=captureTripContext();return {destination:safe($('destination').value),start:$('startDate').value,end:$('endDate').value,interests:c.interests,styles:c.styles,transport:c.transport,area:c.area,children:c.children};}
function fieldComparable(v){return Array.isArray(v)?JSON.stringify([...v].sort()):String(v??'');}
function clearPendingSync(message=''){
 pendingSync=null;
 $('packSyncPanel').hidden=true;
 $('packDiffList').innerHTML='';
 if(message)$('packSyncResult').textContent=message;
}
function syncConsultation(){
 const p=current();if(!p){notify('先に旅行プランを作成してください。',true);return;}
 const incoming=consultationFields();
 const stored=Object.fromEntries(savedPackFields(p).map(([key,,val])=>[key,key==='children'?p.tripContext?.children||0:key==='area'?p.tripContext?.area||'':val]));
 const changed=SYNC_FIELDS.filter(([key])=>fieldComparable(incoming[key])!==fieldComparable(stored[key]));
 if(!changed.length){clearPendingSync('AI相談の内容は、現在の旅行プランと同じです。');return;}
 // Keep an immutable snapshot of the values the user actually reviewed.
 pendingSync={planId:p.id,planUpdated:p.updated,values:JSON.parse(JSON.stringify(incoming)),fields:changed.map(x=>x[0])};
 $('packSyncPanel').hidden=false;
 $('packDiffList').innerHTML=changed.map(([key,label])=>{
  const v=incoming[key],empty=Array.isArray(v)?!v.length:key==='children'?false:!safe(v);
  return `<label class="tc-pack-diff-row"><input type="checkbox" data-sync-field="${key}" ${empty?'disabled':'checked'}><span><strong>${esc(label)}</strong><small>保存中：${esc(formatPackValue(stored[key]))}</small><small>AI相談：${esc(formatPackValue(key==='children'?String(v)+'人':v))}${empty?'（未入力のため反映不可）':''}</small></span></label>`;
 }).join('');
 $('packSyncResult').textContent=`AI相談の内容から変更したい項目を選んでください。入力を変えた場合はもう一度確認してください。`;
}
function applyConsultation(){
 const p=current(),snapshot=pendingSync;
 if(!p||!snapshot||snapshot.planId!==p.id){clearPendingSync('旅行プランが変更されました。内容をもう一度確認してください。');return;}
 if(snapshot.planUpdated!==p.updated){clearPendingSync('保存済みプランが更新されました。内容をもう一度確認してください。');return;}
 const fields=[...document.querySelectorAll('[data-sync-field]:checked')].map(x=>x.dataset.syncField).filter(x=>snapshot.fields.includes(x));
 if(!fields.length){$('packSyncResult').textContent='反映する項目を選択してください。';return;}
 const incoming=snapshot.values;
 if((fields.includes('start')&&!dateOK(incoming.start))||(fields.includes('end')&&!dateOK(incoming.end))){$('packSyncResult').textContent='日付が正しくありません。';return;}
 const nextStart=fields.includes('start')?incoming.start:p.start,nextEnd=fields.includes('end')?incoming.end:p.end;
 if(nextStart&&nextEnd&&nextEnd<nextStart){$('packSyncResult').textContent='帰着日は出発日以降にしてください。';return;}
 lastPackPlan=null;const ok=update(plan=>{
  const ctx=normalizeContext(plan.tripContext);
  for(const key of fields){if(['destination','start','end'].includes(key))plan[key]=incoming[key];else ctx[key]=incoming[key];}
  plan.tripContext=ctx;
  if(fields.includes('children'))plan.packPrefs={...normalizePackPrefs(plan.packPrefs,ctx),withKids:!!ctx.children};
  if(fields.includes('area')&&plan.packPrefs?.regionMode!=='manual'&&['国内旅行','海外旅行'].includes(ctx.area))plan.packPrefs={...normalizePackPrefs(plan.packPrefs,ctx),region:ctx.area==='海外旅行'?'overseas':'domestic'};
 });
 if(ok){clearPendingSync();$('packSuggestions').hidden=true;$('packSuggestionList').innerHTML='';const labels=fields.map(key=>SYNC_FIELDS.find(x=>x[0]===key)[1]);$('packSyncResult').textContent='反映しました：'+labels.join('・')+'。持ち物候補はまだ追加されていません。';notify('AI相談条件を反映しました：'+labels.join('・'));}
}
function editItem(id){const p=current(),x=p?.items.find(x=>x.id===id);$('itemId').value=x?.id||'';$('itemDate').value=x?.date||p?.start||'';$('itemTime').value=x?.time||'';$('itemEndTime').value=x?.endTime||'';$('itemTitle').value=x?.title||'';$('itemPlace').value=x?.place||'';$('itemNote').value=x?.note||'';$('itemFormTitle').textContent=x?'予定を編集':'予定を追加';$('itemDialog').hidden=false;$('itemTitle').focus();}
function closeItem(){$('itemDialog').hidden=true;$('itemForm').reset();$('itemId').value='';}
function extractJSON(text){const block=text.match(/```(?:json)?\s*([\s\S]*?)```/i);const candidate=block?block[1]:text;const match=candidate.match(/\{[\s\S]*"(?:itinerary|days|schedule)"[\s\S]*\}/);if(!match)return null;try{return JSON.parse(match[0]);}catch{return null;}}
function fromJSON(raw){const out=[];const root=raw.itinerary||raw.schedule||raw.days||[];const days=Array.isArray(root)?root:[];for(const d of days){const day=typeof d==='object'?(d.date||d.day||''):'';const date=dateOK(day)?day:'';const entries=Array.isArray(d.items)?d.items:Array.isArray(d.events)?d.events:Array.isArray(d.schedule)?d.schedule:[];for(const x of entries){if(!x||typeof x!=='object')continue;const title=safe(x.title||x.activity||x.name);if(title)out.push({id:uid(),date:dateOK(x.date)?x.date:date,time:timeOK(x.time)?x.time:'',endTime:timeOK(x.endTime)?x.endTime:'',title,place:safe(x.place||x.location),note:safe(x.note||x.transport)});}}
if(!out.length&&Array.isArray(root)){for(const x of root){if(!x||typeof x!=='object')continue;const title=safe(x.title||x.activity||x.name);if(title)out.push({id:uid(),date:dateOK(x.date)?x.date:'',time:timeOK(x.time)?x.time:'',endTime:'',title,place:safe(x.place||x.location),note:safe(x.note)});}}return out.slice(0,200);}
function parseReadable(text){
const out=[];let inside=false;let seen=false;
for(const raw of text.split(/\r?\n/)){
 if(raw.includes('【旅程一覧ここから】')){inside=true;seen=true;continue;}
 if(raw.includes('【旅程一覧ここまで】')){inside=false;break;}
 if(seen&&!inside)continue;
 const line=raw.trim().replace(/^[-*]\s*/, '');
 const match=line.match(/^(20\d{2}[-\/.]\d{1,2}[-\/.]\d{1,2}|未定)\s*[|｜]\s*(\d{1,2}:\d{2}|未定)\s*[|｜]\s*([^|｜]+?)(?:\s*[|｜]\s*([^|｜]*))?(?:\s*[|｜]\s*(.*))?$/);
 if(!match)continue;
 const date=match[1]==='未定'?'':match[1].replace(/[\/.]/g,'-').replace(/-(\d)(?=-|$)/g,'-0$1');
 const time=match[2]==='未定'?'':match[2].padStart(5,'0');
 const title=safe(match[3]);
 if(title)out.push({id:uid(),date:dateOK(date)?date:'',time:timeOK(time)?time:'',endTime:'',title,place:safe(match[4]),note:safe(match[5])});
}
return out.slice(0,200);
}
function parseText(text){
 const p=current(),out=[];let date=p?.start||$('startDate').value||'',dayIndex=0;
 for(let raw of text.replace(/```(?:json)?[\s\S]*?```/gi,'').split(/\r?\n/)){
  let line=raw.replace(/\*\*/g,'').replace(/^\s*(?:[-*•>]|\d+[.)])\s*/, '').trim();if(!line||/^\|?\s*[-:| ]{3,}\s*\|?$/.test(line))continue;
  const iso=line.match(/(20\d{2})[\/.-](\d{1,2})[\/.-](\d{1,2})/);
  if(iso){const d=`${iso[1]}-${iso[2].padStart(2,'0')}-${iso[3].padStart(2,'0')}`;if(dateOK(d))date=d;}
  const dayMark=line.match(/(?:^|\s)(?:第?\s*(\d+)\s*日目|DAY\s*(\d+))/i);
  if(dayMark){dayIndex=Number(dayMark[1]||dayMark[2]);const base=p?.start||$('startDate').value;if(dateOK(base)&&dayIndex>=1&&dayIndex<=60&&!iso)date=nextDate(base,dayIndex-1);}
  if(/^\|/.test(line)){
   const cols=line.split('|').map(x=>x.trim()).filter(Boolean);
   const timeIdx=cols.findIndex(c=>/^([01]?\d|2[0-3])[:：][0-5]\d$/.test(c));
   if(timeIdx>=0){const time=cols[timeIdx].replace('：',':').padStart(5,'0');const title=cols[timeIdx+1]||'';
    if(title&&!/^(予定|内容|場所|活動|時刻|時間)$/.test(title))out.push({id:uid(),date,time,endTime:'',title,place:cols[timeIdx+2]||'',note:cols.slice(timeIdx+3).join(' / ')});
    if(out.length>=200)break;continue;}
  }
  const m=line.match(/(?:^|\s|[|｜])([01]?\d|2[0-3])[:：]([0-5]\d)(?:\s*[〜～–-]\s*(?:[01]?\d|2[0-3])[:：][0-5]\d)?/);
  if(!m)continue;
  const time=String(+m[1]).padStart(2,'0')+':'+m[2];
  let title=line.slice(m.index+m[0].length).replace(/^[\s|｜:：－–—〜～-]+/,'').trim();
  if(!title||title.length>250||/^(出発日|帰着日|予算|営業時間|チェックイン時刻)/.test(title))continue;
  const parts=title.split(/\s*[|｜]\s*/);out.push({id:uid(),date,time,endTime:'',title:parts[0],place:parts[1]||'',note:parts.slice(2).join(' / ')});
  if(out.length>=200)break;
 }
 return out;
}
function previewImport(){
 const text=$('aiAnswer').value.trim();if(!text){notify('AIの回答を貼り付けてください。',true);return;}
 let json=null;try{json=extractJSON(text);}catch{}
 importCandidates=parseReadable(text);
 let method='旅程一覧';if(!importCandidates.length&&json){importCandidates=fromJSON(json);method='以前のJSON形式';}
 if(!importCandidates.length){importCandidates=parseText(text);method='文章・表形式';}
 const existing=new Set((current()?.items||[]).map(itemKey));const unique=new Set();let duplicateCount=0;
 importCandidates=importCandidates.filter(x=>{const k=itemKey(x);if(existing.has(k)||unique.has(k)){duplicateCount++;return false;}unique.add(k);return true;});
 $('importPreview').hidden=false;
 const missingDate=importCandidates.filter(x=>!dateOK(x.date)).length, missingTime=importCandidates.filter(x=>!timeOK(x.time)).length;
 $('importQuality').textContent=importCandidates.length?`読み取り：${importCandidates.length}件 ／ 日付未設定：${missingDate}件 ／ 時刻未設定：${missingTime}件。未設定の項目は「編集」から補えます。`:'予定を読み取れませんでした。AIに再整形を依頼するか、予定を手動で追加してください。';
 $('importPreviewList').innerHTML=importCandidates.length?importCandidates.map((x,i)=>`<div class="tc-import-edit"><div class="tc-import-summary"><label class="tc-import-select"><input type="checkbox" data-import="${i}" checked> <span class="tc-import-summary-text">${esc(x.date||'日付未定')} ${esc(x.time||'時刻未定')}｜${esc(x.title)}${x.place?' 📍'+esc(x.place):''}</span></label><button type="button" class="secondary-button tc-edit-toggle" data-toggle-import="${i}" aria-expanded="false">編集</button></div><div class="tc-import-fields" id="import-fields-${i}" hidden><label>日付<input type="date" data-field="date" data-index="${i}" value="${esc(x.date)}"></label><label>時刻<input type="time" data-field="time" data-index="${i}" value="${esc(x.time)}"></label><label>予定名<input type="text" data-field="title" data-index="${i}" maxlength="250" value="${esc(x.title)}"></label><label>場所<input type="text" data-field="place" data-index="${i}" maxlength="250" value="${esc(x.place)}"></label><label class="tc-wide">メモ<input type="text" data-field="note" data-index="${i}" maxlength="2000" value="${esc(x.note)}"></label></div></div>`).join(''):'<p class="tc-muted">読み取れる予定がありませんでした。回答全文を貼り付けるか、日付と時刻のある旅程一覧をAIに作成してもらってください。手動追加も可能です。</p>';
 $('confirmImport').disabled=!importCandidates.length;$('reformatHelp').hidden=!!importCandidates.length;
 notify(`${method}から${importCandidates.length}件の新しい予定を検出しました。${duplicateCount?'重複'+duplicateCount+'件は除外しました。':''}内容を確認して追加してください。`,!importCandidates.length);
 $('importPreview').scrollIntoView({behavior:'smooth',block:'nearest'});
}
function download(name,content,type){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}
function icsEscape(s){return String(s||'').replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');}
function icsDate(s){return s.replaceAll('-','');}
// 指定された旅行先の現地時刻をUTCに変換してICSに記録する。
function zoneParts(ms,zone){const f=new Intl.DateTimeFormat('en-US',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});const v=Object.fromEntries(f.formatToParts(new Date(ms)).filter(x=>x.type!=='literal').map(x=>[x.type,Number(x.value)]));return Date.UTC(v.year,v.month-1,v.day,v.hour,v.minute,v.second);}
function zonedUTC(date,time,zone){const [y,m,d]=date.split('-').map(Number),[h,min]=time.split(':').map(Number);const wall=Date.UTC(y,m-1,d,h,min);let guess=wall;for(let i=0;i<5;i++){const delta=wall-zoneParts(guess,zone);if(!delta)break;guess+=delta;}if(zoneParts(guess,zone)!==wall)throw Error('この時刻は現地の夏時間切替により存在しない可能性があります');return guess;}
function icsUTC(ms){return new Date(ms).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');}
function calendar(){
 const p=current();if(!p)return;const events=p.items.filter(x=>dateOK(x.date));if(!events.length){notify('カレンダー登録には日付のある予定が必要です。',true);return;}
 const zone=$('calendarTimezone').value, now=icsUTC(Date.now());let lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Travel Concierge//JA','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:'+icsEscape(p.title)];
 try{events.forEach(x=>{const ev=['BEGIN:VEVENT','UID:'+x.id.replace(/[^a-zA-Z0-9-]/g,'')+'@travel-concierge','DTSTAMP:'+now];
 if(timeOK(x.time)){const start=zonedUTC(x.date,x.time,zone);let end;if(timeOK(x.endTime)){end=zonedUTC(x.date,x.endTime,zone);if(end<=start)end=zonedUTC(nextDate(x.date),x.endTime,zone);}else end=start+3600000;ev.push('DTSTART:'+icsUTC(start),'DTEND:'+icsUTC(end));}
 else ev.push('DTSTART;VALUE=DATE:'+icsDate(x.date),'DTEND;VALUE=DATE:'+icsDate(nextDate(x.date)));
 ev.push('SUMMARY:'+icsEscape(x.title),'LOCATION:'+icsEscape(x.place),'DESCRIPTION:'+icsEscape(x.note),'END:VEVENT');lines.push(...ev);});}catch(e){notify('カレンダー出力を中止しました：'+e.message,true);return;}
 lines.push('END:VCALENDAR');download('旅行予定.ics',lines.join('\r\n')+'\r\n','text/calendar;charset=utf-8');notify(`${events.length}件を「${zone}」の現地時刻として出力しました。カレンダーに取り込んだ後、時刻をご確認ください。`);
}
function mapRouteUrl(places,mode){if(places.length===1)return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(places[0]);return 'https://www.google.com/maps/dir/?api=1&origin='+encodeURIComponent(places[0])+'&destination='+encodeURIComponent(places[places.length-1])+(places.length>2?'&waypoints='+encodeURIComponent(places.slice(1,-1).join('|')):'')+'&travelmode='+encodeURIComponent(mode);}
function mapSegments(places,limit=10){const chunks=[];for(let i=0;i<places.length;){const segment=places.slice(i,i+limit);if(!segment.length)break;chunks.push(segment);if(i+limit>=places.length)break;i+=limit-1;}return chunks;}
function maps(){const p=current();if(!p)return;const chosen=$('mapDay').value;const places=[...p.items].filter(x=>x.place&&(chosen==='all'||x.date===chosen)).sort((a,b)=>(a.date||'').localeCompare(b.date||'')||(a.time||'').localeCompare(b.time||'')).map(x=>x.place);if(!places.length){notify('地図を開くには、予定に訪問先の場所を入力してください。',true);return;}const routePlaces=places.filter((place,i)=>i===0||place!==places[i-1]);const mode=$('mapTravelMode')?.value||'driving', segments=mapSegments(routePlaces);const list=$('mapRouteSegments');list.innerHTML='';segments.forEach((segment,i)=>{const a=document.createElement('a');a.href=mapRouteUrl(segment,mode);a.target='_blank';a.rel='noopener noreferrer';a.className='tc-route-link';a.textContent=`ルート${i+1}（${segment.length}地点：${segment[0]} → ${segment[segment.length-1]}）を開く`;list.appendChild(a);});list.hidden=false;notify(`${segments.length}区間のルートを用意しました。各リンクからGoogleマップで開けます。地点の順序と交通手段を確認してください。`);}
function itineraryText(p,options={}){const lines=[`【${p.title}】`,p.start?'旅行日程：'+p.start+(p.end?' ～ '+p.end:''):'',p.destination?'行き先：'+p.destination:'',p.travelInfo&&options.includeTravelInfo?'旅行メモ：'+p.travelInfo:'','【旅程表】'];[...p.items].sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999')||(a.time||'99').localeCompare(b.time||'99')).forEach(x=>lines.push(`${x.date||'日付未定'} ${x.time||'時刻未定'} ${x.title}${x.place?' @'+x.place:''}${x.note&&options.includeItemNotes?' / '+x.note:''}`));lines.push('','【持ち物】');p.packing.forEach(x=>lines.push((x.done?'☑ ':'☐ ')+x.name));return lines.filter((x,i)=>x||i>0).join('\n');}
function buildPrintHTML(p,options={}){
 if(!p)return ''; const sorted=[...p.items].sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999')||(a.time||'99').localeCompare(b.time||'99'));
 const days=new Map();for(const x of sorted){const day=x.date||'日付未設定';if(!days.has(day))days.set(day,[]);days.get(day).push(x);}
 const blocks=[...days].map(([day,items])=>`<section><h2>${esc(day==='日付未設定'?day:fmtDate(day))}</h2>${items.map(x=>`<article><div class="time">${esc(x.time||'時刻未定')}${x.endTime?'〜'+esc(x.endTime):''}</div><div><strong>${esc(x.title)}</strong>${x.place?`<div>📍 ${esc(x.place)}</div>`:''}${x.note&&options.includeItemNotes?`<small>${esc(x.note)}</small>`:''}</div></article>`).join('')}</section>`).join('');
 const html=`<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(p.title)}｜旅行のしおり</title><style>body{font-family:system-ui,sans-serif;color:#203b39;max-width:760px;margin:30px auto;padding:0 20px;line-height:1.65}h1{color:#176b62;margin-bottom:6px}h2{font-size:1.12rem;border-bottom:2px solid #176b62;padding-bottom:6px;margin-top:30px}section{break-inside:avoid-page}article{display:grid;grid-template-columns:90px 1fr;gap:12px;padding:11px 0;border-bottom:1px solid #e0e7e2;break-inside:avoid}.time{color:#176b62;font-weight:700}small,.sub{color:#60756b}.check{display:inline-block;border:1px solid #777;width:15px;height:15px;margin-right:8px;text-align:center;line-height:14px}@media print{body{margin:8px auto}h2{break-after:avoid}}</style></head><body><h1>${esc(p.title)}</h1><p class="sub">${esc(p.destination)}　${esc(p.start)} ${p.end?'〜 '+esc(p.end):''}</p>${blocks||'<p>予定はまだありません。</p>'}${p.travelInfo&&options.includeTravelInfo?'<h2>旅行の連絡・予約メモ</h2><p>'+esc(p.travelInfo).replace(/\n/g,'<br>')+'</p>':''}<h2>持ち物チェックリスト</h2>${p.packing.length?p.packing.map(x=>`<p><span class="check">${x.done?'✓':''}</span>${esc(x.name)}</p>`).join(''):'<p>持ち物は未登録です。</p>'}<p><small>旅コンシェルジュ｜旅行のしおり　※予約・営業時間は公式情報で確認してください。</small></p></body></html>`;
 return html;
}
function printSheet(options={},snapshot=null){const p=snapshot||current();if(!p)return;const html=buildPrintHTML(p,options);const w=window.open('','_blank');if(!w){notify('ポップアップがブロックされました。ブラウザの設定をご確認ください。',true);return;}w.document.write(html);w.document.close();w.focus();notify('プレビューと同じしおりを別タブで開きました。印刷からPDFに保存できます。');}
async function share(options={},snapshot=null){const p=snapshot||current();if(!p)return;const text=itineraryText(p,options);if(navigator.share){try{await navigator.share({title:p.title,text});notify('共有画面を開きました。');return;}catch(e){if(e.name==='AbortError')return;}}try{await navigator.clipboard.writeText(text);notify('確認した内容をコピーしました。LINEなどに貼り付けて共有できます。');}catch{download('旅行のしおり.txt',text,'text/plain;charset=utf-8');notify('共有用テキストをダウンロードしました。');}}
function previewShare(action){const p=current();if(!p)return;shareAction=action;shareSnapshot=JSON.parse(JSON.stringify(p));const dlg=$('sharePreviewDialog');$('previewIncludeTravelInfo').checked=false;$('previewIncludeItemNotes').checked=false;$('sharePreviewTitle').textContent=action==='print'?'印刷・PDF保存する内容を確認':'共有する内容を確認';$('sharePreviewExecute').textContent=action==='print'?'確認してしおりを開く':'確認して共有・コピー';renderSharePreview();dlg.hidden=false;}
function shareOptions(){return {includeTravelInfo:$('previewIncludeTravelInfo').checked,includeItemNotes:$('previewIncludeItemNotes').checked};}
function renderSharePreview(){const p=shareSnapshot;if(!p)return;const options=shareOptions();$('sharePreviewText').hidden=shareAction==='print';$('sharePrintPreview').hidden=shareAction!=='print';if(shareAction==='print'){$('sharePrintPreview').srcdoc=buildPrintHTML(p,options);}else{$('sharePreviewText').textContent=itineraryText(p,options);}const noteCount=p.items.filter(x=>!!x.note).length;const excluded=[];if(p.travelInfo&&!options.includeTravelInfo)excluded.push('旅行の連絡・予約メモ');if(noteCount&&!options.includeItemNotes)excluded.push(`予定のメモ（${noteCount}件）`);$('sharePrivacySummary').textContent=excluded.length?'現在含めない情報：'+excluded.join('、'):'選択した情報はすべて含まれます。共有先を確認してください。';}
function closeSharePreview(){ $('sharePreviewDialog').hidden=true;shareAction=null;shareSnapshot=null;$('sharePrintPreview').srcdoc='';}
function bind(){load();render();$('newPlan').onclick=createFromForm;$('planPicker').onchange=e=>{active=e.target.value;render();};$('duplicatePlan').onclick=()=>{const p=current();if(!p)return;const n=normalizePlan({...p,id:uid(),title:p.title+'（コピー）',items:p.items.map(x=>({...x,id:uid()})),packing:p.packing.map(x=>({...x,id:uid()}))});const before=plans,oldActive=active;plans=[n,...plans];active=n.id;if(!persist()){plans=before;active=oldActive;render();return;}render();notify('プランを複製しました。');};$('deletePlan').onclick=()=>{const p=current();if(!p||!confirm(`「${p.title}」を削除しますか？元に戻せません。`))return;const before=plans,oldActive=active;plans=plans.filter(x=>x.id!==p.id);active=plans[0]?.id||null;if(!persist()){plans=before;active=oldActive;render();return;}render();notify('プランを削除しました。');};
['planTitle','planStart','planEnd','planDestination'].forEach(id=>$(id).addEventListener('change',()=>update(p=>{p.title=safe($('planTitle').value)||'旅行プラン';p.start=$('planStart').value;p.end=$('planEnd').value;p.destination=safe($('planDestination').value);})));$('addItem').onclick=()=>editItem(null);$('cancelItem').onclick=closeItem;$('itemForm').onsubmit=e=>{e.preventDefault();const title=safe($('itemTitle').value);if(!title){notify('予定名を入力してください。',true);return;}const x={id:$('itemId').value||uid(),date:$('itemDate').value,time:$('itemTime').value,endTime:$('itemEndTime').value,title,place:safe($('itemPlace').value),note:safe($('itemNote').value)};const ok=update(p=>{const i=p.items.findIndex(y=>y.id===x.id);if(i>=0)p.items[i]=x;else p.items.push(x);});if(ok)closeItem();};$('itineraryList').onclick=e=>{const edit=e.target.closest('[data-edit]'),remove=e.target.closest('[data-remove]');if(edit)editItem(edit.dataset.edit);if(remove&&confirm('この予定を削除しますか？'))update(p=>p.items=p.items.filter(x=>x.id!==remove.dataset.remove));};
$('pasteAnswer').onclick=async()=>{try{const t=await navigator.clipboard.readText();if(!t.trim())throw Error('empty');$('aiAnswer').value=t;notify('コピーした文章を貼り付けました。「予定を読み取る」を押してください。');}catch{notify('自動貼り付けが使えません。AIの回答をコピーして、入力欄を長押し（PCならCtrl+V）して貼り付けてください。',true);$('aiAnswer').focus();}};$('parseAnswer').onclick=previewImport;$('copyReformat').onclick=async()=>{const prompt='次の旅行計画を、説明文やMarkdown表ではなく、次の形式で予定1件につき1行に整形してください。日付・時刻が分からなければ「未定」と書いてください。JSONやコードブロックは不要です。\n【旅程一覧ここから】\n2026-11-28 | 08:30 | 出発 | 東京駅 | 移動手段のメモ\n【旅程一覧ここまで】\n以下が元の旅行計画です。\n'+$('aiAnswer').value;try{await navigator.clipboard.writeText(prompt);notify('AIに再整形を依頼する文章をコピーしました。Geminiなどに貼り付けてください。');}catch{$('reformatText').hidden=false;$('reformatText').value=prompt;$('reformatText').focus();$('reformatText').select();notify('自動コピーできませんでした。表示した文章を選択してコピーしてください。',true);}};$('importPreviewList').addEventListener('click',e=>{const btn=e.target.closest('[data-toggle-import]');if(!btn)return;const box=$('import-fields-'+btn.dataset.toggleImport);box.hidden=!box.hidden;btn.textContent=box.hidden?'編集':'閉じる';btn.setAttribute('aria-expanded',String(!box.hidden));});$('importPreviewList').addEventListener('input',e=>{const el=e.target.closest('[data-field][data-index]');if(!el)return;const x=importCandidates[Number(el.dataset.index)];if(x){x[el.dataset.field]=el.value.trim();const row=el.closest('.tc-import-edit');const summary=row?.querySelector('.tc-import-summary-text');if(summary)summary.textContent=`${x.date||'日付未定'} ${x.time||'時刻未定'}｜${x.title}${x.place?' 📍'+x.place:''}`;}});$('confirmImport').onclick=()=>{if(!current()&&!createFromForm())return;const picks=[...document.querySelectorAll('[data-import]:checked')].map(x=>importCandidates[Number(x.dataset.import)]);if(picks.some(x=>!safe(x.title)||x.date&&!dateOK(x.date)||x.time&&!timeOK(x.time))){notify('取り込み候補の日付・時刻・予定名を確認してください。',true);return;}if(!picks.length){notify('取り込む予定を選択してください。',true);return;}const existing=new Set(current().items.map(itemKey));const selectedKeys=new Set();const fresh=picks.filter(x=>{const k=itemKey(x);if(existing.has(k)||selectedKeys.has(k))return false;selectedKeys.add(k);return true;});if(!fresh.length){notify('選択した予定はすでに登録されています。',true);return;}let filledOnImport=[];const saved=update(p=>{filledOnImport=fillMissingConsultation(p);p.items.push(...fresh.map(x=>({...x,id:uid()})));if(!p.start){p.start=picks.find(x=>x.date)?.date||'';}});if(saved){$('importPreview').hidden=true;notify(`${fresh.length}件の予定を旅程表に追加しました。${filledOnImport.length?'AI相談の未設定項目も自動反映しました。':''}`);importCandidates=[];}};$('clearAnswer').onclick=()=>{$('aiAnswer').value='';$('importPreview').hidden=true;importCandidates=[];};
$('travelInfo').addEventListener('change',e=>{if(current())update(p=>{p.travelInfo=safe(e.target.value).slice(0,3000);});});$('addPack').onclick=()=>{const name=safe($('packInput').value);if(!name)return;update(p=>p.packing.push({id:uid(),name,done:false}));$('packInput').value='';};$('packInput').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();$('addPack').click();}};$('packTemplate').onclick=()=>{const names=['財布・現金','スマートフォン・充電器','身分証・保険証','交通・宿泊の予約情報','着替え・下着','洗面用具・歯ブラシ','常備薬','雨具','ハンカチ・ティッシュ','飲み物','子どもの着替え・おやつ','モバイルバッテリー'];update(p=>{const set=new Set(p.packing.map(x=>x.name));names.forEach(name=>{if(!set.has(name))p.packing.push({id:uid(),name,done:false});});});notify('持ち物テンプレートを追加しました。');};$('packingList').onchange=e=>{const x=e.target.closest('[data-pack]');if(x)update(p=>{const item=p.packing.find(y=>y.id===x.dataset.pack);if(item)item.done=x.checked;});};$('packingList').onclick=e=>{const x=e.target.closest('[data-packremove]');if(x)update(p=>p.packing=p.packing.filter(y=>y.id!==x.dataset.packremove));};
$('suggestPack').onclick=showPackSuggestions;document.querySelectorAll('[name="packMode"]').forEach(el=>el.addEventListener('change',savePackPrefs));$('applyConsultation').onclick=applyConsultation;$('cancelConsultation').onclick=()=>clearPendingSync('変更を取り消しました。');document.querySelectorAll('[data-pack-type]').forEach(el=>el.addEventListener('change',savePackPrefs));$('packWithKids').onchange=savePackPrefs;$('packRegion').onchange=savePackPrefs;$('packRegionMode').onchange=savePackPrefs;$('syncConsultation').onclick=syncConsultation;document.querySelectorAll('#tripForm input,#tripForm select,#tripForm textarea').forEach(el=>el.addEventListener('change',()=>{if(pendingSync)clearPendingSync('AI相談条件が変更されました。内容をもう一度確認してください。');}));$('selectAllPackSuggestions').onclick=()=>{document.querySelectorAll('[data-pack-suggest]').forEach(x=>x.checked=true);};$('addSuggestedPack').onclick=()=>{const names=[...document.querySelectorAll('[data-pack-suggest]:checked')].map(x=>x.dataset.packSuggest);if(!names.length){notify('追加したい持ち物を選んでください。',true);return;}let addedCount=0;const ok=update(p=>{const existing=new Set(p.packing.map(x=>x.name));names.forEach(name=>{if(!existing.has(name)){p.packing.push({id:uid(),name,done:false});existing.add(name);addedCount++;}});});if(ok){$('packSuggestions').hidden=true;notify(`${addedCount}件の持ち物を追加しました。${names.length-addedCount}件は登録済みのため追加しませんでした。`);}};$('calendarTimezone').addEventListener('change',e=>{if(current())update(p=>{p.timezone=e.target.value;});});$('openMaps').onclick=maps;['mapDay','mapTravelMode'].forEach(id=>$(id).addEventListener('change',()=>{$('mapRouteSegments').hidden=true;$('mapRouteSegments').innerHTML='';}));$('exportCalendar').onclick=calendar;$('printSheet').onclick=()=>previewShare('print');$('shareSheet').onclick=()=>previewShare('share');$('previewIncludeTravelInfo').onchange=renderSharePreview;$('previewIncludeItemNotes').onchange=renderSharePreview;$('sharePreviewCancel').onclick=closeSharePreview;$('sharePreviewExecute').onclick=()=>{const action=shareAction,opts=shareOptions(),snapshot=shareSnapshot;closeSharePreview();if(action==='print')printSheet(opts,snapshot);else if(action==='share')share(opts,snapshot);};
$('exportBackup').onclick=()=>{download('旅コンシェルジュ_バックアップ.json',JSON.stringify({version:BACKUP_VERSION,exportedAt:new Date().toISOString(),plans},null,2),'application/json;charset=utf-8');renderBackupNotice();$('backupConfirm').hidden=false;notify('バックアップのダウンロードを開始しました。ファイルが保存されたことを確認してください。');};$('backupConfirm').onclick=()=>{if(confirm('端末のダウンロード先に「旅コンシェルジュ_バックアップ.json」が存在することを確認しましたか？')){try{localStorage.setItem(BACKUP_STAMP,String(Date.now()));localStorage.removeItem(BACKUP_RESTORE);}catch{}$('backupConfirm').hidden=true;renderBackupNotice();notify('ファイルの保存確認を記録しました。');}};$('importBackup').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{if(f.size>5e6)throw Error('ファイルが大きすぎます');const data=JSON.parse(await f.text());if(!data||data.version!==BACKUP_VERSION||!Array.isArray(data.plans))throw Error('対応していないバックアップ形式です');const restored=data.plans.slice(0,40).map(normalizePlan);if(!confirm(`バックアップ内の${restored.length}件のプランで現在の保存データを置き換えますか？`))return;const old=plans,oldActive=active;plans=restored;active=plans[0]?.id||null;if(!persist()){plans=old;active=oldActive;render();return;}try{localStorage.setItem(BACKUP_RESTORE,'1');}catch{}lastPackPlan=null;lastPackSignature=null;lastSuggestionContext=null;render();notify('バックアップを復元しました。安全のため、改めてバックアップを取得してください。');}catch(err){notify('バックアップの読み込みに失敗しました：'+err.message,true);}finally{e.target.value='';}};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
})();
