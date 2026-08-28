'use strict';

/* ════════════════════════════════════════════════════════
   SUPABASE FETCH — daily_sales (actuals) + monthly_budgets (targets, read-only here)
   Targets are administered exclusively through the separate
   Budget Administration page. This dashboard never writes
   to monthly_budgets and exposes no input controls for it.
   ════════════════════════════════════════════════════════ */
(function(){
  var SB_URL = (window.SUPABASE_URL||'').trim().replace(/\/$/,'');
  var SB_KEY = (window.SUPABASE_KEY||'').trim();

  function setStatus(msg,isErr){ var el=document.getElementById('cloud-status'); if(el){ el.textContent=msg; el.className='cloud-status'+(isErr?' err':''); } }
  function setProgress(pct){ var el=document.getElementById('cloud-prog-fill'); if(el) el.style.width=Math.min(100,pct)+'%'; }

  function sbGet(path){
    return fetch(SB_URL+'/rest/v1/'+path,{headers:{'Content-Type':'application/json','apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY,'Range-Unit':'items'}})
      .then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status+' — '+r.statusText); return r.json(); });
  }
  function rowToStation(r){
    // Deliberately NOT coalescing with ||0 here: a null/undefined value means
    // the source Excel cell was blank, and that fact matters for the Daily
    // Records page and the missing-data indicator. Aggregation below treats
    // null as 0 for arithmetic (via the N() helper) without losing the
    // distinction at the row level.
    return { name:r.name, salesPMS:r.sales_pms, salesAGO:r.sales_ago, salesDPK:r.sales_dpk,
      valPMS:r.val_pms, valAGO:r.val_ago, valDPK:r.val_dpk,
      total:r.total, totalVol:r.total_vol, isZero:r.is_zero||false };
  }

  var PAGE_SIZE=1000;
  function fetchPage(offset){
    return sbGet('daily_sales?select=sale_date,name,sales_pms,sales_ago,sales_dpk,val_pms,val_ago,val_dpk,total,total_vol,is_zero&order=sale_date.asc,name.asc&limit='+PAGE_SIZE+'&offset='+offset);
  }

  // Monthly targets are stored server-side so every viewer sees the same
  // figures the admin set — never invented, never client-local.
  function fetchBudgets(){
    return sbGet('monthly_budgets?select=month_key,pms_vol,pms_rev,ago_vol,ago_rev,dpk_vol,dpk_rev')
      .then(function(rows){
        var out={};
        (rows||[]).forEach(function(r){
          out[r.month_key] = {
            pms:{vol:r.pms_vol||0, rev:r.pms_rev||0},
            ago:{vol:r.ago_vol||0, rev:r.ago_rev||0},
            dpk:{vol:r.dpk_vol||0, rev:r.dpk_rev||0}
          };
        });
        return out;
      })
      .catch(function(){ return {}; }); // table not yet provisioned — dashboard still works, targets show as pending
  }

  // Best-effort "when was this data last loaded" signal. Tries a created_at
  // column first (present if the uploader stamps inserts); if that column
  // doesn't exist or the request fails for any reason, this fails silently
  // and the dashboard falls back to the latest reporting date instead —
  // never blocks or breaks the main data load.
  function fetchFreshness(){
    return sbGet('daily_sales?select=created_at&order=created_at.desc&limit=1')
      .then(function(rows){ return (rows && rows[0] && rows[0].created_at) ? rows[0].created_at : null; })
      .catch(function(){ return null; });
  }

  async function fetchAll(){
    setStatus('Fetching all available data from database…'); setProgress(5);
    var countResp;
    try{
      countResp = await fetch(SB_URL+'/rest/v1/daily_sales?select=id',{headers:{'apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY,'Prefer':'count=exact','Range-Unit':'items','Range':'0-0'}});
    }catch(e){ setStatus('Connection failed — check your Supabase URL and key.', true); return; }
    var totalRows=0; var cr=countResp.headers.get('Content-Range')||''; var m=cr.match(/\/(\d+)/); if(m) totalRows=parseInt(m[1],10);
    if (totalRows===0){ setStatus('No data found in database yet. Upload files via upload.html first.', true); return; }
    setStatus('Loading '+totalRows.toLocaleString()+' records…'); setProgress(10);

    var allRows=[], offset=0, pages=Math.ceil(totalRows/PAGE_SIZE);
    for (var page=0; page<pages; page++){
      try{
        var rows = await fetchPage(offset);
        allRows = allRows.concat(rows);
        offset += PAGE_SIZE;
        setProgress(10 + Math.round(((page+1)/pages)*65));
        setStatus('Loading… '+allRows.length.toLocaleString()+' of '+totalRows.toLocaleString()+' records');
      }catch(e){ setStatus('Error loading data: '+e.message, true); return; }
    }

    setStatus('Loading monthly targets…'); setProgress(80);
    BUDGETS = await fetchBudgets();

    setStatus('Checking data freshness…'); setProgress(85);
    LAST_UPLOAD_TS = await fetchFreshness();

    setStatus('Processing records…'); setProgress(90);
    allRows.forEach(function(r){
      var iso=r.sale_date;
      if(!RAW_DATA[iso]) RAW_DATA[iso]={date:iso,stations:[]};
      RAW_DATA[iso].stations.push(rowToStation(r));
    });
    setProgress(96);
    setStatus('Ready — building monthly views…');
    await new Promise(function(res){ setTimeout(res,250); });

    buildMonthlyAggregates();
    document.getElementById('cloud-screen').style.display='none';
    launchDashboard();
  }

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', fetchAll); else fetchAll();
}());

