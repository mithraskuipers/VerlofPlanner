// ── RENDER FUNCTIONS ──────────────────────────────────────────────────────────

function renderCalendar() {
  const year = state.year;
  const p = getProfile();
  const free = allFreeDays();
  const planned = p.plannedDays || {};
  const today = dateKey(new Date());

  const suggestedDays = new Set();
  if (window._suggestions) {
    window._suggestions.forEach((s) => {
      s.freeDaysInPeriod.forEach((day) => {
        if (!day.isWeekend && !day.isFree && !planned[day.date]) {
          suggestedDays.add(day.date);
        }
      });
    });
  }

  const grid = document.getElementById("calendarGrid");
  grid.innerHTML = "";

  for (let m = 0; m < 12; m++) {
    const block = document.createElement("div");
    block.className = "month-block";

    const mName = document.createElement("div");
    mName.className = "month-name";
    mName.textContent = MONTHS_NL[m];
    block.appendChild(mName);

    const headerRow = document.createElement("div");
    headerRow.className = "week-row";
    DAYS_NL.forEach((d) => {
      const h = document.createElement("div");
      h.className = "day-header";
      h.textContent = d;
      headerRow.appendChild(h);
    });
    block.appendChild(headerRow);

    const firstDay = new Date(year, m, 1);
    const lastDay = new Date(year, m + 1, 0);
    const startDow = (firstDay.getDay() + 6) % 7;

    let currentRow = document.createElement("div");
    currentRow.className = "week-row";

    for (let empty = 0; empty < startDow; empty++) {
      const e = document.createElement("div");
      e.className = "cal-day empty";
      currentRow.appendChild(e);
    }

    for (let day = 1; day <= lastDay.getDate(); day++) {
      const d = new Date(year, m, day);
      const dow = (d.getDay() + 6) % 7;
      const k = dateKey(d);

      const cell = document.createElement("div");
      cell.className = "cal-day";
      cell.textContent = day;

      if (k === today) cell.classList.add("today");

      if (planned[k]) {
        cell.classList.add("leave-day");
        cell.title = "Verlof opgenomen";
      } else if (free[k] && dow < 5) {
        cell.classList.add(
          free[k].type === "national" ? "national-holiday" : "custom-holiday",
        );
        cell.title = free[k].name;
      } else if (free[k] && dow >= 5) {
        cell.classList.add("weekend");
        cell.title = free[k].name + " (valt in weekend)";
      } else if (suggestedDays.has(k)) {
        cell.classList.add("suggested-day");
        cell.title = "Aanbevolen verlofdag";
      } else if (dow >= 5) {
        cell.classList.add("weekend");
      }

      currentRow.appendChild(cell);

      if (dow === 6 || day === lastDay.getDate()) {
        if (dow < 6 && day === lastDay.getDate()) {
          for (let pad = dow + 1; pad < 7; pad++) {
            const e = document.createElement("div");
            e.className = "cal-day empty";
            currentRow.appendChild(e);
          }
        }
        block.appendChild(currentRow);
        currentRow = document.createElement("div");
        currentRow.className = "week-row";
      }
    }
    grid.appendChild(block);
  }
}

function renderSuggestions() {
  const container = document.getElementById("suggestionsContainer");
  const suggestions = computeSuggestions();
  const p = getProfile();

  const plannedCount = Object.keys(p.plannedDays || {}).length;
  const hasLeaveConfig =
    p.leaveMode === "hours"
      ? p.totalLeave != null && p.totalLeave !== ""
      : p.totalDays != null && p.totalDays !== "";

  let remaining = Infinity;
  if (hasLeaveConfig) {
    if ((p.leaveMode || "days") === "hours") {
      remaining =
        Math.floor(
          (parseInt(p.totalLeave) || 0) / (parseFloat(p.hoursPerDay) || 8),
        ) - plannedCount;
    } else {
      remaining = (parseInt(p.totalDays) || 0) - plannedCount;
    }
  }

  window._suggestions = suggestions;

  if (!hasLeaveConfig) {
    container.innerHTML =
      '<div class="empty-state">Vul je verlofbalans in bij de instellingen om suggesties te zien.</div>';
    return;
  }

  if (suggestions.length === 0) {
    container.innerHTML =
      '<div class="empty-state">Geen suggesties gevonden. Pas de min/max verlofdagen aan.</div>';
    return;
  }

  container.innerHTML = suggestions
    .map((s, i) => {
      const canAfford = remaining === Infinity || s.daysToTake <= remaining;

      const monthMap = {};
      s.freeDaysInPeriod.forEach((day) => {
        if (!monthMap[day.month]) monthMap[day.month] = [];
        monthMap[day.month].push(day);
      });

      const calHtml = Object.entries(monthMap)
        .map(([mo, mDays]) => {
          const firstDow = (new Date(mDays[0].date).getDay() + 6) % 7;
          let cells = "";
          for (let pad = 0; pad < firstDow; pad++) cells += "<div></div>";
          mDays.forEach((day) => {
            let cls = "sc-day";
            if (day.isWeekend) cls += " sc-weekend";
            else if (day.isFree) cls += " sc-free";
            else cls += " sc-take";
            const tip = day.isFree
              ? day.freeName || ""
              : !day.isWeekend
                ? "Op te nemen"
                : "";
            cells += `<div class="${cls}" title="${tip}">${day.dayNum}</div>`;
          });
          const header = DAYS_NL.map((d) => `<div>${d[0]}</div>`).join("");
          return `<div class="sug-month-block">
        <div class="sug-month-name">${MONTHS_NL[mo]}</div>
        <div class="sug-cal-header">${header}</div>
        <div class="sug-cal-grid">${cells}</div>
      </div>`;
        })
        .join("");

      const plural = (n) => (n !== 1 ? "en" : "");
      const notAfford = canAfford
        ? ""
        : '<span style="color:var(--warn);font-size:12px;margin-left:auto;">Onvoldoende saldo</span>';
      const disabledAttr = canAfford ? "" : ' disabled style="opacity:0.5"';

      return `<div class="suggestion-card">
      <div class="suggestion-header">
        <div>
          <div class="suggestion-title">${s.label}</div>
          <div class="suggestion-meta">${s.daysToTake} verlofdag${plural(s.daysToTake)} opnemen · ${s.totalDaysOff} kalenderdagen aaneengesloten · ${s.freeworkCount} feestdag${plural(s.freeworkCount)} meegenomen</div>
        </div>
        <span class="suggestion-score ${s.efficiencyClass}">${s.efficiencyLabel}</span>
      </div>
      <div class="sug-calendar-row">${calHtml}</div>
      <div class="sug-legend-row">
        <span class="sug-leg-item sc-free-leg">Feestdag</span>
        <span class="sug-leg-item sc-take-leg">Op te nemen</span>
        <span class="sug-leg-item sc-weekend-leg">Weekend</span>
        ${notAfford}
      </div>
      <div style="padding:0 14px 12px;">
        <button class="btn btn-primary btn-sm" onclick="planSuggestion(${i})"${disabledAttr}>Inplannen</button>
      </div>
    </div>`;
    })
    .join("");

  // "Show more" button
  const limit = state.suggestionsLimit || 6;
  container.innerHTML += `<div style="text-align:center;padding:8px 0 4px;">
    <button class="btn btn-ghost btn-sm" id="showMoreSuggestions" onclick="showMoreSuggestions()">↓ Meer suggesties tonen</button>
    ${limit > 6 ? `<button class="btn btn-ghost btn-sm" style="margin-left:8px;" onclick="showFewerSuggestions()">↑ Minder tonen</button>` : ""}
  </div>`;
}

function renderHolidaysList() {
  const loading = document.getElementById("loadingHolidays");
  const list = document.getElementById("holidaysList");
  const free = allFreeDays();
  if (Object.keys(free).length === 0) {
    loading.style.display = "block";
    list.style.display = "none";
    return;
  }
  loading.style.display = "none";
  list.style.display = "flex";
  // Show source indicator
  const p = getProfile();
  const sourceEl = document.getElementById("holidaySource");
  if (sourceEl) {
    const src = p._holidaySource;
    sourceEl.innerHTML = src === "json"
      ? `<span class="source-badge source-json">📄 nl-${state.year}.json</span>`
      : `<span class="source-badge source-fallback">⚙️ Berekend (fallback)</span>`;
  }
  const sorted = Object.entries(free).sort((a, b) => a[0].localeCompare(b[0]));
  list.innerHTML = sorted
    .map(([k, v]) => {
      const isNational = v.type === "national";
      const badge = isNational ? "badge-national" : "badge-custom";
      const badgeTxt = isNational ? "Nationaal" : "Eigen";
      const delBtn = isNational
        ? ""
        : `<button class="btn btn-danger btn-sm" onclick="removeCustomDay('${k}')">×</button>`;
      return `<div class="day-item ${isNational ? "national" : "custom"}">
      <div>
        <div style="font-weight:500;font-size:13px;">${v.name || v}</div>
        <div style="font-size:11px;color:var(--muted);">${formatDate(k)}</div>
      </div>
      <div style="display:flex;align-items:center;gap:6px;">
        <span class="day-badge ${badge}">${badgeTxt}</span>${delBtn}
      </div>
    </div>`;
    })
    .join("");
}

function renderPlannedList() {
  const p = getProfile();
  const planned = p.plannedDays || {};
  const list = document.getElementById("plannedList");
  const empty = document.getElementById("plannedEmpty");
  const sorted = Object.keys(planned).sort();
  if (sorted.length === 0) {
    list.innerHTML = "";
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";
  list.innerHTML = sorted
    .map((k) => {
      const [ky, km, kd] = k.split("-").map(Number);
      const dow = new Date(ky, km - 1, kd).getDay();
      const dayName = DAYS_NL[(dow + 6) % 7];
      return `<div class="day-item custom">
      <div>
        <div style="font-weight:500;font-size:13px;">${formatDate(k)}</div>
        <div style="font-size:11px;color:var(--muted);">${dayName}dag</div>
      </div>
      <button class="btn btn-danger btn-sm" onclick="removePlannedDay('${k}')">×</button>
    </div>`;
    })
    .join("");
}

function renderStats() {
  const p = getProfile();
  const mode = p.leaveMode || "days";
  const plannedCount = Object.keys(p.plannedDays || {}).length;

  const hasLeaveConfig =
    mode === "hours"
      ? p.totalLeave != null && p.totalLeave !== ""
      : p.totalDays != null && p.totalDays !== "";

  let totalDays = null,
    expiryDays = 0,
    expiryDateVal = "";
  if (hasLeaveConfig) {
    if (mode === "days") {
      totalDays = parseInt(p.totalDays) || 0;
      expiryDays = parseInt(p.expiryDaysCount) || 0;
      expiryDateVal = p.expiryDateDays || "";
    } else {
      const hpd = parseFloat(p.hoursPerDay) || 8;
      totalDays = Math.floor((parseInt(p.totalLeave) || 0) / hpd);
      expiryDays = Math.floor((parseInt(p.expiryHours) || 0) / hpd);
      expiryDateVal = p.expiryDate || "";
    }
  }

  const remaining = totalDays != null ? totalDays - plannedCount : null;
  document.getElementById("daysLeft").textContent =
    remaining != null ? remaining : "—";
  document.getElementById("daysPlanned").textContent =
    plannedCount +
    " dag" +
    (plannedCount !== 1 ? "en" : "") +
    " reeds ingepland";
  document.getElementById("expiryDays").textContent =
    expiryDays > 0 ? expiryDays : "0";

  if (expiryDateVal && expiryDays > 0) {
    const [ey, em, ed] = expiryDateVal.split("-").map(Number);
    const daysUntil = Math.ceil(
      (new Date(ey, em - 1, ed) - new Date()) / 86400000,
    );
    document.getElementById("expiryDate").textContent =
      "Verloopt op " + formatDate(expiryDateVal) + " (" + daysUntil + " dagen)";
    if (daysUntil < 60) {
      document.getElementById("expiryAlert").style.display = "flex";
      document.getElementById("expiryAlertText").textContent =
        "Je hebt " +
        expiryDays +
        " verlofdag" +
        (expiryDays !== 1 ? "en" : "") +
        " die vervalt op " +
        formatDate(expiryDateVal) +
        ". Plan deze snel in!";
    } else {
      document.getElementById("expiryAlert").style.display = "none";
    }
  } else {
    document.getElementById("expiryDate").textContent =
      "Geen vervaldatum ingesteld";
    document.getElementById("expiryAlert").style.display = "none";
  }

  const free = allFreeDays();
  let freeWorkdays = 0;
  Object.keys(free).forEach((k) => {
    const d = new Date(k);
    if (d.getFullYear() === state.year && !isWeekend(d)) freeWorkdays++;
  });
  document.getElementById("totalFreeDays").textContent = freeWorkdays;
  document.getElementById("freeDaysSub").textContent =
    freeWorkdays + " nationale + eigen vrije werkdagen";
}

function renderProfileModal() {
  const list = document.getElementById("profileList");
  const allKeys = Object.keys(state.profiles).map((k) => k.split("_")[0]);
  const profiles = [
    "standaard",
    ...allKeys.filter((v, i, a) => a.indexOf(v) === i && v !== "standaard"),
  ];
  list.innerHTML = profiles
    .map((name) => {
      const isActive = name === state.activeProfile;
      return `<div class="profile-item ${isActive ? "active" : ""}" onclick="switchProfile('${name}')">
      <span>${name}</span>
      ${isActive ? '<span style="font-size:11px;color:var(--accent);">Actief</span>' : ""}
    </div>`;
    })
    .join("");
}

function setSlider(id, valId, value, fallback) {
  const el = document.getElementById(id);
  const valEl = document.getElementById(valId);
  if (!el) return;
  const v = (value != null && value !== "") ? value : fallback;
  el.value = v;
  if (valEl) valEl.textContent = v;
}

function loadProfileSettings() {
  const p = getProfile();
  const mode = p.leaveMode || "days";
  populateExpiryDropdowns();
  document.getElementById("modeDaysBtn").classList.toggle("active", mode === "days");
  document.getElementById("modeHoursBtn").classList.toggle("active", mode === "hours");
  document.getElementById("fieldsDays").style.display = mode === "days" ? "" : "none";
  document.getElementById("fieldsHours").style.display = mode === "hours" ? "" : "none";

  setSlider("totalDays", "totalDaysVal", p.totalDays, 20);
  document.getElementById("expiryDateInputDays").value = p.expiryDateDays || "";
  setSlider("expiryDaysInput", "expiryDaysVal", p.expiryDaysCount, 0);
  setSlider("totalLeave", "totalLeaveVal", p.totalLeave, 160);
  setSlider("hoursPerDay", "hoursPerDayVal", p.hoursPerDay, 8);
  document.getElementById("expiryDateInput").value = p.expiryDate || "";
  setSlider("expiryHours", "expiryHoursVal", p.expiryHours, 0);
  setSlider("minVacation", "minVacationVal", p.minVacation, 7);
  setSlider("maxLeave", "maxLeaveVal", p.maxLeave, 5);
  setSlider("maxCalendarDays", "maxCalendarDaysVal", p.maxCalendarDays, 10);
  document.getElementById("profileName").textContent = state.activeProfile;
}

// renderAll: suggestions FIRST so calendar can read window._suggestions
function renderAll() {
  document.getElementById("currentYearLabel").textContent = state.year;
  document.getElementById("calYear").textContent = state.year;
  document.getElementById("sugYear").textContent = state.year;
  loadProfileSettings();
  renderHolidaysList();
  renderPlannedList();
  renderSuggestions(); // must run before renderCalendar
  renderCalendar();
  renderStats();
}

// ── SUGGESTION LIMIT ─────────────────────────────────────────────────────────
function showMoreSuggestions() {
  state.suggestionsLimit = (state.suggestionsLimit || 6) + 6;
  renderSuggestions();
  renderCalendar();
}
function showFewerSuggestions() {
  state.suggestionsLimit = Math.max(6, (state.suggestionsLimit || 6) - 6);
  renderSuggestions();
  renderCalendar();
}

// ── EVENT WIRING ──────────────────────────────────────────────────────────────
document.getElementById("prevYear").onclick = () => {
  state.year--;
  save();
  initYear();
};
document.getElementById("nextYear").onclick = () => {
  state.year++;
  save();
  initYear();
};

document.getElementById("saveSettings").onclick = handleSaveSettings;
document.getElementById("saveSettingsTop").onclick = handleSaveSettings;

function handleSaveSettings() {
  const p = getProfile();
  const mode = p.leaveMode || "days";

  if (mode === "days") {
    p.totalDays = parseInt(document.getElementById("totalDays").value);
    p.expiryDateDays = document.getElementById("expiryDateInputDays").value;
    p.expiryDaysCount = parseInt(document.getElementById("expiryDaysInput").value) || 0;
  } else {
    p.totalLeave = parseInt(document.getElementById("totalLeave").value);
    p.hoursPerDay = parseFloat(document.getElementById("hoursPerDay").value);
    p.expiryDate = document.getElementById("expiryDateInput").value;
    p.expiryHours = parseInt(document.getElementById("expiryHours").value) || 0;
  }

  p.minVacation = parseInt(document.getElementById("minVacation").value) || null;
  p.maxLeave = parseInt(document.getElementById("maxLeave").value) || null;
  p.maxCalendarDays = parseInt(document.getElementById("maxCalendarDays").value) || null;

  save();
  renderAll();
  ["saveSettings", "saveSettingsTop"].forEach((id) => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.textContent = "Opgeslagen ✓";
      setTimeout(() => {
        btn.textContent = "Instellingen opslaan";
      }, 2000);
    }
  });
}

document.getElementById("addCustomDay").onclick = () => {
  const date = document.getElementById("customDayDate").value;
  const name =
    document.getElementById("customDayName").value.trim() || "Vrije dag";
  if (!date) return;
  const p = getProfile();
  if (!p.customHolidays) p.customHolidays = {};
  p.customHolidays[date] = name;
  document.getElementById("customDayDate").value = "";
  document.getElementById("customDayName").value = "";
  save();
  renderAll();
};

document.getElementById("recalcBtn").onclick = renderAll;

document.querySelectorAll(".tab").forEach((tab) => {
  tab.onclick = () => {
    document
      .querySelectorAll(".tab")
      .forEach((t) => t.classList.remove("active"));
    document
      .querySelectorAll(".tab-content")
      .forEach((c) => c.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById("tab-" + tab.dataset.tab).classList.add("active");
  };
});

document.getElementById("openProfiles").onclick = () => {
  renderProfileModal();
  document.getElementById("profileModal").classList.add("open");
};
document.getElementById("closeProfiles").onclick = () => {
  document.getElementById("profileModal").classList.remove("open");
};
document.getElementById("profileModal").onclick = (e) => {
  if (e.target === document.getElementById("profileModal"))
    document.getElementById("profileModal").classList.remove("open");
};
document.getElementById("addProfile").onclick = () => {
  const name = document.getElementById("newProfileName").value.trim();
  if (!name) return;
  document.getElementById("newProfileName").value = "";
  switchProfile(name);
  document.getElementById("profileModal").classList.remove("open");
};

document.getElementById("modeToggle").onclick = (e) => {
  const btn = e.target.closest(".mode-btn");
  if (!btn) return;
  const p = getProfile();
  p.leaveMode = btn.dataset.mode;
  save();
  loadProfileSettings();
  renderStats();
};

// ── SLIDER LIVE UPDATES ───────────────────────────────────────────────────────
const sliderMap = {
  totalDays: "totalDaysVal",
  expiryDaysInput: "expiryDaysVal",
  totalLeave: "totalLeaveVal",
  hoursPerDay: "hoursPerDayVal",
  expiryHours: "expiryHoursVal",
  minVacation: "minVacationVal",
  maxLeave: "maxLeaveVal",
  maxCalendarDays: "maxCalendarDaysVal",
};
Object.entries(sliderMap).forEach(([sliderId, valId]) => {
  const el = document.getElementById(sliderId);
  const valEl = document.getElementById(valId);
  if (el && valEl) el.addEventListener("input", () => { valEl.textContent = el.value; });
});

// ── BOOTSTRAP (after all functions are defined) ──────────────────────────────
load();
initYear();
