/* CHEMIE_ANALYTIK_BRIDGE v0.1.0
 * Minimaler Browser-Bridge-Entwurf für GitHub Pages.
 * API bewusst klein halten; Speicherbackend kann später ersetzt werden.
 */

window.AnalytikBridge = (() => {
  const PREFIX = "CHEMIE_ANALYTIK_";

  function readJson(key, fallback = null) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      console.error("AnalytikBridge readJson:", err);
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  }

  function getContext() {
    return readJson("CONTEXT", {});
  }

  function setContext(context) {
    writeJson("CONTEXT", context);
    return context;
  }

  function startRun({ appId, sampleId, caseId = null, sourceResultId = null, peakId = null }) {
    const runId = `RUN_${Date.now()}`;
    const run = {
      run_id: runId,
      case_id: caseId,
      sample_id: sampleId,
      app_id: appId,
      source_result_id: sourceResultId,
      peak_id: peakId,
      status: "active",
      started_at: new Date().toISOString()
    };
    writeJson(`RUN_${runId}`, run);
    setContext(run);
    return run;
  }

  function saveResult(result) {
    if (!result || !result.result_id) {
      throw new Error("RESULT benötigt result_id.");
    }
    writeJson(`RESULT_${result.result_id}`, result);
    return result;
  }

  function getResult(resultId) {
    return readJson(`RESULT_${resultId}`);
  }

  function getRun(runId) {
    return readJson(`RUN_${runId}`);
  }

  function returnToHub(hubUrl) {
    if (hubUrl) window.location.href = hubUrl;
  }

  return {
    version: "0.1.0",
    getContext,
    setContext,
    startRun,
    saveResult,
    getResult,
    getRun,
    returnToHub
  };
})();
