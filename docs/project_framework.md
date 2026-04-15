# Project Framework

## Topic
Detection of scam compounds using satellite imagery and spatial analysis in Southeast Asia.

---

## Concept
Rather than directly identifying scam compounds, this project focuses on detecting **spatial patterns associated with known sites**, including:

- Enclosed compound structures
- High-density built-up areas
- Border proximity
- Rapid development patterns

The approach is **pattern-based and exploratory**, not deterministic classification.

---

## Pattern Indicators

### 1. Built Environment
- NDBI (built-up intensity)
- Dense and enclosed spatial structures

### 2. Vegetation Suppression
- NDVI reduction indicating development

### 3. Night Activity
- Night-time lights (NTL) intensity

### 4. Spatial Context
- Proximity to international borders
- Location within urban or commercial clusters

---

## Data Logic

### Sample Types
- **Confirmed sites** → used as reference/training
- **Suspected sites** → used for validation and comparison

### Context Classification
- border_area  
- urban_area  
- commercial_complex  
- special_economic_zone (where applicable)

---

## Research Questions

1. What spatial characteristics distinguish confirmed scam compounds?
2. Can similar spatial patterns be detected in other locations?
3. How do these patterns vary across different environments?
4. To what extent can remote sensing indicators support detection?

---

## Analytical Strategy

Instead of traditional classification:
- Use **confirmed sites as anchors**
- Extract spatial features
- Identify areas with similar characteristics
- Validate against suspected sites

---

## Design Comparison (Interpretation Layer)

Comparison is structured as:
- Confirmed vs Detected patterns
- Detected vs Suspected sites
- Variation across spatial contexts (border / urban / commercial)

---

## Intended Output
A spatial decision-support tool that:
- Highlights candidate areas
- Allows interactive exploration
- Supports interpretation rather than definitive classification

---

## Key Assumption
Locations sharing multiple spatial indicators with confirmed sites are more likely to represent similar types of developments.

---

## Critical Reflection
- Detection is probabilistic, not definitive
- Similar patterns may exist in legitimate developments
- Results should be interpreted cautiously
