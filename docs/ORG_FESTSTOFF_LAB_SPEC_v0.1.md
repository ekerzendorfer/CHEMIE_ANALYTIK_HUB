# ORG_FESTSTOFF_LAB v0.1 – Fachliche und technische Spezifikation

## 1. Rolle

Kleine browserbasierte Voranalyse für unbekannte organische Feststoffe.

Ziel ist **nicht** die Stoffidentifikation. Die App sammelt klassische Beobachtungen und gibt ausschließlich allgemeine Strukturmerkmale an den Analytik-Hub zurück.

Single-Mode und Hub-Modus bleiben getrennt.

## 2. VCÖ-01 – erste Probe

Hub-Auftrag:

- Sample: `VCOE01_RESIDUE_SOLID`
- Anzeige: „Unbekannter weißer organischer Feststoff“
- interne Modellreferenz: `vcoe01_residue_solid_v1`
- Stoffidentität im UI verborgen

## 3. Methoden v0.1

### SOLUBILITY – Lösungsverhalten
Drei kleine Teilproben:
- Wasser
- polarer organischer Löser
- unpolarer organischer Löser

Ausgabe sind nur Beobachtungen wie „gut löslich / teilweise löslich / kaum löslich“.

Keine automatische Stoffklassenzuordnung allein aus der Löslichkeit.

### PH_AQUEOUS – pH
Nur sinnvoll, wenn eine wässrige Phase hergestellt werden kann.

Ausgabe:
- experimenteller/kuratierter pH-Bereich
- allgemeiner Befund „saure wässrige Phase“

### BICARBONATE – Hydrogencarbonatprobe
Beobachtung:
- Gasentwicklung / CO₂

Allgemeine Interpretation:
- `carboxylic_acid: strong`

### FE3 – Fe(III)-Probe
Beobachtung:
- charakteristische violette Komplexfärbung

Allgemeine Interpretation:
- `phenolic_oh: strong`

Die App darf daraus nicht „Salicylsäure“ ableiten.

### FLAME – Brennprobe
Beobachtung:
- deutlich rußende Flamme

Vorsichtige Interpretation:
- `aromatic_or_unsaturated: indication`

Keine Aussage „Aromat eindeutig nachgewiesen“.

## 4. Methoden bewusst noch nicht in v0.1

Datenmodell später erweiterbar für:
- Bromwasser
- Beilsteinprobe
- Fehling
- Tollens
- Oxidation primärer/sekundärer Alkohole
- weitere Löslichkeits-/Reaktivitätsproben

Schmelzpunkt gehört **nicht** in die Voranalyse. Er ist für die spätere unabhängige Bestätigung einer Strukturhypothese reserviert.

## 5. UI

Drei kompakte Bereiche:

1. **Probe**
   - unbekannter weißer Feststoff
   - keine Kandidatennamen

2. **Methoden**
   - Karten/Buttons für die freigeschalteten Methoden
   - Teilprobe wird bei jeder Methode verbraucht
   - Beobachtung sichtbar nach Durchführung
   - keine automatische Komplettlösung

3. **Befundjournal**
   - protokolliert Methode + Beobachtung
   - Lernende markieren bzw. bestätigen daraus allgemeine Strukturmerkmale
   - Rückgabe erst möglich, wenn die erforderlichen Kernbefunde dokumentiert sind

## 6. RESULT

```json
{
  "analysis_type": "ORGANIC_SOLID_SCREENING",
  "measurement": {
    "methods_completed": ["SOLUBILITY", "PH_AQUEOUS", "BICARBONATE", "FE3", "FLAME"],
    "observations": {
      "BICARBONATE": "Gasentwicklung",
      "FE3": "violette Färbung",
      "FLAME": "rußende Flamme"
    }
  },
  "evaluation": {
    "supported_features": {
      "carboxylic_acid": "strong",
      "phenolic_oh": "strong",
      "aromatic_or_unsaturated": "indication",
      "acidic_aqueous_phase": "supported",
      "polar_character": "indication"
    }
  }
}
```

Verboten in v0.1:
- `identified_substance`
- Stoffname „Salicylsäure“
- `substance_id` als SchülerInnen-Ergebnis
- `identity_status: confirmed`

## 7. Bridge

Aufruf:
`?bridge=1&run=RUN_...`

Hub-Input:
- `mode: qualitative_screening`
- `model_ref`
- `display_label`
- `allowed_methods`
- `required_evidence`
- `output_policy.identify_substance = false`

Rückgabe über die bestehende `CHEMIE_ANALYTIK_BRIDGE`.

## 8. Didaktisches Ziel

Die Voranalyse soll für VCÖ-01 zu einer fachlich sinnvollen Eingrenzung führen:

- Carbonsäurefunktion stark gestützt
- phenolische OH-Gruppe stark gestützt
- Hinweis auf ungesättigtes/aromatisches System

Erst danach folgt später die instrumentelle Strukturaufklärung im STRUKTUR_LAB.
