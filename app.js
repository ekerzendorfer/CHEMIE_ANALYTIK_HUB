(() => {
  "use strict";

  const STORAGE_KEY = "chemie_analytik_hub_v0_2";
  const LEGACY_STORAGE_KEY = "chemie_analytik_hub_v0_1";
  const ACTIVE_CASE = "VCOE01";
  const HUB_VERSION = "0.2.0";

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
      importReturnedResult();
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
    ].forEach(function (id) { els[id] = document.getElementById(id); });
  }

  function bindStaticEvents() {
    els.resetBtn.addEventListener("click", function () {
      if (!confirm("VCÖ-01 wirklich auf den Ausgangszustand zurücksetzen?")) return;
      state = createInitialState(db);
      selectedSampleId = db.case.start_sample_id;
      saveState();
      render();
    });

    els.toggleDiag.addEventListener("click", function () {
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
      schema: "schema/schema-version.json",
      resultSchema: "schema/result-schema.json"
    };

    const entries = await Promise.all(Object.entries(paths).map(async function (entry) {
      const key = entry[0];
      const path = entry[1];
      const response = await fetch(path, { cache: "no-store" });
      if (!response.ok) throw new Error(path + " konnte nicht geladen werden (" + response.status + ").");
      return [key, await response.json()];
    }));

    const raw = Object.fromEntries(entries);
    const activeCase = raw.cases.cases.find(function (c) { return c.id === ACTIVE_CASE; });
    if (!activeCase) throw new Error("Case " + ACTIVE_CASE + " fehlt.");

    return {
      raw: raw,
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
    const sampleIds = new Set(core.samples.map(function (x) { return x.id; }));
    const substanceIds = new Set(core.substances.map(function (x) { return x.id; }));
    const operationIds = new Set(core.operations.map(function (x) { return x.id; }));
    const caseIds = new Set(core.raw.cases.cases.map(function (x) { return x.id; }));

    checkDuplicates(core.samples, "Sample", issues);
    checkDuplicates(core.substances, "Substance", issues);
    checkDuplicates(core.operations, "Operation", issues);

    core.samples.forEach(function (sample) {
      if (sample.case_id && !caseIds.has(sample.case_id)) issues.push(sample.id + ": unbekannte case_id " + sample.case_id);
      if (sample.parent_sample_id && !sampleIds.has(sample.parent_sample_id)) issues.push(sample.id + ": parent_sample_id " + sample.parent_sample_id + " fehlt");
      if (sample.created_by && !operationIds.has(sample.created_by)) issues.push(sample.id + ": created_by " + sample.created_by + " fehlt");
      (sample.allowed_operations || []).forEach(function (op) {
        if (!operationIds.has(op)) issues.push(sample.id + ": allowed_operation " + op + " fehlt");
      });
      (sample.composition_internal || []).forEach(function (comp) {
        if (!substanceIds.has(comp.substance_id)) issues.push(sample.id + ": Substance " + comp.substance_id + " fehlt");
      });
    });

    core.raw.cases.cases.forEach(function (c) {
      if (!sampleIds.has(c.start_sample_id)) issues.push(c.id + ": start_sample_id " + c.start_sample_id + " fehlt");
    });

    const resultRequired = new Set(core.raw.resultSchema.required_fields || []);
    ["result_id", "run_id", "app_id", "sample_id", "status", "source", "measurement"].forEach(function (field) {
      if (!resultRequired.has(field)) issues.push("RESULT-Schema: Pflichtfeld " + field + " fehlt");
    });

    const modelFractions = core.samples.flatMap(function (s) {
      return (s.composition_internal || []).filter(function (x) {
        return typeof x.fraction_model === "number";
      });
    });
    if (modelFractions.length) warnings.push("fraction_model-Werte sind Entwicklungs-/Platzhalterwerte und keine festgelegte reale Rezeptur.");

    if (!window.AnalytikBridge) issues.push("CHEMIE_ANALYTIK_BRIDGE wurde nicht geladen.");

    return { issues: issues, warnings: warnings };
  }

  function checkDuplicates(items, label, issues) {
    const seen = new Set();
    items.forEach(function (item) {
      if (seen.has(item.id)) issues.push(label + ": doppelte ID " + item.id);
      seen.add(item.id);
    });
  }

  function createInitialState(core) {
    return {
      caseId: core.case.id,
      unlockedSamples: [core.case.start_sample_id],
      completedOperations: [],
      results: [],
      importedResultIds: [],
      journal: [{
        ts: new Date().toISOString(),
        type: "system",
        text: "Unbekannte Ausgangsprobe bereitgestellt."
      }],
      selectedSampleId: core.case.start_sample_id
    };
  }

  function loadState() {
    try {
      let parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (parsed && parsed.caseId === ACTIVE_CASE) return parsed;

      parsed = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY));
      if (parsed && parsed.caseId === ACTIVE_CASE) {
        parsed.results = parsed.results || [];
        parsed.importedResultIds = parsed.importedResultIds || [];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
        return parsed;
      }
      return null;
    } catch (err) {
      return null;
    }
  }

  function normalizeState() {
    if (!Array.isArray(state.unlockedSamples)) state.unlockedSamples = [db.case.start_sample_id];
    if (!Array.isArray(state.completedOperations)) state.completedOperations = [];
    if (!Array.isArray(state.results)) state.results = [];
    if (!Array.isArray(state.importedResultIds)) state.importedResultIds = [];
    if (!Array.isArray(state.journal)) state.journal = [];
  }

  function saveState() {
    state.selectedSampleId = selectedSampleId;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function importReturnedResult() {
    const params = new URLSearchParams(window.location.search);
    const runId = params.get("resume");
    if (!runId || !window.AnalytikBridge) return;

    const run = window.AnalytikBridge.getRun(runId);
    const result = window.AnalytikBridge.getResultForRun(runId);

    if (run && run.status === "completed" && result && !state.importedResultIds.includes(result.result_id)) {
      state.results.push(result);
      state.importedResultIds.push(result.result_id);
      state.journal.push({
        ts: new Date().toISOString(),
        type: "result",
        text: prettyAnalysis(result.analysis_type) + ": digitales RESULT " + result.result_id + " von " + result.app_id + " übernommen."
      });
      selectedSampleId = result.sample_id || selectedSampleId;
      saveState();
    }

    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete("resume");
    window.history.replaceState({}, "", cleanUrl.toString());
  }

  function render() {
    els.schemaBadge.textContent = "CORE " + db.schemaVersion + " · Bridge " + (window.AnalytikBridge ? window.AnalytikBridge.version : "–");
    els.caseTitle.textContent = db.case.name_de;
    els.caseDescription.textContent = "Eine unbekannte heterogene Probe soll sinnvoll vorbereitet und schrittweise analysiert werden. Die interne Stoffzusammensetzung bleibt im Schülerbetrieb verborgen.";
    renderTree();
    renderDetail();
    renderJournal();
    renderValidator();
  }

  function renderTree() {
    const caseSamples = db.samples.filter(function (s) { return s.case_id === db.case.id; });
    const byParent = new Map();
    caseSamples.forEach(function (sample) {
      const parent = sample.parent_sample_id || "__root__";
      if (!byParent.has(parent)) byParent.set(parent, []);
      byParent.get(parent).push(sample);
    });

    els.sampleTree.innerHTML = "";
    const root = caseSamples.find(function (s) { return s.id === db.case.start_sample_id; });
    if (root) els.sampleTree.appendChild(makeTreeNode(root, byParent));
  }

  function makeTreeNode(sample, byParent) {
    const node = document.createElement("div");
    node.className = "tree-node";
    const unlocked = state.unlockedSamples.includes(sample.id);
    const resultCount = state.results.filter(function (r) { return r.sample_id === sample.id; }).length;

    const row = document.createElement("div");
    row.className = "node-row";
    row.innerHTML = '<span class="state-dot ' + (unlocked ? "" : "locked") + '"></span>';

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "sample-btn " + (unlocked ? "" : "locked") + " " + (selectedSampleId === sample.id ? "selected" : "");
    btn.disabled = !unlocked;
    const statusText = !unlocked ? "gesperrt" : (resultCount ? resultCount + " Resultat(e)" : "bereit");
    btn.innerHTML = '<span><span class="sample-name">' + escapeHtml(sample.name_de) + '</span><br><span class="sample-id">' + escapeHtml(sample.id) + '</span></span><span>' + escapeHtml(statusText) + '</span>';
    btn.addEventListener("click", function () {
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
      children.forEach(function (child) { box.appendChild(makeTreeNode(child, byParent)); });
      node.appendChild(box);
    }
    return node;
  }

  function renderDetail() {
    const sample = db.samples.find(function (s) { return s.id === selectedSampleId; });
    if (!sample) return;

    els.detailTitle.textContent = sample.name_de;
    const sampleResults = state.results.filter(function (r) { return r.sample_id === sample.id; });
    const stateLabel = sample.physical_state || "–";
    const meta = [
      ["Sample-ID", sample.id],
      ["Zustand", stateLabel],
      ["Homogen", sample.homogeneous === true ? "ja" : (sample.homogeneous === false ? "nein" : "–")],
      ["Resultate", sampleResults.length]
    ];
    els.sampleMeta.innerHTML = meta.map(function (pair) {
      return '<div class="meta-item"><b>' + escapeHtml(pair[0]) + '</b>' + escapeHtml(String(pair[1])) + '</div>';
    }).join("");

    els.actions.innerHTML = "";
    els.actionHint.textContent = "";

    const ops = sample.allowed_operations || [];
    const analyses = sample.compatible_analyses || [];

    if (!ops.length && !analyses.length) {
      els.actions.innerHTML = '<div class="empty">Für diese Probe ist in Hub v' + HUB_VERSION + ' noch kein weiterer Schritt aktiviert.</div>';
      return;
    }

    ops.forEach(function (opId) {
      const op = db.operations.find(function (o) { return o.id === opId; });
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "action-btn";
      const localExecutable = isLocalExecutableOperation(sample, op);
      const done = operationAlreadyDone(sample.id, opId);
      btn.textContent = (op ? op.name_de : opId) + (localExecutable ? "" : " · vorbereitet");
      btn.disabled = !localExecutable || done;
      if (localExecutable && !done) {
        btn.addEventListener("click", function () { executeLocalOperation(sample, op); });
      }
      els.actions.appendChild(btn);
    });

    analyses.forEach(function (analysis) {
      const btn = document.createElement("button");
      btn.type = "button";
      const dummyEnabled = sample.id === "VCOE01_SOLID_AQ" && analysis === "SPECTRAL_LAB";
      btn.className = "action-btn " + (dummyEnabled ? "" : "secondary");
      btn.disabled = !dummyEnabled;
      btn.textContent = dummyEnabled
        ? prettyAnalysis(analysis) + " · Bridge-Test starten"
        : prettyAnalysis(analysis) + " · vorbereitet";
      if (dummyEnabled) {
        btn.addEventListener("click", function () { startDummyAnalysis(sample, analysis); });
      }
      els.actions.appendChild(btn);
    });

    if (sample.id === "VCOE01_RAW") {
      els.actionHint.textContent = "Filtration ist funktional. Zentrifugation bleibt als alternative Probenvorbereitung reserviert, bis dafür eigene Ausgabesamples definiert sind.";
    } else if (sample.id === "VCOE01_SOLID") {
      els.actionHint.textContent = "Der Filterrückstand kann nun in Wasser gelöst werden; dadurch entsteht eine neue wässrige Analyseprobe.";
    } else if (sample.id === "VCOE01_SOLID_AQ") {
      els.actionHint.textContent = "Für SpektralLab ist in v0.2 zunächst nur ein technischer Dummy-Rundlauf aktiv. Er prüft Hub → Laborstation → RESULT → Hub, noch ohne fachliche Photometriesimulation.";
    } else {
      els.actionHint.textContent = "Weitere Stationen werden schrittweise an dieselbe CORE-/RESULT-Schnittstelle angebunden.";
    }
  }

  function isLocalExecutableOperation(sample, op) {
    if (!op || op.external_app) return false;
    if (!(sample.allowed_operations || []).includes(op.id)) return false;
    return db.samples.some(function (s) {
      return s.parent_sample_id === sample.id && s.created_by === op.id;
    });
  }

  function executeLocalOperation(sample, op) {
    const children = db.samples.filter(function (s) {
      return s.parent_sample_id === sample.id && s.created_by === op.id;
    });
    if (!children.length) {
      alert("Für " + op.name_de + " sind keine Ausgabesamples definiert.");
      return;
    }

    children.forEach(function (child) {
      if (!state.unlockedSamples.includes(child.id)) state.unlockedSamples.push(child.id);
    });

    state.completedOperations.push({ sampleId: sample.id, operationId: op.id, ts: new Date().toISOString() });
    state.journal.push({
      ts: new Date().toISOString(),
      type: "operation",
      text: op.name_de + " durchgeführt: " + children.map(function (c) { return c.name_de; }).join(" und ") + (children.length === 1 ? " wurde als neue Probe erzeugt." : " wurden als neue Proben erzeugt.")
    });

    if (op.id === "FILTER") {
      const filtrate = children.find(function (c) { return c.id === "VCOE01_FILTRATE"; });
      selectedSampleId = filtrate ? filtrate.id : children[0].id;
    } else {
      selectedSampleId = children[0].id;
    }
    saveState();
    render();
  }

  function startDummyAnalysis(sample, analysisType) {
    if (!window.AnalytikBridge) {
      alert("Bridge ist nicht geladen.");
      return;
    }

    const returnUrl = new URL(window.location.href);
    returnUrl.search = "";
    returnUrl.hash = "";

    const run = window.AnalytikBridge.startRun({
      appId: "DUMMY_LAB",
      sampleId: sample.id,
      caseId: db.case.id,
      analysisType: analysisType,
      returnUrl: returnUrl.toString()
    });

    const target = new URL("dummy-lab.html", window.location.href);
    target.searchParams.set("bridge", "1");
    target.searchParams.set("run", run.run_id);
    window.location.href = target.toString();
  }

  function operationAlreadyDone(sampleId, operationId) {
    return state.completedOperations.some(function (x) {
      return x.sampleId === sampleId && x.operationId === operationId;
    });
  }

  function renderJournal() {
    if (!state.journal.length) {
      els.journal.innerHTML = '<div class="empty">Noch keine Einträge.</div>';
      return;
    }
    els.journal.innerHTML = state.journal.map(function (entry) {
      const d = new Date(entry.ts);
      const stamp = Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      const label = entry.type === "result" ? '<span class="journal-tag">RESULT</span>' : "";
      return '<div class="journal-entry">' + label + escapeHtml(entry.text) + '<time>' + escapeHtml(stamp) + '</time></div>';
    }).join("");
  }

  function renderValidator() {
    const parts = [
      '<span class="status ' + (validation.issues.length ? "warn" : "ok") + '">' + (validation.issues.length ? validation.issues.length + " Fehler" : "Referenzen konsistent") + '</span>',
      '<span class="status ok">' + db.substances.length + ' Substances</span>',
      '<span class="status ok">' + db.samples.length + ' Samples</span>',
      '<span class="status ok">' + db.operations.length + ' Operations</span>',
      '<span class="status ok">' + state.results.length + ' Results</span>'
    ];
    if (validation.warnings.length) parts.push('<span class="status warn">' + validation.warnings.length + ' Hinweis(e)</span>');
    els.validatorSummary.innerHTML = parts.join("");

    const detail = [];
    detail.push("Hub: " + HUB_VERSION);
    detail.push("Schema: " + db.schemaVersion);
    detail.push("Bridge: " + (window.AnalytikBridge ? window.AnalytikBridge.version : "nicht geladen"));
    detail.push("Case: " + db.case.id);
    detail.push("");
    if (validation.issues.length) {
      detail.push("FEHLER:");
      validation.issues.forEach(function (x) { detail.push("- " + x); });
    } else {
      detail.push("Keine fehlerhaften Referenzen gefunden.");
    }
    if (validation.warnings.length) {
      detail.push("");
      detail.push("HINWEISE:");
      validation.warnings.forEach(function (x) { detail.push("- " + x); });
    }
    els.validatorDetails.textContent = detail.join("\n");
  }

  function prettyAnalysis(id) {
    const map = {
      ION_FISHING: "Ionenfischen",
      SPECTRAL_LAB: "SpektralLab",
      GC_LAB: "GC-Lab",
      TITRATION: "Titrationslabor",
      UVVIS: "UV/VIS-Photometrie"
    };
    return map[id] || id || "Analyse";
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
    document.body.innerHTML = '<main class="wrap" style="padding:40px 0"><section class="card"><h1>Hub konnte nicht gestartet werden</h1><p>' + escapeHtml(error.message) + '</p><p class="muted">Bitte über einen Webserver bzw. GitHub Pages öffnen; lokale file://-Aufrufe dürfen JSON-Dateien je nach Browser blockieren.</p></section></main>';
  }
})();
