'use strict';

async function doUpload(){
  clearLog();
  var btn = document.getElementById('btnUpload');
  btn.disabled = true;

  var url  = getUrl();
  var key  = getKey();
  var date = document.getElementById('inpDate').value;
  var file = document.getElementById('inpFile').files[0];

  if(!url || !key){ log('❌ Please paste your Supabase URL and key above.','err'); btn.disabled=false; return; }
  if(!date){ log('❌ Please select a sales date.','err'); btn.disabled=false; return; }
  if(!file){ log('❌ Please select an Excel file.','err'); btn.disabled=false; return; }

  // Writes to daily_sales now require a signed-in "uploader"
  // account (see sql/001_lockdown_daily_sales_writes.sql). The
  // login form should already have hidden this button if there's
  // no session, but re-check here too since a session can expire
  // mid-visit.
  var accessToken = await getValidAccessToken();
  if(!accessToken){
    log('❌ Your session has expired — please sign in again.','err');
    updateAuthUI();
    btn.disabled = false;
    return;
  }

  // Save creds
  localStorage.setItem(SB_URL_KEY, url);
  localStorage.setItem(SB_KEY_KEY, key);
  document.getElementById('credsBox').style.display='none';

  log('📂 Reading file: '+file.name+'…');

  var stations;
  try{
    stations = await parseExcel(file, date);
    log('✅ Parsed '+stations.length+' stations from Excel.','ok');
  }catch(e){
    log('❌ Parse error: '+e,'err'); btn.disabled=false; return;
  }

  if(!stations.length){ log('❌ No station rows found — check file format.','err'); btn.disabled=false; return; }

  log('☁️  Uploading to Supabase in batches…');

  var BATCH = 50;
  var saved = 0, errors = 0;
  for(var i=0; i<stations.length; i+=BATCH){
    var batch = stations.slice(i, i+BATCH);
    try{
      var resp = await fetch(url+'/rest/v1/daily_sales', {
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          'apikey': key,
          'Authorization': 'Bearer '+accessToken,
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(batch)
      });
      if(!resp.ok){
        var errText = await resp.text();
        log('❌ Batch '+(Math.floor(i/BATCH)+1)+' error: '+resp.status+' '+errText,'err');
        errors += batch.length;
      } else {
        saved += batch.length;
        log('  Batch '+(Math.floor(i/BATCH)+1)+': '+batch.length+' stations saved','info');
      }
    }catch(err){
      log('❌ Network error: '+err.message,'err');
      errors += batch.length;
    }
  }

  if(saved>0){
    log('','ok');
    log('🎉 Done! '+saved+' stations saved for '+date+(errors>0?' ('+errors+' errors)':'')+'.',  'ok');
    log('The shared dashboard will show this data on next load.','ok');
  } else {
    log('❌ Upload failed — '+errors+' rows not saved.','err');
  }

  btn.disabled=false;
}
