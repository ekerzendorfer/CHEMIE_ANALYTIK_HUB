(() => {
  "use strict";
  const params = new URLSearchParams(window.location.search);
  const runId = params.get("run");
  const title = document.getElementById("title");
  const meta = document.getElementById("meta");
  const details = document.getElementById("details");
  const completeBtn = document.getElementById("completeBtn");
  const cancelBtn = document.getElementById("cancelBtn");

  if (!runId || !window.AnalytikBridge) {
    title.textContent = "Kein gültiger Bridge-Run";
    completeBtn.disabled = true;
    cancelBtn.disabled = true;
    return;
  }

  const run = window.AnalytikBridge.getRun(runId);
  if (!run) {
    title.textContent = "Run " + runId + " nicht gefunden";
    completeBtn.disabled = true;
    cancelBtn.disabled = true;
    return;
  }

  title.textContent = "Sample " + run.sample_id;
  meta.textContent = "Angeforderte Analyse: " + (run.analysis_type || "–") + " · Run: " + run.run_id;
  details.textContent = JSON.stringify(run, null, 2);

  completeBtn.addEventListener("click", function () {
    const resultId = "RES_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
    const result = {
      result_id: resultId,
      run_id: run.run_id,
      case_id: run.case_id,
      sample_id: run.sample_id,
      app_id: "DUMMY_LAB",
      analysis_type: run.analysis_type || "BRIDGE_TEST",
      status: "completed",
      source: "app",
      measurement: {
        bridge_test: true,
        transferred_value: 0.428,
        note: "Synthetischer Testwert – keine fachliche Messung."
      },
      evaluation: { bridge_roundtrip: "ok" },
      student_interpretation: {},
      created_at: new Date().toISOString()
    };
    const completedRun = window.AnalytikBridge.completeRun(run.run_id, result);
    window.AnalytikBridge.returnToHub(completedRun);
  });

  cancelBtn.addEventListener("click", function () {
    window.AnalytikBridge.returnToHub(run);
  });
})();
