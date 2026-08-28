'use strict';

// ── COLUMN ALIASES (mirrors dashboard parser) ────────────────
var COL_ALIASES = {
  name:      ['station','station name','station_name','name','retailstation'],
  salesPMS:  ['pms sales','pms sales l','pms_sales','pms volume','pms vol','pms sold','pmssales'],
  salesAGO:  ['ago sales','ago_sales','ago volume','ago vol','ago sold'],
  salesDPK:  ['dpk sales','dpk_sales','dpk volume','dpk vol'],
  pricePMS:  ['pms price','pms_price','price pms'],
  priceAGO:  ['ago price','ago_price','price ago'],
  priceDPK:  ['dpk price','dpk_price','price dpk'],
  valPMS:    ['pms rev','pms revenue','pms value','pms_rev','pms_value'],
  valAGO:    ['ago rev','ago revenue','ago value','ago_rev','ago_value'],
  valDPK:    ['dpk rev','dpk revenue','dpk value','dpk_rev','dpk_value'],
  total:     ['total revenue','total rev','total_revenue','total sales','total','grand total'],
  stockPMS:  ['pms stock','pms_stock','stock pms','closing pms'],
  stockAGO:  ['ago stock','ago_stock','stock ago','closing ago'],
  stockDPK:  ['dpk stock','dpk_stock','stock dpk','closing dpk'],
};

function buildColMap(headers){
  var map = {};
  headers.forEach(function(h, i){
    var hl = (h||'').toString().toLowerCase().replace(/[^a-z0-9 _]/g,'').trim();
    Object.keys(COL_ALIASES).forEach(function(field){
      if(map[field] !== undefined) return;
      COL_ALIASES[field].forEach(function(alias){
        if(hl === alias) map[field] = i;
      });
    });
  });
  return map;
}

// ── TWO-ROW MERGED HEADER SUPPORT ─────────────────────────────
// Rainoil's standard daily template has group titles on one row
// (STATIONS, CLOSING STOCK (LTRS), SALES (LTRS), UNIT PRICE/LTR,
// SALES VALUE (N)) with merged cells, and PMS / AGO / DPK / TOTAL
// sub-columns on the row directly beneath. This detects that shape
// and builds the column map from it instead of single-row aliases.
function tryBuildTwoRowColMap(rows, groupRowIdx){
  var groupRow = (rows[groupRowIdx]||[]).map(function(c){ return (c||'').toString(); });
  var subRow   = (rows[groupRowIdx+1]||[]).map(function(c){ return (c||'').toString().toLowerCase().trim(); });

  var subHits = subRow.filter(function(c){ return ['pms','ago','dpk','total'].indexOf(c)!==-1; }).length;
  if(subHits < 3) return null; // not this layout

  // forward-fill group labels across merged/blank cells
  var groups = [];
  var last = '';
  var width = Math.max(groupRow.length, subRow.length);
  for(var i=0;i<width;i++){
    var g = (groupRow[i]||'').toString().trim();
    if(g) last = g;
    groups.push(last.toLowerCase());
  }

  var map = {};
  for(i=0;i<width;i++){
    var g = groups[i]||'';
    var sub = subRow[i]||'';
    if(map.name===undefined && g.indexOf('station')!==-1){ map.name = i; continue; }

    var prefix = null;
    if(g.indexOf('stock')!==-1) prefix = 'stock';
    else if(g.indexOf('value')!==-1 || g.indexOf('revenue')!==-1) prefix = 'val';
    else if(g.indexOf('sales')!==-1) prefix = 'sales';
    else if(g.indexOf('price')!==-1) prefix = 'price';

    if(prefix==='val' && sub==='total'){ map.total = i; continue; }
    if(!prefix || ['pms','ago','dpk'].indexOf(sub)===-1) continue;

    var key = prefix + sub.charAt(0).toUpperCase() + sub.slice(1); // e.g. stockPms
    key = key.replace(/Pms$/,'PMS').replace(/Ago$/,'AGO').replace(/Dpk$/,'DPK');
    if(map[key]===undefined) map[key] = i;
  }

  return (map.name!==undefined) ? map : null;
}

function parseExcel(file, date){
  return new Promise(function(resolve, reject){
    var reader = new FileReader();
    reader.onload = function(e){
      try{
        var wb = XLSX.read(e.target.result, {type:'array'});
        var ws = wb.Sheets[wb.SheetNames[0]];
        var rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:''});

        // Find header row (first row containing 'station' or 'name')
        var headerIdx = -1;
        for(var i=0;i<Math.min(10,rows.length);i++){
          var cells = rows[i].map(function(c){return (c||'').toString().toLowerCase();});
          if(cells.some(function(c){return c.indexOf('station')!==-1||c==='name';})){
            headerIdx=i; break;
          }
        }
        if(headerIdx===-1){ reject('Could not find header row in Excel file.'); return; }

        var colMap, dataStart;
        var twoRowMap = tryBuildTwoRowColMap(rows, headerIdx);
        if(twoRowMap){
          colMap = twoRowMap;
          dataStart = headerIdx + 2; // skip group row + sub-header row
        } else {
          var headers = rows[headerIdx].map(function(c){return (c||'').toString();});
          colMap = buildColMap(headers);
          dataStart = headerIdx + 1;
        }

        if(colMap.name===undefined){ reject('Could not find a station name column.'); return; }

        var stations = [];
        for(var r=dataStart; r<rows.length; r++){
          var row = rows[r];
          var rawName = row[colMap.name]||'';
          if(!rawName.toString().trim()) continue;

          function g(field, def){
            if(colMap[field]===undefined) return def||0;
            var v = parseFloat(row[colMap[field]]||0);
            return isNaN(v)?def||0:v;
          }

          var s = {
            sale_date:   date,
            name:        normalizeStationName(rawName.toString()),
            stock_pms:   g('stockPMS'),
            stock_ago:   g('stockAGO'),
            stock_dpk:   g('stockDPK'),
            sales_pms:   g('salesPMS'),
            sales_ago:   g('salesAGO'),
            sales_dpk:   g('salesDPK'),
            price_pms:   g('pricePMS'),
            price_ago:   g('priceAGO'),
            price_dpk:   g('priceDPK'),
            val_pms:     g('valPMS'),
            val_ago:     g('valAGO'),
            val_dpk:     g('valDPK'),
            total:       g('total'),
          };

          if(s.total===0) s.total = s.val_pms + s.val_ago + s.val_dpk;
          if(s.val_pms===0 && s.price_pms>0 && s.sales_pms>0) s.val_pms = s.price_pms*s.sales_pms;
          if(s.val_ago===0 && s.price_ago>0 && s.sales_ago>0) s.val_ago = s.price_ago*s.sales_ago;
          if(s.val_dpk===0 && s.price_dpk>0 && s.sales_dpk>0) s.val_dpk = s.price_dpk*s.sales_dpk;
          if(s.total===0) s.total = s.val_pms + s.val_ago + s.val_dpk;

          s.total_vol   = s.sales_pms + s.sales_ago + s.sales_dpk;
          s.total_stock = s.stock_pms + s.stock_ago + s.stock_dpk;
          s.is_zero     = (s.total===0 && s.total_vol===0);
          s.rpl         = s.total_vol>0 ? s.total/s.total_vol : 0;

          stations.push(s);
        }

        resolve(stations);
      } catch(err){ reject(err.message||String(err)); }
    };
    reader.onerror = function(){ reject('File read error'); };
    reader.readAsArrayBuffer(file);
  });
}

