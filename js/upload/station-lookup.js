'use strict';

// ── STATION_LOOKUP — same as main dashboard ──────────────────
// This maps short keys from the Excel to the canonical station names.
// It must match the STATION_LOOKUP table in dashboard_v29.html exactly.
var STATION_LOOKUP = {
  'ABAK ROAD':'Rainoil Uyo - Abak Road','ABAKALIKI':'Rainoil Abakaliki - Azuiyiokwu','ABAKALIKI 2':'Rainoil Abakaliki - Mile 50','ABAYI-OSISIOMA':'Rainoil Aba - Abayi-Osisioma','ABIJO':'Rainoil Abijo','ABRAKA':'Rainoil Abraka','ABUJA 2':'Rainoil FCT - Gwarimpa','ABUJA 3':'Rainoil FCT - Karmo','ADO-EKITI':'Rainoil Ado-Ekiti - Ikere Road','AGBARHO 1':'Rainoil Agbarho - Ohrerhe','AGBARHO 2':'Rainoil Agbarho - Ewherhe','AGBOR 1':'Rainoil Agbor - Asaba Road','AGBOR 2':'Rainoil Agbor - Abraka Road','AGBOR 3':'Rainoil Agbor - Alero Road','AGBOR 4':'Rainoil Agbor - Owa-Ekei','ANWAI':'Rainoil Anwai','ASABA 2':'Rainoil Asaba - Asaba/Benin Road','ASABA 3':'Rainoil Asaba - Okpanam Road','AUCHI':'Rainoil Auchi - Igara Road','AWKA 1':'Rainoil Awka - 279 Zik Avenue','AWKA 2':'Rainoil Awka - Regina Caeli Road','AWKA 3':'Rainoil Awka - 55 Zik Avenue','AWKUZU':'Rainoil Awkuzu','AYOBO':'Rainoil Ayobo','BARNAWA':'Rainoil Kaduna - Barnawa','BENIN-AGBOR ROAD':'Rainoil Benin - Benin/Agbor Road','BENIN-AUCHI ROAD':'Rainoil Benin - Benin/Auchi Road','BONSAC':'Rainoil Bonsac','BORDER ROAD':'Fynefield Border Road Ikom','BOROKIRI':'Rainoil Portharcourt - Borokiri','BUKURU':'Rainoil Bukuru Jos','CHIKUN':'Rainoil Kaduna - Chikun','CHOBA':'Rainoil Portharcourt - Choba','DSC 2':'Rainoil Udu - Steel Town','DSC UDU ROAD':'Rainoil Udu - Udu Road','DUTSE ALHAJI':'Rainoil FCT - Dutse Alhaji'
  // NOTE: The uploader uses the same normalizeStationName() logic as the dashboard.
  // If a station isn't in STATION_LOOKUP, its raw name from the Excel is used as-is.
};

function normalizeStationName(raw){
  if(!raw) return '';
  var upper = raw.trim().toUpperCase();
  return STATION_LOOKUP[upper] || raw.trim();
}

