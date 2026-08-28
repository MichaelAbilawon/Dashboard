'use strict';

/* ════════════════════════════════════════════════════════
   THEME — default to system preference on first visit,
   then remember the explicit choice. Every visual token the
   app uses is a CSS variable, so this attribute swap is the
   entire theming mechanism for markup; charts are redrawn
   separately below because Canvas doesn't inherit CSS vars.
   ════════════════════════════════════════════════════════ */
/* The initial theme (localStorage, falling back to system preference)
   is already applied by the inline script in <head> — before first
   paint, to avoid a flash of the wrong theme. This just handles the
   user explicitly flipping it afterwards. */
var THEME_KEY = 'rainoil_dashboard_theme';
function toggleTheme(){
  var cur = document.documentElement.getAttribute('data-theme');
  var next = cur==='dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try{ localStorage.setItem(THEME_KEY, next); }catch(e){}
  if (STATE.month) renderAll(); // redraw charts with the new palette
}

