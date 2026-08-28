'use strict';

function log(msg, cls){
  var d = document.getElementById('log');
  d.innerHTML += '<div class="'+(cls||'info')+'">'+msg+'</div>';
  d.scrollTop = d.scrollHeight;
}

function clearLog(){
  document.getElementById('log').innerHTML = '';
}

