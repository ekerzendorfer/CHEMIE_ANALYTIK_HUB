# CHEMIE_ANALYTIK_HUB

**Version:** v0.3.0 – erste reale Laborintegration  
**Basis:** CHEMIE_ANALYTIK_CORE schema v0.2.0 · CHEMIE_ANALYTIK_BRIDGE v0.2.1

Browserbasierter Test-Hub für das geplante **Digitale Analytiklabor – CHEMIE mit KI**.

## Ziel von v0.2

Dieser Stand testet den ersten vollständigen technischen Rundlauf:

- CORE-Daten (`SUBSTANCE`, `SAMPLE`, `CASE`, `OPERATION`) laden
- Referenzen im Browser validieren
- Fall `VCOE01` öffnen
- interne Stoffzusammensetzung im Schülerbetrieb verbergen
- Sample-Baum dynamisch freischalten
- **Filtration** durchführen
- **Filterrückstand in Wasser lösen**
- dadurch `VCOE01_SOLID_AQ` erzeugen
- über die **CHEMIE_ANALYTIK_BRIDGE v0.2** einen Analyse-Run starten
- ein standardisiertes `RESULT` zurückgeben und in den Hub übernehmen
- Untersuchungsschritte im Laborjournal protokollieren
- Zustand lokal in `localStorage` halten
- alte v0.1-Sitzungen soweit möglich übernehmen

Die Zusammensetzungen und `fraction_model`-Werte von `VCOE01` sind **Entwicklungswerte** und noch keine festgelegte reale Rezeptur.

## Single-Mode-Prinzip

Alle angebundenen Labor-Apps bleiben unabhängig vom Hub vollständig nutzbar. Der Hub-Modus ist immer eine zusätzliche Betriebsart. Eine App erkennt den Analysekontext nur dann, wenn sie über die Bridge gestartet wurde.

## Bridge-Test

Die Datei `dummy-lab.html` ist **keine fachliche Labor-App**. Sie simuliert lediglich den Datentransfer:

```text
Hub → Run/Context → Dummy-Labor → RESULT → Hub
```

Der enthaltene Zahlenwert ist ausdrücklich synthetisch und dient nur dem Techniktest.

## RESULT-Herkunft

Ab Schema v0.2 ist die Herkunft eines Ergebnisses verbindlich:

- `source: "app"` – Ergebnis aus einer angebundenen Labor-App
- `source: "manual"` – von Lernenden/Lehrkraft manuell eingetragen
- `source: "external"` – Ergebnis aus einer externen Messung/Quelle

Damit können virtuelle und reale Analysedaten später im selben Fall kombiniert werden.

## Struktur

```text
CHEMIE_ANALYTIK_HUB/
├── index.html
├── app.js
├── styles.css
├── dummy-lab.html
├── dummy-lab.js
├── data/
│   ├── substances.json
│   ├── samples.json
│   ├── cases.json
│   └── operations.json
├── schema/
│   ├── schema-version.json
│   └── result-schema.json
└── bridge/
    └── chemie-analytik-bridge.js
```

## Nächste Schritte nach erfolgreichem v0.2-Test

1. Dummy-Rundlauf auf GitHub Pages praktisch prüfen.
2. SpektralLab so erweitern, dass es im Single-Mode unverändert bleibt und zusätzlich einen Bridge-Modus erkennt.
3. `VCOE01_SOLID_AQ` an SpektralLab übergeben.
4. echtes Photometrie-`RESULT` in den Hub zurückführen.
5. danach Destillationslabor als Sample-erzeugende externe Operation anbinden.
6. erst anschließend GC-Lab als von Beginn an CORE-konforme neue App entwickeln.

## Didaktischer Grundsatz

Der Hub transportiert **Probe, Messdaten und technische Resultate** digital. Fachliche Interpretation und Stoffhypothesen bleiben – abhängig vom Aufgabenmodus – bei den Lernenden.


## v0.3 – SpektralLab-Integration

Nach dem erfolgreichen Dummy-Rundlauf kann `VCOE01_SOLID_AQ` nun direkt an das bestehende SpektralLab übergeben werden.

Der Hub startet einen Run mit:

- `app_id: SPECTRAL_LAB`
- `analysis_type: UVVIS_SPECTRUM`
- einem kleinen `input`-Kontext für die Labor-App
- Rücksprungadresse zum Hub

Die erste Integration ist bewusst **qualitativ**. Die reale Konzentration der VCÖ-01-Probe ist noch nicht festgelegt. SpektralLab verwendet deshalb intern nur eine didaktische Arbeitskonzentration für die Spektrenform und gibt **keine Konzentrationsbestimmung** zurück.

Das Single-Mode-Prinzip bleibt verbindlich: SpektralLab ohne Bridge-Parameter verhält sich wie bisher.
