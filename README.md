# CASA0025 – Scam Compounds Detection (Southeast Asia)

## Project Overview

This project develops a Google Earth Engine (GEE)–based application to identify and explore spatial patterns of suspected scam compounds in Southeast Asia, with a focus on **Myanmar and Cambodia**.

Using confirmed reported sites as reference samples, the project applies remote sensing indicators and similarity-based analysis to detect locations with comparable characteristics.

---

## Problem Statement
Scam compounds are difficult to systematically detect due to:
- Limited verified ground data
- Rapid spatial development in border regions
- Overlap with legitimate urban/commercial environments

This project aims to support **researchers and policy-oriented users** by providing a tool to explore **potential high-risk areas based on spatial patterns**, rather than definitive classification.

---

## Objectives

- Identify spatial characteristics of confirmed scam compound sites
- Detect candidate locations with similar patterns
- Compare detected patterns across different environments (e.g. border vs urban)
- Develop an interactive application for exploration and interpretation

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

## Study Area
- **Primary focus:** Myanmar and Cambodia (confirmed sites available)
- **Extended context:** Thailand and Laos (regional dynamics and border influence)

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

* **Preprocessing (Researches/CSV/GITHUB/GEE):** Piyapa, Shuting
* **Analysis (GEE):** Xihong, Jiayi
* **Visualisation (Quarto):** Siyi, Wanqi

All team members contribute to the final presentation.

---

## Tools & Technologies

* Google Earth Engine (GEE)
* JavaScript (GEE Code Editor)
* Sentinel-2 imagery
* VIIRS Night-time Lights
* Excel / CSV preprocessing
* Quarto (interactive visualisation)
* GitHub (version control)

---

## Limitations
- Limited confirmed ground truth (Myanmar, Cambodia only)
- Potential false positives due to similar built environments
- No direct verification of detected sites

---

## Expected Outputs
An interactive application that allows users to:
- Explore confirmed and suspected sites
- Visualise spatial indicators and patterns
- Identify areas with similar characteristics
  
---

## Notes

This project uses secondary, anonymised, and publicly available datasets.
Results represent spatial patterns consistent with suspicious developments and do not constitute verified ground-truth identification.

## Documentation
See detailed framework and methodology in the /docs folder.

---
