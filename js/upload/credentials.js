'use strict';

// ── CONFIG (auto-saves to localStorage) ──────────────────────
var SB_URL_KEY = 'rainoil_sb_url';
var SB_KEY_KEY = 'rainoil_sb_key';

function getUrl(){ return document.getElementById('inpUrl').value.trim() || localStorage.getItem(SB_URL_KEY) || ''; }
function getKey(){ return document.getElementById('inpKey').value.trim() || localStorage.getItem(SB_KEY_KEY) || ''; }

window.onload = function(){
  var savedUrl = localStorage.getItem(SB_URL_KEY);
  var savedKey = localStorage.getItem(SB_KEY_KEY);
  if(savedUrl) document.getElementById('inpUrl').value = savedUrl;
  if(savedKey) document.getElementById('inpKey').value = savedKey;
  if(savedUrl && savedKey) document.getElementById('credsBox').style.display = 'none';

  // Default date to today
  var today = new Date();
  var yyyy = today.getFullYear();
  var mm   = String(today.getMonth()+1).padStart(2,'0');
  var dd   = String(today.getDate()).padStart(2,'0');
  document.getElementById('inpDate').value = yyyy+'-'+mm+'-'+dd;
};

