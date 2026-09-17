'use strict';

/* ════════════════════════════════════════════════════════
   PERIOD ANALYSIS — page rendering
   Default view is unchanged in spirit: Station + Product +
   Start/End date → Recorded-Day Average, a daily table, CSV
   export. Two things changed under the hood:

   1. Scope can now be a single station OR "All Stations"
      (network-wide) — both read through the same
      performanceSummary() (js/business/performance-analysis.js),
      so the numbers are guaranteed consistent with Daily
      Records' network totals and with a single-station lookup.

   2. Data now comes from the already-loaded RAW_DATA instead of
      a per-change network fetch (js/services/period-analysis-service.js
      is retired — see docs/ARCHITECTURE.md). Same table, same
      null handling, same duplicate-date summing rules; this tab
      is simply synchronous now, and "All Stations" scope costs
      nothing extra since that data was already resident in
      memory for every other tab anyway.

   Once a result exists, two secondary panels become available —
   Compare Periods and Pattern Analysis — deliberately hidden
   until then, so the tab's first impression is unchanged from
   before this enhancement.
   ════════════════════════════════════════════════════════ */

function populatePeriodAnalysisStationDatalist(){
  var dl = document.getElementById('pa-station-list');
  if (dl.children.length) return; // populated once; station list doesn't change during a session
  dl.innerHTML = stationOptionsDatalist();
}

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

// Scope toggle: "Single Station" shows the station search box;
// "All Stations" hides it (the field becomes irrelevant) and
// switches performanceSummary() to network-wide mode.
function setPaScope(scope){
  STATE.paScope = scope;
  document.getElementById('pa-station-field').style.display = (scope==='all') ? 'none' : '';
  document.querySelectorAll('#pa-scope-group .seg-btn').forEach(function(b){
    b.classList.toggle('active', b.dataset.val===scope);
  });
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
    scope:   STATE.paScope || 'station',
    station: STATE.paStation, // only meaningful when scope==='station'
    product: document.getElementById('pa-product').value,
    start:   document.getElementById('pa-start').value,
    end:     document.getElementById('pa-end').value
  };
}

function renderPeriodAnalysis(){
  populatePeriodAnalysisStationDatalist();

  var inputs = readPeriodAnalysisInputs();
  STATE.paProduct = inputs.product;
  STATE.paStart = inputs.start || null;
  STATE.paEnd = inputs.end || null;

  var errEl = document.getElementById('pa-error');
  errEl.textContent = '';

  var scopeNeedsStation = inputs.scope==='station';
  if ((scopeNeedsStation && !inputs.station) || !inputs.start || !inputs.end){
    periodAnalysisEmptyState(scopeNeedsStation
      ? 'Select a station, product, and date range to see results.'
      : 'Select a product and date range to see results.');
    closePaPanels();
    return;
  }
  if (inputs.end < inputs.start){
    errEl.textContent = 'End date cannot be earlier than start date.';
    periodAnalysisEmptyState('Fix the date range above to see results.');
    closePaPanels();
    return;
  }

  var productLabel = inputs.product === 'pms' ? 'PMS' : 'AGO';
  var stationFilter = scopeNeedsStation ? inputs.station : null;
  var summary = performanceSummary(inputs.start, inputs.end, inputs.product, stationFilter);
  PERIOD_ROWS_CACHE = summary.series;

  if (summary.recordedDays === 0){
    periodAnalysisEmptyState('No recorded sales data available for this period.');
    closePaPanels();
    return;
  }

  document.getElementById('pa-prompt').style.display = 'none';
  document.getElementById('pa-results').style.display = 'block';

  var scopeLabel = scopeNeedsStation ? inputs.station : 'All Stations';
  document.getElementById('pa-context').textContent =
    scopeLabel + ' — ' + productLabel + ' — ' + fmtDateShort(inputs.start) + ' – ' + fmtDateShort(inputs.end);
  document.getElementById('pa-vol-col').textContent = productLabel + ' Volume (L)';

  var bw = bestWorstDay(summary.series);

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
  kpi('Best Recorded Day', bw.best ? (fmtVFull(bw.best.value)+' L') : '—',
    bw.best ? (bw.best.dates.length>1 ? bw.best.dates.length+' tied dates — see table' : fmtDateShort(bw.best.dates[0])+' — '+WEEKDAY_NAMES[weekdayOf(bw.best.dates[0])]) : '');
  kpi('Lowest Recorded Day', bw.worst ? (fmtVFull(bw.worst.value)+' L') : '—',
    bw.worst ? (bw.worst.dates.length>1 ? bw.worst.dates.length+' tied dates — see table' : fmtDateShort(bw.worst.dates[0])) : '');

  var bestSet = bw.best ? bw.best.dates : [];
  var worstSet = bw.worst ? bw.worst.dates : [];
  var body = document.getElementById('pa-body'); body.innerHTML = '';
  summary.series.forEach(function(r){
    var tag = bestSet.indexOf(r.date)>-1 ? ' pa-best-row' : (worstSet.indexOf(r.date)>-1 ? ' pa-worst-row' : '');
    var badge = bestSet.indexOf(r.date)>-1 ? ' <span class="pa-badge pa-badge-best">Best</span>' : (worstSet.indexOf(r.date)>-1 ? ' <span class="pa-badge pa-badge-worst">Lowest</span>' : '');
    body.innerHTML += '<tr class="'+tag+'"><td class="name-cell">'+fmtDateShort(r.date)+badge+'</td><td class="pa-weekday-cell">'+WEEKDAY_NAMES[weekdayOf(r.date)].slice(0,3)+'</td><td class="num">'+fmtVFull(r.volume)+'</td></tr>';
  });
  document.getElementById('pa-count').textContent = summary.recordedDays + ' recorded day(s)';
  document.getElementById('pa-tbl-footer').textContent =
    'Total '+fmtVFull(summary.totalVolume)+' L across '+summary.recordedDays+' recorded day(s) → average '+fmtVFull(summary.avgDaily)+' L/day. '+
    'Days with no record, or a blank '+productLabel+' value that day, are excluded from both the total and the day count — never treated as zero.'+
    (bestSet.length>1 ? ' '+bestSet.length+' day(s) are tied for the highest recorded volume.' : '')+
    (worstSet.length>1 ? ' '+worstSet.length+' day(s) are tied for the lowest recorded volume.' : '');

  // Cache everything the two secondary panels need so they don't have
  // to re-derive scope/product/summary from the DOM independently.
  PA_ACTIVE = { scope: inputs.scope, station: inputs.station, product: inputs.product,
    start: inputs.start, end: inputs.end, summary: summary, bestWorst: bw };

  renderPaDigDeeper();
  if (STATE.paCompareOpen) renderPaCompare();
  if (STATE.paPatternOpen) renderPaPattern();
}

var PA_ACTIVE = null; // set by renderPeriodAnalysis() whenever a result is showing; read by the two panels below

function closePaPanels(){
  PA_ACTIVE = null;
  document.getElementById('pa-dig-deeper').style.display = 'none';
  document.getElementById('pa-compare-panel').style.display = 'none';
  document.getElementById('pa-pattern-panel').style.display = 'none';
}

/* ════════════════════════════════════════════════════════
   DIG DEEPER — the reveal Option 3 asked for: invisible until
   a result exists, so the tab's first impression on load is
   unchanged from before this enhancement.
   ════════════════════════════════════════════════════════ */
function renderPaDigDeeper(){
  document.getElementById('pa-dig-deeper').style.display = 'flex';
  document.getElementById('pa-compare-toggle').classList.toggle('active', !!STATE.paCompareOpen);
  document.getElementById('pa-pattern-toggle').classList.toggle('active', !!STATE.paPatternOpen);
}
function togglePaCompare(){
  STATE.paCompareOpen = !STATE.paCompareOpen;
  if (STATE.paCompareOpen) STATE.paPatternOpen = false; // one panel at a time — keeps the page from getting cluttered
  renderPaDigDeeper();
  document.getElementById('pa-pattern-panel').style.display = 'none';
  if (STATE.paCompareOpen) renderPaCompare(); else document.getElementById('pa-compare-panel').style.display = 'none';
}
function togglePaPattern(){
  STATE.paPatternOpen = !STATE.paPatternOpen;
  if (STATE.paPatternOpen) STATE.paCompareOpen = false;
  renderPaDigDeeper();
  document.getElementById('pa-compare-panel').style.display = 'none';
  if (STATE.paPatternOpen) renderPaPattern(); else document.getElementById('pa-pattern-panel').style.display = 'none';
}

/* ════════════════════════════════════════════════════════
   COMPARE PERIODS (§13) — same scope/product already active;
   the user only picks a second date range. Percentage fields
   are never shown when the baseline is zero/unavailable (§20)
   — comparePeriodSummaries() already returns null for those,
   rendered here as "N/A".
   ════════════════════════════════════════════════════════ */
function onPaCompareDatesChange(){
  STATE.paCompareStart = document.getElementById('pa-cmp-start').value || null;
  STATE.paCompareEnd = document.getElementById('pa-cmp-end').value || null;
  renderPaCompare();
}
function pctOrNA(pct){ return pct===null ? 'N/A' : signed(pct, function(v){ return fmtPct(v,1); }); }
function renderPaCompare(){
  var panel = document.getElementById('pa-compare-panel');
  panel.style.display = 'block';
  if (!PA_ACTIVE) return;

  var bStart = STATE.paCompareStart, bEnd = STATE.paCompareEnd;
  var body = document.getElementById('pa-compare-body');
  var errEl = document.getElementById('pa-compare-error'); errEl.textContent = '';

  if (!bStart || !bEnd){
    body.innerHTML = '<div class="empty-state">Pick a second date range above to compare against '+fmtDateShort(PA_ACTIVE.start)+' – '+fmtDateShort(PA_ACTIVE.end)+'.</div>';
    return;
  }
  if (bEnd < bStart){
    errEl.textContent = 'End date cannot be earlier than start date.';
    body.innerHTML = '';
    return;
  }

  var stationFilter = PA_ACTIVE.scope==='station' ? PA_ACTIVE.station : null;
  var summaryB = performanceSummary(bStart, bEnd, PA_ACTIVE.product, stationFilter);
  var cmp = comparePeriodSummaries(PA_ACTIVE.summary, summaryB);
  var productLabel = PA_ACTIVE.product==='pms' ? 'PMS' : 'AGO';

  if (summaryB.recordedDays===0){
    body.innerHTML = '<div class="empty-state">No recorded sales data available for '+fmtDateShort(bStart)+' – '+fmtDateShort(bEnd)+' — no comparable baseline.</div>';
    return;
  }

  body.innerHTML =
    '<div class="tbl-wrap"><div class="tbl-scroll"><table><thead><tr>'+
      '<th></th><th class="num">Period A: '+fmtDateShort(PA_ACTIVE.start)+' – '+fmtDateShort(PA_ACTIVE.end)+'</th>'+
      '<th class="num">Period B: '+fmtDateShort(bStart)+' – '+fmtDateShort(bEnd)+'</th><th class="num">Difference (A − B)</th>'+
    '</tr></thead><tbody>'+
      '<tr><td class="name-cell">Total '+productLabel+' Volume</td><td class="num">'+fmtVFull(PA_ACTIVE.summary.totalVolume)+' L</td><td class="num">'+fmtVFull(summaryB.totalVolume)+' L</td>'+
        '<td class="num">'+signed(cmp.volDiff, function(v){return fmtVFull(v)+' L';})+' <span class="pa-pct">('+pctOrNA(cmp.volPct)+')</span></td></tr>'+
      '<tr><td class="name-cell">Recorded Sales Days</td><td class="num">'+PA_ACTIVE.summary.recordedDays+'</td><td class="num">'+summaryB.recordedDays+'</td>'+
        '<td class="num">'+signed(PA_ACTIVE.summary.recordedDays-summaryB.recordedDays, String)+'</td></tr>'+
      '<tr><td class="name-cell">Average Daily Sales</td><td class="num">'+fmtVFull(PA_ACTIVE.summary.avgDaily)+' L/day</td><td class="num">'+fmtVFull(summaryB.avgDaily)+' L/day</td>'+
        '<td class="num">'+signed(cmp.avgDiff, function(v){return fmtVFull(v)+' L/day';})+' <span class="pa-pct">('+pctOrNA(cmp.avgPct)+')</span></td></tr>'+
    '</tbody></table></div>'+
    '<div class="tbl-footer">Percentage change is shown as N/A where the comparison period has no valid baseline to divide by — never as 0% or an error value.</div></div>';
}

/* ════════════════════════════════════════════════════════
   PATTERN ANALYSIS (§9, §27) — day-of-week breakdown of the
   currently active period, plus an optional day-of-month
   investigation seeded from whichever day came out best.
   Neutral, factual language only — reports what the data
   shows, never why (§24).
   ════════════════════════════════════════════════════════ */
function renderPaPattern(){
  var panel = document.getElementById('pa-pattern-panel');
  panel.style.display = 'block';
  if (!PA_ACTIVE) return;

  var dow = dayOfWeekBreakdown(PA_ACTIVE.summary.series);
  var recordedDow = dow.filter(function(d){ return d.recordedDays>0; });
  var maxAvg = recordedDow.length ? Math.max.apply(null, recordedDow.map(function(d){return d.avgVolume;})) : null;

  var dowRows = dow.map(function(d, idx){
    var isTop = maxAvg!==null && d.avgVolume===maxAvg;
    return '<tr class="pa-clickable-row'+(isTop?' pa-best-row':'')+'" onclick="setPaPatternWeekday('+idx+')"><td class="name-cell">'+d.weekday+(isTop?' <span class="pa-badge pa-badge-best">Highest avg</span>':'')+'</td>'+
      '<td class="num">'+d.recordedDays+'</td><td class="num">'+(d.avgVolume===null?'<span class="blank-cell">—</span>':fmtVFull(d.avgVolume)+' L')+'</td></tr>';
  }).join('');

  var dowHtml = '<div class="sec-head"><div class="sec-title">Day of Week</div>'+
    '<div class="sec-sub">Average recorded daily volume by weekday, within '+fmtDateShort(PA_ACTIVE.start)+' – '+fmtDateShort(PA_ACTIVE.end)+'. Reports what was recorded — not a cause. Click a row to see that weekday in detail below.</div></div>'+
    '<div class="tbl-wrap"><div class="tbl-scroll"><table><thead><tr><th>Weekday</th><th class="num">Recorded Days</th><th class="num">Average Volume</th></tr></thead><tbody>'+dowRows+'</tbody></table></div></div>';

  // Which weekday is under investigation: an explicit pick (from the
  // selector or a clicked row above) if one has been made this
  // session, otherwise default to the best recorded day's weekday —
  // still a useful starting point, just no longer the only option.
  var bw = PA_ACTIVE.bestWorst;
  var defaultWd = (bw.best && bw.best.dates.length) ? weekdayOf(bw.best.dates[0]) : null;
  var wdIdx = (STATE.paPatternWeekday!==null && STATE.paPatternWeekday!==undefined) ? STATE.paPatternWeekday : defaultWd;

  var weekdayPickerHtml = '<div class="drill-bar" style="margin-top:1.6rem"><label>Investigate weekday</label><div class="seg-group" id="pa-weekday-group">'+
    WEEKDAY_NAMES.map(function(name, idx){
      return '<button class="seg-btn'+(idx===wdIdx?' active':'')+'" onclick="setPaPatternWeekday('+idx+')">'+name.slice(0,3)+'</button>';
    }).join('')+
    '</div></div>';

  var detailHtml = '';
  if (wdIdx!==null && wdIdx!==undefined){
    var wdName = WEEKDAY_NAMES[wdIdx];

    // ── Within the CURRENT active range: every individual occurrence
    // of this weekday, actual values, not an average — this is what
    // lets a person point at one specific date and say "this one is
    // low compared to the others right here". ──
    var withinRange = PA_ACTIVE.summary.series.filter(function(r){ return weekdayOf(r.date)===wdIdx; });
    var withinBw = bestWorstDay(withinRange); // best/worst among just this weekday's occurrences, not the whole period
    var wBest = withinBw.best ? withinBw.best.dates : [];
    var wWorst = withinBw.worst ? withinBw.worst.dates : [];
    var withinRows = withinRange.length
      ? withinRange.map(function(r){
          var badge = wBest.indexOf(r.date)>-1 ? ' <span class="pa-badge pa-badge-best">Highest</span>'
            : wWorst.indexOf(r.date)>-1 ? ' <span class="pa-badge pa-badge-worst">Lowest</span>' : '';
          var tag = wBest.indexOf(r.date)>-1 ? ' class="pa-best-row"' : (wWorst.indexOf(r.date)>-1 ? ' class="pa-worst-row"' : '');
          return '<tr'+tag+'><td class="name-cell">'+fmtDateShort(r.date)+badge+'</td><td class="num">'+fmtVFull(r.volume)+' L</td></tr>';
        }).join('')
      : '';
    var withinHtml = '<div class="sec-head" style="margin-top:1.6rem"><div class="sec-title">Every '+wdName+' — '+fmtDateShort(PA_ACTIVE.start)+' to '+fmtDateShort(PA_ACTIVE.end)+'</div>'+
      '<div class="sec-sub">Each recorded '+wdName+' in the active period, individually — not averaged — so a specific date can be compared against the others.</div></div>'+
      (withinRange.length
        ? '<div class="tbl-wrap"><div class="tbl-scroll"><table><thead><tr><th>Date</th><th class="num">Volume</th></tr></thead><tbody>'+withinRows+'</tbody></table></div>'+
          '<div class="tbl-footer">'+withinRange.length+' recorded '+wdName+'(s) in this range'+(wBest.length>1?' — '+wBest.length+' tied for highest':'')+(wWorst.length>1?' — '+wWorst.length+' tied for lowest':'')+'.</div></div>'
        : '<div class="empty-state">No recorded '+wdName+'s in '+fmtDateShort(PA_ACTIVE.start)+' – '+fmtDateShort(PA_ACTIVE.end)+'.</div>');

    // ── Across other months, aggregated — the longer-range context
    // ("and maybe month" from the request this was built for). ──
    var mks = rangeMonthKeys(STATE.paPatternRange || '12', STATE.month);
    var across = weekdayAcrossMonths(wdIdx, mks, PA_ACTIVE.product, PA_ACTIVE.scope==='station' ? PA_ACTIVE.station : null);
    var acrossRows = across.map(function(r){
      var cell = r.recordedDays===0 ? '<span class="blank-cell">No record</span>' : fmtVFull(r.totalVolume)+' L';
      var avgCell = r.recordedDays===0 ? '<span class="blank-cell">—</span>' : fmtVFull(r.avgDaily)+' L';
      return '<tr><td class="name-cell">'+r.label+'</td><td class="num">'+r.recordedDays+' of '+r.weekdayOccurrences+'</td><td class="num">'+cell+'</td><td class="num">'+avgCell+'</td></tr>';
    }).join('');
    var acrossHtml =
      '<div class="sec-head" style="margin-top:1.6rem"><div class="sec-title">'+wdName+' Performance Across Months</div>'+
        '<div class="sec-sub">How '+wdName+'s performed in other available months, for comparison against the range above.</div></div>'+
      '<div class="drill-bar"><label>Range</label><select onchange="setPaPatternRange(this.value)">'+
        '<option value="6"'+(STATE.paPatternRange==='6'?' selected':'')+'>Last 6 Months</option>'+
        '<option value="12"'+((!STATE.paPatternRange||STATE.paPatternRange==='12')?' selected':'')+'>Last 12 Months</option>'+
        '<option value="ytd"'+(STATE.paPatternRange==='ytd'?' selected':'')+'>Year to Date</option>'+
        '<option value="all"'+(STATE.paPatternRange==='all'?' selected':'')+'>All Available Data</option>'+
      '</select></div>'+
      '<div class="tbl-wrap"><div class="tbl-scroll"><table><thead><tr><th>Month</th><th class="num">Recorded '+wdName+'s</th><th class="num">Total Volume</th><th class="num">Avg. per Recorded '+wdName+'</th></tr></thead><tbody>'+acrossRows+'</tbody></table></div>'+
      '<div class="tbl-footer">"Recorded '+wdName+'s" shows how many of that month\'s '+wdName+'s (always 4 or 5) actually have a valid record — the average divides by the recorded count only, never the full calendar count.</div></div>';

    detailHtml = withinHtml + acrossHtml;
  }

  panel.querySelector('#pa-pattern-body').innerHTML = dowHtml + weekdayPickerHtml + detailHtml;
}
function setPaPatternWeekday(idx){ STATE.paPatternWeekday = idx; renderPaPattern(); }
function setPaPatternRange(r){ STATE.paPatternRange = r; renderPaPattern(); }

/* ════════════════════════════════════════════════════════
   CSV EXPORT — unchanged from before: exports exactly
   PERIOD_ROWS_CACHE, the rows currently on screen.
   ════════════════════════════════════════════════════════ */
function exportPeriodAnalysisCSV(){
  if (!PERIOD_ROWS_CACHE.length) return;
  var productLabel = STATE.paProduct === 'pms' ? 'PMS' : 'AGO';
  var scopeSlug = (STATE.paScope==='all') ? 'AllStations' : (STATE.paStation||'station').replace(/[^a-z0-9]+/gi,'_');
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
  var filename = 'Period_Analysis_'+scopeSlug+'_'+productLabel+'_'+stamp+'.csv';
  var a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
}
