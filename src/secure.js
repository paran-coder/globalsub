/* GlobalSub: opt-in password encrypted key local to this browser. */
(function(root){
  'use strict';
  const STORE_KEY='globalsub_v1_encrypted_key';
  function bytesToBase64(bytes){let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s);}
  function base64ToBytes(s){return Uint8Array.from(atob(s),c=>c.charCodeAt(0));}
  async function derive(password,salt){
    if(!root.crypto?.subtle)throw new Error('암호화 기능을 지원하지 않는 브라우저입니다. HTTPS 또는 localhost에서 실행하세요.');
    const base=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);
    return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:310000,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  }
  async function saveKey(key,password){
    if(password.length<8)throw new Error('암호는 8자 이상으로 설정하세요.');
    const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
    const aes=await derive(password,salt);
    const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv},aes,new TextEncoder().encode(key));
    localStorage.setItem(STORE_KEY,JSON.stringify({v:1,salt:bytesToBase64(salt),iv:bytesToBase64(iv),data:bytesToBase64(new Uint8Array(ciphertext))}));
  }
  async function loadKey(password){
    const record=localStorage.getItem(STORE_KEY);
    if(!record)throw new Error('브라우저에 저장된 키가 없습니다.');
    try{
      const r=JSON.parse(record),key=await derive(password,base64ToBytes(r.salt));
      const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:base64ToBytes(r.iv)},key,base64ToBytes(r.data));
      return new TextDecoder().decode(plain);
    }catch {throw new Error('암호가 틀렸거나 저장된 키가 손상되었습니다.');}
  }
  function hasKey(){return !!localStorage.getItem(STORE_KEY);}
  function clearKey(){localStorage.removeItem(STORE_KEY);}
  root.GlobalSubSecure={saveKey,loadKey,hasKey,clearKey};
})(globalThis);
