# VCÖ-01 Abschlussansicht · Hub v0.14

## Ziel

Die Abschlussansicht führt die verteilten RESULT-Objekte des Analysefalls zu einer fachlich nachvollziehbaren Gesamtdarstellung zusammen. Sie erzeugt keine neue Messinformation, sondern liest vorhandene Ergebnisse und berechnet nur solche Größen, die aus gespeicherten Rohdaten und dokumentierter Probenvorbereitung eindeutig ableitbar sind.

## Freischaltung

Pflichtketten:
1. QUALITATIVE_ION_ANALYSIS: Cu²⁺ und SO₄²⁻ bestätigt
2. UVVIS_CALIBRATION abgeschlossen
3. FRACTIONAL_DISTILLATION abgeschlossen
4. GC_CONFIRMATION für ETHYL_ACETATE
5. GC_CONFIRMATION für BUTAN_1_OL
6. ORGANIC_SOLID_SCREENING abgeschlossen
7. STRUCTURE_ELUCIDATION für den Feststoff: supported
8. MELTING_POINT_CONFIRMATION: confirmed
9. ACID_BASE_TITRATION_QUANT: completed

## Bereiche

### Analytische Route
Drei Zweige:
- anorganischer Zweig
- flüchtiger organischer Zweig
- nichtflüchtiger organischer Zweig

### Identifizierte Bestandteile
- Kupfer(II)-sulfat-Komponente
- Ethylacetat
- 1-Butanol
- Salicylsäure

### Beweisketten
Die Methodenfolge wird pro Komponente als kompakte Evidenzkette dargestellt.

### Quantitative Ergebnisse

#### Kupfer-Komponente
Aus den Standardmessungen des UVVIS_CALIBRATION-RESULTs wird eine lineare Regression A = m·c + b berechnet. Aus der mittleren Absorbanz der unbekannten Messlösung folgt c. Anschließend:
- Rückrechnung über den dokumentierten Verdünnungsfaktor
- Stoffmenge in der 100,0-mL-Stocklösung
- Massenbilanz als CuSO₄·5H₂O gemäß Fallmodell

Der Hydratationsgrad wird ausdrücklich nicht als separat experimentell bestätigt dargestellt.

#### Salicylsäure
Die finale Masse wird aus dem bereits vollständig ausgewerteten ACID_BASE_TITRATION_QUANT-RESULT übernommen.

#### Ethylacetat / 1-Butanol
In v0.14 keine quantitative Gesamtbilanz. Peakflächen-% werden nicht als Stoffmengen-% interpretiert.

## Protokollhilfe

Aus den bestätigten Identitäten und quantitativen Resultaten wird ein kurzer zusammenhängender Abschlussabsatz erzeugt. Er ist als Protokollhilfe gedacht, nicht als Ersatz für ein vollständiges SchülerInnenprotokoll.
