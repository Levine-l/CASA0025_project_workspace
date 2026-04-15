# Methodology – Scam Compounds Detection (Southeast Asia)

## Overview

This methodology outlines a step-by-step workflow to detect and analyse suspicious scam compound developments using satellite data and spatial analysis in Google Earth Engine (GEE).

The approach integrates similarity-based detection, remote sensing indicators, and spatial analysis to identify anomalous development patterns.

---

# Methodology

## 1. Study Area and Sample Sites

The study focuses on **Myanmar and Cambodia**, where confirmed scam compound locations are available.

During preprocessing:
- Only these two countries provided reliable confirmed data
- The Area of Interest (AOI) was therefore reduced accordingly

### Regional Context
- **Thailand and Laos** are not primary study areas
- However, they are included conceptually due to:
  - Cross-border human trafficking routes
  - Infrastructure dependencies (electricity, internet)
  - Border-linked development patterns

---

## 2. Data Collection

### Primary Dataset
- Reported scam compound locations (CSV)
- Attributes include:
  - Coordinates (lat/lon)
  - Site status (confirmed / suspected)
  - Context type (e.g. border_area, urban_area)

### Secondary Data (GEE)
- Sentinel-2 imagery
- Night-time lights (VIIRS)
- Auxiliary spatial layers

---

## 3. Data Preprocessing

- Cleaning and formatting CSV datasets
- Standardising coordinate systems
- Removing incomplete or inconsistent entries
- Structuring data for GEE import

### Sample Classification
- **Confirmed sites** → used for training/reference
- **Suspected sites** → used for validation only

---

## 4. Feature Extraction

Satellite-derived indicators include:

- **NDBI** → built-up intensity
- **NDVI** → vegetation presence
- **Night-time lights (NTL)** → human activity

These features are extracted for:
- Confirmed sites
- Surrounding regions

---

## 5. Similarity-Based Detection

The core approach is **pattern matching**:

1. Extract feature signatures from confirmed sites
2. Apply similarity logic across the study area
3. Identify areas with comparable characteristics

This is not a supervised classification model, but a **semi-exploratory detection approach**.

---

## 6. Spatial Filtering

Detected areas are refined using spatial constraints:

- Distance to international borders
- Density and clustering patterns
- Morphological characteristics of built environments

---

## 7. Candidate Site Identification

Areas that:
- Match multiple feature criteria
- Pass spatial filtering

→ are identified as **candidate sites**

---

## 8. Validation and Interpretation

- Candidate sites are compared with **suspected locations**
- Overlap and similarity are used as a proxy for validation

### Important Note
- No ground truth verification is available
- Validation is indicative, not definitive

---

## 9. Interactive Application

Results are implemented in an interactive application using:
- Google Earth Engine
- Quarto

Users can:
- Explore spatial layers
- Compare site types
- Interpret detection results

---

## 10. Limitations

- Limited confirmed data (Myanmar, Cambodia only)
- High uncertainty in suspected site classification
- Potential false positives in dense urban areas
- Lack of field validation

---

## 11. Critical Reflection

The methodology prioritises:
- Transparency over prediction accuracy
- Exploratory analysis over definitive classification

The results should be interpreted as:
> Indicators of potential similarity, not confirmed identification.
