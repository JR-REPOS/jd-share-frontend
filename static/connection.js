(function(root){
  function normalize(value, pageProtocol='http:') {
    value=value.trim(); if(!value)return '';
    const url=new URL(value);
    if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash)throw new Error('Enter a trusted http(s) backend URL without credentials, query or fragment.');
    if(pageProtocol==='https:'&&url.protocol!=='https:')throw new Error('This HTTPS page needs an HTTPS backend address, such as your Tailscale URL.');
    return url.href.replace(/\/$/,'');
  }
  function create({storage,location}) {
    const base=()=>storage.getItem('jd_backend')||'';
    return {base, url:path=>base()+path,
      save(value){const result=normalize(value,location?.protocol);storage.setItem('jd_backend',result);return result;},
      needsBackend:()=>Boolean(location?.hostname?.endsWith('.github.io')&&!base())};
  }
  function generate(crypto) {
    if(!crypto?.getRandomValues)throw new Error('Secure token generation needs HTTPS or localhost.');
    return Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');
  }
  function os(nav={}) {
    const text=(nav.userAgentData?.platform||nav.platform||'')+' '+(nav.userAgent||'');
    if(/iPhone|iPad|iPod|Android/i.test(text)||(/Mac/i.test(text)&&nav.maxTouchPoints>1))return 'mobile';
    if(/Windows|Win32|Win64/i.test(text))return 'Windows';
    if(/Mac/i.test(text))return 'macOS';
    if(/Linux/i.test(text))return 'Linux';
    return 'unknown';
  }
  root.Connection={create,normalize,generate,os};
  if(typeof module!=='undefined')module.exports=root.Connection;
})(typeof window!=='undefined'?window:globalThis);
