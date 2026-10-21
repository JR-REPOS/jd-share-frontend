/* All-LinkGrabber view; the job-scoped Find files review stays separate. */
const PendingView = (() => {
  function create({document: doc, api, tok, onDownloaded}) {
    const $ = id => doc.getElementById(id);
    let visible = false, links = null, snapshot = '', chosen = new Set();
    let loading = false, sending = false, failed = false, hold = false;
    let updated = 0, generation = 0, signature = '', controller = null;
    const usable = link => link.availability !== 'OFFLINE' && link.enabled !== false;
    const message = (text, error = false) => { $('pendingMessage').textContent = text; $('pendingMessage').className = 'msg ' + (error ? 'err' : 'ok'); };
    const stale = () => failed || !updated || Date.now() - updated >= 15000;
    function buttons() {
      $('downloadPending').textContent = `Download selected (${chosen.size})`;
      $('downloadPending').disabled = !chosen.size || stale() || loading || sending || hold;
      $('clearPending').disabled = !chosen.size || sending;
      $('refreshPending').disabled = loading || sending;
      $('refreshPending').textContent = loading ? 'Checking…' : 'Refresh files';
    }
    function render() {
      const query = $('pendingSearch').value.trim().toLocaleLowerCase();
      const shown = (links || []).filter(l => l.name.toLocaleLowerCase().includes(query));
      const old = stale();
      if (links !== null) {
        const hidden = [...chosen].filter(id => !shown.some(l => l.id === id)).length;
        $('pendingSummary').textContent = `${shown.length} shown · ${links.length} pending · ${chosen.size} selected${hidden ? ` (${hidden} hidden by search)` : ''}${old ? ' · last known list — refresh before downloading' : ''}`;
      }
      const next = JSON.stringify([shown, query, old, sending]);
      if (next !== signature) {
        signature = next; const list = $('pendingList'); list.replaceChildren();
        if (links !== null && !shown.length) {
          const li = doc.createElement('li'); li.className = 'empty';
          li.textContent = query ? 'No filenames match this search.' : old ? 'No pending files at the last successful check.' : 'Nothing waiting in LinkGrabber. Use Add only or Find files above.';
          list.appendChild(li);
        }
        for (const l of shown) {
          const li = doc.createElement('li'), label = doc.createElement('label'); label.className = 'choice';
          const cb = doc.createElement('input'); cb.type = 'checkbox'; cb.checked = chosen.has(l.id);
          cb.disabled = !usable(l) || old || sending;
          cb.onchange = () => { cb.checked ? chosen.add(l.id) : chosen.delete(l.id); render(); };
          const name = doc.createElement('span'); name.textContent = l.name;
          const meta = doc.createElement('small');
          meta.textContent = `${l.bytesTotal > 0 ? DownloadView.size(l.bytesTotal) : 'Size unknown'} · ${l.availability}${l.enabled === false ? ' · Disabled' : ''}${l.status ? ' · ' + l.status : ''}`;
          name.appendChild(meta); label.append(cb, name); li.appendChild(label); list.appendChild(li);
        }
      }
      buttons();
    }
    async function refresh({acknowledge = false} = {}) {
      if (loading || sending) return;
      if (!tok()) { reset(); $('pendingSummary').textContent = 'Save the access token below to load LinkGrabber.'; return; }
      if (acknowledge) { hold = false; message(''); }
      loading = true; buttons();
      const epoch = generation, key = tok();
      controller = new AbortController(); const activeController = controller;
      const timer = setTimeout(() => activeController.abort(), 12000);
      try {
        const result = await api('/api/linkgrabber', {signal: activeController.signal, cache:'no-store'});
        if (epoch !== generation || key !== tok()) return;
        if (!result.snapshot || !Array.isArray(result.links) || !result.links.every(l => l && typeof l.id === 'string' && typeof l.name === 'string'))
          throw new Error('LinkGrabber returned an invalid list. Use Refresh files.');
        snapshot = result.snapshot; links = result.links; updated = Date.now(); failed = false;
        const valid = new Set(links.filter(usable).map(l => l.id));
        chosen = new Set([...chosen].filter(id => valid.has(id)));
        // An uncertain move requires a deliberate refresh before a new command.
        if (!hold && $('pendingMessage').className.includes('err')) message('');
      } catch(e) {
        if (epoch !== generation || key !== tok()) return;
        failed = true;
        message(e.name === 'AbortError' ? 'LinkGrabber check timed out. Try Refresh files.' : e.message, true);
        if (links === null) $('pendingSummary').textContent = 'LinkGrabber unavailable. Try Refresh files.';
      } finally {
        clearTimeout(timer);
        if (epoch === generation) { loading = false; controller = null; render(); }
      }
    }
    function reset() {
      generation++; controller?.abort(); controller = null;
      links = null; snapshot = ''; chosen.clear(); loading = false; sending = false; failed = false;
      updated = 0; hold = false; signature = ''; $('pendingList').replaceChildren();
      $('pendingSummary').textContent = 'Refresh to load pending files.'; message(''); buttons();
    }
    function tab(pending, focus = false) {
      visible = pending;
      for (const [id, selected] of [['downloadsTab', !pending], ['linkgrabberTab', pending]]) {
        $(id).setAttribute('aria-selected', String(selected)); $(id).tabIndex = selected ? 0 : -1;
        if (selected && focus) $(id).focus();
      }
      $('downloadsPanel').hidden = pending; $('linkgrabberPanel').hidden = !pending;
      if (pending) { render(); refresh(); }
    }
    $('downloadsTab').onclick = () => tab(false);
    $('linkgrabberTab').onclick = () => tab(true);
    for (const id of ['downloadsTab', 'linkgrabberTab']) $(id).onkeydown = event => {
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
        event.preventDefault(); tab(event.key === 'Home' ? false : event.key === 'End' ? true : !visible, true);
      }
    };
    $('pendingSearch').oninput = render;
    $('refreshPending').onclick = () => refresh({acknowledge:true});
    $('clearPending').onclick = () => { chosen.clear(); signature = ''; render(); };
    $('downloadPending').onclick = async () => {
      if (!chosen.size || stale() || loading || sending || hold) return;
      sending = true; render(); const epoch = generation;
      message('Moving selected files to Downloads…');
      try {
        const result = await api('/api/linkgrabber/download', {method:'POST', body:JSON.stringify({snapshot, ids:[...chosen]})});
        if (epoch !== generation) return;
        chosen.clear(); snapshot = ''; failed = true;
        message(`${result.selected} selected file${result.selected === 1 ? '' : 's'} sent to Downloads. Open the Downloads tab to follow progress.`);
        onDownloaded();
      } catch(e) {
        if (epoch !== generation) return;
        hold = true; chosen.clear(); failed = true; snapshot = '';
        message(`${e.message} Check the PC, then press Refresh files before selecting again.`, true);
      } finally {
        if (epoch === generation) { sending = false; signature = ''; render(); }
      }
    };
    doc.addEventListener('visibilitychange', () => { if (!doc.hidden && visible) { render(); refresh(); } });
    setInterval(() => { if (visible && links !== null) render(); }, 1000);
    buttons();
    return {reset, refreshIfVisible: () => visible ? refresh() : Promise.resolve(), refresh};
  }
  return {create};
})();
