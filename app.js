(() => {
  "use strict";

  const STORAGE_KEY = "chemie_analytik_hub_v0_1";
  const ACTIVE_CASE = "VCOE01";

  const els = {};
  let db = null;
  let state = null;
  let selectedSampleId = null;
  let validation = null;

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    bindEls();
    bindStaticEvents();

    try {
      db = await loadCore();
      validation = validateCore(db);
      state = loadState() || createInitialState(db);
      normalizeState();
      selectedSampleId = state.selectedSampleId || db.case.start_sample_id;
      render();
    } catch (error) {
      renderFatal(error);
    }
  }

  function bindEls() {
    [
      "schemaBadge", "caseTitle", "caseDescription", "sampleTree", "detailTitle",
      "sampleMeta", "actions", "actionHint", "journal", "validatorSummary",
      "validatorDetails", "resetBtn", "toggleDiag"
    ].forEach(id => els[id] = document.getElementById(id));
  }

  function bindStaticEvents() {
    els.resetBtn.addEventListener("click", () => {
      if (!confirm("VCÖ-01 wirklich auf den Ausgangszustand zurücksetzen?")) return;
      state = createInitialState(db);
      selectedSampleId = db.case.start_sample_id;
      saveState();
      render();
    });

    els.toggleDiag.addEventListener("click", () => {
      els.validatorDetails.classList.toggle("hidden");
      els.toggleDiag.textContent = els.validatorDetails.classList.contains("hidden")
        ? "Details anzeigen" : "Details ausblenden";
    });
  }

  async function loadCore() {
    const paths = {
      substances: "data/substances.json",
      samples: "data/samples.json",
      cases: "data/cases.json",
      operations: "data/operations.json",
      schema: "schema/schema-version.json"
    };

    const entries = await Promise.all(Object.entries(paths).map(async ([key, path]) => {
      const response = await fetch(path, { cache: "no-store" });
      if (!response.ok) throw new Error(`${path} konnte nicht geladen werden (${response.status}).`);
      return [key, await response.json()];
    }));

    const raw = Object.fromEntries(entries);
    const activeCase = raw.cases.cases.find(c => c.id === ACTIVE_CASE);
    if (!activeCase) throw new Error(`Case ${ACTIVE_CASE} fehlt.`);

    return {
      raw,
      case: activeCase,
      substances: raw.substances.substances,
      samples: raw.samples.samples,
      operations: raw.operations.operations,
      schemaVersion: raw.schema.schema_version || raw.samples.schema_version || "?"
    };
  }

  function validateCore(core) {
    const issues = [];
    const warnings = [];
    const sampleIds = new Set(core.samples.map(x => x.id));
    const substanceIds = new Set(core.substances.map(x => x.id));
    const operationIds = new Set(core.operations.map(x => x.id));
    const caseIds = new Set(core.raw.cases.cases.map(x => x.id));

    checkDuplicates(core.samples, "Sample", issues);
    checkDuplicates(core.substances, "Substance", issues);
    checkDuplicates(core.operations, "Operation", issues);

    for (const sample of core.samples) {
      if (sample.case_id && !caseIds.has(sample.case_id)) issues.push(`${sample.id}: unbekannte case_id ${sample.case_id}`);
      if (sample.parent_sample_id && !sampleIds.has(sample.parent_sample_id)) issues.push(`${sample.id}: parent_sample_id ${sample.parent_sample_id} fehlt`);
      if (sample.created_by && !operationIds.has(sample.created_by)) issues.push(`${sample.id}: created_by ${sample.created_by} fehlt`);
      for (const op of sample.allowed_operations || []) {
        if (!operationIds.has(op)) issues.push(`${sample.id}: allowed_operation ${op} fehlt`);
      }
      for (const comp of sample.composition_internal || []) {
        if (!substanceIds.has(comp.substance_id)) issues.push(`${sample.id}: Substance ${comp.substance_id} fehlt`);
      }
    }

    for (const c of core.raw.cases.cases) {
      if (!sampleIds.has(c.start_sample_id)) issues.push(`${c.id}: start_sample_id ${c.start_sample_id} fehlt`);
    }

    const modelFractions = core.samples.flatMap(s => (s.composition_internal || [])
      .filter(x => typeof x.fraction_model === "number")
      .map(x => ({ sample: s.id, value: x.fraction_model })));
    if (modelFractions.length) warnings.push("fraction_model-Werte sind Entwicklungs-/Platzhalterwerte und keine festgelegte reale Rezeptur.");

    return { issues, warnings };
  }

  function checkDuplicates(items, label, issues) {
    const seen = new Set();
    for (const item of items) {
      if (seen.has(item.id)) issues.push(`${label}: doppelte ID ${item.id}`);
      seen.add(item.id);
    }
  }

  function createInitialState(core) {
    return {
      caseId: core.case.id,
      unlockedSamples: [core.case.start_sample_id],
      completedOperations: [],
      journal: [{
        ts: new Date().toISOString(),
        text: "Unbekannte Ausgangsprobe bereitgestellt."
      }],
      selectedSampleId: core.case.start_sample_id
    };
  }

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return parsed && parsed.caseId === ACTIVE_CASE ? parsed : null;
    } catch {
      return null;
    }
  }

  function normalizeState() {
    if (!Array.isArray(state.unlockedSamples)) state.unlockedSamples = [db.case.start_sample_id];
    if (!Array.isArray(state.completedOperations)) state.completedOperations = [];
    if (!Array.isArray(state.journal)) state.journal = [];
  }

  function saveState() {
    state.selectedSampleId = selectedSampleId;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function render() {
    els.schemaBadge.textContent = `CORE ${db.schemaVersion}`;
    els.caseTitle.textContent = db.case.name_de;
    els.caseDescription.textContent = "Eine unbekannte heterogene Probe soll sinnvoll vorbereitet und schrittweise analysiert werden. Die interne Stoffzusammensetzung bleibt im Schülerbetrieb verborgen.";
    renderTree();
    renderDetail();
    renderJournal();
    renderValidator();
  }

  function renderTree() {
    const caseSamples = db.samples.filter(s => s.case_id === db.case.id);
    const byParent = new Map();
    for (const sample of caseSamples) {
      const parent = sample.parent_sample_id || "__root__";
      if (!byParent.has(parent)) byParent.set(parent, []);
      byParent.get(parent).push(sample);
    }

    els.sampleTree.innerHTML = "";
    const root = caseSamples.find(s => s.id === db.case.start_sample_id);
    if (root) els.sampleTree.appendChild(makeTreeNode(root, byParent));
  }

  function makeTreeNode(sample, byParent) {
    const node = document.createElement("div");
    node.className = "tree-node";
    const unlocked = state.unlockedSamples.includes(sample.id);

    const row = document.createElement("div");
    row.className = "node-row";
    row.innerHTML = `<span class="state-dot ${unlocked ? "" : "locked"}"></span>`;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `sample-btn ${unlocked ? "" : "locked"} ${selectedSampleId === sample.id ? "selected" : ""}`;
    btn.disabled = !unlocked;
    btn.innerHTML = `<span><span class="sample-name">${escapeHtml(sample.name_de)}</span><br><span class="sample-id">${escapeHtml(sample.id)}</span></span><span>${unlocked ? "bereit" : "gesperrt"}</span>`;
    btn.addEventListener("click", () => {
      selectedSampleId = sample.id;
      saveState();
      render();
    });
    row.appendChild(btn);
    node.appendChild(row);

    const children = byParent.get(sample.id) || [];
    if (children.length) {
      const box = document.createElement("div");
      box.className = "tree-children";
      for (const child of children) box.appendChild(makeTreeNode(child, byParent));
      node.appendChild(box);
    }
    return node;
  }

  function renderDetail() {
    const sample = db.samples.find(s => s.id === selectedSampleId);
    if (!sample) return;

    els.detailTitle.textContent = sample.name_de;
    const stateLabel = sample.physical_state || "–";
    els.sampleMeta.innerHTML = [
      ["Sample-ID", sample.id],
      ["Zustand", stateLabel],
      ["Homogen", sample.homogeneous === true ? "ja" : sample.homogeneous === false ? "nein" : "–"],
      ["Typ", sample.sample_type || "–"]
    ].map(([k, v]) => `<div class="meta-item"><b>${escapeHtml(k)}</b>${escapeHtml(String(v))}</div>`).join("");

    els.actions.innerHTML = "";
    els.actionHint.textContent = "";

    const ops = sample.allowed_operations || [];
    const analyses = sample.compatible_analyses || [];

    if (!ops.length && !analyses.length) {
      els.actions.innerHTML = `<div class="empty">Für diese Probe ist in Hub v0.1 noch kein weiterer Schritt aktiviert.</div>`;
      return;
    }

    for (const opId of ops) {
      const op = db.operations.find(o => o.id === opId);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "action-btn";
      btn.textContent = op ? op.name_de : opId;

      const isFilter = opId === "FILTER" && sample.id === "VCOE01_RAW";
      btn.disabled = !isFilter || operationAlreadyDone(sample.id, opId);
      if (isFilter && !operationAlreadyDone(sample.id, opId)) {
        btn.addEventListener("click", () => executeFilter(sample));
      }
      els.actions.appendChild(btn);
    }

    for (const analysis of analyses) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "action-btn secondary";
      btn.disabled = true;
      btn.textContent = `${prettyAnalysis(analysis)} · vorbereitet`;
      els.actions.appendChild(btn);
    }

    if (sample.id === "VCOE01_RAW") {
      els.actionHint.textContent = "Im ersten Teststand ist nur die Filtration funktional. Zentrifugation bleibt als alternative Probenvorbereitung sichtbar, wird aber noch nicht ausgeführt.";
    } else {
      els.actionHint.textContent = "Die nächsten Stationen werden schrittweise an dieselbe CORE-/RESULT-Schnittstelle angebunden.";
    }
  }

  function executeFilter(sample) {
    const children = db.samples.filter(s => s.parent_sample_id === sample.id && s.created_by === "FILTER");
    if (!children.length) {
      alert("Für diese Filtration sind keine Ausgabesamples definiert.");
      return;
    }

    for (const child of children) {
      if (!state.unlockedSamples.includes(child.id)) state.unlockedSamples.push(child.id);
    }

    state.completedOperations.push({ sampleId: sample.id, operationId: "FILTER", ts: new Date().toISOString() });
    state.journal.push({
      ts: new Date().toISOString(),
      text: `Filtration durchgeführt: ${children.map(c => c.name_de).join(" und ")} wurden als neue Proben erzeugt.`
    });
    selectedSampleId = children.find(c => c.id === "VCOE01_FILTRATE")?.id || children[0].id;
    saveState();
    render();
  }

  function operationAlreadyDone(sampleId, operationId) {
    return state.completedOperations.some(x => x.sampleId === sampleId && x.operationId === operationId);
  }

  function renderJournal() {
    if (!state.journal.length) {
      els.journal.innerHTML = `<div class="empty">Noch keine Einträge.</div>`;
      return;
    }
    els.journal.innerHTML = state.journal.map(entry => {
      const d = new Date(entry.ts);
      const stamp = Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      return `<div class="journal-entry">${escapeHtml(entry.text)}<time>${escapeHtml(stamp)}</time></div>`;
    }).join("");
  }

  function renderValidator() {
    const parts = [
      `<span class="status ${validation.issues.length ? "warn" : "ok"}">${validation.issues.length ? `${validation.issues.length} Fehler` : "Referenzen konsistent"}</span>`,
      `<span class="status ok">${db.substances.length} Substances</span>`,
      `<span class="status ok">${db.samples.length} Samples</span>`,
      `<span class="status ok">${db.operations.length} Operations</span>`
    ];
    if (validation.warnings.length) parts.push(`<span class="status warn">${validation.warnings.length} Hinweis(e)</span>`);
    els.validatorSummary.innerHTML = parts.join("");

    const detail = [];
    detail.push(`Schema: ${db.schemaVersion}`);
    detail.push(`Case: ${db.case.id}`);
    detail.push("");
    if (validation.issues.length) {
      detail.push("FEHLER:");
      detail.push(...validation.issues.map(x => `- ${x}`));
    } else {
      detail.push("Keine fehlerhaften Referenzen gefunden.");
    }
    if (validation.warnings.length) {
      detail.push("", "HINWEISE:", ...validation.warnings.map(x => `- ${x}`));
    }
    els.validatorDetails.textContent = detail.join("\n");
  }

  function prettyAnalysis(id) {
    const map = {
      ION_FISHING: "Ionenfischen",
      SPECTRAL_LAB: "SpektralLab",
      GC_LAB: "GC-Lab",
      TITRATION: "Titrationslabor"
    };
    return map[id] || id;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function renderFatal(error) {
    document.body.innerHTML = `<main class="wrap" style="padding:40px 0"><section class="card"><h1>Hub konnte nicht gestartet werden</h1><p>${escapeHtml(error.message)}</p><p class="muted">Bitte über einen Webserver bzw. GitHub Pages öffnen; lokale file://-Aufrufe dürfen JSON-Dateien je nach Browser blockieren.</p></section></main>`;
  }
})();
