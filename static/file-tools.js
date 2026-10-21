/* Stable file editor outside the polled cards; priority changes require Apply. */
const FileTools = (() => {
  function create({document: doc, api, tok, onChanged}) {
    const $ = id => doc.getElementById(id);
    let links = [], id = '', stale = true, busy = false, hold = false, generation = 0;
    const tell = (text, error=false) => { $('fileActionMessage').textContent=text; $('fileActionMessage').className='msg '+(error?'err':'ok'); };
    function update(next, old) {
      links = next; stale = old;
      const link = links.find(l => String(l.uuid) === id);
      if (id && !link) { $('fileControls').hidden=true; id=''; tell('The managed file is no longer in Downloads.'); }
      if (!id) return;
      $('managedName').textContent=link.name || 'Unnamed file';
      $('fileEnabled').textContent=link.enabled === true ? 'Disable file' : 'Enable file';
      $('fileEnabledHelp').textContent=typeof link.enabled === 'boolean' ? 'Enable makes this file eligible to run when the controller is running. Disable takes it out of scheduling; an active transfer may take a moment to stop.' : 'JDownloader did not return this file’s enabled state. Enable file sends an explicit enable request so the file can be made eligible again; it does not start the controller.';
      $('fileCurrent').textContent=`${link.enabled === false ? 'Disabled' : link.enabled === true ? 'Enabled' : 'Enabled state unknown'} · Priority: ${link.priority || 'Unknown'}${stale ? ' · last known' : ''}`;
      $('fileEnabled').disabled=busy || stale || hold || link.finished === true;
      $('fileRetry').disabled=busy || stale || hold || link.finished === true || link.running === true;
      $('applyPriority').disabled=busy || stale || hold || link.finished === true || !$('filePriority').value;
      $('filePriority').disabled=busy || stale || hold || link.finished === true;
      $('closeFileControls').disabled=busy;
    }
    function open(nextId) {
      if (busy) return;
      id=nextId; hold=false; tell('');
      const link=links.find(l => String(l.uuid)===id);
      $('filePriority').value=link?.priority || '';
      $('fileControls').hidden=false; update(links,stale);
      $('closeFileControls').focus();
      $('fileControls').scrollIntoView?.({behavior:'auto',block:'nearest'});
    }
    async function change(action, value) {
      if (busy || stale || hold || !id) return;
      const link=links.find(l=>String(l.uuid)===id);
      if (!link || link.finished) return;
      busy=true; const epoch=generation, key=tok(), current=id; update(links,stale);
      tell('Applying file setting…');
      try {
        await api(`/api/downloads/${encodeURIComponent(current)}/${action}`, {method:'POST',body:JSON.stringify({[action]:value})});
        if (epoch!==generation || key!==tok()) return;
        // Use the next server status as the authority; never display a guessed state.
        hold=true;
        tell('Setting sent. Refresh Downloads to confirm the current state.');
      } catch(e) {
        if (epoch!==generation) return;
        hold=true; tell(e.message,true);
      } finally {
        if (epoch===generation) {busy=false; update(links,stale); onChanged();}
      }
    }
    $('fileEnabled').onclick=()=>{
      const link=links.find(l=>String(l.uuid)===id);
      if (link) return change('enabled',link.enabled !== true);
    };
    $('fileRetry').onclick=()=>change('retry',null);
    $('applyPriority').onclick=()=>change('priority',$('filePriority').value);
    $('filePriority').onchange=()=>update(links,stale);
    $('closeFileControls').onclick=()=>{if(!busy){$('fileControls').hidden=true;id='';}};
    return {open,update,busy:()=>busy,
      confirmed(next,old){ if(!old && !busy) hold=false; update(next,old); },
      reset(){generation++;id='';links=[];busy=false;hold=false;stale=true;$('fileControls').hidden=true;tell('');}
    };
  }
  return {create};
})();
