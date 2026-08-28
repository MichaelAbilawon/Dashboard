'use strict';

/* ════════════════════════════════════════════════════════
   PERIOD ANALYSIS — page rendering
   Station + Product + Start date + End date → Recorded-Day
   Average. Fetches directly from Supabase (scoped to the
   selected station/date range — see
   js/services/period-analysis-service.js) rather than reading
   from the already-loaded RAW_DATA, then hands the raw rows to
   js/business/period-analysis.js's summarizePeriodRows(), the
   single trusted place this dashboard computes a recorded-day
   average.
   ════════════════════════════════════════════════════════ */

var PERIOD_ANALYSIS_REQUEST_ID = 0; // guards against a slow earlier
  // request overwriting a faster later one if the user changes
  // filters again before the first fetch has returned

function populatePeriodAnalysisStationDatalist(){
  var dl = document.getElementById('pa-station-list');
  if (dl.children.length) return; // populated once; station list doesn't change during a session
  // Reuses stationOptionsDatalist() from js/pages/stations.js (built for
  // Compare Stations' own search boxes) — called with no exclusion since
  // Period Analysis only ever picks one station, not two.
  dl.innerHTML = stationOptionsDatalist();
}

// Mirrors js/pages/stations.js's onCmpAChange()/onCmpBChange(): typed
// text is matched case-insensitively against the real station list.
// On a match, STATE.paStation is updated and the box is normalized to
// the station's canonical name/casing. On no match (a typo, or a
// station that doesn't exist), the box reverts to the last valid
// selection rather than letting an unvalidated string reach the
// fetch — Compare Stations achieves the same outcome by fully
// rebuilding its picker's HTML on every render; this input is static,
// so the revert has to be done explicitly here instead.
function onPaStationChange(v){
  v = v.trim();
  var match = allStationNames().find(function(n){ return n.toLowerCase()===v.toLowerCase(); });
  var input = document.getElementById('pa-station');
  if (match){
    STATE.paStation = match;
    input.value = match;
  } else {
    input.value = STATE.paStation || '';
  }
  renderPeriodAnalysis();
}

function periodAnalysisEmptyState(message){
  document.getElementById('pa-results').style.display = 'none';
  var prompt = document.getElementById('pa-prompt');
  prompt.style.display = 'block';
  prompt.textContent = message;
}

function readPeriodAnalysisInputs(){
  return {
    // Station comes from STATE, not the input's raw .value — the
    // value can briefly hold unvalidated typed text before
    // onPaStationChange() has a chance to correct it; STATE.paStation
    // is only ever set to a confirmed real station name.
    station: STATE.paStation,
    product: document.getElementById('pa-product').value,
    start:   document.getElementById('pa-start').value,
    end:     document.getElementById('pa-end').value
  };
}

async function renderPeriodAnalysis(){
  populatePeriodAnalysisStationDatalist();

  var inputs = readPeriodAnalysisInputs();
  STATE.paProduct = inputs.product;
  STATE.paStart = inputs.start || null;
  STATE.paEnd = inputs.end || null;

  var errEl = document.getElementById('pa-error');
  errEl.textContent = '';

  if (!inputs.station || !inputs.start || !inputs.end){
    periodAnalysisEmptyState('Select a station, product, and date range to see results.');
    return;
  }
  if (inputs.end < inputs.start){
    errEl.textContent = 'End date cannot be earlier than start date.';
    periodAnalysisEmptyState('Fix the date range above to see results.');
    return;
  }

  var requestId = ++PERIOD_ANALYSIS_REQUEST_ID;
  periodAnalysisEmptyState('Loading period data…');

  var rows;
  try{
    rows = await fetchStationPeriodRows(inputs.station, inputs.start, inputs.end);
  }catch(e){
    if (requestId !== PERIOD_ANALYSIS_REQUEST_ID) return; // a newer request superseded this one
    periodAnalysisEmptyState('Could not load period data — ' + e.message + '. Please try again.');
    return;
  }
  if (requestId !== PERIOD_ANALYSIS_REQUEST_ID) return; // user changed filters while this was in flight

  var productLabel = inputs.product === 'pms' ? 'PMS' : 'AGO';
  var summary = summarizePeriodRows(rows, inputs.product);
  PERIOD_ROWS_CACHE = summary.series;

  if (summary.recordedDays === 0){
    periodAnalysisEmptyState('No recorded sales data available for this period.');
    return;
  }

  document.getElementById('pa-prompt').style.display = 'none';
  document.getElementById('pa-results').style.display = 'block';

  document.getElementById('pa-context').textContent =
    inputs.station + ' — ' + productLabel + ' — ' + fmtDateShort(inputs.start) + ' – ' + fmtDateShort(inputs.end);
  document.getElementById('pa-vol-col').textContent = productLabel + ' Volume (L)';

  var kEl = document.getElementById('pa-kpis'); kEl.innerHTML = '';
  function kpi(label, val, sub, accent){
    var d = document.createElement('div');
    d.className = 'kpi-card' + (accent ? ' accent' : '');
    d.innerHTML = '<div class="kpi-label">'+label+'</div><div class="kpi-val">'+val+'</div>'+(sub?'<div class="kpi-sub">'+sub+'</div>':'');
    kEl.appendChild(d);
  }
  kpi('Average Daily Sales', fmtVFull(summary.avgDaily)+' L/day', 'Recorded-day average', true);
  kpi('Total Volume', fmtVFull(summary.totalVolume)+' L', productLabel+' across recorded days');
  kpi('Recorded Sales Days', String(summary.recordedDays), 'Unique days with a valid record');

  var body = document.getElementById('pa-body'); body.innerHTML = '';
  summary.series.forEach(function(r){
    body.innerHTML += '<tr><td class="name-cell">'+fmtDateShort(r.date)+'</td><td class="num">'+fmtVFull(r.volume)+'</td></tr>';
  });
  document.getElementById('pa-count').textContent = summary.recordedDays + ' recorded day(s)';
  document.getElementById('pa-tbl-footer').textContent =
    'Total '+fmtVFull(summary.totalVolume)+' L across '+summary.recordedDays+' recorded day(s) → average '+fmtVFull(summary.avgDaily)+' L/day. '+
    'Days with no record, or a blank '+productLabel+' value that day, are excluded from both the total and the day count — never treated as zero.';
}

/* ════════════════════════════════════════════════════════
   CSV EXPORT — exports exactly PERIOD_ROWS_CACHE, the same
   rows currently on screen for the selected station/product/
   date range. Mirrors js/pages/daily-records.js's export
   pattern and reuses its csvCell() escaping helper.
   ════════════════════════════════════════════════════════ */
function exportPeriodAnalysisCSV(){
  if (!PERIOD_ROWS_CACHE.length) return;
  var productLabel = STATE.paProduct === 'pms' ? 'PMS' : 'AGO';
  var headers = ['Date', productLabel+' Volume (L)'];
  var lines = [headers.map(csvCell).join(',')];
  PERIOD_ROWS_CACHE.forEach(function(r){
    lines.push([r.date, r.volume].map(csvCell).join(','));
  });
  var blob = new Blob([lines.join('\r\n')], {type:'text/csv;charset=utf-8;'});
  var url = URL.createObjectURL(blob);
  var now = new Date();
  function pad(n){ return String(n).padStart(2,'0'); }
  var stamp = now.getFullYear()+'-'+pad(now.getMonth()+1)+'-'+pad(now.getDate())+'_'+pad(now.getHours())+pad(now.getMinutes());
  var stationSlug = (STATE.paStation||'station').replace(/[^a-z0-9]+/gi,'_');
  var filename = 'Period_Analysis_'+stationSlug+'_'+productLabel+'_'+stamp+'.csv';
  var a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
}
