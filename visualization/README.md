# Visualization Handoff

This folder contains the visualization-side handoff files for the CASA0025
scam compound project.

## Included files

- `scam_compound_gee_app_v3.js`
  - Current Google Earth Engine app script.
  - This is the main file to paste into the Earth Engine Code Editor.
  - V3 keeps the lightweight map design and focuses on:
    - candidate density map
    - confirmed / suspected / control site layers
    - stage funnel
    - precomputed validation charts
    - evidence scatter
    - priority review list

- `README.md`
  - Short handoff note for the next person.

## Data assumptions in V3

The script is configured to read these Earth Engine assets:

```javascript
var SCAM_POINTS_ASSET = 'projects/casa0025wk6/assets/scam_points_cleaned';
var CANDIDATE_ASSET = 'projects/casa0025wk6/assets/Final_Summary_Table_Complete';
```

The current Stage 2 candidate outputs are effectively the
Cambodia-Vietnam workflow outputs. The broader reported-site points still
include Cambodia, Myanmar, Thailand, and Vietnam context points.

## Scope

This handoff folder only includes the current Earth Engine app script and a
short note. Earlier V1/V2 drafts and local preview files are intentionally not
included here.

## Handoff note

If someone else continues the app, start directly from
`scam_compound_gee_app_v3.js`.
