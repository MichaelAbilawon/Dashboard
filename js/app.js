'use strict';

/* ════════════════════════════════════════════════════════
   LAUNCH
   ════════════════════════════════════════════════════════ */
function launchDashboard(){
  if (!MONTH_KEYS.length){
    document.getElementById('cloud-screen').querySelector('.cloud-content').innerHTML =
      '<div class="empty-state">No data available yet.</div>';
    return;
  }
  var years = uniqueYearsFromMonthKeys();
  var yearSel = document.getElementById('year-select');
  yearSel.innerHTML = years.map(function(y){ return '<option value="'+y+'">'+y+'</option>'; }).join('');

  STATE.month = MONTH_KEYS[MONTH_KEYS.length-1];
  var currentYear = STATE.month.slice(0,4);
  yearSel.value = currentYear;
  populateMonthOnlySelect(currentYear, STATE.month);

  document.getElementById('dashboard').style.display='flex';
  renderAll();
}
// Years present in the data, derived purely from MONTH_KEYS — never
// hard-coded, so a newly-imported year appears automatically the
// next time the dashboard loads, with no frontend change required.
function uniqueYearsFromMonthKeys(){
  var years = [];
  MONTH_KEYS.forEach(function(mk){ var y = mk.slice(0,4); if (years.indexOf(y)===-1) years.push(y); });
  years.sort();
  return years;
}
function populateMonthOnlySelect(year, selectMk){
  var monthSel = document.getElementById('month-only-select');
  var monthsForYear = MONTH_KEYS.filter(function(mk){ return mk.slice(0,4)===year; });
  monthSel.innerHTML = monthsForYear.map(function(mk){
    return '<option value="'+mk+'">'+MONTHS[parseInt(mk.slice(5,7),10)]+'</option>';
  }).join('');
  monthSel.value = selectMk;
}
function onYearChange(year){
  var monthsForYear = MONTH_KEYS.filter(function(mk){ return mk.slice(0,4)===year; });
  var defaultMk = monthsForYear[monthsForYear.length-1]; // most recent month on file for that year
  populateMonthOnlySelect(year, defaultMk);
  onMonthChange(defaultMk);
}
function onMonthChange(mk){ STATE.month = mk; renderAll(); }
function switchTab(name, el){
  document.querySelectorAll('.tab').forEach(function(t){ t.classList.remove('active'); });
  document.querySelectorAll('.tab-panel').forEach(function(p){ p.classList.remove('active'); });
  var tabEl = el || document.querySelector('.tab[data-tab="'+name+'"]');
  if (tabEl) tabEl.classList.add('active');
  document.getElementById('tab-'+name).classList.add('active');
  // Period Analysis isn't driven by STATE.month like the other tabs
  // (it has its own station/product/date-range filters), so it
  // renders on tab activation rather than from renderAll().
  if (name === 'period') renderPeriodAnalysis();
}
function jumpToStationsForDay(date){
  STATE.day = date;
  STATE.selectedStation = null;
  switchTab('stations');
  renderStations(STATE.month);
}
function daysInCalendarMonth(mk){ var p=mk.split('-'); return new Date(parseInt(p[0],10), parseInt(p[1],10), 0).getDate(); }
function fmtDateShort(iso){ var p=iso.split('-'); return parseInt(p[2],10)+' '+MONTHS[parseInt(p[1],10)].slice(0,3)+' '+p[0]; }
function fmtFreshness(iso){
  if(!iso) return null;
  try{
    var d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleString('en-NG',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
  }catch(e){ return null; }
}
function renderAll(){
  var mk = STATE.month;
  var totalDays = daysInCalendarMonth(mk);
  var monthDates = datesInMonth(mk);
  var freshnessLine = LAST_UPLOAD_TS ? ('Data updated '+fmtFreshness(LAST_UPLOAD_TS)) : ('Data through '+fmtDateShort(monthDates[monthDates.length-1]));
  document.getElementById('hdr-meta').innerHTML =
    MONTH_AGG[mk].totals.days+' of '+totalDays+' day(s) reported — '+monthLabel(mk)+'<br>'+freshnessLine;
  renderExec(mk);
  renderBudget(mk);
  renderTrend(mk);
  renderStations(mk);
  renderDailyRecords(mk);
  renderMix(mk);
}

