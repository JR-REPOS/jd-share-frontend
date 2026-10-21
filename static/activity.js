/* Local, opt-in activity history and foreground completion notifications. */
const ActivityView = (() => {
  function create({document:doc, storage, notify = typeof Notification === 'undefined' ? null : Notification, scope = ''}) {
    const $ = id => doc.getElementById(id);
    let key = 'jd_activity_history' + (scope ? ':' + scope : '');
    let preference = 'jd_history_enabled' + (scope ? ':' + scope : '');
    let enabled = storage.getItem(preference) === 'yes', previous = null, notifications = false;
    let rows = [];
    try { rows = JSON.parse(storage.getItem(key) || '[]'); } catch (_) {}
    if (!Array.isArray(rows)) rows = [];
    rows = rows.filter(r=>r && typeof r.id === 'string' && typeof r.name === 'string' && typeof r.observed === 'string').slice(0,200);
    function render() {
      $('recordHistory').checked = enabled;
      const list = $('historyList');list.replaceChildren();
      if (!rows.length) {const li=doc.createElement('li');li.className='empty';li.textContent='No recorded completions.';list.appendChild(li);}
      for (const row of rows) {
        const li=doc.createElement('li');li.className='history-entry';
        li.textContent=`${row.name} — observed finished ${row.observed}`;list.appendChild(li);
      }
      $('clearHistory').disabled = !rows.length;
    }
    function persist() {try {storage.setItem(key,JSON.stringify(rows));} catch (_) {$('activityMessage').textContent='History could not be saved on this browser.';} render();}
    $('recordHistory').onchange=()=>{
      enabled=$('recordHistory').checked;
      try {storage.setItem(preference,enabled?'yes':'no');} catch (_) {}
      $('activityMessage').textContent=enabled?'Recording completed files observed from now on.':'History recording off. Existing entries are kept until cleared.';
    };
    $('clearHistory').onclick=()=>{rows=[];persist();};
    $('enableNotifications').disabled=!notify;
    $('notificationHelp').textContent=notify?'Notifications work while this page stays open and connected. This is not background push.':'Browser notifications are unavailable here. History can still record completions while the app is open.';
    $('enableNotifications').onclick=async()=>{
      if(!notify)return;
      if(notifications){notifications=false;$('enableNotifications').textContent='Enable completion notifications';return;}
      try {
        const permission=await notify.requestPermission();
        notifications=permission==='granted';
        $('enableNotifications').textContent=notifications?'Disable completion notifications':'Enable completion notifications';
        $('activityMessage').textContent=notifications?'Completion notifications enabled for this open page.':'Notification permission was not granted.';
      }catch(_){$('activityMessage').textContent='Notifications could not be enabled in this browser.';}
    };
    render();
    return {
      setScope(next) {
        if(next===scope)return;
        scope=next;key='jd_activity_history:'+scope;preference='jd_history_enabled:'+scope;
        previous=null;notifications=false;enabled=storage.getItem(preference)==='yes';rows=[];
        try{rows=JSON.parse(storage.getItem(key)||'[]');}catch(_){}
        if(!Array.isArray(rows))rows=[];
        rows=rows.filter(r=>r && typeof r.id==='string' && typeof r.name==='string' && typeof r.observed==='string').slice(0,200);
        $('enableNotifications').textContent='Enable completion notifications';render();
      },
      observe(links) {
        let newlyFinished=0;
        for(const link of links) {
          if(link.uuid==null || link.finished!==true)continue;
          const id=String(link.uuid);
          if(previous?.has(id) && previous.get(id)!==true)newlyFinished++;
          if(enabled && previous?.get(id)!==true && !rows.some(r=>r.id===id))rows.unshift({id,name:String(link.name||'Unnamed file').slice(0,300),observed:new Date().toISOString()});
        }
        rows=rows.slice(0,200);
        if(enabled)persist();
        if(notifications && newlyFinished && notify?.permission==='granted') {
          try {new notify('JDownloader download finished',{body:`${newlyFinished} file${newlyFinished===1?'':'s'} completed. Open JD Share for details.`});} catch(_) {}
        }
        previous=new Map(links.map(l=>[String(l.uuid),l.finished===true]));
      },
      reset() {previous=null;notifications=false;enabled=false;rows=[];storage.removeItem(key);storage.removeItem(preference);$('enableNotifications').textContent='Enable completion notifications';render();}
    };
  }
  return {create};
})();
