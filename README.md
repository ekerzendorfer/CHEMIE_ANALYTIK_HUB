# CHEMIE_ANALYTIK_HUB

**Version:** v0.1.0 – erster Test-Hub  
**Basis:** CHEMIE_ANALYTIK_CORE schema v0.1.0

Browserbasierter Test-Hub für das geplante **Digitale Analytiklabor – CHEMIE mit KI**.

## Ziel von v0.1

Der erste Stand testet bewusst nur die grundlegende Architektur:

- CORE-Daten (`SUBSTANCE`, `SAMPLE`, `CASE`, `OPERATION`) laden
- Referenzen im Browser validieren
- Fall `VCOE01` öffnen
- interne Stoffzusammensetzung im Schülerbetrieb verbergen
- Sample-Baum darstellen
- **Filtration** als erste reale Operation ausführen
- dadurch `VCOE01_SOLID` und `VCOE01_FILTRATE` freischalten
- Untersuchungsschritte in einem kleinen Laborjournal protokollieren
- Zustand lokal in `localStorage` halten

Die Zusammensetzungen und `fraction_model`-Werte von `VCOE01` sind **Entwicklungswerte** und noch keine festgelegte reale Rezeptur.

## Start

Da die JSON-Dateien per `fetch()` geladen werden, sollte die App über einen Webserver laufen.

### GitHub Pages

Repository auf GitHub anlegen, Inhalt dieses Ordners in den Repository-Root kopieren und GitHub Pages für den Branch aktivieren.

### Lokal mit Python

```bash
python -m http.server 8000
```

Dann im Browser öffnen:

```text
http://localhost:8000/
```

## Struktur

```text
CHEMIE_ANALYTIK_HUB/
├── index.html
├── app.js
├── styles.css
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

## Nächste Schritte

1. `DISSOLVE_WATER` als zweite Hub-Operation aktivieren.
2. Übergabe an externe Labor-App zunächst mit einer Dummy-Station testen.
3. `RESULT`-Rückkanal in Hub und Bridge integrieren.
4. Destillationslabor als erste bestehende echte Labor-App anbinden.
5. Danach GC-Lab bereits vollständig nach der gemeinsamen Schnittstelle entwickeln.

## Didaktischer Grundsatz

Der Hub transportiert **Probe, Messdaten und technische Resultate** digital. Fachliche Interpretation und Stoffhypothesen sollen – abhängig vom Aufgabenmodus – bei den Lernenden bleiben.
