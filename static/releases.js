/* Public release notes: text only, with no access token or device data. */
const ReleaseView = (() => {
  function create({document:doc, load}) {
    const $=id=>doc.getElementById(id);
    let data=null, pending=null;
    async function ready(){
      if(data)return data;
      if(pending)return pending;
      pending=load().then(result=>{
        if(!result || typeof result.version!=='string' || !Array.isArray(result.releases))throw new Error('Release notes unavailable.');
        data=result;$('appVersion').textContent='V'+result.version;return result;
      }).catch(error=>{$('appVersion').textContent='Version unavailable';throw error;}).finally(()=>pending=null);
      return pending;
    }
    function render(result){
      const list=$('changesList');list.replaceChildren();
      for(const release of result.releases){
        const item=doc.createElement('li');item.className='release-entry';
        const heading=doc.createElement('h3');heading.textContent=`${release.version?'V'+release.version:'Legacy · unversioned'} — ${release.title}`;
        const date=doc.createElement('p');date.className='hint';date.textContent=release.timestamp+(release.version?'':' · recorded history');
        const bullets=doc.createElement('ul');
        for(const text of release.changes||[]){const li=doc.createElement('li');li.textContent=text;bullets.appendChild(li);}
        item.append(heading,date,bullets);list.appendChild(item);
      }
    }
    function close(){const dialog=$('changesDialog');if(typeof dialog.close==='function')dialog.close();else dialog.removeAttribute('open');$('changesButton').focus();}
    $('closeChanges').onclick=close;
    $('changesDialog').onclose=()=>$('changesButton').focus();
    $('changesDialog').onclick=event=>{if(event.target===$('changesDialog'))close();};
    $('changesButton').onclick=async()=>{
      const dialog=$('changesDialog');
      if(typeof dialog.showModal==='function'){if(!dialog.open)dialog.showModal();}else dialog.setAttribute('open','');
      $('closeChanges').focus();
      $('changesMessage').textContent='Loading changes…';
      try{render(await ready());$('changesMessage').textContent='';}
      catch(_){$('changesMessage').textContent='Changes could not be loaded. Check the connection and open Changes again.';}
    };
    ready().catch(()=>{});
    return {ready};
  }
  return {create};
})();
if(typeof module!=='undefined' && module.exports)module.exports=ReleaseView;
