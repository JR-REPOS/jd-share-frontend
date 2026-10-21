/* Download presentation. Unknown values stay unknown; zero bytes is not completion. */
const DownloadView = (() => {
  const number = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
  function size(value) {
    let n = number(value);
    if (n === null) return 'Unknown';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
    return `${n.toFixed(i ? 1 : 0)} ${units[i]}`;
  }
  function eta(value) {
    const n = number(value);
    if (n === null || n === 0) return 'Calculating…';
    const seconds = Math.ceil(n);
    if (seconds < 60) return `${seconds}s remaining`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s remaining`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor(seconds % 3600 / 60)}m remaining`;
    return `${Math.floor(seconds / 86400)}d ${Math.floor(seconds % 86400 / 3600)}h remaining`;
  }
  const stateKey = state => String(state || '').replace(/_STATE$/i, '').toUpperCase();
  function controllerLabel(state) {
    const key = stateKey(state);
    return {RUNNING: 'Downloading', PAUSE: 'Paused', PAUSED: 'Paused', STOPPED: 'Stopped', IDLE: 'Idle', STOPPING: 'Stopping'}[key]
      || (key ? key.toLowerCase().replace(/_/g, ' ') : 'Unknown state');
  }
  function describe(link, state, stale = false) {
    const loaded = number(link.bytesLoaded), total = number(link.bytesTotal);
    const finished = link.finished === true;
    const rawStatus = typeof link.status === 'string' ? link.status.trim() : '';
    let label, tone = '';
    if (finished) { label = 'Finished'; tone = 'done'; }
    else if (/error|failed|offline|unavailable|not found|fatal/i.test(rawStatus)) { label = 'Needs attention'; tone = 'error'; }
    else if (link.enabled === false) label = 'Disabled';
    else if (link.skipped === true) label = 'Skipped';
    else if (/paus/i.test(rawStatus) || (/^PAUSE(D)?$/.test(stateKey(state)) && link.running === true)) label = 'Paused';
    else if (link.running === true) { label = 'Downloading'; tone = 'active'; }
    else if (rawStatus) label = rawStatus;
    else label = 'Queued';
    const pct = finished ? 100 : total > 0 && loaded !== null ? Math.max(0, Math.min(100, 100 * loaded / total)) : null;
    const active = !finished && label === 'Downloading';
    const speed = number(link.speed);
    return {
      label, tone, rawStatus, pct, active,
      progress: pct === null ? 'Progress unknown' : finished ? '100%' : `${pct >= 100 ? '100' : Math.floor(pct)}%`,
      bytes: `${loaded === null ? 'Size unknown' : size(loaded)} / ${total > 0 ? size(total) : 'size unknown'}`,
      speed: stale ? 'Speed unavailable' : finished ? 'Complete' : active ? speed === null ? 'Speed unknown' : `${size(speed)}/s` : '—',
      eta: stale ? 'ETA unavailable' : finished ? 'Finished' : label === 'Paused' ? 'Paused' : active ? eta(link.eta) : 'ETA —',
    };
  }
  // Filters share the card classifier; unknown states never become success.
  function category(link, state) {
    const info = describe(link, state);
    if (link.finished === true) return 'finished';
    if (info.tone === 'error' || /already exists|blocked|captcha|password|disk|account required/i.test(info.rawStatus)) return 'attention';
    if (link.enabled === false) return 'disabled';
    if (link.skipped === true) return 'skipped';
    if (info.label === 'Paused') return 'paused';
    return info.active ? 'active' : 'queued';
  }
  function select(links, state, search = '', filter = 'all') {
    const term = search.trim().toLocaleLowerCase();
    return links.filter(link => String(link.name || '').toLocaleLowerCase().includes(term)
      && (filter === 'all' || category(link, state) === filter));
  }
  function groups(links, packages = []) {
    const names = new Map(packages.map(p => [String(p.uuid), p.name || 'Unnamed package']));
    const result = new Map();
    for (const link of links) {
      const key = link.packageUUID == null ? '' : String(link.packageUUID);
      if (!result.has(key)) result.set(key, {id:key, name:names.get(key) || (key ? 'Package ' + key : 'Package unavailable'), links:[]});
      result.get(key).links.push(link);
    }
    return [...result.values()];
  }
  function element(doc, tag, className, text) {
    const el = doc.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }
  function render(list, links, state, stale = false, options = {}) {
    const doc = list.ownerDocument;
    const focusedId = doc.activeElement?.dataset?.downloadId;
    const focusedSelection = doc.activeElement?.dataset?.selectionId;
    const focusedPackage = doc.activeElement?.dataset?.packageId;
    let refocus = null;
    list.replaceChildren();
    list.classList.toggle('stale', stale);
    if (!links.length) {
      list.appendChild(element(doc, 'li', 'empty', stale ? 'Last successful check found no downloads.' : 'No downloads yet. Use Find files above to choose a video.'));
      return;
    }
    const grouped = options.grouped === true;
    const buckets = grouped ? groups(links, options.packages) : [{links}];
    for (const group of buckets) {
      let parent = list;
      if (grouped) {
        const outer = element(doc, 'li', 'package-group');
        const details = element(doc, 'details', 'package-section');
        details.open = !options.collapsed?.has(group.id);
        const summary = element(doc, 'summary', '', `${group.name} · ${group.links.length} shown`);
        summary.dataset.packageId = group.id;
        if (focusedPackage !== undefined && focusedPackage === group.id) refocus = summary;
        const cards = element(doc, 'ul', 'package-files');
        cards.setAttribute('aria-label', group.name);
        details.ontoggle = () => options.onCollapse?.(group.id, !details.open);
        details.append(summary, cards); outer.appendChild(details); list.appendChild(outer);
        parent = cards;
      }
      for (const link of group.links) {
      const info = describe(link, state, stale);
      const card = element(doc, 'li', `download-card ${info.tone}`);
      const head = element(doc, 'div', 'card-head');
      const name = element(doc, 'div', 'name', link.name || 'Unnamed file');
      const badge = element(doc, 'span', `badge ${info.tone}`, info.label);
      head.append(name, badge);
      const progress = element(doc, 'div', 'progress-meta');
      progress.append(element(doc, 'span', '', info.progress), element(doc, 'span', '', info.bytes));
      const track = element(doc, 'div', 'track');
      track.setAttribute('role', 'progressbar');
      track.setAttribute('aria-label', `${link.name || 'Unnamed file'} progress`);
      track.setAttribute('aria-valuemin', '0'); track.setAttribute('aria-valuemax', '100');
      if (info.pct !== null) track.setAttribute('aria-valuenow', String(Math.floor(info.pct)));
      track.setAttribute('aria-valuetext', info.progress + (stale ? ', last known' : ''));
      const fill = element(doc, 'div', 'fill');
      fill.style.width = `${info.pct ?? 0}%`;
      track.appendChild(fill);
      const meta = element(doc, 'div', 'meta');
      meta.append(element(doc, 'span', 'file-speed', info.speed), element(doc, 'span', 'file-eta', info.eta));
      card.append(head, progress, track, meta);
      if (options.onSelect && link.uuid && link.finished !== true) {
        const label = element(doc, 'label', 'download-choice');
        const checkbox = element(doc, 'input'); checkbox.type = 'checkbox';
        checkbox.dataset.selectionId = String(link.uuid);
        if (focusedSelection === String(link.uuid)) refocus = checkbox;
        checkbox.checked = options.selected?.has(String(link.uuid)) || false;
        checkbox.disabled = stale || options.disabled === true;
        checkbox.setAttribute('aria-label', `Select ${link.name || 'file'}`);
        checkbox.onchange = () => options.onSelect(String(link.uuid), checkbox.checked);
        label.append(checkbox, element(doc, 'span', '', 'Select file')); card.appendChild(label);
      }
      if (info.rawStatus && info.rawStatus.toLowerCase() !== info.label.toLowerCase())
        card.appendChild(element(doc, 'div', 'file-detail', info.rawStatus));
      if (options.onManage && link.uuid && !link.finished) {
        const button = element(doc, 'button', 'manage-file', 'Manage file');
        button.type = 'button'; button.dataset.downloadId = String(link.uuid);
        button.setAttribute('aria-label', `Manage ${link.name || 'file'}`);
        button.disabled = stale || options.disabled === true;
        button.onclick = () => options.onManage(String(link.uuid));
        if (String(link.uuid) === focusedId) refocus = button;
        card.appendChild(button);
      }
      parent.appendChild(card);
      }
    }
    refocus?.focus();
  }
  return {number, size, eta, controllerLabel, describe, category, select, groups, render};
})();
if (typeof module !== 'undefined' && module.exports) module.exports = DownloadView;
