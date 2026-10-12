# VCÖ-01 · End-to-End-Smoke-Test

**Zweck:** reproduzierbarer manueller Release-Test für den vollständigen Analysefall VCÖ-01.  
**Gültig ab:** CHEMIE_ANALYTIK_HUB v0.17 · STRUKTUR_LAB v0.2.6

Der Smoke-Test ist kein zusätzlicher Übungsfall. Er läuft parallel zu einem normalen vollständigen Durchgang. Nur an wenigen Stellen wird bewusst geprüft, ob eine noch unzulässige Aktion gesperrt bleibt.

## Testprinzip

Es werden zwei komplette Durchgänge durchgeführt:

- **A · Geführt** – vollständiger funktionaler Release-Test mit didaktischer Führung
- **B · Expert** – derselbe Fall mit reduzierter Wegweisung und Expert-Modus im STRUKTUR-LAB

Für jeden Prüfschritt gilt:

- [ ] PASS – Verhalten entspricht der Erwartung
- [ ] FAIL – Abweichung dokumentieren
- bei einem FAIL: Probe/Station, sichtbarer Zustand und wenn möglich Screenshot notieren

---

# A · Geführt

## A0 · Startzustand

- [ ] **A0.1** Hub startet ohne Fehler; Modus Geführt ist aktiv.
- [ ] **A0.2** Nach Fall zurücksetzen ist nur die Ausgangsprobe freigeschaltet.
- [ ] **A0.3** Interne Zusammensetzungen/Stoffnamen der unbekannten Ausgangsprobe sind nicht sichtbar.
- [ ] **A0.4** Zwischenbilanz ist zu Beginn noch gesperrt.
- [ ] **A0.5** CORE-Validator meldet keine fehlerhaften Referenzen.

## A1 · Probenvorbereitung

- [ ] **A1.1** Filtration erzeugt Filtrat und Filterrückstand genau einmal.
- [ ] **A1.2** Der Probenbaum zeigt beide neuen Proben an der richtigen Stelle.
- [ ] **A1.3** Filterrückstand lässt sich in Wasser lösen; die wässrige Stocklösung wird erzeugt.
- [ ] **A1.4** Teilproben für qualitative Ionenanalyse und quantitative Photometrie können erzeugt werden.
- [ ] **A1.5 – Sperrtest** Photometrische Komplexbildung ist vor bestätigter Ionenanalyse nicht freigegeben.

## A2 · Qualitative Ionenanalyse

- [ ] **A2.1** IONENFISCHEN startet mit der richtigen Teilprobe.
- [ ] **A2.2** Rückkehr zum Hub erfolgt zur richtigen Probe.
- [ ] **A2.3** Genau ein RESULT wird importiert.
- [ ] **A2.4** Cu²⁺ und SO₄²⁻ erscheinen erst nach abgeschlossener Analyse als bestätigt.
- [ ] **A2.5** Nach diesem RESULT wird die photometrische Probenvorbereitung freigegeben.

## A3 · Photometrie und MESSWERT_LAB

- [ ] **A3.1** Komplexbildung/Volumenvorbereitung erzeugt die Messlösung korrekt.
- [ ] **A3.2** SpektralLab übernimmt die richtige Probe und erzeugt Eichdaten + unbekannte Messung.
- [ ] **A3.3** Nach Rückkehr zeigt der Hub noch kein automatisch berechnetes quantitatives Cu-Endergebnis.
- [ ] **A3.4** Im MESSWERT_LAB auswerten übergibt die Rohdaten korrekt.
- [ ] **A3.5** Regression und Rückrechnung werden sichtbar/studentisch bearbeitet.
- [ ] **A3.6** Nach Rückkehr ist die quantitative Cu-Bestimmung genau einmal im Hub gespeichert.
- [ ] **A3.7** Der anorganische Hauptzweig gilt nun als abgeschlossen.
- [ ] **A3.8** Die Zwischenbilanz wird erstmals freigeschaltet und zeigt nur bereits gesicherte Befunde.

## A4 · Destillation

- [ ] **A4.1** DESTILLATIONSLABOR übernimmt das unbekannte organische Filtrat.
- [ ] **A4.2 – Sperrtest** Ein Run mit 0–2 Sternen kann nicht als endgültige Fraktionierung an den Hub übergeben werden.
- [ ] **A4.3** Ein akzeptierter Run erzeugt F1, F2, F3 und Rückstand genau einmal.
- [ ] **A4.4** Fraktionsvolumina und Qualitätsinformation werden im Hub korrekt angezeigt.
- [ ] **A4.5** Stoffidentitäten/Runtime-Zusammensetzungen bleiben im Hub verborgen.

## A5 · GC der flüchtigen Fraktionen

- [ ] **A5.1** GC-LAB erhält die richtige Runtime-Fraktion.
- [ ] **A5.2 – Sperrtest** Bei mehreren Peaks ist eine Rückgabe unterhalb von Rs = 1,5 nicht zulässig.
- [ ] **A5.3** Ein sauberer Einzelpeak darf ohne Rs übernommen werden.
- [ ] **A5.4** Mehrkomponentenfraktionen werden als solche erkannt.
- [ ] **A5.5 – Sperrtest** Eine deutliche Mischfraktion wird nicht als Reinstoff direkt an STRUKTUR-LAB übergeben.
- [ ] **A5.6** Die Peaks bleiben vor weiterer Evidenz als P1/P2/... ohne Stoffnamen sichtbar.

## A6 · Strukturaufklärung flüchtiger Komponenten

Für Ethylacetat und 1-Butanol:

- [ ] **A6.1** STRUKTUR-LAB startet aus einer ausreichend reinen Fraktion im Basismodus.
- [ ] **A6.2** Summenformel ist im Basismodus von Beginn an sichtbar.
- [ ] **A6.3** M → MS → IR → ¹H-NMR → Stoffklasse → Strukturhypothese funktioniert vollständig.
- [ ] **A6.4** Rückgabe an den Hub erzeugt zunächst nur identity_status: supported.
- [ ] **A6.5** PubChem-Link ist bei supported noch nicht sichtbar.
- [ ] **A6.6** Gezielter Referenzstandard + Aufstockung startet mit der ursprünglichen GC-Methode.
- [ ] **A6.7** Erst danach wird die Identität als confirmed geführt.
- [ ] **A6.8** PubChem-Link erscheint erst jetzt.
- [ ] **A6.9** Die bestätigten Standards können zur Interpretation einer Mischfraktion genutzt werden.

## A7 · Nichtflüchtiger Rückstand

- [ ] **A7.1** Aus dem Destillationsrückstand wird der organische Feststoff korrekt isoliert.
- [ ] **A7.2** ORG_FESTSTOFF_LAB gibt nur Beobachtungen/allgemeine Strukturmerkmale zurück, noch keinen Stoffnamen.
- [ ] **A7.3** STRUKTUR-LAB startet im Basismodus mit den Vorbefunden.
- [ ] **A7.4** Salicylsäure wird zunächst nur spektroskopisch gestützt.
- [ ] **A7.5** Schmelz- und Mischschmelzpunkt liefern die unabhängige Identitätsbestätigung.
- [ ] **A7.6** PubChem-Link erscheint erst nach bestätigter Identität.

## A8 · Quantitative Salicylsäure

- [ ] **A8.1** TITRATIONSTOOL startet erst nach bestätigter Feststoffidentität.
- [ ] **A8.2** Die quantitative Rechenkette muss vollständig bearbeitet werden.
- [ ] **A8.3** Das quantitative RESULT wird genau einmal importiert.
- [ ] **A8.4** Masse der Salicylsäure erscheint in Zwischen-/Abschlussbilanz.

## A9 · Abschluss

- [ ] **A9.1** Alle drei Hauptzweige sind als abgeschlossen markiert.
- [ ] **A9.2** Zwischenbilanz geht in Fall abschließen über.
- [ ] **A9.3** Identifizierte Komponenten werden nur mit bestätigtem Status gezeigt.
- [ ] **A9.4** Beweisketten sind fachlich korrekt und nachvollziehbar.
- [ ] **A9.5** Quantitative Ergebnisse stammen aus MESSWERT_LAB bzw. TITRATIONSTOOL, nicht aus versteckter Hub-Berechnung.
- [ ] **A9.6** Keine unbestätigten Stoffnamen werden nachträglich in frühere Schritte geleakt.
- [ ] **A9.7** Keine doppelten RESULTs / keine doppelten Runtime-Samples.

---

# B · Expert

Der zweite Durchlauf prüft dieselbe vollständige Analysenkette. Alle funktionalen Punkte aus A müssen erneut funktionieren. Zusätzlich gelten folgende Expert-Kriterien.

## B0 · Modus

- [ ] **B0.1** Vor dem Reset auf Expert umschalten.
- [ ] **B0.2** Fall zurücksetzen erhält den gewählten Expert-Modus.
- [ ] **B0.3** Probenbaum, fachliche Sperren und CORE-/RESULT-Logik bleiben gegenüber Geführt unverändert.
- [ ] **B0.4** Aktionsbereich heißt Verfügbare Operationen und Analysen.
- [ ] **B0.5** Hinweise zur aktuellen Probe sind deutlich knapper und verraten keinen empfohlenen Gesamtweg.

## B1 · Probenvorbereitung und anorganischer Zweig

- [ ] **B1.1** Dieselben fachlich notwendigen Sperren wie in Geführt bleiben aktiv.
- [ ] **B1.2** Gesperrte Schritte werden neutral als gesperrt markiert, ohne die Lösung vorwegzunehmen.
- [ ] **B1.3** App-Auswertungshinweise aus RESULTs werden im Hub nicht als zusätzliche Lösungsführung eingeblendet.
- [ ] **B1.4** Messdaten, Laborjournal und quantitative Resultate bleiben vollständig erhalten.

## B2 · Flüchtiger organischer Zweig

- [ ] **B2.1** Destillation und GC besitzen dieselben Qualitäts-/Freigabekriterien wie in Geführt.
- [ ] **B2.2** Mischfraktionssperre bleibt identisch.
- [ ] **B2.3** GC-Ergebnisdarstellung ist kompakter, ohne Messdaten zu verlieren.

## B3 · STRUKTUR-LAB · Expert · flüchtige Komponenten

Für Ethylacetat und 1-Butanol:

- [ ] **B3.1** STRUKTUR-LAB startet automatisch im Expertenmodus.
- [ ] **B3.2** Die Summenformel ist zu Beginn nicht sichtbar.
- [ ] **B3.3** Molare Masse ist verfügbar.
- [ ] **B3.4** Elementaranalyse durchführen liefert C/H-Massenanteile; O wird als Differenz ausgewiesen.
- [ ] **B3.5** MS bleibt gesperrt, solange die Elementaranalyse nicht vollständig ausgewertet ist.
- [ ] **B3.6** Verhältnisformel muss korrekt eingegeben werden.
- [ ] **B3.7** M(Verhältnisformel) wird erst nach korrekter Verhältnisformel angezeigt.
- [ ] **B3.8** Faktor n = M/M(VF) muss korrekt bestimmt werden.
- [ ] **B3.9** Erst dann erscheint die Summenformel und MS wird freigegeben.
- [ ] **B3.10 · Ethylacetat-Spezialtest** C2H4O → n=2 → C4H8O2.
- [ ] **B3.11 · 1-Butanol-Spezialtest** Verhältnisformel entspricht bereits der Summenformel; n=1.
- [ ] **B3.12** RESULT enthält ELEMENTAL_ANALYSIS und formula_source: elemental_analysis_plus_molar_mass.
- [ ] **B3.13** Die weitere Spektren-/Bestätigungskette endet fachlich im selben Ergebnis wie Geführt.

## B4 · STRUKTUR-LAB · Expert · Feststoff

- [ ] **B4.1** STRUKTUR-LAB startet für den Rückstand automatisch im Expertenmodus.
- [ ] **B4.2** Vorbefunde aus der klassischen Analyse bleiben verfügbar, nennen aber keinen Stoff.
- [ ] **B4.3** Summenformel C7H6O3 wird erst nach Elementaranalyse + Molmasse freigeschaltet.
- [ ] **B4.4** Verhältnisformel = Summenformel; n=1.
- [ ] **B4.5** Schmelz-/Mischschmelzpunkt und Titration funktionieren anschließend unverändert.

## B5 · Abschluss / Gleichwertigkeit

- [ ] **B5.1** Expert erreicht dieselben bestätigten Komponenten wie Geführt.
- [ ] **B5.2** Expert erreicht dieselben quantitativen Endergebnisse wie Geführt.
- [ ] **B5.3** Beweisketten enthalten im Expert-Modus zusätzlich die selbst erschlossene Summenformel.
- [ ] **B5.4** Kein Schritt wurde nur deshalb freigegeben, weil Expert aktiv ist.
- [ ] **B5.5** Keine notwendige Messinformation wurde durch die reduzierte Führung ausgeblendet.
- [ ] **B5.6** Abschlussansicht ist in beiden Modi fachlich konsistent.

---

# Übergreifende Release-Kriterien

Der Stand gilt als Smoke-Test bestanden, wenn:

- alle Pflichtketten in beiden Modi abgeschlossen werden können,
- kein Bridge-Rücksprung auf eine falsche Probe führt,
- kein RESULT doppelt importiert wird,
- keine interne Stoffidentität vor der vorgesehenen Evidenz sichtbar wird,
- alle fachlichen Sperren korrekt wirken,
- Geführt und Expert dieselbe Chemie und dieselben Endergebnisse liefern,
- der Unterschied ausschließlich in Lernunterstützung und Eigenständigkeit liegt,
- die Summenformel im Expert-Modus nicht vor der Elementaranalyse verfügbar ist.

## Fehlernotiz

Bei einem FAIL bitte festhalten:

- Test-ID:
- Modus:
- Probe/Station:
- sichtbarer Fehler:
- letzter erfolgreicher Schritt:
- reproduzierbar nach Reload: ja/nein
- Screenshot/GIF vorhanden: ja/nein
