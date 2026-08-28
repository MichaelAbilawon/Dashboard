'use strict';

/* ════════════════════════════════════════════════════════
   DAILY RECORDS — the audit/verification layer beneath the
   monthly figures. One row per reporting day. A field is
   summed across that day's reporting stations only where a
   station actually has a value; if every station is blank
   for that field that day, the cell is blank too — never a
   fabricated zero. Days where some (not all) stations are
   blank for a field show the real partial sum with a subtle
   dotted-underline marker, so the number is never mistaken
   for a complete total.
   ════════════════════════════════════════════════════════ */
var DAILY_FIELD_MAP = [
  ['pmsVol','salesPMS'], ['agoVol','salesAGO'], ['dpkVol','salesDPK'], ['totalVol','totalVol'],
  ['pmsRev','valPMS'], ['agoRev','valAGO'], ['dpkRev','valDPK'], ['totalRev','total']
];
function computeDailyRows(mk){
  var dates = datesInMonth(mk);
  return dates.map(function(d){
    var stations = RAW_DATA[d].stations;
    var row = { date:d, stationsCount: stations.length };
    DAILY_FIELD_MAP.forEach(function(f){
      var key=f[0], srcKey=f[1];
      var sum=0, present=0, missing=0;
      stations.forEach(function(s){
        var v = s[srcKey];
        if (isBlankVal(v)) missing++; else { present++; sum+=v; }
      });
      row[key] = present>0 ? sum : null;
      row[key+'_partial'] = missing>0 && present>0;
      row[key+'_missing'] = missing;
    });
    return row;
  });
}
function dailyCellHtml(val, partial, missingCount, fmtFn){
  if (val===null) return '<td class="num"><span class="blank-cell">—</span></td>';
  if (!partial) return '<td class="num">'+fmtFn(val)+'</td>';
  return '<td class="num partial" title="'+missingCount+' station-day record(s) missing this figure that day — showing the sum of what was actually reported">'+fmtFn(val)+'</td>';
}
function renderDailyRecords(mk){
  var allRows = computeDailyRows(mk);
  var sortKey = document.getElementById('daily-sort') ? document.getElementById('daily-sort').value : 'date-asc';
  var search = document.getElementById('daily-search') ? document.getElementById('daily-search').value.trim().toLowerCase() : '';

  var rows = allRows.slice();
  if (sortKey==='date-asc') rows.sort(function(a,b){ return a.date<b.date?-1:(a.date>b.date?1:0); });
  else if (sortKey==='date-desc') rows.sort(function(a,b){ return a.date>b.date?-1:(a.date<b.date?1:0); });
  else if (sortKey==='totalVol') rows.sort(function(a,b){ return N(b.totalVol)-N(a.totalVol); });
  else if (sortKey==='totalRev') rows.sort(function(a,b){ return N(b.totalRev)-N(a.totalRev); });
  else if (sortKey==='stations') rows.sort(function(a,b){ return b.stationsCount-a.stationsCount; });

  if (search) rows = rows.filter(function(r){ return r.date.indexOf(search)>-1 || fmtDateShort(r.date).toLowerCase().indexOf(search)>-1; });

  DAILY_ROWS_CACHE = rows; // CSV export reads exactly these rows, in this order — same filter, same sort

  var totalDaysCal = daysInCalendarMonth(mk);
  var reportedDays = allRows.length;
  var missingRevRows = allRows.reduce(function(s,r){ return s+r.totalRev_missing; },0);
  var missingPms = allRows.reduce(function(s,r){ return s+r.pmsRev_missing; },0);
  var missingAgo = allRows.reduce(function(s,r){ return s+r.agoRev_missing; },0);
  var missingDpk = allRows.reduce(function(s,r){ return s+r.dpkRev_missing; },0);
  var stationDaysTotal = allRows.reduce(function(s,r){ return s+r.stationsCount; },0);
  var bestDay = allRows.reduce(function(best,r){ return (best===null || N(r.totalRev)>N(best.totalRev)) ? r : best; }, null);

  var strip = document.getElementById('daily-stat-strip'); strip.innerHTML='';
  function stat(label,val,sub,cls){ var d=document.createElement('div'); d.className='stat-item'; d.innerHTML='<div class="stat-item-label">'+label+'</div><div class="stat-item-val'+(cls?' '+cls:'')+'">'+val+'</div>'+(sub?'<div class="stat-item-sub">'+sub+'</div>':''); strip.appendChild(d); }
  stat('Reporting Days', reportedDays+' / '+totalDaysCal, reportedDays<totalDaysCal ? (totalDaysCal-reportedDays)+' day(s) not yet uploaded' : 'Complete month on file', reportedDays<totalDaysCal?'warn':'good');
  stat('Highest Revenue Day', bestDay?fmtDateShort(bestDay.date):'—', bestDay?fmtNFull(bestDay.totalRev):'', '');
  stat('Missing Revenue Entries', missingRevRows, missingRevRows>0 ? ('of '+stationDaysTotal+' station-day records — PMS '+missingPms+', AGO '+missingAgo+', DPK '+missingDpk) : 'Every station-day record has a revenue figure', missingRevRows>0?'warn':'good');
  stat('Station-Day Records', stationDaysTotal, reportedDays+' day(s) of station-level data', '');

  var body = document.getElementById('daily-body'); body.innerHTML='';
  if (!rows.length){
    body.innerHTML = '<tr><td colspan="10"><div class="empty-state">No daily records match'+(search?' "'+search+'"':' this month')+'.</div></td></tr>';
  } else {
    rows.forEach(function(r){
      body.innerHTML += '<tr>'+
        '<td class="name-cell"><a class="date-link" onclick="jumpToStationsForDay(\''+r.date+'\')" title="See station performance for this day">'+fmtDateShort(r.date)+'</a></td>'+
        dailyCellHtml(r.pmsVol, r.pmsVol_partial, r.pmsVol_missing, fmtVFull)+
        dailyCellHtml(r.agoVol, r.agoVol_partial, r.agoVol_missing, fmtVFull)+
        dailyCellHtml(r.dpkVol, r.dpkVol_partial, r.dpkVol_missing, fmtVFull)+
        dailyCellHtml(r.totalVol, r.totalVol_partial, r.totalVol_missing, fmtVFull)+
        dailyCellHtml(r.pmsRev, r.pmsRev_partial, r.pmsRev_missing, fmtNFull)+
        dailyCellHtml(r.agoRev, r.agoRev_partial, r.agoRev_missing, fmtNFull)+
        dailyCellHtml(r.dpkRev, r.dpkRev_partial, r.dpkRev_missing, fmtNFull)+
        dailyCellHtml(r.totalRev, r.totalRev_partial, r.totalRev_missing, fmtNFull)+
        '<td class="num">'+r.stationsCount+'</td>'+
      '</tr>';
    });
  }

  document.getElementById('daily-count').textContent = search ? (rows.length+' of '+allRows.length+' days') : (allRows.length+' day(s)');
  var sortLabelD = document.getElementById('daily-sort').selectedOptions[0].textContent;
  var footerD = 'Sorted by '+sortLabelD+' for '+monthLabel(mk)+'.';
  if (search) footerD += ' Filtered by "'+search+'".';
  footerD += ' Dotted underline = at least one station was missing that figure that day; the value shown is the sum of what was actually reported, not an estimate.';
  document.getElementById('daily-tbl-footer').textContent = footerD;
}

/* ════════════════════════════════════════════════════════
   CSV EXPORT — exports exactly DAILY_ROWS_CACHE, the same
   rows currently on screen (same month, same sort, same
   search filter). Blank cells stay blank in the file; no
   value is calculated, formatted with a currency symbol, or
   otherwise transformed beyond what a spreadsheet needs.
   ════════════════════════════════════════════════════════ */
function csvCell(v){
  v = (v===null||v===undefined) ? '' : String(v);
  if (/[",\n]/.test(v)) v = '"'+v.replace(/"/g,'""')+'"';
  return v;
}
function exportDailyRecordsCSV(){
  if (!DAILY_ROWS_CACHE.length){ return; }
  var mk = STATE.month;
  var headers = ['Date','PMS Volume (L)','AGO Volume (L)','DPK Volume (L)','Total Volume (L)','PMS Revenue (NGN)','AGO Revenue (NGN)','DPK Revenue (NGN)','Total Revenue (NGN)','Stations Reporting'];
  var lines = [headers.map(csvCell).join(',')];
  DAILY_ROWS_CACHE.forEach(function(r){
    lines.push([
      r.date, r.pmsVol, r.agoVol, r.dpkVol, r.totalVol, r.pmsRev, r.agoRev, r.dpkRev, r.totalRev, r.stationsCount
    ].map(csvCell).join(','));
  });
  var blob = new Blob([lines.join('\r\n')], {type:'text/csv;charset=utf-8;'});
  var url = URL.createObjectURL(blob);
  var now = new Date();
  function pad(n){ return String(n).padStart(2,'0'); }
  var stamp = now.getFullYear()+'-'+pad(now.getMonth()+1)+'-'+pad(now.getDate())+'_'+pad(now.getHours())+pad(now.getMinutes());
  var filename = 'Daily_Sales_'+monthLabel(mk).replace(' ','_')+'_'+stamp+'.csv';
  var a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
}

