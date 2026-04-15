# Project Framework – Scam Compounds Detection (Southeast Asia)

## Topic

Detection of suspicious scam compound developments in Southeast Asia using satellite imagery and spatial data analysis.

---

## Concept

This project aims to identify anomalous spatial patterns associated with large enclosed scam compounds in Cambodia and Myanmar, and Laos.

Rather than detecting individual buildings, the focus is on **compound-level characteristics**, combining similarity-based detection with remote sensing indicators to identify areas that deviate from typical urban and rural development patterns.

---

## Pattern Indicators

The detection framework is based on a set of observable spatial indicators:

* Large enclosed built-up areas
* High building density within a defined boundary
* Rapid construction or land-use change (temporal signals)
* Elevated night-time light intensity
* Strong contrast with surrounding land use
* Location in peripheral or border regions

These indicators collectively define the spatial signature of potential scam compounds.

---

## Research Questions

### Core Question

To what extent can satellite-derived similarity and spatial indicators identify anomalous development patterns associated with scam compounds?

### Sub-questions

**1. Clustering**

* Do detected candidate sites exhibit significant spatial clustering?
* Are clusters concentrated in border or peripheral regions?

**2. Morphology**

* How do spatial and morphological characteristics of detected sites differ from typical urban and rural areas?

---

## Design Comparison

### A. Sampling Design

Three groups are defined for comparison:

* **Group A:** Candidate sites (top similarity scores)
* **Group B:** Random urban samples (within same cities)
* **Group C:** Random rural samples (within same AOI)

---

### B. Metrics

For each group, the following indicators are calculated:

* Similarity score
* Mean NDBI (built-up index)
* Mean NDVI (vegetation index)
* Night-time light (NTL) intensity
* Change magnitude (e.g. ΔNDBI, ΔNTL)
* Distance to borders and transport networks

---

### C. Comparative Outputs

The analysis will be visualised using:

* Boxplots / violin plots (distribution comparison)
* Bar charts (mean values with confidence intervals)
* Change analysis (before vs after development)
* Maps with candidate sites and hotspot overlays

---

### D. Statistical Testing

To assess differences between groups:

* t-test or Mann–Whitney test (Group A vs B/C)
* Effect size (Cohen’s d)
* Spatial autocorrelation (e.g. Moran’s I) or hotspot analysis

---

## Expected Contribution

This framework provides a scalable approach to detecting suspicious developments using remote sensing and spatial analysis, contributing to understanding the spatial characteristics of emerging scam compound landscapes.

---

## Notes

This framework identifies spatial patterns consistent with suspicious developments and does not constitute verified ground-truth identification.
