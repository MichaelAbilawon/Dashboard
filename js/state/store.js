'use strict';

/* ════════════════════════════════════════════════════════
   DATA STORE
   ════════════════════════════════════════════════════════ */
var RAW_DATA = {};      // { 'YYYY-MM-DD': { stations:[...] } }
var MONTH_KEYS = [];    // sorted ascending
var MONTH_AGG = {};     // keyed by 'YYYY-MM'
var BUDGETS = {};       // keyed by 'YYYY-MM' — { pms:{vol,rev}, ago:{vol,rev}, dpk:{vol,rev} }
var LAST_UPLOAD_TS = null; // ISO timestamp of the most recent insert, if available; null if not
var DAILY_ROWS_CACHE = []; // exact rows currently displayed on the Daily Records table — CSV export reads only from here
var STATE = { month:null, day:'all', selectedStation:null,
  stationsSubtab:'perf',
  trendProduct:'compare', trendRange:'12',
  cmpA:null, cmpB:null, cmpProduct:'pms', cmpRange:'12',
  paStation:null, paProduct:'pms', paStart:null, paEnd:null };
var PERIOD_ROWS_CACHE = []; // exact daily rows currently shown on the Period Analysis table — CSV export reads only from here

