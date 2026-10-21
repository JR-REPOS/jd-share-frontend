/* Device picker, explicit speed controls, durable schedule UI and share handoff. */
const AdvancedView = (() => {
  function sharedLinks(fragment) {
    if (!fragment.startsWith('#links=')) return '';
    try {return decodeURIComponent(fragment.slice(7)).slice(0,50000);} catch (_) {return '';}
  }
  function create({document:doc,api,storage,device,canSwitch,onSwitch}) {
    const $=id=>doc.getElementById(id);
    function say(id,text){$(id).textContent=text;}
    async function devices() {
      try {
        const result=await api('/api/devices');
        if(!Array.isArray(result.devices))throw new Error('Device list unavailable; update the backend.');
        const select=$('devicePicker');select.replaceChildren();
        const option=doc.createElement('option');option.value='';option.textContent='Configured default: '+(result.devices.find(d=>d.id===result.default)?.name || 'PC');select.appendChild(option);
        for(const row of result.devices){const o=doc.createElement('option');o.value=row.id;o.textContent=row.name;select.appendChild(o);}
        if(device() && !result.devices.some(d=>d.id===device())) {
          const missing=doc.createElement('option');missing.value=device();missing.textContent='Selected PC unavailable';select.appendChild(missing);
        }
        select.value=device();
        say('deviceMessage',result.warning || 'Commands target the selected PC. Uploaded phone files always go to the server hosting this app.');
      } catch(e) {say('deviceMessage',e.message);}
    }
    if(device()) {
      const saved=doc.createElement('option');saved.value=device();saved.textContent='Selected PC (refresh to load name)';
      $('devicePicker').appendChild(saved);$('devicePicker').value=device();
    }
    $('refreshDevices').onclick=devices;
    $('devicePicker').onchange=()=>{
      if(!canSwitch()){$('devicePicker').value=device();say('deviceMessage','Wait for the current file command to finish before switching PCs.');return;}
      const next=$('devicePicker').value;
      if(next===device())return;
      storage.setItem('jd_device',next);storage.removeItem('jd_review');onSwitch();
    };
    $('refreshSpeed').onclick=async()=>{
      $('refreshSpeed').disabled=true;
      try {
        const state=await api('/api/speed-limit');
        $('applySpeed').disabled=!state.supported;
        if(state.supported){
          $('speedEnabled').checked=state.enabled===true;
          if(Number.isInteger(state.bytesPerSecond) && state.bytesPerSecond>0)$('speedLimit').value=String(Math.ceil(state.bytesPerSecond/1024));
          say('speedMessage',`${state.enabled===true?'Limit enabled':state.enabled===false?'Limit disabled':'Enabled state unknown'} · ${state.bytesPerSecond==null?'rate unknown':state.bytesPerSecond+' B/s'}`);
        }else say('speedMessage',state.detail || 'Speed settings unavailable on this device.');
      }catch(e){$('applySpeed').disabled=true;say('speedMessage',e.message);}
      finally{$('refreshSpeed').disabled=false;}
    };
    $('applySpeed').onclick=async()=>{
      const kib=Number($('speedLimit').value);
      if(!Number.isInteger(kib)||kib<1||kib>2097151)return say('speedMessage','Enter a whole number from 1 to 2097151 KiB/s.');
      $('applySpeed').disabled=true;
      try {
        const state=await api('/api/speed-limit',{method:'POST',body:JSON.stringify({enabled:$('speedEnabled').checked,kibPerSecond:kib})});
        say('speedMessage',`Readback: ${state.enabled===true?'enabled':state.enabled===false?'disabled':'unknown'} · ${state.bytesPerSecond==null?'rate unknown':state.bytesPerSecond+' B/s'}.`);
      }catch(e){say('speedMessage',e.message);}
      finally{ /* deliberate Refresh required before another change */ }
    };
    async function schedules() {
      $('refreshSchedules').disabled=true;
      try {
        const result=await api('/api/schedules');const list=$('scheduleList');list.replaceChildren();
        for(const job of result.jobs || []) {
          const li=doc.createElement('li');li.className='history-entry';
          const text=doc.createElement('span');text.textContent=`${new Date(job.at*1000).toLocaleString()} · ${job.action} · ${job.status}`;li.appendChild(text);
          if(job.status==='pending') {
            const cancel=doc.createElement('button');cancel.type='button';cancel.textContent='Cancel';
            cancel.onclick=async()=>{cancel.disabled=true;try{await api('/api/schedules/'+encodeURIComponent(job.id),{method:'DELETE'});say('scheduleMessage','Schedule cancelled.');await schedules();}catch(e){say('scheduleMessage',e.message);}};
            li.appendChild(cancel);
          }
          list.appendChild(li);
        }
        if(!list.children.length){const li=doc.createElement('li');li.textContent='No schedules for this PC.';list.appendChild(li);}
      }catch(e){say('scheduleMessage',e.message);}
      finally{$('refreshSchedules').disabled=false;}
    }
    $('refreshSchedules').onclick=schedules;
    $('saveSchedule').onclick=async()=>{
      const at=new Date($('scheduleTime').value);
      if(!Number.isFinite(at.getTime()))return say('scheduleMessage','Choose a date and time.');
      $('saveSchedule').disabled=true;
      try {
        await api('/api/schedules',{method:'POST',body:JSON.stringify({action:$('scheduleAction').value,at:at.toISOString()})});
        say('scheduleMessage','Schedule saved on the server for this PC.');await schedules();
      }catch(e){say('scheduleMessage',e.message);}
      finally{$('saveSchedule').disabled=false;}
    };
    return {devices};
  }
  return {create,sharedLinks};
})();
if(typeof module!=='undefined' && module.exports)module.exports=AdvancedView;
