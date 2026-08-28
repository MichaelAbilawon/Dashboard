'use strict';

/* ════════════════════════════════════════════════════════
   AUTH — email/password login gate for upload.html
   ════════════════════════════════════════════════════════
   Uses Supabase Auth's REST API directly (no supabase-js SDK
   pulled in) to stay consistent with the rest of this project,
   which has no build step and no package dependencies.

   This does NOT touch index.html — the dashboard stays open
   to read with no login, exactly as before. This gate exists
   only so that writes to daily_sales (which the SQL migration
   in sql/001_lockdown_daily_sales_writes.sql now requires an
   "uploader" role for) have a way to authenticate.
   ════════════════════════════════════════════════════════ */

var SB_SESSION_KEY = 'rainoil_sb_session';

function saveSession(session){
  // session: { access_token, refresh_token, expires_at, email }
  localStorage.setItem(SB_SESSION_KEY, JSON.stringify(session));
}

function getSession(){
  try{
    var raw = localStorage.getItem(SB_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  }catch(e){ return null; }
}

function clearSession(){
  localStorage.removeItem(SB_SESSION_KEY);
}

function isSessionValid(session){
  if(!session || !session.access_token || !session.expires_at) return false;
  // 30s buffer so we don't fire a request with a token that
  // expires mid-flight
  return (session.expires_at * 1000) > (Date.now() + 30000);
}

// Exchanges email+password for an access/refresh token pair.
// Throws with a readable message on failure.
async function signIn(email, password){
  var url = getUrl();
  var anonKey = getKey();
  if(!url || !anonKey){
    throw new Error('Enter the Supabase URL and anon key above first.');
  }

  var resp = await fetch(url+'/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': anonKey
    },
    body: JSON.stringify({ email: email, password: password })
  });

  var data = await resp.json();
  if(!resp.ok){
    throw new Error(data.error_description || data.msg || 'Sign-in failed.');
  }

  saveSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at, // unix seconds, from Supabase
    email: email
  });
  return data;
}

// Attempts to refresh an expired session using the stored
// refresh_token. Returns the new session, or null if refresh
// wasn't possible (caller should fall back to showing the login form).
async function refreshSession(){
  var session = getSession();
  if(!session || !session.refresh_token) return null;

  var url = getUrl();
  var anonKey = getKey();
  if(!url || !anonKey) return null;

  try{
    var resp = await fetch(url+'/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': anonKey
      },
      body: JSON.stringify({ refresh_token: session.refresh_token })
    });
    var data = await resp.json();
    if(!resp.ok) { clearSession(); return null; }

    var newSession = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
      email: session.email
    };
    saveSession(newSession);
    return newSession;
  }catch(e){
    return null;
  }
}

// Returns a valid access_token, refreshing first if needed, or
// null if the user needs to sign in again.
async function getValidAccessToken(){
  var session = getSession();
  if(isSessionValid(session)) return session.access_token;
  var refreshed = await refreshSession();
  return refreshed ? refreshed.access_token : null;
}

function signOut(){
  clearSession();
  updateAuthUI();
}

// Shows/hides the login form vs. the upload form based on
// whether we currently hold a usable session. Does not make any
// network calls itself — call refreshSession() first if you need
// to confirm the token is still valid server-side.
function updateAuthUI(){
  var session = getSession();
  var signedIn = isSessionValid(session);
  document.getElementById('loginBox').style.display = signedIn ? 'none' : 'block';
  document.getElementById('uploadForm').style.display = signedIn ? 'block' : 'none';
  if(signedIn){
    document.getElementById('signedInAs').textContent = session.email;
  }
}

async function doSignIn(){
  var emailEl = document.getElementById('inpEmail');
  var passEl  = document.getElementById('inpPassword');
  var btn     = document.getElementById('btnSignIn');
  var errEl   = document.getElementById('loginError');

  errEl.textContent = '';
  btn.disabled = true;
  try{
    await signIn(emailEl.value.trim(), passEl.value);
    passEl.value = '';
    updateAuthUI();
  }catch(e){
    errEl.textContent = '❌ ' + e.message;
  }finally{
    btn.disabled = false;
  }
}

window.addEventListener('DOMContentLoaded', async function(){
  // If we have a session but it's expired, try a silent refresh
  // before deciding whether to show the login form.
  var session = getSession();
  if(session && !isSessionValid(session)){
    await refreshSession();
  }
  updateAuthUI();
});
