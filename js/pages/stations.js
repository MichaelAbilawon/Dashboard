'use strict';

/* ════════════════════════════════════════════════════════
   TAB 4 — STATIONS
   Rank is computed once, over the COMPLETE relevant station
   population for the selected period — the whole month, or
   a single day within it if the day selector is used — under
   the chosen sort key, before any search filter is applied.
   Search only hides non-matching rows; it can never renumber
   the survivors. A station's rank is therefore always its
   true position in the full ranking for that period, exactly
   as required.

   This is one page — "Station Performance" — not a separate
   daily dashboard. The Day selector is page-local context,
   not a global mode switch.
   ════════════════════════════════════════════════════════ */
function ensureDayOptions(mk){
  var sel = document.getElementById('stn-day');
  if (sel.dataset.month !== mk){
    var dates = datesInMonth(mk);
    sel.innerHTML = '<option value="all">All Days (Month)</option>'+dates.map(function(d){ return '<option value="'+d+'">'+fmtDateShort(d)+'</option>'; }).join('');
    sel.dataset.month = mk;
  }
  var hasOpt = Array.prototype.some.call(sel.options, function(o){ return o.value===STATE.day; });
  sel.value = hasOpt ? STATE.day : 'all';
  STATE.day = sel.value;
}
function onStationDayChange(v){ STATE.day = v; renderStations(STATE.month); }
function selectStation(name){ STATE.selectedStation = name; STATE.stationsSubtab='perf'; renderStations(STATE.month); }
function clearSelectedStation(){ STATE.selectedStation = null; renderStations(STATE.month); }

/* ════════════════════════════════════════════════════════
   STATIONS TAB — sub-navigation between the existing Station
   Performance list/detail and the new Compare Stations view.
   Both live under the one "Stations" top-level tab, per the
   requirement that this stay a drill-down, not a new page.
   ════════════════════════════════════════════════════════ */
function switchStationsSubtab(mode){
  STATE.stationsSubtab = mode;
  document.getElementById('stn-subtab-perf').classList.toggle('active', mode==='perf');
  document.getElementById('stn-subtab-cmp').classList.toggle('active', mode==='cmp');
  var cmpView = document.getElementById('stations-compare-view');
  if (mode==='perf'){
    cmpView.style.display='none';
    renderStations(STATE.month);
  } else {
    document.getElementById('stations-list-view').style.display='none';
    document.getElementById('stations-detail-view').style.display='none';
    cmpView.style.display='';
    renderStationCompare();
  }
}
function goToStationFromCompare(name){
  STATE.selectedStation = name;
  switchStationsSubtab('perf');
}

/* ════════════════════════════════════════════════════════
   STATION COMPARISON — "How do these two stations compare
   for the same product over the same period?" Reuses the
   same stationProductSeries()/rangeMonthKeys() helpers as
   Monthly Product Trend, so the underlying numbers are
   guaranteed to match the single-station view and the rest
   of the dashboard. PMS and AGO are never mixed in one
   comparison, and a station cannot be picked as both sides.
   ════════════════════════════════════════════════════════ */
function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }
function stationOptionsDatalist(excludeName){
  return allStationNames().filter(function(n){ return n!==excludeName; })
    .map(function(n){ return '<option value="'+esc(n)+'">'; }).join('');
}
function onCmpAChange(v){
  v = v.trim();
  var match = allStationNames().find(function(n){ return n.toLowerCase()===v.toLowerCase(); });
  if (match && match!==STATE.cmpB) STATE.cmpA = match;
  renderStationCompare();
}
function onCmpBChange(v){
  v = v.trim();
  var match = allStationNames().find(function(n){ return n.toLowerCase()===v.toLowerCase(); });
  if (match && match!==STATE.cmpA) STATE.cmpB = match;
  renderStationCompare();
}
function swapCmpStations(){ var t=STATE.cmpA; STATE.cmpA=STATE.cmpB; STATE.cmpB=t; renderStationCompare(); }
function setCmpProduct(p){ STATE.cmpProduct = p; renderStationCompare(); }
function setCmpRange(r){ STATE.cmpRange = r; renderStationCompare(); }

function renderStationCompare(){
  var A = STATE.cmpA, B = STATE.cmpB;
  var productLabel = STATE.cmpProduct==='pms' ? 'PMS' : 'AGO';

  var picker =
    '<div class="sec-head"><div class="sec-title">Compare Stations</div>'+
      '<div class="sec-sub">Actual '+productLabel+' volume, station vs station, over the same period. No forecasting — recorded sales only.</div></div>'+
    '<div class="cmp-picker">'+
      '<div class="cmp-slot"><label>Station A</label>'+
        '<input type="text" list="dl-stations-a" value="'+esc(A||'')+'" placeholder="Search station…" onchange="onCmpAChange(this.value)">'+
        '<datalist id="dl-stations-a">'+stationOptionsDatalist(B)+'</datalist></div>'+
      '<div class="cmp-vs">VS</div>'+
      '<div class="cmp-slot"><label>Station B</label>'+
        '<input type="text" list="dl-stations-b" value="'+esc(B||'')+'" placeholder="Search station…" onchange="onCmpBChange(this.value)">'+
        '<datalist id="dl-stations-b">'+stationOptionsDatalist(A)+'</datalist></div>'+
      '<button class="hbtn" onclick="swapCmpStations()" title="Swap Station A and Station B">Swap ⇄</button>'+
    '</div>'+
    '<div class="drill-bar">'+
      '<label>Product</label>'+
      '<div class="seg-group">'+
        '<button class="seg-btn'+(STATE.cmpProduct==='pms'?' active':'')+'" onclick="setCmpProduct(\'pms\')">PMS</button>'+
        '<button class="seg-btn'+(STATE.cmpProduct==='ago'?' active':'')+'" onclick="setCmpProduct(\'ago\')">AGO</button>'+
      '</div>'+
      '<label>Range</label>'+
      '<select onchange="setCmpRange(this.value)">'+
        '<option value="6"'+(STATE.cmpRange==='6'?' selected':'')+'>Last 6 Months</option>'+
        '<option value="12"'+(STATE.cmpRange==='12'?' selected':'')+'>Last 12 Months</option>'+
        '<option value="ytd"'+(STATE.cmpRange==='ytd'?' selected':'')+'>Year to Date</option>'+
        '<option value="all"'+(STATE.cmpRange==='all'?' selected':'')+'>All Available Data</option>'+
      '</select>'+
    '</div>';

  var view = document.getElementById('stations-compare-view');

  if (!A || !B){
    view.innerHTML = picker + '<div class="trend-empty">Pick a Station A and a Station B above to compare their '+productLabel+' performance.</div>';
    return;
  }

  var mks = rangeMonthKeys(STATE.cmpRange, STATE.month);
  var seriesA = stationProductSeries(A, STATE.cmpProduct, mks);
  var seriesB = stationProductSeries(B, STATE.cmpProduct, mks);
  var anyData = seriesA.some(function(p){return p.val!==null;}) || seriesB.some(function(p){return p.val!==null;});

  if (!anyData){
    view.innerHTML = picker + '<div class="trend-empty">No '+productLabel+' records found for '+A+' or '+B+' in the selected range.</div>';
    return;
  }

  var totalA=0, totalB=0, monthsAHigher=0, monthsBHigher=0, monthsCompared=0;
  seriesA.forEach(function(p){ totalA += N(p.val); });
  seriesB.forEach(function(p){ totalB += N(p.val); });
  mks.forEach(function(mk,i){
    var a=seriesA[i].val, b=seriesB[i].val;
    if (a!==null && b!==null){
      monthsCompared++;
      if (a>b) monthsAHigher++; else if (b>a) monthsBHigher++;
    }
  });
  var diffTotal = (seriesA.some(function(p){return p.val!==null;}) && seriesB.some(function(p){return p.val!==null;})) ? (totalA-totalB) : null;

  var summary = '<div class="cmp-summary">'+
    '<div class="stat-item"><div class="stat-item-label">'+esc(A)+' Total</div><div class="stat-item-val">'+fmtVFull(totalA)+' L</div><div class="stat-item-sub"><a class="rank-link" onclick="goToStationFromCompare(\''+A.replace(/'/g,"\\'")+'\')">View ranking</a></div></div>'+
    '<div class="stat-item"><div class="stat-item-label">'+esc(B)+' Total</div><div class="stat-item-val">'+fmtVFull(totalB)+' L</div><div class="stat-item-sub"><a class="rank-link" onclick="goToStationFromCompare(\''+B.replace(/'/g,"\\'")+'\')">View ranking</a></div></div>'+
    '<div class="stat-item"><div class="stat-item-label">Difference (A − B)</div><div class="stat-item-val">'+(diffTotal===null?'—':signed(diffTotal,fmtVFull)+' L')+'</div></div>'+
    '<div class="stat-item"><div class="stat-item-label">Months A Higher</div><div class="stat-item-val">'+monthsAHigher+'</div><div class="stat-item-sub">of '+monthsCompared+' comparable month(s)</div></div>'+
    '<div class="stat-item"><div class="stat-item-label">Months B Higher</div><div class="stat-item-val">'+monthsBHigher+'</div><div class="stat-item-sub">of '+monthsCompared+' comparable month(s)</div></div>'+
  '</div>';

  var chart = '<div class="chart-grid full"><div class="chart-card">'+
    '<div class="chart-title">'+productLabel+' Volume — '+esc(A)+' vs '+esc(B)+' (Litres)</div>'+
    '<div class="chart-wrap tall"><canvas id="c-station-compare"></canvas></div></div></div>';

  var rows = mks.map(function(mk,i){
    var a=seriesA[i].val, b=seriesB[i].val;
    var diff = (a!==null && b!==null) ? (a-b) : null;
    var higher = diff===null ? '<span class="higher-tie">—</span>' : (diff>0 ? '<span class="higher-a">'+esc(A)+'</span>' : (diff<0 ? '<span class="higher-b">'+esc(B)+'</span>' : '<span class="higher-tie">Tie</span>'));
    return '<tr><td class="name-cell">'+monthLabel(mk)+'</td>'+
      stationCellHtml(a, fmtVFull) + stationCellHtml(b, fmtVFull) +
      '<td class="num">'+(diff===null?'<span class="blank-cell">—</span>':signed(diff,fmtVFull))+'</td>'+
      '<td>'+higher+'</td>'+
    '</tr>';
  }).join('');
  var table = '<div class="tbl-wrap"><div class="tbl-scroll"><table><thead><tr>'+
      '<th>Month</th><th class="num">'+esc(A)+' (L)</th><th class="num">'+esc(B)+' (L)</th><th class="num">Difference (A − B)</th><th>Higher Volume</th>'+
    '</tr></thead><tbody>'+rows+'</tbody></table></div>'+
    '<div class="tbl-footer">Difference and "Higher Volume" are only shown for months where both stations have actual recorded '+productLabel+' data.</div></div>';

  view.innerHTML = picker + summary + chart + table;

  var P = chartPalette();
  mkChart('c-station-compare',{type:'bar',data:{labels:mks.map(monthLabel),datasets:[
      {label:A, data:seriesA.map(function(p){return p.val;}), backgroundColor:P.teal},
      {label:B, data:seriesB.map(function(p){return p.val;}), backgroundColor:P.navy}
    ]}, options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{position:'top',labels:{color:P.legend,boxWidth:11,font:{size:11}}},
        tooltip:{callbacks:{label:function(c){ return c.dataset.label+': '+(c.raw===null?'No data':fmtVFull(c.raw)+' L'); }}}},
      scales:{x:{grid:{display:false}},y:{grid:{color:P.grid},ticks:{callback:function(v){return fmtVCompact(v);}}}}}
  });
}

function stationRowsForDay(date){
  var stations = RAW_DATA[date] ? RAW_DATA[date].stations : [];
  return stations.map(function(s){
    return { name:s.name, vol:s.totalVol, rev:s.total,
      pmsVol:s.salesPMS, agoVol:s.salesAGO, dpkVol:s.salesDPK,
      pmsRev:s.valPMS, agoRev:s.valAGO, dpkRev:s.valDPK, daysReported:1 };
  });
}
function stationRowsForPeriod(mk, dayVal){
  return dayVal==='all' ? Object.values(MONTH_AGG[mk].stations) : stationRowsForDay(dayVal);
}
function stationCellHtml(val, fmtFn){
  return (val===null||val===undefined) ? '<td class="num"><span class="blank-cell">—</span></td>' : '<td class="num">'+fmtFn(val)+'</td>';
}

function renderStations(mk){
  ensureDayOptions(mk);
  var dayVal = STATE.day;

  var listView = document.getElementById('stations-list-view');
  var detailView = document.getElementById('stations-detail-view');
  if (STATE.selectedStation){
    listView.style.display='none';
    detailView.style.display='';
    renderStationDetail(mk, STATE.selectedStation);
    return;
  }
  listView.style.display='';
  detailView.style.display='none';

  var sortKey = document.getElementById('stn-sort').value;
  var search = document.getElementById('stn-search').value.trim().toLowerCase();

  var fullList = stationRowsForPeriod(mk, dayVal).slice();
  fullList.sort(function(a,b){ return N(b[sortKey])-N(a[sortKey]); });
  fullList.forEach(function(s,i){ s.__rank = i+1; });

  var displayList = search ? fullList.filter(function(s){ return s.name.toLowerCase().indexOf(search)>-1; }) : fullList;
  var periodLabel = dayVal==='all' ? monthLabel(mk) : fmtDateShort(dayVal);

  var body = document.getElementById('stations-body'); body.innerHTML='';
  if (!displayList.length){
    body.innerHTML = '<tr><td colspan="9"><div class="empty-state">No stations match "'+search+'" for '+periodLabel+'.</div></td></tr>';
  } else {
    displayList.forEach(function(s){
      var safeName = s.name.replace(/'/g,"\\'").replace(/"/g,'&quot;');
      body.innerHTML += '<tr class="station-row" onclick="selectStation(\''+safeName+'\')" title="View station detail">'+
        '<td class="rank-col">'+s.__rank+'</td><td class="name-cell">'+s.name+'</td>'+
        stationCellHtml(s.vol, fmtVFull)+stationCellHtml(s.pmsVol, fmtVFull)+stationCellHtml(s.agoVol, fmtVFull)+
        stationCellHtml(s.rev, fmtNFull)+stationCellHtml(s.pmsRev, fmtNFull)+stationCellHtml(s.agoRev, fmtNFull)+
        '<td class="num">'+(s.daysReported!==undefined?s.daysReported:'—')+'</td></tr>';
    });
  }

  document.getElementById('stn-count').textContent = search ? (displayList.length+' of '+fullList.length+' stations') : (fullList.length+' stations');
  var sortLabel = document.getElementById('stn-sort').selectedOptions[0].textContent;
  var footerTxt = 'Ranked by '+sortLabel+' for '+periodLabel+'. Click a station to see its full detail.';
  if (search) footerTxt += ' Filtered by "'+search+'" — rank shown is each station’s true position in the full '+(dayVal==='all'?'monthly':'daily')+' ranking.';
  document.getElementById('stations-tbl-footer').textContent = footerTxt;
}

/* ════════════════════════════════════════════════════════
   STATION DETAIL — drill-down from the Station Performance
   list, not a separate top-level page. Always shows the
   station's monthly position (rank is computed against the
   same complete monthly population used elsewhere), plus a
   day-by-day breakdown so the monthly figure can be traced
   back to what was actually reported. DPK appears here even
   though it's excluded from the ranked list above: this is a
   full record of what the station reported, not a ranking.
   ════════════════════════════════════════════════════════ */
function renderStationDetail(mk, name){
  var agg = MONTH_AGG[mk];
  var stMonth = agg.stations[name];

  var ranked = Object.values(agg.stations).slice();
  ranked.sort(function(a,b){ return N(b.vol)-N(a.vol); });
  var rank=null, total=ranked.length;
  ranked.forEach(function(s,i){ if (s.name===name) rank=i+1; });

  var head = '<div class="detail-head">'+
      '<button class="hbtn" onclick="clearSelectedStation()">&larr; Back to Station Performance</button>'+
      '<div class="sec-title">'+name+'</div>'+
      '<div class="sec-sub">'+monthLabel(mk)+(stMonth?(' — Rank '+rank+' / '+total+' by Total Volume'):' — no records found for this month')+'</div>'+
    '</div>';

  var body;
  if (!stMonth){
    body = '<div class="empty-state">No daily_sales records exist for '+name+' in '+monthLabel(mk)+'. Either the station did not report this month, or its name in the source file differs from this spelling.</div>';
  } else {
    var kEl = '<div class="kpi-grid">'+
      '<div class="kpi-card accent"><div class="kpi-label">Total Volume</div><div class="kpi-val">'+fmtVFull(stMonth.vol)+' L</div></div>'+
      '<div class="kpi-card"><div class="kpi-label">Total Revenue</div><div class="kpi-val">'+fmtNFull(stMonth.rev)+'</div></div>'+
      '<div class="kpi-card"><div class="kpi-label">PMS</div><div class="kpi-val">'+fmtVFull(stMonth.pmsVol)+' L</div><div class="kpi-sub">'+fmtNFull(stMonth.pmsRev)+'</div></div>'+
      '<div class="kpi-card"><div class="kpi-label">AGO</div><div class="kpi-val">'+fmtVFull(stMonth.agoVol)+' L</div><div class="kpi-sub">'+fmtNFull(stMonth.agoRev)+'</div></div>'+
      '<div class="kpi-card"><div class="kpi-label">Days Reported</div><div class="kpi-val">'+stMonth.daysReported+'</div><div class="kpi-sub">of '+daysInCalendarMonth(mk)+' calendar days</div></div>'+
    '</div>';

    var dates = datesInMonth(mk);
    var rows = dates.map(function(d){
      var srow = RAW_DATA[d].stations.find(function(s){ return s.name===name; });
      return { date:d, pms: srow?srow.salesPMS:null, ago: srow?srow.salesAGO:null, dpk: srow?srow.salesDPK:null, rev: srow?srow.total:null, reported: !!srow };
    });
    var tbl = '<div class="tbl-wrap"><div class="tbl-scroll"><table><thead><tr>'+
        '<th>Date</th><th class="num">PMS (L)</th><th class="num">AGO (L)</th><th class="num">DPK (L)</th><th class="num">Revenue (₦)</th>'+
      '</tr></thead><tbody>'+
      rows.map(function(r){
        if (!r.reported) return '<tr><td class="name-cell">'+fmtDateShort(r.date)+'</td><td class="num" colspan="4"><span class="blank-cell">No record this day</span></td></tr>';
        return '<tr><td class="name-cell">'+fmtDateShort(r.date)+'</td>'+
          stationCellHtml(r.pms, fmtVFull)+stationCellHtml(r.ago, fmtVFull)+stationCellHtml(r.dpk, fmtVFull)+stationCellHtml(r.rev, fmtNFull)+
        '</tr>';
      }).join('')+
      '</tbody></table></div><div class="tbl-footer">Daily breakdown for '+name+' — '+monthLabel(mk)+'.</div></div>';

    body = kEl + tbl;
  }

  var trendSection = stMonth ? trendSectionShell() : '';

  document.getElementById('stations-detail-view').innerHTML = head + body + trendSection;

  if (stMonth) renderStationTrend(name);
}

/* ════════════════════════════════════════════════════════
   MONTHLY PRODUCT TREND — lives inside Station Detail, below
   the existing monthly summary. Historical comparison only;
   no forecasting, no fabricated months, no zero-filled gaps.
   ════════════════════════════════════════════════════════ */
function trendSectionShell(){
  return '<div class="trend-section" id="trend-section">'+
    '<div class="sec-head"><div class="sec-title">Monthly Product Trend</div>'+
      '<div class="sec-sub" id="trend-sec-sub"></div></div>'+
    '<div class="drill-bar">'+
      '<label>Product</label>'+
      '<div class="seg-group" id="trend-product-group">'+
        '<button class="seg-btn" data-val="pms" onclick="setTrendProduct(\'pms\')">PMS</button>'+
        '<button class="seg-btn" data-val="ago" onclick="setTrendProduct(\'ago\')">AGO</button>'+
        '<button class="seg-btn" data-val="compare" onclick="setTrendProduct(\'compare\')">Compare</button>'+
      '</div>'+
      '<label>Range</label>'+
      '<select id="trend-range-select" onchange="setTrendRange(this.value)">'+
        '<option value="6">Last 6 Months</option>'+
        '<option value="12">Last 12 Months</option>'+
        '<option value="ytd">Year to Date</option>'+
        '<option value="all">All Available Data</option>'+
      '</select>'+
    '</div>'+
    '<div class="chart-grid full"><div class="chart-card"><div class="chart-title" id="trend-chart-title">Monthly Volume (Litres)</div>'+
      '<div class="chart-wrap tall"><canvas id="c-station-trend"></canvas></div></div></div>'+
    '<div id="trend-table-wrap"></div>'+
  '</div>';
}
function setTrendProduct(p){ STATE.trendProduct = p; renderStationTrend(STATE.selectedStation); }
function setTrendRange(r){ STATE.trendRange = r; renderStationTrend(STATE.selectedStation); }

function renderStationTrend(name){
  var sec = document.getElementById('trend-section');
  if (!sec) return; // detail view was re-rendered/left before this ran

  // Sync control UI to STATE
  document.querySelectorAll('#trend-product-group .seg-btn').forEach(function(b){
    b.classList.toggle('active', b.dataset.val===STATE.trendProduct);
  });
  var rSel = document.getElementById('trend-range-select'); rSel.value = STATE.trendRange;

  var mks = rangeMonthKeys(STATE.trendRange, STATE.month);
  var pmsSeries = withMoM(stationProductSeries(name, 'pms', mks));
  var agoSeries = withMoM(stationProductSeries(name, 'ago', mks));
  var anyData = pmsSeries.some(function(p){return p.val!==null;}) || agoSeries.some(function(p){return p.val!==null;});

  var rangeLabel = {6:'last 6 months',12:'last 12 months',ytd:'year to date',all:'all available data'}[STATE.trendRange];
  document.getElementById('trend-sec-sub').textContent =
    'How '+name+' has performed on PMS and AGO across '+rangeLabel+'. Months with no recorded data are omitted, never estimated.';
  document.getElementById('trend-chart-title').textContent =
    STATE.trendProduct==='pms' ? 'PMS Volume by Month (Litres)' :
    STATE.trendProduct==='ago' ? 'AGO Volume by Month (Litres)' : 'PMS vs AGO Volume by Month (Litres)';

  var chartCard = document.getElementById('c-station-trend').closest('.chart-card');
  var tableWrap = document.getElementById('trend-table-wrap');

  if (!anyData){
    chartCard.style.display = 'none';
    tableWrap.innerHTML = '<div class="trend-empty">No PMS or AGO records found for '+name+' in the selected range.</div>';
    return;
  }
  chartCard.style.display = '';

  var P = chartPalette();
  var labels = mks.map(monthLabel);
  var datasets = [];
  if (STATE.trendProduct==='pms' || STATE.trendProduct==='compare'){
    datasets.push({label:'PMS', data:pmsSeries.map(function(p){return p.val;}), backgroundColor:P.teal});
  }
  if (STATE.trendProduct==='ago' || STATE.trendProduct==='compare'){
    datasets.push({label:'AGO', data:agoSeries.map(function(p){return p.val;}), backgroundColor:P.navy});
  }
  mkChart('c-station-trend',{type:'bar',data:{labels:labels,datasets:datasets},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{position:'top',labels:{color:P.legend,boxWidth:11,font:{size:11}}},
        tooltip:{callbacks:{label:function(c){ return c.dataset.label+': '+(c.raw===null?'No data':fmtVFull(c.raw)+' L'); }}}},
      scales:{x:{grid:{display:false}},y:{grid:{color:P.grid},ticks:{callback:function(v){return fmtVCompact(v);}}}}}
  });

  // Compact comparison table beneath the chart — only shows the columns
  // relevant to the current product mode.
  var showPms = STATE.trendProduct==='pms' || STATE.trendProduct==='compare';
  var showAgo = STATE.trendProduct==='ago' || STATE.trendProduct==='compare';
  var head = '<th>Month</th>'+(showPms?'<th class="num">PMS Volume (L)</th><th class="num">PMS MoM</th>':'')+(showAgo?'<th class="num">AGO Volume (L)</th><th class="num">AGO MoM</th>':'');
  var rows = mks.map(function(mk,i){
    var p = pmsSeries[i], a = agoSeries[i];
    return '<tr><td class="name-cell">'+monthLabel(mk)+'</td>'+
      (showPms ? stationCellHtml(p.val, fmtVFull) + '<td class="num">'+momCellHtml(p.momDelta,p.momPct)+'</td>' : '')+
      (showAgo ? stationCellHtml(a.val, fmtVFull) + '<td class="num">'+momCellHtml(a.momDelta,a.momPct)+'</td>' : '')+
    '</tr>';
  }).join('');
  tableWrap.innerHTML = '<div class="tbl-wrap"><div class="tbl-scroll"><table><thead><tr>'+head+'</tr></thead><tbody>'+rows+'</tbody></table></div>'+
    '<div class="tbl-footer">Month-on-month is calculated only between two consecutive months that both have actual data for '+name+'; otherwise shown as “—”.</div></div>';
}

