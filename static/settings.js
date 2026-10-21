(function(root){
  function create({document,api,crypto,navigator,version}) {
    const $=id=>document.getElementById(id), fields=['MYJD_EMAIL','MYJD_PASSWORD','MYJD_DEVICE','API_TOKEN','UPLOAD_DIR','HOST','PORT','ALLOWED_ORIGINS','SHORTCUT_URL'];
    const dialog=$('settingsDialog'), message=$('settingsMessage');
    const setMessage=text=>message.textContent=text;
    $('settingsToggle').onclick=async()=>{
      dialog.showModal();setMessage('Loading saved backend settings…');$('saveSettings').disabled=true;
      $('backendUrl').value=root.localStorage?.getItem('jd_backend')||$('backendUrl').value;
      $('token').value=root.localStorage?.getItem('jd_token')||$('token').value;
      try {
        const r=await api('/api/settings?includeSecrets=true',{cache:'no-store'});
        fields.forEach(k=>{$('cfg_'+k).value=r.values[k]||({HOST:'0.0.0.0',PORT:'8787',UPLOAD_DIR:'./uploads'}[k]||'');});
        $('cfg_MYJD_PASSWORD').placeholder=r.passwordSet?'Saved; leave blank to keep':'Enter password';
        $('cfg_API_TOKEN').placeholder=r.tokenSet?'Saved; leave blank to keep':'Generate a token';
        $('saveSettings').disabled=false;
        setMessage('Saved values loaded from the backend. Secrets stay masked unless revealed. Restart the backend after saving changes.');
      }catch(e){setMessage(e.message+' Save your browser connection above first, then reopen Settings to load the backend fields.');}
    };
    $('closeSettings').onclick=()=>dialog.close();
    dialog.onclose=()=>{['MYJD_PASSWORD','API_TOKEN'].forEach(k=>{$('cfg_'+k).value='';$('cfg_'+k).type='password';});$('showPassword').checked=false;$('showGeneratedToken').checked=false;$('settingsToggle').focus();};
    $('generateToken').onclick=()=>{try{$('cfg_API_TOKEN').value=root.Connection.generate(crypto);setMessage('New random token generated. Copy it before closing; it becomes active after saving and restarting the backend.');}catch(e){setMessage(e.message);}};
    $('showPassword').onchange=()=>{$('cfg_MYJD_PASSWORD').type=$('showPassword').checked?'text':'password';};
    $('showGeneratedToken').onchange=()=>{$('cfg_API_TOKEN').type=$('showGeneratedToken').checked?'text':'password';};
    $('settingsForm').onsubmit=async event=>{
      event.preventDefault();if($('saveSettings').disabled)return;
      const values=Object.fromEntries(fields.map(k=>[k,$('cfg_'+k).value]));
      $('saveSettings').disabled=true;
      try{await api('/api/settings',{method:'POST',body:JSON.stringify(values)});
        if(values.API_TOKEN)$('token').value=values.API_TOKEN;
        setMessage('Saved. Restart the JD Share backend to apply changes. If you changed the token, it is filled in Browser connection: click Save after restarting. Host/port changes may change your backend address.');
      }catch(e){setMessage(e.message);}finally{$('saveSettings').disabled=false;}
    };
    $('openDesktop').onclick=async()=>{
      $('openDesktop').disabled=true;
      try {const r=await api('/api/desktop/open',{method:'POST'});$('desktopMessage').textContent=r.message;}
      catch(e){$('desktopMessage').textContent=e.message;}
      finally{$('openDesktop').disabled=false;}
    };
    const detected=root.Connection.os(navigator);
    $('desktopOS').value=['Windows','macOS','Linux'].includes(detected)?detected:'choose';
    const updateDownload=()=>{
      const selected=$('desktopOS').value, anchors={Windows:'windows',macOS:'macos',Linux:'linux'};
      $('downloadDesktop').href='https://jdownloader.org/jdownloader2'+(anchors[selected]?'#'+anchors[selected]:'');
      $('downloadDesktop').textContent='Download JDownloader Desktop'+(anchors[selected]?' · '+selected:'');
      $('desktopDownloadHint').textContent=detected==='mobile'?'JDownloader Desktop needs a Windows, Mac or Linux PC. Choose the PC’s OS.':'Opens the official installer page. Choose the architecture/version for your PC there.';
    };
    $('desktopOS').onchange=updateDownload;updateDownload();
    $('installShortcut').onclick=async()=>{
      $('shortcutMessage').textContent='Checking Shortcut installation link…';
      try{
        const r=await api('/api/shortcut',{cache:'no-store'});
        if(!/^https:\/\/www\.icloud\.com\/shortcuts\/[a-zA-Z0-9]+$/.test(r.url||''))throw new Error('A published iCloud Shortcut link is not configured yet. Use the setup guide or download a signed Shortcut from a successful GitHub Actions run.');
        // A visible link avoids popup blockers following an asynchronous request.
        const a=$('shortcutInstallLink');a.href=r.url;a.hidden=false;a.textContent='Open Shortcut setup · V'+r.version;
        $('shortcutMessage').textContent='Tap the setup link to open Apple’s install screen. Setup asks for your JD Share URL; no account password or API token belongs in the Shortcut.';
      }catch(e){$('shortcutMessage').textContent=e.message;}
    };
    return {version};
  }
  root.SettingsView={create};
})(typeof window!=='undefined'?window:globalThis);
