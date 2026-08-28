'use strict';

/* Chart palette is read live from CSS variables so every
   chart automatically matches the active theme; call this
   fresh inside each render function (not cached), and again
   whenever the theme toggles. */
function chartPalette(){
  var cs = getComputedStyle(document.documentElement);
  function v(name){ return cs.getPropertyValue(name).trim(); }
  return {
    teal:v('--brand'), navy:v('--navy'), plum:v('--plum'), gold:v('--gold'),
    good:v('--good'), bad:v('--bad'), grid:v('--chart-grid'), neutral:v('--chart-neutral'),
    tick:v('--ink-3'), legend:v('--ink-2'), surface:v('--surface'),
    tooltipBg:v('--tooltip-bg'), tooltipText:v('--tooltip-text')
  };
}
var CHARTS={};
function mkChart(id,cfg){
  if(CHARTS[id]){try{CHARTS[id].destroy();}catch(e){}}
  var el=document.getElementById(id); if(!el) return;
  var P = chartPalette();
  Chart.defaults.font.family = "'IBM Plex Mono',monospace";
  Chart.defaults.color = P.tick;
  Chart.defaults.borderColor = P.grid;
  cfg.options = cfg.options || {};
  cfg.options.plugins = cfg.options.plugins || {};
  cfg.options.plugins.tooltip = Object.assign({
    backgroundColor:P.tooltipBg, titleColor:P.tooltipText, bodyColor:P.tooltipText,
    padding:10, cornerRadius:2, titleFont:{family:"'IBM Plex Mono',monospace",size:11}, bodyFont:{family:"'IBM Plex Mono',monospace",size:11}, boxPadding:4
  }, cfg.options.plugins.tooltip||{});
  CHARTS[id]=new Chart(el,cfg);
}

