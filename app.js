// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const MONTHS_NL = [
  "Januari",
  "Februari",
  "Maart",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Augustus",
  "September",
  "Oktober",
  "November",
  "December",
];
const DAYS_NL = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];

// ── STATE ─────────────────────────────────────────────────────────────────────
let state = {
  year: 2026,
  profiles: {},
  activeProfile: "standaard",
  suggestionsLimit: 6,
};

const defaultProfile = () => ({
  leaveMode: "days", // default: days (not hours)
  totalDays: 20,
  totalLeave: null,
  hoursPerDay: 8,
  expiryDate: "",
  expiryHours: 0,
  expiryDaysCount: 0,
  expiryDateDays: "",
  minVacation: 7,
  maxLeave: 5,
  maxCalendarDays: 10,
  customHolidays: {},
  nationalHolidays: {},
  plannedDays: {},
});

function getProfile() {
  const k = state.activeProfile + "_" + state.year;
  if (!state.profiles[k]) state.profiles[k] = defaultProfile();
  return state.profiles[k];
}

function save() {
  localStorage.setItem("verlofplanner_v5", JSON.stringify(state));
}

function load() {
  try {
    const d = localStorage.getItem("verlofplanner_v5");
    if (d) state = JSON.parse(d);
    if (!state.profiles) state.profiles = {};
    if (!state.activeProfile) state.activeProfile = "standaard";
    if (!state.year) state.year = new Date().getFullYear();
  } catch (e) {}
}

// ── HOLIDAYS ──────────────────────────────────────────────────────────────────
// Naming convention: nl-{year}.json
// Format: { "year": 2026, "country": "NL", "holidays": [ { "date": "YYYY-MM-DD", "name": "..." } ] }

// Bundled holiday data (used when JSON files can't be fetched, e.g. file:// protocol)
const BUNDLED_HOLIDAYS = {
  2026: {"year":2026,"country":"NL","holidays":[{"date":"2026-01-01","name":"Nieuwjaarsdag"},{"date":"2026-04-03","name":"Goede vrijdag"},{"date":"2026-04-05","name":"Eerste Paasdag"},{"date":"2026-04-06","name":"Tweede Paasdag"},{"date":"2026-04-27","name":"Koningsdag"},{"date":"2026-05-05","name":"Bevrijdingsdag"},{"date":"2026-05-14","name":"Hemelvaartsdag"},{"date":"2026-05-24","name":"Eerste Pinksterdag"},{"date":"2026-05-25","name":"Tweede Pinksterdag"},{"date":"2026-12-25","name":"Eerste Kerstdag"},{"date":"2026-12-26","name":"Tweede Kerstdag"}]},
  2027: {"year":2027,"country":"NL","holidays":[{"date":"2027-01-01","name":"Nieuwjaarsdag"},{"date":"2027-03-26","name":"Goede vrijdag"},{"date":"2027-03-28","name":"Eerste Paasdag"},{"date":"2027-03-29","name":"Tweede Paasdag"},{"date":"2027-04-27","name":"Koningsdag"},{"date":"2027-05-05","name":"Bevrijdingsdag"},{"date":"2027-05-06","name":"Hemelvaartsdag"},{"date":"2027-05-16","name":"Eerste Pinksterdag"},{"date":"2027-05-17","name":"Tweede Pinksterdag"},{"date":"2027-12-25","name":"Eerste Kerstdag"},{"date":"2027-12-26","name":"Tweede Kerstdag"}]},
};

function applyHolidayData(data) {
  const p = getProfile();
  p.nationalHolidays = {};
  data.holidays.forEach((h) => {
    p.nationalHolidays[h.date] = h.name;
  });
  p._holidaySource = "json";
  save();
}

async function fetchNationalHolidays(year) {
  const p = getProfile();

  // 1. Try fetch (works when served via HTTP/HTTPS)
  try {
    const url = `nl-${year}.json`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data.holidays && Array.isArray(data.holidays)) {
        applyHolidayData(data);
        console.log(`Holidays loaded from ${url}`);
        return;
      }
    }
  } catch (e) {
    console.log("Fetch failed (expected on file://), trying bundled data:", e.message);
  }

  // 2. Use bundled data if available
  if (BUNDLED_HOLIDAYS[year]) {
    applyHolidayData(BUNDLED_HOLIDAYS[year]);
    console.log(`Holidays loaded from bundled data for ${year}`);
    return;
  }

  // 3. Last resort: calculated fallback
  console.log(`No bundled data for ${year}, using calculated fallback`);
  p.nationalHolidays = getNLFallback(year);
  p._holidaySource = "fallback";
  save();
}

function getNLFallback(year) {
  const hols = {};
  const fmt = (d) => d.toISOString().split("T")[0];
  hols[year + "-01-01"] = "Nieuwjaarsdag";
  const e = getEaster(year);
  const gf = new Date(e);
  gf.setDate(e.getDate() - 2);
  hols[fmt(gf)] = "Goede vrijdag";
  hols[fmt(e)] = "Eerste Paasdag";
  const em = new Date(e);
  em.setDate(e.getDate() + 1);
  hols[fmt(em)] = "Tweede Paasdag";
  const asc = new Date(e);
  asc.setDate(e.getDate() + 39);
  hols[fmt(asc)] = "Hemelvaartsdag";
  const p1 = new Date(e);
  p1.setDate(e.getDate() + 49);
  hols[fmt(p1)] = "Eerste Pinksterdag";
  const p2 = new Date(e);
  p2.setDate(e.getDate() + 50);
  hols[fmt(p2)] = "Tweede Pinksterdag";
  hols[year + "-04-27"] = "Koningsdag";
  hols[year + "-05-05"] = "Bevrijdingsdag";
  hols[year + "-12-25"] = "Eerste Kerstdag";
  hols[year + "-12-26"] = "Tweede Kerstdag";
  return hols;
}

function getEaster(year) {
  const a = year % 19,
    b = Math.floor(year / 100),
    c = year % 100;
  const d = Math.floor(b / 4),
    e = b % 4,
    f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3),
    h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4),
    k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  return new Date(
    year,
    Math.floor((h + l - 7 * m + 114) / 31) - 1,
    ((h + l - 7 * m + 114) % 31) + 1,
  );
}

// ── UTILITIES ─────────────────────────────────────────────────────────────────
function dateKey(d) {
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}
function isWeekend(d) {
  const w = d.getDay();
  return w === 0 || w === 6;
}

function allFreeDays() {
  const p = getProfile(),
    all = {};
  Object.entries(p.nationalHolidays || {}).forEach(([k, v]) => {
    all[k] = { name: v, type: "national" };
  });
  Object.entries(p.customHolidays || {}).forEach(([k, v]) => {
    all[k] = { name: v, type: "custom" };
  });
  return all;
}

// Parse YYYY-MM-DD as LOCAL midnight to avoid UTC timezone shift (off-by-one bug)
function parseLocalDate(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatPeriod(start, end) {
  const s = typeof start === "string" ? parseLocalDate(start) : start;
  const e = typeof end === "string" ? parseLocalDate(end) : end;
  const sM = MONTHS_NL[s.getMonth()],
    eM = MONTHS_NL[e.getMonth()];
  if (sM === eM) return s.getDate() + " t/m " + e.getDate() + " " + sM;
  return s.getDate() + " " + sM + " t/m " + e.getDate() + " " + eM;
}

function formatDate(dateStr) {
  const d = parseLocalDate(dateStr);
  return d.getDate() + " " + MONTHS_NL[d.getMonth()];
}

function populateExpiryDropdowns() {
  const year = state.year;
  const ends = [
    ["31 januari", year + "-01-31"],
    ["28/29 februari", year + "-02-" + new Date(year, 2, 0).getDate()],
    ["31 maart", year + "-03-31"],
    ["30 april", year + "-04-30"],
    ["31 mei", year + "-05-31"],
    ["30 juni", year + "-06-30"],
    ["31 juli", year + "-07-31"],
    ["31 augustus", year + "-08-31"],
    ["30 september", year + "-09-30"],
    ["31 oktober", year + "-10-31"],
    ["30 november", year + "-11-30"],
    ["31 december", year + "-12-31"],
  ];
  const opts =
    '<option value="">Geen vervaldatum</option>' +
    ends.map(([l, v]) => `<option value="${v}">Eind ${l}</option>`).join("");
  document.getElementById("expiryDateInputDays").innerHTML = opts;
  document.getElementById("expiryDateInput").innerHTML = opts;
}

// ── SUGGESTION ENGINE ─────────────────────────────────────────────────────────
function computeSuggestions() {
  const p = getProfile();
  const year = state.year;
  const free = allFreeDays();

  const hasLeaveConfig =
    p.leaveMode === "hours"
      ? p.totalLeave != null && p.totalLeave !== ""
      : p.totalDays != null && p.totalDays !== "";
  if (!hasLeaveConfig) return [];

  const minV = Math.max(1, parseInt(p.minVacation) || 1);
  const maxV = Math.max(minV, parseInt(p.maxLeave) || 10);
  const maxCal = parseInt(p.maxCalendarDays) || 0;

  const anchors = Object.keys(free)
    .filter((k) => {
      const d = parseLocalDate(k);
      return d.getFullYear() === year && !isWeekend(d);
    })
    .sort();

  if (anchors.length === 0) return [];

  const seen = new Set();
  const candidates = [];

  anchors.forEach((anchorDateStr) => {
    const anchor = parseLocalDate(anchorDateStr);
    for (let startOffset = -14; startOffset <= 0; startOffset++) {
      const startD = new Date(anchor);
      startD.setDate(anchor.getDate() + startOffset);
      for (let len = 1; len <= 28; len++) {
        const endD = new Date(startD);
        endD.setDate(startD.getDate() + len - 1);
        if (endD.getFullYear() !== year) break;

        let toTakeCount = 0,
          freeCount = 0;
        const cur = new Date(startD);
        const days = [];
        while (cur <= endD) {
          const k = dateKey(cur);
          const dow = cur.getDay();
          const weekend = dow === 0 || dow === 6;
          const isFree = !!free[k];
          if (!weekend) {
            if (isFree) freeCount++;
            else toTakeCount++;
          }
          days.push({
            date: k,
            dayNum: cur.getDate(),
            month: cur.getMonth(),
            isWeekend: weekend,
            isFree: isFree,
            freeType: free[k] ? free[k].type : null,
            freeName: free[k] ? free[k].name : null,
            dayName: DAYS_NL[(dow + 6) % 7],
          });
          cur.setDate(cur.getDate() + 1);
        }

        if (freeCount === 0) continue;
        if (toTakeCount > maxV) break;
        if (maxCal > 0 && len > maxCal) break;
        if (toTakeCount < minV) continue;

        const ratio = freeCount / (freeCount + toTakeCount);
        if (ratio < 0.15) continue;

        const takeKey = days
          .filter((d) => !d.isWeekend && !d.isFree)
          .map((d) => d.date)
          .join("|");
        if (seen.has(takeKey)) continue;
        seen.add(takeKey);

        let efficiencyLabel, efficiencyClass;
        if (ratio >= 0.5) {
          efficiencyLabel = "Zeer efficiënt";
          efficiencyClass = "score-excellent";
        } else if (ratio >= 0.3) {
          efficiencyLabel = "Efficiënt";
          efficiencyClass = "score-good";
        } else {
          efficiencyLabel = "Normaal";
          efficiencyClass = "score-ok";
        }

        candidates.push({
          startDate: dateKey(startD),
          endDate: dateKey(endD),
          daysToTake: toTakeCount,
          totalDaysOff: len,
          freeDaysInPeriod: days,
          score: ratio + freeCount * 0.05,
          label: formatPeriod(startD, endD),
          isBridge: len > 7,
          efficiencyLabel,
          efficiencyClass,
          freeworkCount: freeCount,
        });
      }
    }
  });

  candidates.sort((a, b) => b.score - a.score);

  const result = [],
    usedTakeDates = new Set();
  for (const c of candidates) {
    const takeDates = c.freeDaysInPeriod
      .filter((d) => !d.isWeekend && !d.isFree)
      .map((d) => d.date);
    if (takeDates.some((d) => usedTakeDates.has(d))) continue;
    result.push(c);
    takeDates.forEach((d) => usedTakeDates.add(d));
    if (result.length >= (state.suggestionsLimit || 6)) break;
  }
  return result;
}

// ── PLANNED DAYS ──────────────────────────────────────────────────────────────
function planSuggestion(i) {
  const s = window._suggestions[i];
  const p = getProfile();
  if (!p.plannedDays) p.plannedDays = {};
  s.freeDaysInPeriod.forEach((day) => {
    if (!day.isWeekend && !day.isFree) p.plannedDays[day.date] = true;
  });
  save();
  renderAll();
}

function removePlannedDay(k) {
  const p = getProfile();
  delete p.plannedDays[k];
  save();
  renderAll();
}
function removeCustomDay(k) {
  const p = getProfile();
  delete p.customHolidays[k];
  save();
  renderAll();
}

function switchProfile(name) {
  state.activeProfile = name;
  save();
  renderProfileModal();
  renderAll();
}

// ── INIT ──────────────────────────────────────────────────────────────────────
async function initYear() {
  document.getElementById("loadingHolidays").style.display = "block";
  document.getElementById("holidaysList").style.display = "none";
  window._suggestions = [];
  renderAll();

  await fetchNationalHolidays(state.year);

  renderAll();
}

// NOTE: load() and initYear() are called at the end of render.js,
// after renderAll() and all render functions are defined.
