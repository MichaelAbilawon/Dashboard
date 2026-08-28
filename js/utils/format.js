'use strict';

/* ════════════════════════════════════════════════════════
   FORMATTING HELPERS
   ════════════════════════════════════════════════════════ */
var MONTHS=['','January','February','March','April','May','June','July','August','September','October','November','December'];

function fmtCompact(n) {
  if (n===undefined||n===null||isNaN(n)) return '—';
  var sign = n<0 ? '-' : ''; n = Math.abs(n);
  if (n>=1e9) return sign+'₦'+(n/1e9).toFixed(2)+'B';
  if (n>=1e6) return sign+'₦'+(n/1e6).toFixed(1)+'M';
  if (n>=1e3) return sign+'₦'+(n/1e3).toFixed(0)+'K';
  return sign+'₦'+n.toFixed(0);
}
function fmtNFull(n){ if(n===undefined||n===null||isNaN(n)) return '—'; return '₦'+Math.round(n).toLocaleString('en-NG'); }
function fmtVFull(n){ if(n===undefined||n===null||isNaN(n)) return '—'; return Math.round(n).toLocaleString('en-NG'); }
function fmtVCompact(n){
  if(n===undefined||n===null||isNaN(n)) return '—';
  var sign=n<0?'-':''; n=Math.abs(n);
  if(n>=1e6) return sign+(n/1e6).toFixed(2)+'M L';
  if(n>=1e3) return sign+(n/1e3).toFixed(0)+'K L';
  return sign+n.toFixed(0)+' L';
}
function fmtPct(n,d){ if(n===undefined||n===null||isNaN(n)) return '—'; return n.toFixed(d===undefined?1:d)+'%'; }
function signed(n,fn){ if(n===undefined||n===null||isNaN(n)) return '—'; return (n>0?'+':'')+fn(n); }
function alpha(hex,a){ hex=hex.trim(); if(hex[0]!=='#') return hex; var r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16); return 'rgba('+r+','+g+','+b+','+a+')'; }

