(() => {
  "use strict";

  const STORAGE_KEY = "chemie_analytik_hub_v0_2";
  const LEGACY_STORAGE_KEY = "chemie_analytik_hub_v0_1";
  const ACTIVE_CASE = "VCOE01";
  const HUB_VERSION = "0.11.0";

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
      "validatorDetails", "resetBtn", "toggleDiag", "resultGuidance"
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
      Object.values(sample.operation_requirements || {}).forEach(function (req) {
        if (req.result_sample_id && !sampleIds.has(req.result_sample_id)) {
          issues.push(sample.id + ": operation requirement verweist auf unbekanntes Sample " + req.result_sample_id);
        }
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
      runtimeSamples: {},
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
    if (!state.runtimeSamples || typeof state.runtimeSamples !== "object") state.runtimeSamples = {};
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
      if (Array.isArray(result.produced_samples) && result.produced_samples.length) {
        applyProducedSamples(result);
      }
      if (result.analysis_type === "STRUCTURE_ELUCIDATION") {
        applyStructureHypothesis(result);
      }
      if (result.analysis_type === "GC_CONFIRMATION") {
        applyGcConfirmation(result);
      }
      const journalText = result.analysis_type === "QUALITATIVE_ION_ANALYSIS" && result.evaluation && result.evaluation.identified
        ? "Qualitative Ionenanalyse: " + formatIon(result.evaluation.identified.cation) + " und " + formatIon(result.evaluation.identified.anion) + " bestätigt."
        : result.analysis_type === "FRACTIONAL_DISTILLATION"
          ? "Destillation übernommen: F1, F2, F3 und Rückstand wurden als Proben erzeugt · Trennqualität " +
            String(result.evaluation && result.evaluation.quality_score || "–") + "/5."
          : result.analysis_type === "STRUCTURE_ELUCIDATION" && result.evaluation && result.evaluation.hypothesis
            ? (result.peak_id
              ? "Strukturhypothese " + String(result.peak_id) + ": " +
                String(result.evaluation.hypothesis.name_de || result.evaluation.hypothesis.substance_id || "–") +
                " · mit M/MS/IR/¹H-NMR vereinbar; GC-Bestätigung noch ausständig."
              : "Strukturhypothese Feststoff: " +
                String(result.evaluation.hypothesis.name_de || result.evaluation.hypothesis.substance_id || "–") +
                " · mit Voranalyse, M/MS/IR/¹H-NMR vereinbar; Schmelzpunktbestätigung noch ausständig.")
            : result.analysis_type === "GC_CONFIRMATION" && result.evaluation
              ? "Identität " + String(result.peak_id || "Peak") + " bestätigt: " +
                String(result.evaluation.confirmed_name_de || result.evaluation.confirmed_substance_id || "–") +
                " · Referenzstandard und Aufstockung stimmen überein."
              : result.analysis_type === "ORGANIC_SOLID_SCREENING" && result.evaluation
                ? "Organische Feststoff-Voranalyse abgeschlossen: " + formatOrganicFeatureSummary(result.evaluation.supported_features) +
                  ". Keine Stoffidentität wurde vergeben."
                : prettyAnalysis(result.analysis_type) + ": digitales RESULT " + result.result_id + " von " + result.app_id + " übernommen.";
      state.journal.push({
        ts: new Date().toISOString(),
        type: "result",
        text: journalText
      });
      selectedSampleId = result.analysis_type === "FRACTIONAL_DISTILLATION" && result.produced_samples && result.produced_samples[0]
        ? result.produced_samples[0].sample_id
        : (result.sample_id || selectedSampleId);
      saveState();
    }

    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete("resume");
    window.history.replaceState({}, "", cleanUrl.toString());
  }

  function applyStructureHypothesis(result) {
    if (!result || !result.source_result_id || !result.peak_id) return;
    const source = state.results.find(function (r) { return r.result_id === result.source_result_id; });
    if (!source || source.analysis_type !== "GC") return;

    if (!source.student_interpretation || typeof source.student_interpretation !== "object") {
      source.student_interpretation = {};
    }
    const existing = source.student_interpretation[result.peak_id] || {};
    const hypothesis = result.evaluation && result.evaluation.hypothesis || {};
    source.student_interpretation[result.peak_id] = Object.assign({}, existing, {
      identity_status: "supported",
      hypothesis_substance_id: hypothesis.substance_id || null,
      hypothesis_name_de: hypothesis.name_de || null,
      structure_result_id: result.result_id
    });
  }

  function structureResultForPeak(gcResultId, peakId) {
    return state.results.find(function (r) {
      return r.analysis_type === "STRUCTURE_ELUCIDATION" &&
        r.source_result_id === gcResultId &&
        r.peak_id === peakId &&
        r.evaluation && r.evaluation.identity_status === "supported";
    }) || null;
  }

  function structureResultForSourceResult(sourceResultId) {
    return state.results.find(function (r) {
      return r.analysis_type === "STRUCTURE_ELUCIDATION" &&
        r.source_result_id === sourceResultId &&
        !r.peak_id &&
        r.evaluation && r.evaluation.identity_status === "supported";
    }) || null;
  }


  function applyGcConfirmation(result) {
    if (!result || !result.source_result_id || !result.peak_id) return;
    const source = state.results.find(function (r) { return r.result_id === result.source_result_id; });
    if (!source || source.analysis_type !== "GC") return;

    if (!source.student_interpretation || typeof source.student_interpretation !== "object") {
      source.student_interpretation = {};
    }
    const existing = source.student_interpretation[result.peak_id] || {};
    source.student_interpretation[result.peak_id] = Object.assign({}, existing, {
      identity_status: "confirmed",
      confirmed_substance_id: result.evaluation && result.evaluation.confirmed_substance_id || existing.hypothesis_substance_id || null,
      confirmed_name_de: result.evaluation && result.evaluation.confirmed_name_de || existing.hypothesis_name_de || null,
      confirmation_result_id: result.result_id
    });
  }

  function gcConfirmationResultForPeak(gcResultId, peakId) {
    return state.results.find(function (r) {
      return r.analysis_type === "GC_CONFIRMATION" &&
        r.source_result_id === gcResultId &&
        r.peak_id === peakId &&
        r.evaluation && r.evaluation.identity_status === "confirmed";
    }) || null;
  }

  const STRUCTURE_PURITY_THRESHOLD_PERCENT = 95;

  function gcPurityProfile(gcResult) {
    const peaks = gcResult && gcResult.measurement && Array.isArray(gcResult.measurement.peaks)
      ? gcResult.measurement.peaks : [];
    if (!peaks.length) return { pureEnough: false, dominantPeakId: null, dominantArea: 0, peakCount: 0 };
    const sorted = peaks.slice().sort(function (a, b) {
      return Number(b.area_percent || 0) - Number(a.area_percent || 0);
    });
    const dominant = sorted[0];
    const dominantArea = Number(dominant.area_percent || 0);
    return {
      pureEnough: peaks.length === 1 || dominantArea >= STRUCTURE_PURITY_THRESHOLD_PERCENT,
      dominantPeakId: dominant.peak_id,
      dominantArea: dominantArea,
      peakCount: peaks.length
    };
  }

  function structureAllowedForPeak(gcResult, peak) {
    const p = gcPurityProfile(gcResult);
    return p.pureEnough && p.dominantPeakId === peak.peak_id;
  }

  function confirmedIdentityForSubstance(substanceId, excludeSourceResultId) {
    if (!substanceId) return null;
    const matches = state.results.filter(function (r) {
      return r.analysis_type === "GC_CONFIRMATION" &&
        r.evaluation && r.evaluation.identity_status === "confirmed" &&
        r.evaluation.confirmed_substance_id === substanceId &&
        (!excludeSourceResultId || r.source_result_id !== excludeSourceResultId);
    });
    return matches.length ? matches[matches.length - 1] : null;
  }

  function knownConfirmedStandardForPeak(gcResult, peak) {
    const peakMap = gcResult && gcResult.internal_payload && gcResult.internal_payload.peak_map;
    const substanceId = peakMap && peakMap[peak.peak_id];
    if (!substanceId) return null;
    const confirmation = confirmedIdentityForSubstance(substanceId, gcResult.result_id);
    if (!confirmation) return null;
    return {
      substance_id: substanceId,
      name_de: confirmation.evaluation.confirmed_name_de || substanceId,
      source_confirmation_result_id: confirmation.result_id
    };
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
    const runtime = state.runtimeSamples[sample.id] || null;
    const stateLabel = sample.physical_state || "–";
    const meta = [
      ["Sample-ID", sample.id],
      ["Zustand", stateLabel],
      ["Homogen", sample.homogeneous === true ? "ja" : (sample.homogeneous === false ? "nein" : "–")],
      ["Resultate", sampleResults.length]
    ];
    if (runtime && Number.isFinite(Number(runtime.volume_ml))) {
      meta.push(["Volumen", Number(runtime.volume_ml).toFixed(1).replace(".", ",") + " mL"]);
    }
    if (runtime && runtime.quality && runtime.quality.label_de) {
      meta.push(["Fraktionsqualität", runtime.quality.label_de]);
    }
    els.sampleMeta.innerHTML = meta.map(function (pair) {
      return '<div class="meta-item"><b>' + escapeHtml(pair[0]) + '</b>' + escapeHtml(String(pair[1])) + '</div>';
    }).join("");

    els.actions.innerHTML = "";
    els.actionHint.textContent = "";
    renderResultGuidance(sample);

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
      const externalExecutable = isExternalExecutableOperation(sample, op);
      const executable = localExecutable || externalExecutable;
      const done = operationAlreadyDone(sample.id, opId);
      const requirementOk = operationRequirementSatisfied(sample, opId);
      btn.textContent = externalExecutable && opId === "DISTILL"
        ? "Destillationslabor öffnen"
        : (op ? op.name_de : opId) + (!executable ? " · vorbereitet" : (!requirementOk ? " · nach Ionenanalyse" : ""));
      btn.disabled = !executable || done || !requirementOk;
      if (localExecutable && !done && requirementOk) {
        btn.addEventListener("click", function () { executeLocalOperation(sample, op); });
      } else if (externalExecutable && !done && requirementOk) {
        btn.addEventListener("click", function () { executeExternalOperation(sample, op); });
      }
      els.actions.appendChild(btn);
    });

    analyses.forEach(function (analysis) {
      const btn = document.createElement("button");
      btn.type = "button";
      const spectralCalibration = sample.id === "VCOE01_PHOT_AMMINE" && analysis === "SPECTRAL_LAB";
      const ionEnabled = sample.id === "VCOE01_ION_ALIQUOT" && analysis === "ION_FISHING";
      const gcEnabled = ["VCOE01_F1","VCOE01_F2","VCOE01_F3"].includes(sample.id) &&
        analysis === "GC_LAB" && !!state.runtimeSamples[sample.id];
      const organicSolidEnabled = sample.id === "VCOE01_RESIDUE_SOLID" && analysis === "ORG_SOLID_SCREENING";
      const enabled = spectralCalibration || ionEnabled || gcEnabled || organicSolidEnabled;
      btn.className = "action-btn " + (enabled ? "" : "secondary");
      btn.disabled = !enabled;
      btn.textContent = spectralCalibration
        ? "Quantitative Photometrie öffnen"
        : ionEnabled
          ? "Ionenfischen öffnen"
          : gcEnabled
            ? "GC-Lab öffnen"
            : organicSolidEnabled
              ? "Organische Feststoffanalyse öffnen"
              : prettyAnalysis(analysis) + " · vorbereitet";
      if (spectralCalibration) {
        btn.addEventListener("click", function () { startSpectralLab(sample); });
      } else if (ionEnabled) {
        btn.addEventListener("click", function () { startIonFishing(sample); });
      } else if (gcEnabled) {
        btn.addEventListener("click", function () { startGcLab(sample); });
      } else if (organicSolidEnabled) {
        btn.addEventListener("click", function () { startOrganicSolidLab(sample); });
      }
      els.actions.appendChild(btn);
    });

    if (sample.id === "VCOE01_RAW") {
      els.actionHint.textContent = "Filtration ist funktional. Zentrifugation bleibt als alternative Probenvorbereitung reserviert, bis dafür eigene Ausgabesamples definiert sind.";
    } else if (sample.id === "VCOE01_SOLID") {
      els.actionHint.textContent = "Der Filterrückstand kann nun in Wasser gelöst werden; dadurch entsteht eine neue wässrige Analyseprobe.";
    } else if (sample.id === "VCOE01_SOLID_AQ") {
      els.actionHint.textContent = "Der Filterrückstand wurde quantitativ in Wasser gelöst und im Entwicklungsmodell auf 100,0 mL aufgefüllt. Die Stocklösung kann qualitativ untersucht oder in getrennte Teilproben für Ionenanalyse und quantitative Photometrie aufgeteilt werden.";
    } else if (sample.id === "VCOE01_ION_ALIQUOT") {
      els.actionHint.textContent = "Diese Teilprobe dient zur qualitativen Identifikation der enthaltenen Ionen. Erst nach bestätigtem Cu²⁺-/SO₄²⁻-Nachweis wird die quantitative Photometrie freigeschaltet.";
    } else if (sample.id === "VCOE01_PHOT_ALIQUOT") {
      els.actionHint.textContent = operationRequirementSatisfied(sample, "COMPLEX_AMMONIA_EXCESS")
        ? "Die qualitative Ionenanalyse ist abgeschlossen. Jetzt können 10,00 mL der Teilprobe mit Ammoniak im Überschuss versetzt und im 25,00-mL-Messkolben bis zur Marke aufgefüllt werden."
        : "Die quantitative Photometrie bleibt gesperrt, bis die qualitative Ionenanalyse Cu²⁺ und SO₄²⁻ bestätigt hat.";
    } else if (sample.id === "VCOE01_PHOT_AMMINE") {
      els.actionHint.textContent = "Die tiefblaue Messlösung ist für die Eichkurvenmessung vorbereitet. SpektralLab liefert nur Rohdaten; die Konzentration wird von den SchülerInnen aus der Eichgeraden bestimmt.";
    } else if (sample.id === "VCOE01_FILTRATE") {
      els.actionHint.textContent = operationAlreadyDone(sample.id, "DISTILL")
        ? "Der akzeptierte Destillations-Run wurde übernommen. Die erzeugten Fraktionen tragen ihre tatsächlichen virtuellen Zusammensetzungen als Runtime-Daten weiter."
        : "Destilliere das unbekannte organische Filtrat. Bei 0–2 Sternen erhältst du Optimierungshinweise und kannst einen neuen Run starten; ab 3 Sternen dürfen die Fraktionen an den Hub übergeben werden.";
    } else if (["VCOE01_F1","VCOE01_F2","VCOE01_F3"].includes(sample.id)) {
      els.actionHint.textContent = "Diese Fraktion wurde im akzeptierten Destillations-Run erzeugt. Ihre tatsächliche Zusammensetzung bleibt verborgen. Im GC gilt: Ein einzelner sauberer Peak kann übernommen werden; bei mehreren Peaks müssen benachbarte Peaks mindestens Rₛ ≥ 1,5 erreichen.";
    } else if (sample.id === "VCOE01_RESIDUE") {
      els.actionHint.textContent = "Der Destillationsrückstand kann noch flüchtige Reste enthalten. Kühle ihn ab und entferne verbliebene flüchtige Komponenten, bevor der organische Feststoff untersucht wird.";
    } else if (sample.id === "VCOE01_RESIDUE_SOLID") {
      els.actionHint.textContent = "Der isolierte weiße Feststoff wird zunächst klassisch voruntersucht. Ziel sind allgemeine Strukturmerkmale – keine Stoffidentifikation. Ein Schmelzpunkt bleibt bewusst für die spätere Bestätigung reserviert.";
    } else {
      els.actionHint.textContent = "Weitere Stationen werden schrittweise an dieselbe CORE-/RESULT-Schnittstelle angebunden.";
    }
  }

  function operationRequirementSatisfied(sample, operationId) {
    const req = sample.operation_requirements && sample.operation_requirements[operationId];
    if (!req) return true;
    return state.results.some(function (result) {
      if (req.result_sample_id && result.sample_id !== req.result_sample_id) return false;
      if (req.analysis_type && result.analysis_type !== req.analysis_type) return false;
      if (req.identity_status && (!result.evaluation || result.evaluation.identity_status !== req.identity_status)) return false;
      if (req.identified) {
        const identified = result.evaluation && result.evaluation.identified;
        if (!identified) return false;
        if (req.identified.cation && identified.cation !== req.identified.cation) return false;
        if (req.identified.anion && identified.anion !== req.identified.anion) return false;
      }
      return true;
    });
  }

  function formatIon(value) {
    const map = {"Cu2+":"Cu²⁺","SO4 2-":"SO₄²⁻"};
    return map[value] || value || "–";
  }

  function organicFeatureLabel(id) {
    const map = {
      carboxylic_acid: "Carbonsäurefunktion",
      phenolic_oh: "phenolische OH-Gruppe",
      aromatic_or_unsaturated: "ungesättigtes/aromatisches System",
      acidic_aqueous_phase: "saure wässrige Phase",
      polar_character: "polarer Charakter"
    };
    return map[id] || id;
  }

  function organicStrengthLabel(value) {
    const map = {
      strong: "stark gestützt",
      supported: "gestützt",
      indication: "Hinweis",
      observed: "beobachtet"
    };
    return map[value] || value || "Befund";
  }

  function formatOrganicFeatureSummary(features) {
    if (!features || typeof features !== "object") return "allgemeine Strukturmerkmale dokumentiert";
    const parts = Object.entries(features)
      .filter(function (entry) { return !!entry[1]; })
      .map(function (entry) {
        const strength = typeof entry[1] === "string" ? entry[1] : entry[1].strength;
        return organicFeatureLabel(entry[0]) + " (" + organicStrengthLabel(strength) + ")";
      });
    return parts.length ? parts.join(", ") : "allgemeine Strukturmerkmale dokumentiert";
  }


  function applyProducedSamples(result) {
    (result.produced_samples || []).forEach(function (produced) {
      if (!produced || !produced.sample_id) return;
      state.runtimeSamples[produced.sample_id] = produced;
      if (!state.unlockedSamples.includes(produced.sample_id)) state.unlockedSamples.push(produced.sample_id);
    });
    if (!operationAlreadyDone(result.sample_id, "DISTILL")) {
      state.completedOperations.push({
        sampleId: result.sample_id,
        operationId: "DISTILL",
        ts: new Date().toISOString(),
        resultId: result.result_id
      });
    }
  }

  function isExternalExecutableOperation(sample, op) {
    return !!(op && op.external_app && (sample.allowed_operations || []).includes(op.id));
  }

  function executeExternalOperation(sample, op) {
    if (op && op.id === "DISTILL") {
      startDestillation(sample);
      return;
    }
    alert("Diese externe Operation ist noch nicht angebunden.");
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

  function startDestillation(sample) {
    if (!window.AnalytikBridge) {
      alert("Bridge ist nicht geladen.");
      return;
    }

    const returnUrl = new URL(window.location.href);
    returnUrl.search = "";
    returnUrl.hash = "";

    const run = window.AnalytikBridge.startRun({
      appId: "DESTILLATION_LAB",
      sampleId: sample.id,
      caseId: db.case.id,
      analysisType: "FRACTIONAL_DISTILLATION",
      input: {
        mode: "fractional",
        model_ref: "ethylacetate_butanol1",
        display_label: "Unbekanntes organisches Filtrat",
        hide_identity: true,
        development_model: true,
        initial_volume_ml: 100,
        initial_component_a_percent: 75,
        component_ids: {
          a: "ETHYL_ACETATE",
          b: "BUTAN_1_OL"
        },
        nonvolatile_component: {
          substance_id: "SALICYLIC_ACID",
          role: "residue_analyte"
        },
        minimum_quality_score: 3,
        produced_sample_ids: {
          fraction_1: "VCOE01_F1",
          fraction_2: "VCOE01_F2",
          fraction_3: "VCOE01_F3",
          residue: "VCOE01_RESIDUE"
        },
        note: "Optimiere die fraktionierende Destillation. Die Stoffidentitäten und internen Zusammensetzungen bleiben verborgen. Ab 3 von 5 Sternen kann ein Run an den Hub übernommen werden."
      },
      returnUrl: returnUrl.toString()
    });

    const target = new URL("../DESTILLATIONSLABOR/", window.location.href);
    target.searchParams.set("bridge", "1");
    target.searchParams.set("run", run.run_id);
    window.location.href = target.toString();
  }

  function startGcLab(sample) {
    if (!window.AnalytikBridge) {
      alert("Bridge ist nicht geladen.");
      return;
    }

    const runtime = state.runtimeSamples[sample.id];
    if (!runtime || !Array.isArray(runtime.composition_internal)) {
      alert("Für diese Fraktion fehlen Runtime-Daten aus der Destillation.");
      return;
    }

    const returnUrl = new URL(window.location.href);
    returnUrl.search = "";
    returnUrl.hash = "";

    const run = window.AnalytikBridge.startRun({
      appId: "GC_LAB",
      sampleId: sample.id,
      caseId: db.case.id,
      analysisType: "GC",
      input: {
        mode: "unknown_mixture",
        display_label: sample.name_de,
        hide_identity: true,
        minimum_resolution: 1.5,
        single_peak_allowed: true,
        runtime_sample: {
          sample_id: sample.id,
          volume_ml: runtime.volume_ml,
          composition_internal: runtime.composition_internal,
          quality: runtime.quality || null
        },
        note: "Untersuche die unbekannte Destillationsfraktion. Optimiere Säule, Länge, Temperatur und Trägergasstrom. Stoffidentitäten bleiben verborgen. Ein einzelner sauberer Peak ist ein gültiges Ergebnis; bei mehreren Peaks ist für die Rückgabe Rₛ ≥ 1,5 erforderlich."
      },
      returnUrl: returnUrl.toString()
    });

    const target = new URL("../GC_LAB/", window.location.href);
    target.searchParams.set("bridge", "1");
    target.searchParams.set("run", run.run_id);
    window.location.href = target.toString();
  }

  function startOrganicSolidLab(sample) {
    if (!window.AnalytikBridge) {
      alert("Bridge ist nicht geladen.");
      return;
    }

    const returnUrl = new URL(window.location.href);
    returnUrl.search = "";
    returnUrl.hash = "";

    const run = window.AnalytikBridge.startRun({
      appId: "ORG_FESTSTOFF_LAB",
      sampleId: sample.id,
      caseId: db.case.id,
      analysisType: "ORGANIC_SOLID_SCREENING",
      input: {
        mode: "qualitative_screening",
        model_ref: "vcoe01_residue_solid_v1",
        display_label: "Unbekannter weißer organischer Feststoff",
        hide_identity: true,
        allowed_methods: [
          "SOLUBILITY",
          "PH_AQUEOUS",
          "BICARBONATE",
          "FE3",
          "FLAME"
        ],
        required_evidence: [
          "SOLUBILITY",
          "BICARBONATE",
          "FE3",
          "FLAME"
        ],
        output_policy: {
          identify_substance: false,
          return_supported_features_only: true
        },
        note: "Untersuche den unbekannten weißen Feststoff mit geeigneten klassischen Vorproben. Gib nur allgemeine Strukturmerkmale zurück. Die Stoffidentität und der Schmelzpunkt bleiben für spätere Analyseschritte offen."
      },
      returnUrl: returnUrl.toString()
    });

    const target = new URL("../ORG_FESTSTOFF_LAB/", window.location.href);
    target.searchParams.set("bridge", "1");
    target.searchParams.set("run", run.run_id);
    window.location.href = target.toString();
  }

  function startStructureLab(sample, gcResult, peak) {
    if (!window.AnalytikBridge) {
      alert("Bridge ist nicht geladen.");
      return;
    }

    const peakMap = gcResult && gcResult.internal_payload && gcResult.internal_payload.peak_map;
    const targetSubstanceId = peakMap && peakMap[peak.peak_id];
    if (!targetSubstanceId) {
      alert("Für diesen Peak fehlt die interne Zuordnung für die Strukturaufklärung.");
      return;
    }

    const returnUrl = new URL(window.location.href);
    returnUrl.search = "";
    returnUrl.hash = "";

    const run = window.AnalytikBridge.startRun({
      appId: "STRUKTUR_LAB",
      sampleId: sample.id,
      caseId: db.case.id,
      analysisType: "STRUCTURE_ELUCIDATION",
      sourceResultId: gcResult.result_id,
      peakId: peak.peak_id,
      input: {
        mode: "gc_peak",
        structure_mode: "basic",
        target_substance_id: targetSubstanceId,
        display_label: sample.name_de + " · " + peak.peak_id,
        source_peak: {
          peak_id: peak.peak_id,
          retention_time_min: peak.retention_time_min,
          area_percent: peak.area_percent,
          width_min: peak.width_min
        },
        assignment_text: "Untersuche " + peak.peak_id + " aus dem GC-Lauf dieser Fraktion. Nutze M, MS, IR und ¹H-NMR, formuliere eine begründete Strukturhypothese und ordne anschließend einen Stoffnamen zu."
      },
      returnUrl: returnUrl.toString()
    });

    const target = new URL("../STRUKTUR_LAB/", window.location.href);
    target.searchParams.set("bridge", "1");
    target.searchParams.set("run", run.run_id);
    window.location.href = target.toString();
  }

  function startSolidStructureLab(sample, screeningResult) {
    if (!window.AnalytikBridge) {
      alert("Bridge ist nicht geladen.");
      return;
    }
    if (!screeningResult || !screeningResult.evaluation) {
      alert("Die qualitative Voranalyse fehlt.");
      return;
    }

    const returnUrl = new URL(window.location.href);
    returnUrl.search = "";
    returnUrl.hash = "";

    const run = window.AnalytikBridge.startRun({
      appId: "STRUKTUR_LAB",
      sampleId: sample.id,
      caseId: db.case.id,
      analysisType: "STRUCTURE_ELUCIDATION",
      sourceResultId: screeningResult.result_id,
      input: {
        mode: "solid_screening",
        structure_mode: "basic",
        target_substance_id: "SALICYLIC_ACID",
        display_label: sample.name_de,
        prior_findings: screeningResult.evaluation.supported_features || {},
        assignment_text: "Die klassische Voranalyse hat bereits allgemeine Strukturmerkmale ergeben. Nutze diese Vorbefunde zusammen mit M, MS, IR und besonders ¹H-NMR, um eine konkrete Strukturhypothese für den unbekannten Feststoff zu entwickeln."
      },
      returnUrl: returnUrl.toString()
    });

    const target = new URL("../STRUKTUR_LAB/", window.location.href);
    target.searchParams.set("bridge", "1");
    target.searchParams.set("run", run.run_id);
    window.location.href = target.toString();
  }

  function startGcConfirmation(sample, gcResult, peak, structureResult, knownStandard) {
    if (!window.AnalytikBridge) {
      alert("Bridge ist nicht geladen.");
      return;
    }
    const runtime = state.runtimeSamples[sample.id];
    if (!runtime || !Array.isArray(runtime.composition_internal)) {
      alert("Für diese Fraktion fehlen Runtime-Daten aus der Destillation.");
      return;
    }
    const structureHypothesis = structureResult && structureResult.evaluation && structureResult.evaluation.hypothesis;
    const hypothesis = structureHypothesis || (knownStandard ? {
      substance_id: knownStandard.substance_id,
      name_de: knownStandard.name_de
    } : null);
    if (!hypothesis || !hypothesis.substance_id) {
      alert("Für diesen Peak fehlt eine unabhängig begründete Stoffidentität.");
      return;
    }

    const returnUrl = new URL(window.location.href);
    returnUrl.search = "";
    returnUrl.hash = "";

    const m = gcResult.measurement || {};
    const run = window.AnalytikBridge.startRun({
      appId: "GC_LAB",
      sampleId: sample.id,
      caseId: db.case.id,
      analysisType: "GC_CONFIRMATION",
      sourceResultId: gcResult.result_id,
      peakId: peak.peak_id,
      input: {
        mode: "targeted_confirmation",
        source_result_id: gcResult.result_id,
        structure_result_id: structureResult ? structureResult.result_id : null,
        known_identity_source_result_id: knownStandard ? knownStandard.source_confirmation_result_id : null,
        hypothesis_substance_id: hypothesis.substance_id,
        hypothesis_name_de: hypothesis.name_de || hypothesis.substance_id,
        display_label: sample.name_de + " · " + peak.peak_id,
        source_peak: {
          peak_id: peak.peak_id,
          retention_time_min: peak.retention_time_min,
          area_percent: peak.area_percent,
          width_min: peak.width_min
        },
        source_gc_method: {
          column_id: m.column,
          length_m: m.column_length_m,
          temperature_c: m.temperature_c,
          flow_ml_min: m.flow_ml_min
        },
        runtime_sample: {
          sample_id: sample.id,
          volume_ml: runtime.volume_ml,
          composition_internal: runtime.composition_internal,
          quality: runtime.quality || null
        },
        verification_standard_ratio: 0.60,
        note: structureResult
          ? "Prüfe die bereits spektroskopisch gestützte Hypothese gezielt mit Referenzstandard und anschließender Aufstockung unter unveränderten GC-Bedingungen."
          : "Prüfe die in einer anderen, ausreichend reinen Fraktion bereits bestätigte Identität jetzt gezielt in dieser Mischfraktion mit Referenzstandard und Aufstockung."
      },
      returnUrl: returnUrl.toString()
    });

    const target = new URL("../GC_LAB/", window.location.href);
    target.searchParams.set("bridge", "1");
    target.searchParams.set("run", run.run_id);
    window.location.href = target.toString();
  }

  function startIonFishing(sample) {
    if (!window.AnalytikBridge) {
      alert("Bridge ist nicht geladen.");
      return;
    }

    const returnUrl = new URL(window.location.href);
    returnUrl.search = "";
    returnUrl.hash = "";

    const run = window.AnalytikBridge.startRun({
      appId: "ION_FISHING",
      sampleId: sample.id,
      caseId: db.case.id,
      analysisType: "QUALITATIVE_ION_ANALYSIS",
      input: {
        model_ref: "probe_05",
        display_label: "Unbekannte Ionen-Teilprobe",
        required_evidence: ["NH3_ue", "BaCl2"],
        note: "Bestimme Kation und Anion durch geeignete Nachweise. Die Stoffidentität wird vom Hub nicht vorgegeben."
      },
      returnUrl: returnUrl.toString()
    });

    const target = new URL("../IONENFISCHEN/", window.location.href);
    target.searchParams.set("bridge", "1");
    target.searchParams.set("run", run.run_id);
    window.location.href = target.toString();
  }

  function startSpectralLab(sample) {
    if (!window.AnalytikBridge) {
      alert("Bridge ist nicht geladen.");
      return;
    }

    const returnUrl = new URL(window.location.href);
    returnUrl.search = "";
    returnUrl.hash = "";

    let analysisType;
    let input;

    if (sample.id === "VCOE01_PHOT_AMMINE") {
      analysisType = "UVVIS_CALIBRATION";
      input = {
        mode: "calibration",
        model_ref: "tetraammine_copper",
        display_label: "Aufbereitete Messlösung",
        quantitative: true,
        wavelength_nm: 620,
        path_length_cm: 1.0,
        standards_mol_l: [0.003, 0.006, 0.009, 0.012, 0.015],
        unknown_concentration_mol_l: 0.0100,
        lab_mode: "normal",
        note: "Bestimme die Konzentration der unbekannten Messlösung aus einer selbst ausgewerteten Eichgeraden. SpektralLab gibt keine berechnete Konzentration zurück.",
        evaluation_hints: [
          "Trage die Konzentrationen der Standards gegen ihre Absorbanzen auf und bestimme eine lineare Ausgleichsgerade A = m·c + b.",
          "Bestimme aus der Absorbanz der unbekannten Messlösung ihre Konzentration mit c = (A - b) / m. Bei Mehrfachmessungen verwende einen geeigneten Mittelwert.",
          "Die Messlösung wurde aus 10,00 mL Teilprobe hergestellt und auf 25,00 mL aufgefüllt. Rechne mit diesem Verdünnungsfaktor auf die wässrige Stocklösung zurück.",
          "Der Filterrückstand wurde im Entwicklungsmodell auf 100,0 mL gelöst. Bestimme daraus die Stoffmenge an Cu²⁺.",
          "Wenn Cu²⁺ und SO₄²⁻ qualitativ bestätigt sind, kannst du aus der Stoffmenge und der molaren Masse die Masse des ursprünglichen Kupfer(II)-sulfat-Pentahydrats bestimmen."
        ]
      };
    } else {
      analysisType = "UVVIS_SPECTRUM";
      input = {
        mode: "spectrum",
        model_ref: "copper_aqua",
        display_label: "Unbekannte wässrige Teilprobe",
        hide_identity: true,
        quantitative: false,
        path_length_cm: 1.0,
        range_nm: [380, 800],
        measurement_wavelength_nm: 750,
        note: "Qualitativer Integrationslauf: Die reale Fallkonzentration ist noch nicht als endgültige Rezeptur festgelegt. Es wird keine quantitative Konzentration zurückgegeben."
      };
    }

    const run = window.AnalytikBridge.startRun({
      appId: "SPECTRAL_LAB",
      sampleId: sample.id,
      caseId: db.case.id,
      analysisType: analysisType,
      input: input,
      returnUrl: returnUrl.toString()
    });

    const target = new URL("../VIRTUELLES_PHOTOMETER/", window.location.href);
    target.searchParams.set("bridge", "1");
    target.searchParams.set("run", run.run_id);
    window.location.href = target.toString();
  }

  function renderResultGuidance(sample) {
    if (!els.resultGuidance) return;

    const gcResults = state.results.filter(function (r) {
      return r.sample_id === sample.id && r.analysis_type === "GC" && r.status === "completed";
    });

    const organicSolidResult = state.results
      .filter(function (r) {
        return r.sample_id === sample.id &&
          r.analysis_type === "ORGANIC_SOLID_SCREENING" &&
          r.status === "completed";
      })
      .slice(-1)[0] || null;

    const otherResults = state.results
      .filter(function (r) { return r.sample_id === sample.id; })
      .filter(function (r) {
        const evaluation = r.evaluation || {};
        return (Array.isArray(evaluation.hints) && evaluation.hints.length) || evaluation.real_experiment;
      });

    let gcHtml = "";
    if (gcResults.length) {
      gcHtml = gcResults.map(function (gcResult) {
        const peaks = gcResult.measurement && Array.isArray(gcResult.measurement.peaks) ? gcResult.measurement.peaks : [];
        const purity = gcPurityProfile(gcResult);

        const peakRows = peaks.map(function (peak) {
          const rawStructureResult = structureResultForPeak(gcResult.result_id, peak.peak_id);
          const structureAllowed = structureAllowedForPeak(gcResult, peak);
          const structureResult = structureAllowed ? rawStructureResult : null;
          const interpretation = gcResult.student_interpretation && gcResult.student_interpretation[peak.peak_id] || {};
          const rt = Number.isFinite(Number(peak.retention_time_min))
            ? Number(peak.retention_time_min).toFixed(2).replace(".", ",") + " min" : "–";
          const area = Number.isFinite(Number(peak.area_percent))
            ? Number(peak.area_percent).toFixed(1).replace(".", ",") + " %" : "–";
          const confirmationResult = gcConfirmationResultForPeak(gcResult.result_id, peak.peak_id);
          const knownStandard = knownConfirmedStandardForPeak(gcResult, peak);

          const status = confirmationResult && confirmationResult.evaluation
            ? '<span class="peak-status confirmed">Bestätigt: ' +
              escapeHtml(confirmationResult.evaluation.confirmed_name_de || confirmationResult.evaluation.confirmed_substance_id || "Identität") +
              '</span>'
            : structureResult && structureResult.evaluation && structureResult.evaluation.hypothesis
              ? '<span class="peak-status supported">Hypothese: ' +
                escapeHtml(structureResult.evaluation.hypothesis.name_de || structureResult.evaluation.hypothesis.substance_id || "gestützt") +
                '</span>'
              : knownStandard
                ? '<span class="peak-status known">Standard verfügbar: ' + escapeHtml(knownStandard.name_de) + '</span>'
                : interpretation.identity_status === "supported"
                  ? '<span class="peak-status supported">spektroskopisch gestützt</span>'
                  : '<span class="peak-status">Identität offen</span>';

          let button;
          if (confirmationResult) {
            button = '<span class="peak-next confirmed-text">Beweiskette abgeschlossen: Referenzstandard + Aufstockung bestätigt.</span>';
          } else if (structureResult) {
            button = '<button class="peak-confirm-btn" type="button" data-gc-result="' + escapeHtml(gcResult.result_id) +
              '" data-peak-id="' + escapeHtml(peak.peak_id) + '" data-structure-result="' + escapeHtml(structureResult.result_id) +
              '">Mit Standard & Aufstockung bestätigen</button>';
          } else if (structureAllowed) {
            button = '<button class="peak-structure-btn" type="button" data-gc-result="' + escapeHtml(gcResult.result_id) +
              '" data-peak-id="' + escapeHtml(peak.peak_id) + '">Im STRUKTUR-LAB untersuchen</button>';
          } else if (knownStandard) {
            button = '<button class="peak-known-confirm-btn" type="button" data-gc-result="' + escapeHtml(gcResult.result_id) +
              '" data-peak-id="' + escapeHtml(peak.peak_id) + '" data-substance-id="' + escapeHtml(knownStandard.substance_id) +
              '" data-substance-name="' + escapeHtml(knownStandard.name_de) +
              '" data-known-result="' + escapeHtml(knownStandard.source_confirmation_result_id) +
              '">Mit bestätigtem Standard prüfen</button>';
          } else {
            button = '<span class="peak-next mixture-locked">Keine Reinstoff-Spektroskopie: Standard wird erst nach unabhängiger Identifikation in einer ausreichend reinen Fraktion freigeschaltet.</span>';
          }

          return '<div class="gc-peak-row"><div><strong>' + escapeHtml(peak.peak_id) +
            '</strong><span>tR ' + escapeHtml(rt) + ' · Fläche ' + escapeHtml(area) + '</span></div>' +
            status + button + '</div>';
        }).join("");

        const intro = purity.pureEnough
          ? '<p>Diese Fraktion ist für die direkte Strukturaufklärung des dominanten Peaks ausreichend rein. Kleinere Nebenpeaks werden nicht separat in das Reinstoff-Spektroskopie-Lab geschickt.</p>'
          : '<div class="mixture-warning"><strong>Mischprobe erkannt – Reinstoff-Spektroskopie gesperrt</strong><p>Mehrere relevante GC-Komponenten sind vorhanden. Ein direktes MS-/IR-/¹H-NMR-Spektrum dieser Gesamtprobe wäre ein Mischspektrum und daher für unsere Reinstoff-Strukturaufklärung ungeeignet. Bereits unabhängig bestätigte Standards können hier jedoch chromatographisch geprüft und aufgestockt werden.</p></div>';

        return '<div class="guidance-box gc-guidance"><strong>GC-Peaks weiter untersuchen</strong>' +
          intro + '<div class="gc-peak-list">' + peakRows + '</div></div>';
      }).join("");
    }

    let organicHtml = "";
    if (organicSolidResult) {
      const features = organicSolidResult.evaluation && organicSolidResult.evaluation.supported_features || {};
      const featureRows = Object.entries(features)
        .filter(function (entry) { return !!entry[1]; })
        .map(function (entry) {
          const strength = typeof entry[1] === "string" ? entry[1] : entry[1].strength;
          return '<li><strong>' + escapeHtml(organicFeatureLabel(entry[0])) + '</strong> · ' +
            escapeHtml(organicStrengthLabel(strength)) + '</li>';
        }).join("");
      const solidStructureResult = structureResultForSourceResult(organicSolidResult.result_id);
      const structureStep = solidStructureResult && solidStructureResult.evaluation && solidStructureResult.evaluation.hypothesis
        ? '<div class="solid-structure-state"><span class="peak-status supported">Hypothese: ' +
          escapeHtml(solidStructureResult.evaluation.hypothesis.name_de || solidStructureResult.evaluation.hypothesis.substance_id || "gestützt") +
          '</span><span class="peak-next">Nächster späterer Beweisschritt: Schmelz-/Mischschmelzpunkt mit Referenzsubstanz.</span></div>'
        : '<button class="solid-structure-btn" type="button" data-screening-result="' + escapeHtml(organicSolidResult.result_id) +
          '">Im STRUKTUR-LAB untersuchen</button>';

      organicHtml = '<div class="guidance-box organic-screening"><strong>Voranalyse: allgemeine Strukturmerkmale</strong>' +
        '<p>Die klassischen Vorproben grenzen die unbekannte Verbindung ein, vergeben aber bewusst noch keinen Stoffnamen.</p>' +
        (featureRows ? '<ul>' + featureRows + '</ul>' : '<p>Noch keine auswertbaren Strukturmerkmale zurückgegeben.</p>') +
        '<p class="screening-next">Die Vorbefunde werden als Startwissen an die instrumentelle Strukturaufklärung übergeben. Der Schmelzpunkt bleibt für eine unabhängige Bestätigung reserviert.</p>' +
        structureStep + '</div>';
    }

    let otherHtml = "";
    if (otherResults.length) {
      const latest = otherResults[otherResults.length - 1];
      const evaluation = latest.evaluation || {};
      const hints = Array.isArray(evaluation.hints) ? evaluation.hints : [];
      const hintHtml = hints.length
        ? '<div class="guidance-box"><strong>Auswertungshinweise</strong><p>Die App hat nur Messdaten übernommen. Die fachliche Auswertung bleibt Teil deiner Arbeit.</p><ol>' +
          hints.map(function (hint) { return "<li>" + escapeHtml(hint) + "</li>"; }).join("") +
          "</ol></div>"
        : "";
      const realHtml = evaluation.real_experiment
        ? '<div class="guidance-box real-experiment"><strong>Optionaler Realversuch</strong><p>' + escapeHtml(evaluation.real_experiment) + "</p></div>"
        : "";
      otherHtml = hintHtml + realHtml;
    }

    const html = gcHtml + organicHtml + otherHtml;
    if (!html) {
      els.resultGuidance.innerHTML = "";
      els.resultGuidance.hidden = true;
      return;
    }

    els.resultGuidance.hidden = false;
    els.resultGuidance.innerHTML = html;

    els.resultGuidance.querySelectorAll(".solid-structure-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const screeningResult = state.results.find(function (r) { return r.result_id === btn.dataset.screeningResult; });
        if (screeningResult) startSolidStructureLab(sample, screeningResult);
      });
    });

    els.resultGuidance.querySelectorAll(".peak-structure-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const gcResult = state.results.find(function (r) { return r.result_id === btn.dataset.gcResult; });
        const peak = gcResult && gcResult.measurement && Array.isArray(gcResult.measurement.peaks)
          ? gcResult.measurement.peaks.find(function (p) { return p.peak_id === btn.dataset.peakId; })
          : null;
        if (gcResult && peak) startStructureLab(sample, gcResult, peak);
      });
    });

    els.resultGuidance.querySelectorAll(".peak-confirm-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const gcResult = state.results.find(function (r) { return r.result_id === btn.dataset.gcResult; });
        const structureResult = state.results.find(function (r) { return r.result_id === btn.dataset.structureResult; });
        const peak = gcResult && gcResult.measurement && Array.isArray(gcResult.measurement.peaks)
          ? gcResult.measurement.peaks.find(function (p) { return p.peak_id === btn.dataset.peakId; })
          : null;
        if (gcResult && peak && structureResult) startGcConfirmation(sample, gcResult, peak, structureResult, null);
      });
    });

    els.resultGuidance.querySelectorAll(".peak-known-confirm-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const gcResult = state.results.find(function (r) { return r.result_id === btn.dataset.gcResult; });
        const peak = gcResult && gcResult.measurement && Array.isArray(gcResult.measurement.peaks)
          ? gcResult.measurement.peaks.find(function (p) { return p.peak_id === btn.dataset.peakId; })
          : null;
        const knownStandard = {
          substance_id: btn.dataset.substanceId,
          name_de: btn.dataset.substanceName,
          source_confirmation_result_id: btn.dataset.knownResult
        };
        if (gcResult && peak) startGcConfirmation(sample, gcResult, peak, null, knownStandard);
      });
    });
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
      UVVIS: "UV/VIS-Photometrie",
      UVVIS_SPECTRUM: "UV/VIS-Spektrum",
      UVVIS_CALIBRATION: "Quantitative UV/VIS-Photometrie",
      QUALITATIVE_ION_ANALYSIS: "Qualitative Ionenanalyse",
      FRACTIONAL_DISTILLATION: "Fraktionierende Destillation",
      GC: "Gaschromatographie",
      STRUCTURE_ELUCIDATION: "Strukturaufklärung",
      GC_CONFIRMATION: "GC-Identitätsbestätigung",
      ORGANIC_SOLID_SCREENING: "Organische Feststoff-Voranalyse",
      ORG_SOLID_SCREENING: "Organische Feststoffanalyse",
      ORG_FESTSTOFF_LAB: "Organische Feststoffanalyse",
      STRUKTUR_LAB: "Struktur-Lab"
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
