/* Utility dialogs, server reports and browser-local download presets. */
(function(root){
const hints={
 backendUrl:'The address of the PC running JD Share. Same PC: http://localhost:8787. GitHub Pages or phones: use your trusted HTTPS tunnel URL.',
 token:'Copy API_TOKEN from the backend .env. This is the JD Share access token, not your My.JDownloader password.',
 cfg_MYJD_EMAIL:'Register or sign in at my.jdownloader.org. Use the same email in desktop JDownloader → Settings → My.JDownloader.',
 cfg_MYJD_PASSWORD:'Your My.JDownloader account password. Saved on the backend PC; masked here. Use Show password to reveal.',
 cfg_MYJD_DEVICE:'Copy the exact device name in My.JDownloader, e.g. JDownloader@Home-PC. Blank chooses the first device.',
 cfg_API_TOKEN:'Generate a random token here. Save, restart the backend, then save the same token in Browser connection.',
 cfg_UPLOAD_DIR:'Folder on the backend PC for phone uploads, e.g. ./uploads or C:\\Users\\Jamie\\Downloads. It is not the JDownloader destination.',
 cfg_HOST:'Network interface to bind: 0.0.0.0 for network access; 127.0.0.1 for this PC only. Not the public tunnel URL.',
 cfg_PORT:'Port where JD Share listens, usually 8787. Restart after changing. Include it in local backend URLs.',
 cfg_ALLOWED_ORIGINS:'Exact browser origins, separated by commas. For this Pages site: https://jr-repos.github.io (no trailing slash or path).',
 cfg_SHORTCUT_URL:'Optional Apple share link from Shortcuts → Share → Copy iCloud Link, formatted https://www.icloud.com/shortcuts/…'
};
function create({document:doc,api,storage,connection,device,actualDevice,canSwitch,confirm}){
 const $=id=>doc.getElementById(id), pending=new Set();let offset=0, logsData=null, logBusy=false;
 const dates=at=>new Date(at*1000).toLocaleString();
 const text=(tag,value)=>{const e=doc.createElement(tag);e.textContent=value;return e;};
 async function run(key,fn){if(pending.has(key))return;pending.add(key);try{await fn();}catch(e){$(key).textContent=e.message;}finally{pending.delete(key);}}
 for(const id of ['download','siri','history','statistics','logs','step']){
  const opener=$(id==='statistics'?'statisticsButton':id+'Button'), dialog=$(id+'Dialog');
  opener.onclick=()=>{dialog.showModal();if(id==='history')loadHistory();if(id==='statistics')loadStatistics();if(id==='logs')loadLogs();};
  $('close'+id[0].toUpperCase()+id.slice(1)).onclick=()=>dialog.close();dialog.onclose=()=>opener.focus();
 }
 for(const [id,description] of Object.entries(hints)){
  const input=$(id), label=doc.querySelector('label[for="'+id+'"]');if(!label)continue;
  const wrap=doc.createElement('span');wrap.className='help-wrap';
  const button=text('button','?');button.type='button';button.className='help-button';button.setAttribute('aria-label','Help for '+id.replace('cfg_',''));button.setAttribute('aria-describedby',id+'Help');
  const tip=text('span',description);tip.id=id+'Help';tip.className='help-tip';tip.setAttribute('role','tooltip');
  button.onclick=event=>{event.preventDefault();wrap.classList.toggle('help-open');};
  wrap.append(button,tip);label.after(wrap);input.setAttribute('aria-describedby',id+'Help');
 }
 $('testConnection').onclick=()=>run('connectionTestResult',async()=>{
  $('connectionTestResult').textContent='Testing backend, account and selected PC…';
  const r=await api('/api/connection-test',{cache:'no-store'});
  $('connectionTestResult').textContent=Object.entries(r.checks).map(([k,v])=>k+': '+v).join(' · ');
 });
 $('refreshDisk').onclick=()=>run('diskSpace',async()=>{const r=await api('/api/disk',{cache:'no-store'});$('diskSpace').textContent=DownloadView.size(r.free)+' free / '+DownloadView.size(r.total)+' · backend upload disk';$('diskSpace').title=r.scope;});
 async function loadHistory(){return run('serverHistoryMessage',async()=>{
  const r=await api('/api/history?offset='+offset,{cache:'no-store'}),list=$('serverHistoryList');list.replaceChildren();
  $('serverHistoryMessage').textContent=`${r.total} server records · selected PC · ${r.items.length?'showing '+(offset+1)+'–'+(offset+r.items.length):'no entries'}`;
  for(const row of r.items){const d=row.detail;const li=text('li',dates(row.at)+' · '+(row.kind==='link'?'Sent ('+d.outcome+'): '+d.url:'Completed: '+d.name));li.className='history-entry';list.appendChild(li);}
  $('historyPrev').disabled=offset===0;$('historyNext').disabled=offset+r.items.length>=r.total;
 });}
 $('refreshHistory').onclick=()=>{offset=0;return loadHistory();};
 $('historyPrev').onclick=()=>{offset=Math.max(0,offset-100);return loadHistory();};
 $('historyNext').onclick=()=>{offset+=100;return loadHistory();};
 async function loadStatistics(){return run('statsScope',async()=>{
  const r=await api('/api/statistics',{cache:'no-store'});$('statsScope').textContent=r.scope;
  const grid=$('statisticsGrid');grid.replaceChildren();
  const values={'Links sent':r.sent,'All-time completed files':r.files,'Known completed data':DownloadView.size(r.bytes),'Unknown file sizes':r.unknownSizes||0,'Top observed speed':DownloadView.size(r.peak)+'/s','Combined observed active time':Math.round(r.active)+' seconds','Most concurrent files observed':r.concurrent,'Quickest fully observed file':r.quickest?r.quickest.name+' · '+Math.round(r.quickest.seconds)+' seconds':'Not enough observations'};
  for(const [k,v] of Object.entries(values)){const cell=doc.createElement('div');cell.append(text('dt',k),text('dd',String(v)));grid.appendChild(cell);}
  $('fileTypes').replaceChildren();for(const type of r.types)$('fileTypes').appendChild(text('li',type.type+' · '+type.files));
 });}
 async function loadLogs(){return run('logsMessage',async()=>{
  logsData=await api('/api/logs',{cache:'no-store'});$('recordLogs').checked=logsData.enabled;
  $('systemLogs').textContent=logsData.items.map(r=>dates(r.at)+' '+r.code+' ['+r.status+']').join('\n')||'No recorded logs.';
  $('logsMessage').textContent=logsData.enabled?'Recording enabled on this backend.':'Recording disabled; previous logs are retained until cleared.';
 });}
 $('refreshLogs').onclick=loadLogs;
 $('recordLogs').onchange=async()=>{if(logBusy)return;logBusy=true;$('recordLogs').disabled=true;try{await api('/api/logs',{method:'POST',body:JSON.stringify({enabled:$('recordLogs').checked})});await loadLogs();}catch(e){$('logsMessage').textContent=e.message;$('recordLogs').checked=logsData?.enabled||false;}finally{logBusy=false;$('recordLogs').disabled=false;}};
 $('clearLogs').onclick=async()=>{try{await api('/api/logs',{method:'DELETE'});await loadLogs();}catch(e){$('logsMessage').textContent=e.message;}};
 $('exportLogs').onclick=()=>{if(!logsData)return;const blob=new Blob([JSON.stringify(logsData,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=doc.createElement('a');a.href=url;a.download='jd-share-system-logs.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 const presetKey='jd_presets:'+connection.base();let presets=[];
 try{presets=JSON.parse(storage.getItem(presetKey)||'[]');}catch(_){}
 presets=Array.isArray(presets)?presets.filter(p=>p && ['name','package','destination','device'].every(k=>typeof p[k]==='string')).slice(0,100):[];
 function presetOptions(){const list=$('presetPicker');list.replaceChildren();const blank=text('option','Choose preset…');blank.value='';list.appendChild(blank);presets.forEach((p,i)=>{const e=text('option',p.name);e.value=String(i);list.appendChild(e);});}
 function savePresets(){try{storage.setItem(presetKey,JSON.stringify(presets));presetOptions();return true;}catch(e){$('presetMessage').textContent='Cannot save presets in this browser.';return false;}}
 presetOptions();
 function applyFields(p){$('pkg').value=p.package;$('destination').value=p.destination;}
 try{const draft=JSON.parse(storage.getItem('jd_preset_draft')||'null');if(draft?.backend===connection.base()&&draft.device===device())applyFields(draft);storage.removeItem('jd_preset_draft');}catch(_){}
 $('savePreset').onclick=()=>{const name=$('presetName').value.trim(),id=actualDevice();if(!name||!id){$('presetMessage').textContent='Enter a name and connect to a PC first.';return;}const p={name:name.slice(0,80),package:$('pkg').value,destination:$('destination').value,device:id};const i=presets.findIndex(p=>p.name===name);if(i>=0)presets[i]=p;else if(presets.length<100)presets.push(p);else return $('presetMessage').textContent='Limit of 100 presets reached.';if(savePresets())$('presetMessage').textContent='Preset saved in this browser.';};
 $('applyPreset').onclick=()=>{const raw=$('presetPicker').value,p=raw===''?null:presets[Number(raw)];if(!p)return;if(!canSwitch())return $('presetMessage').textContent='Wait for the current operation.';if(p.device!==device()){
   storage.setItem('jd_preset_draft',JSON.stringify({...p,backend:connection.base()}));storage.removeItem('jd_review');storage.setItem('jd_device',p.device);root.location.reload();return;
  }applyFields(p);$('presetMessage').textContent='Preset applied. Check links before sending.';};
 $('deletePreset').onclick=()=>{const raw=$('presetPicker').value;if(raw==='')return;presets.splice(Number(raw),1);savePresets();};
 return {async checkDuplicates(links){
  if(pending.has('duplicates'))return false;pending.add('duplicates');
  try{const r=await api('/api/duplicates',{method:'POST',body:JSON.stringify({links})});
   const matches=[...new Set([...r.history,...r.pending])];$('duplicateWarning').textContent=matches.length?`${matches.length} link(s) already recorded or pending.`:r.pendingAvailable?'No known duplicate links.':'No historical matches. Pending URLs could not all be checked.';
   return !matches.length||confirm('These links were already submitted or are pending:\n'+matches.join('\n')+'\nSend again?');
  }catch(e){$('duplicateWarning').textContent='Duplicate check unavailable: '+e.message;return confirm('Duplicate check unavailable. Send links anyway?');}
  finally{pending.delete('duplicates');}
 }};
}
root.Hub={create};
})(typeof window!=='undefined'?window:globalThis);
