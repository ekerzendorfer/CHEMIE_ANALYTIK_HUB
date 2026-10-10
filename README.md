# CHEMIE_ANALYTIK_HUB

**Version:** v0.13.0 – quantitative Salicylsäurebestimmung  
**Basis:** CHEMIE_ANALYTIK_CORE schema v0.13.0 · CHEMIE_ANALYTIK_BRIDGE v0.2.1

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


## v0.4 – Teilproben und quantitative Kupfer-Photometrie

Der anorganische Ast von VCÖ-01 wird in getrennte Teilproben aufgeteilt:

```text
VCOE01_SOLID_AQ
├── VCOE01_ION_ALIQUOT
└── VCOE01_PHOT_ALIQUOT
    └── COMPLEX_AMMONIA_EXCESS
        └── VCOE01_PHOT_AMMINE
```

Das Entwicklungsmodell verwendet für die quantitative Photometrie:

- Filterrückstand auf 100,0 mL lösen
- 10,00 mL Teilprobe für Photometrie
- Ammoniak im Überschuss
- auf 25,00 mL Messlösung auffüllen
- Eichstandards 0,003 / 0,006 / 0,009 / 0,012 / 0,015 mol/L
- interne unbekannte Messkonzentration 0,0100 mol/L

Diese Werte sind ausdrücklich als `development_model` markiert und noch keine endgültige Rezeptur.

Der Hub liefert nach einem quantitativen RESULT nur Auswertungshinweise. Regression, unbekannte Konzentration und Rückrechnung auf die Ausgangsprobe werden nicht automatisch berechnet.


## v0.5 – Ionenfischen und evidenzabhängige Freigabe

Der anorganische Ablauf ist nun bewusst sequenziert:

```text
VCOE01_SOLID_AQ
├── VCOE01_ION_ALIQUOT → IONENFISCHEN → Cu²⁺ / SO₄²⁻ bestätigt
└── VCOE01_PHOT_ALIQUOT
    └── erst nach bestätigtem Ionen-RESULT:
        COMPLEX_AMMONIA_EXCESS
        → VCOE01_PHOT_AMMINE
        → quantitative Photometrie
```

Die Freigabebedingung liegt im Sample-Datensatz als `operation_requirements` und wird vom Hub geprüft.

Nach erfolgreicher Ionenanalyse kann der Hub zusätzlich einen einfachen Realversuch anregen: CuSO₄-Lösung mit wenig und anschließend überschüssiger Ammoniaklösung versetzen und Niederschlagsbildung bzw. tiefblaue Komplexlösung beobachten.


## v0.6 – Destillation als Sample-erzeugende externe Operation

Das organische Filtrat wird an das DESTILLATIONSLABOR übergeben. Die Fraktionen bleiben im Hub so lange gesperrt, bis ein Destillations-Run mit mindestens 3/5 Sternen bewusst übernommen wurde.

Ein akzeptierter RESULT kann zusätzlich `produced_samples` enthalten. Diese Runtime-Samples verwenden stabile IDs, tragen aber die im konkreten Versuch entstandenen Volumina und internen Zusammensetzungen:

- `VCOE01_F1`
- `VCOE01_F2`
- `VCOE01_F3`
- `VCOE01_RESIDUE`

Die Zusammensetzungen werden im SchülerInnen-Hub nicht angezeigt. Sie dienen als Eingabedaten für nachfolgende Laborstationen, insbesondere GC.

Die für den ersten Test verwendete Startzusammensetzung der flüchtigen Komponenten ist weiterhin ein ausdrücklich markiertes Entwicklungsmodell und keine endgültige VCÖ-01-Rezeptur.


## v0.7 – GC-LAB auf F1/F2/F3

Die im akzeptierten Destillations-Run erzeugten Runtime-Samples können nun direkt an GC-LAB übergeben werden.

Der Hub transportiert intern:

- stabile SAMPLE-ID,
- Fraktionsvolumen,
- tatsächliche virtuelle Runtime-Zusammensetzung,
- qualitative Fraktionsmetadaten.

Im SchülerInnen-UI bleiben Stoffidentitäten und interne Zusammensetzung verborgen.

GC-LAB liefert erst dann ein offizielles RESULT zurück, wenn alle relevanten benachbarten Peaks mindestens die Freigabeschwelle `R_s ≥ 1,5` erfüllen. Schlechtere Läufe bleiben ausschließlich in der GC-Versuchshistorie.

Das GC-RESULT enthält öffentliche Messdaten (Retentionszeiten, Peakflächen, Peakbreiten, minimale Auflösung) sowie einen internen Peak→CORE-ID-Payload für die spätere Kopplung an das Strukturaufklärungs-Lab. Die Peaks bleiben im SchülerInnenbetrieb P1/P2/... und werden durch GC allein nicht identifiziert.


## v0.8 – GC-Peak → STRUKTUR-LAB

Ein übernommenes GC-RESULT kann nun für jeden detektierten Peak eine nachgeschaltete Strukturaufklärung starten.

Ablauf:
- Hub zeigt P1/P2/... mit Retentionszeit und Peakflächenanteil
- Peak wird mit `source_result_id + peak_id` referenziert
- die interne Peak→CORE-ID-Zuordnung aus dem GC-RESULT bleibt im SchülerInnen-UI verborgen
- STRUKTUR-LAB startet im Basismodus mit dem passenden kuratierten Fall
- M → MS → IR → ¹H-NMR → Stoffklasse → Strukturhypothese → Name
- Rückgabe erhält `identity_status: supported`
- der ursprüngliche GC-Peak wird im Hub als spektroskopisch gestützt markiert
- `confirmed` bleibt ausdrücklich dem späteren gezielten GC-Referenzstandard bzw. der Aufstockung vorbehalten

Damit bleibt die Beweiskette fachlich getrennt:
`GC-Trennung → spektroskopische Hypothese → chromatographische Bestätigung`.


## v0.9 – gezielte GC-Bestätigung

Nach einer spektroskopisch gestützten Strukturhypothese kann derselbe GC-Peak gezielt bestätigt werden.

Ablauf:
- der Hub bietet nur den bereits begründeten Stoff als Referenzstandard an
- GC-LAB übernimmt exakt die Methode des ursprünglichen GC-Laufs
- Referenzstandard: Retentionszeit muss mit dem Zielpeak übereinstimmen
- Aufstockung: derselbe Peak muss wachsen, ohne dass ein neuer Peak entsteht
- erst beide Belege zusammen liefern ein GC_CONFIRMATION-RESULT mit identity_status: confirmed
- der ursprüngliche GC-Peak wird im Hub als bestätigt markiert

Damit ist die organische Beweiskette geschlossen: GC-Trennung → M/MS/IR/¹H-NMR-Hypothese → gezielter Standard → Aufstockung → bestätigte Identität.


## v0.9.1 – Mischproben-Sperre und Standardtransfer

Direkte Reinstoff-Spektroskopie wird nur noch für ausreichend reine GC-Fraktionen freigegeben.

Didaktische Freigaberegel:
- ein einzelner Peak: Strukturaufklärung möglich
- bei mehreren Peaks: nur der dominante Peak, wenn er mindestens 95 % Peakflächenanteil besitzt
- deutliche Mischfraktionen: keine direkte Übergabe an STRUKTUR-LAB, da MS/IR/¹H-NMR der Gesamtprobe Mischspektren liefern würden

Mischfraktionen bleiben analytisch wertvoll:
- Stoffe, die zuvor in einer anderen ausreichend reinen Fraktion vollständig bestätigt wurden, werden als bekannte Standards freigeschaltet
- der jeweilige Standard kann unter der Methode der Mischfraktion erneut gemessen und zur Probe aufgestockt werden
- so lassen sich beide Komponenten einer Übergangsfraktion chromatographisch bestätigen, ohne eine unrealistische Reinstoff-Spektroskopie der Mischung vorzutäuschen

Die 95-%-Grenze ist eine didaktische Freigaberegel. Peakflächen-% im vereinfachten FID-Modell sind keine exakten Stoffmengen-%.


## v0.10 – organischer Destillationsrückstand

Der nichtflüchtige Destillationsrückstand erhält einen eigenen, bewusst kleinen Analyseweg.

Ablauf:
- `VCOE01_RESIDUE`: Rückstand aus der Destillation; kann noch flüchtige Reste enthalten
- lokale Probenvorbereitung `ISOLATE_RESIDUE_SOLID`
- neues Sample `VCOE01_RESIDUE_SOLID`: unbekannter weißer organischer Feststoff
- Übergabe an `ORG_FESTSTOFF_LAB` als `ORGANIC_SOLID_SCREENING`

Für VCÖ-01 vorgesehene Methoden:
- Lösungsverhalten
- pH einer sinnvollen wässrigen Phase
- Hydrogencarbonatprobe
- Fe(III)-Probe
- Brennprobe

Die Voranalyse darf ausdrücklich **keine Stoffidentität** zurückgeben. Zulässige Rückgabe sind nur Beobachtungen und allgemeine Strukturmerkmale, z. B. Carbonsäurefunktion, phenolische OH-Gruppe oder ein Hinweis auf ein ungesättigtes/aromatisches System.

Der Schmelzpunkt bleibt für einen späteren unabhängigen Bestätigungsschritt reserviert. STRUKTUR_LAB und quantitative Titration folgen in getrennten Entwicklungsstufen.


## v0.11 – Feststoff-Voranalyse → STRUKTUR-LAB

Nach dem ORGANIC_SOLID_SCREENING kann der isolierte VCÖ-01-Feststoff direkt zur instrumentellen Strukturaufklärung weitergegeben werden.

Der Hub übergibt:
- das Feststoff-Sample
- die allgemeine qualitative Voranalyse als `prior_findings`
- intern den kuratierten Zielstoff für den passenden Strukturfall
- keine Stoffidentität im SchülerInnen-UI

STRUKTUR-LAB zeigt die Vorbefunde als bereits bekanntes Startwissen und bearbeitet anschließend M, EI-MS, IR und ¹H-NMR.

Nach einer korrekten Strukturhypothese bleibt der Status `supported`. Für den Feststoff ist als unabhängige Bestätigung ein späterer Schmelz-/Mischschmelzpunkt vorgesehen.


## v0.12 – Schmelz-/Mischschmelzpunkt-Bestätigung

Nach einer gestützten Feststoff-Strukturhypothese startet der Hub ORG_FESTSTOFF_LAB im Modus `melting_confirmation`.

Beweiskette:
1. Schmelzbereich der unbekannten Probe
2. Schmelzbereich des gezielt gewählten Referenzstandards
3. 1:1-Mischschmelzpunkt

Erst nach übereinstimmendem Referenzbereich und fehlender relevanter Depression oder Verbreiterung der Mischung wird die Feststoffidentität als `confirmed` geführt.

Für VCÖ-01 ist damit die qualitative Identitätskette der Salicylsäure abgeschlossen; die quantitative Titration bleibt der nächste eigene Entwicklungsschritt.


## v0.13 – quantitative Salicylsäurebestimmung

Nach bestätigter Salicylsäure-Identität kann der Hub eine gezielte quantitative Titration im TITRATIONSTOOL starten.

VCÖ-01-Modell:
- gesamter Rückstand quantitativ auf 100,0 mL
- 20,00 mL Aliquot
- 0,0200 mol/L NaOH
- Auswertung des ersten Äquivalenzpunkts
- Carboxylproton: n(NaOH) : n(Salicylsäure) = 1 : 1
- Rückrechnung auf Stoffmenge und Masse im gesamten ursprünglichen Rückstand

Der interne Entwicklungswert beträgt 0,138121 g Salicylsäure und wird im SchülerInnen-UI nicht vorgegeben. Das TITRATIONSTOOL gibt das quantitative RESULT erst nach vollständig korrekt ausgefüllter Rechenkette zurück.
