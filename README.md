# CASA0025 – Scam Compounds Detection (Southeast Asia)

## Project Overview

This project investigates the detection of suspicious scam compound developments in Southeast Asia (Cambodia, Myanmar, Laos) using satellite imagery and spatial analysis in Google Earth Engine (GEE).

The aim is to identify anomalous built-up patterns that differ from typical urban and rural development, based on a combination of similarity detection and remote sensing indicators.

This project focuses on identifying spatial patterns associated with large enclosed scam compounds using multi-source satellite data.

---

## Objectives

- Detect candidate scam compound sites using satellite-derived similarity
- Analyse spatial and morphological patterns of detected areas
- Compare detected sites with typical urban and rural environments
- Develop an interactive application to explore results

---

## Methodology (Summary)

1. Data collection (reported scam sites + auxiliary datasets)
2. Data preprocessing (cleaning, formatting, GEE import)
3. Similarity-based detection (satellite embeddings)
4. Feature extraction (NDBI, NDVI, night-time lights)
5. Change detection (temporal development patterns)
6. Spatial filtering (proximity to borders, density, enclosure)
7. Candidate cluster identification
8. Comparative analysis (urban vs rural vs detected sites)
9. Validation and interpretation
10. Interactive visualisation (Quarto web application)

---

## Repository Structure

```
CASA0025_project/
│
├── data_raw/            # Original datasets (Excel, raw sources)
├── data_processed/      # Cleaned data for analysis (CSV for GEE)
├── Preprocessing/       # Data preparation scripts (R / GEE)
├── Analysis/            # GEE scripts for detection & analysis
├── Visualization/       # Quarto files for interactive app
├── docs/                # Project documentation (framework, methodology, references)
└── README.md
```

---

## Team Roles

* **Preprocessing:** Piyapa, Shuting
* **Analysis (GEE):** Xihong, Jiayi
* **Visualisation (Quarto):** Siyi, Wanqi

All team members contribute to the final presentation.

---

## Tools & Technologies

* Google Earth Engine (GEE)
* Sentinel-2 imagery
* VIIRS Night-time Lights
* R / CSV preprocessing
* Quarto (interactive visualisation)
* GitHub (version control)

---

## Expected Outputs

* Spatial detection of candidate scam compounds
* Comparative statistical analysis (urban vs rural vs detected sites)
* Interactive web-based visualisation
* Interpretable spatial insights on anomalous developments

---

## Notes

This project uses secondary, anonymised, and publicly available datasets.
Results represent spatial patterns consistent with suspicious developments and do not constitute verified ground-truth identification.

## Documentation
See detailed framework and methodology in the /docs folder.

---
