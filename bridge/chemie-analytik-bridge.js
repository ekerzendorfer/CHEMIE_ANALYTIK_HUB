/* CHEMIE_ANALYTIK_BRIDGE v0.2.1
 * Gemeinsame Browser-Schnittstelle fuer Hub und Labor-Apps auf GitHub Pages.
 * API bewusst klein halten; Speicherbackend kann spaeter ersetzt werden.
 */

window.AnalytikBridge = (() => {
  const PREFIX = "CHEMIE_ANALYTIK_";

  function readJson(storageKey, fallback = null) {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      console.error("AnalytikBridge readJson:", err);
      return fallback;
    }
  }

  function writeJson(storageKey, value) {
    localStorage.setItem(storageKey, JSON.stringify(value));
  }

  function contextKey() { return PREFIX + "CONTEXT"; }
  function runKey(runId) { return PREFIX + "RUN_" + runId; }
  function resultKey(resultId) { return PREFIX + "RESULT_" + resultId; }

  function getContext() { return readJson(contextKey(), {}); }

  function setContext(context) {
    writeJson(contextKey(), context);
    return context;
  }

  function startRun(options) {
    const opts = options || {};
    if (!opts.appId || !opts.sampleId) throw new Error("startRun benötigt appId und sampleId.");

    const runId = "RUN_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
    const run = {
      run_id: runId,
      case_id: opts.caseId || null,
      sample_id: opts.sampleId,
      app_id: opts.appId,
      analysis_type: opts.analysisType || null,
      input: opts.input || null,
      return_url: opts.returnUrl || null,
      source_result_id: opts.sourceResultId || null,
      peak_id: opts.peakId || null,
      status: "active",
      started_at: new Date().toISOString(),
      completed_at: null,
      result_id: null
    };

    writeJson(runKey(runId), run);
    setContext(run);
    return run;
  }

  function saveResult(result) {
    if (!result || !result.result_id || !result.run_id) {
      throw new Error("RESULT benötigt result_id und run_id.");
    }
    writeJson(resultKey(result.result_id), result);
    return result;
  }

  function getRun(runId) { return readJson(runKey(runId)); }
  function getResult(resultId) { return readJson(resultKey(resultId)); }

  function completeRun(runId, result) {
    const run = getRun(runId);
    if (!run) throw new Error("Run " + runId + " wurde nicht gefunden.");
    if (!result || result.run_id !== runId) throw new Error("RESULT passt nicht zum Run.");

    saveResult(result);
    const completed = Object.assign({}, run, {
      status: "completed",
      completed_at: new Date().toISOString(),
      result_id: result.result_id
    });
    writeJson(runKey(runId), completed);
    setContext(completed);
    return completed;
  }

  function getResultForRun(runId) {
    const run = getRun(runId);
    return run && run.result_id ? getResult(run.result_id) : null;
  }

  function returnToHub(runOrUrl) {
    const run = typeof runOrUrl === "string" ? getRun(runOrUrl) : runOrUrl;
    const directUrl = typeof runOrUrl === "string" && runOrUrl.startsWith("http") ? runOrUrl : null;
    const hubUrl = (run && run.return_url) || directUrl;
    if (!hubUrl) throw new Error("Keine return_url für den Hub vorhanden.");

    const url = new URL(hubUrl, window.location.href);
    if (run && run.run_id) url.searchParams.set("resume", run.run_id);
    window.location.href = url.toString();
  }

  return {
    version: "0.2.1",
    getContext: getContext,
    setContext: setContext,
    startRun: startRun,
    saveResult: saveResult,
    completeRun: completeRun,
    getResult: getResult,
    getRun: getRun,
    getResultForRun: getResultForRun,
    returnToHub: returnToHub
  };
})();
