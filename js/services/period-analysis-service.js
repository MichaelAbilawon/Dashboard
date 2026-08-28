'use strict';

/* ════════════════════════════════════════════════════════
   PERIOD ANALYSIS — SCOPED FETCH
   Deliberately separate from js/services/supabase-service.js's
   fetchAll(), which loads the ENTIRE daily_sales table into
   memory once at startup so the rest of the dashboard (month
   switch, trend charts, comparisons) can render instantly with
   no further network calls.

   Period Analysis queries can span an arbitrary station and
   date range chosen at runtime, so instead of slicing the
   already-loaded RAW_DATA, this fetches only the rows that
   actually match — one station, one date range — directly from
   the API. This keeps Period Analysis fast and light regardless
   of how many years of history accumulate, and establishes the
   scoped-fetch pattern this project would extend to the rest of
   the dashboard if the full-load approach ever stops scaling
   (see docs/ARCHITECTURE.md §14).
   ════════════════════════════════════════════════════════ */

function fetchStationPeriodRows(stationName, startDate, endDate){
  var SB_URL = (window.SUPABASE_URL||'').trim().replace(/\/$/,'');
  var SB_KEY = (window.SUPABASE_KEY||'').trim();

  var path = 'daily_sales'
    + '?select=sale_date,name,sales_pms,sales_ago'
    + '&name=eq.' + encodeURIComponent(stationName)
    + '&sale_date=gte.' + encodeURIComponent(startDate)
    + '&sale_date=lte.' + encodeURIComponent(endDate)
    + '&order=sale_date.asc';

  return fetch(SB_URL+'/rest/v1/'+path, {
    headers:{
      'Content-Type':'application/json',
      'apikey': SB_KEY,
      'Authorization': 'Bearer '+SB_KEY
    }
  }).then(function(r){
    if(!r.ok) throw new Error('HTTP '+r.status+' — '+r.statusText);
    return r.json();
  });
}
