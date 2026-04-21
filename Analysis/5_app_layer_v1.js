// ============================================================
// CASA0025 - Analysis 05
// 5_app_ready_layers.js
// Purpose:
// Prepare app-ready layers and simple query UI for visualization handoff
// Current stable configuration:
// - AOI: CambodiaVietnam
// - Stage 1: embedding candidate points (p97, 2024)
// - Stage 2: tiered refinement rebuilt from candidate_metrics asset
// ============================================================


// ==============================
// 0. IMPORT ASSETS
// ==============================

// Cleaned scam points table
var scam_points_updated = ee.FeatureCollection(
  'projects/casa0025wk6/assets/scam_points_cleaned'
);

// Stage 1 candidate points from embedding screening
var candidatePoints = ee.FeatureCollection(
  'projects/casa0025wk6/assets/candidate_points_CambodiaVietnam_2024_p97'
);

// Stage 2 final summary from Analysis 03
var stage2Summary = ee.FeatureCollection(
  'projects/casa0025wk6/assets/Final_Summary_Table_Complete'
);


// ==============================
// 1. BASIC SETUP
// ==============================
var aoi = ee.Geometry.Rectangle([102.0, 10.0, 108.5, 15.5]);
var aoiName = 'CambodiaVietnam';
var analysisYear = 2024;
var baselineYear = 2021;

// current preferred analysis setting
var stage1ThresholdMode = 'p97';
var stage1SampleScale = 20;
var stage1ReferenceLimit = 3;

Map.setOptions('SATELLITE');
Map.centerObject(aoi, 7);


// ==============================
// 2. REBUILD KNOWN POINT GEOMETRY
// ==============================
var scam_points_geom = scam_points_updated.map(function(f) {
  var lon = ee.Number.parse(ee.String(f.get('lon')));
  var lat = ee.Number.parse(ee.String(f.get('lat')));
  return f.setGeometry(ee.Geometry.Point([lon, lat]));
});

var confirmed = scam_points_geom
  .filter(ee.Filter.eq('site_status', 'confirmed'))
  .filterBounds(aoi);

var suspected = scam_points_geom
  .filter(ee.Filter.eq('site_status', 'suspected'))
  .filterBounds(aoi);

var controls = scam_points_geom
  .filter(ee.Filter.eq('site_status', 'control'))
  .filterBounds(aoi);


// ==============================
// 3. STAGE 1 READY LAYER
//    Add candidate_id and stage metadata for display
// ==============================
var stage1Ready = candidatePoints.map(function(f) {
  var candidateId = ee.String('cand_').cat(ee.String(f.get('system:index')));

  return f.set({
    candidate_id: candidateId,
    stage_label: 'Stage 1 - broad screening',
    aoi_name: aoiName,
    analysis_year: analysisYear,
    baseline_year: baselineYear,
    threshold_mode: stage1ThresholdMode,
    sample_scale_m: stage1SampleScale,
    reference_limit: stage1ReferenceLimit
  });
});


// ==============================
// 4. STAGE 2 READY LAYER
//    Read final summary directly and add only app fields
// ==============================
var stage2Ready = stage2Summary.map(function(f) {
  var distBorderRaw = ee.Number(f.get('dist_to_border_m'));

  var candidateId = ee.String(
    ee.Algorithms.If(
      f.get('candidate_id'),
      f.get('candidate_id'),
      ee.String('cand_').cat(ee.String(f.get('system:index')))
    )
  );

  // keep border distance, but also expose whether it is usable
  var borderDistanceValid = distBorderRaw.lt(99999);

  return f.set({
    candidate_id: candidateId,
    border_distance_valid: borderDistanceValid,
    stage_label: 'Stage 2 - tiered refinement',
    aoi_name: aoiName,
    analysis_year: analysisYear,
    baseline_year: baselineYear
  });
});

var highTier = stage2Ready.filter(ee.Filter.eq('priority_tier', 'high'));
var mediumTier = stage2Ready.filter(ee.Filter.eq('priority_tier', 'medium'));
var lowTier = stage2Ready.filter(ee.Filter.eq('priority_tier', 'low'));
var operationalHighTier = stage2Ready.filter(
  ee.Filter.eq('operational_priority_tier', 'operational_high')
);
var displayHighTop = operationalHighTier
  .sort('dist_to_confirmed_m')
  .limit(200);

print('Stage 1 candidate points', stage1Ready.size());
print('Stage 2 all refined candidates', stage2Ready.size());
print('Stage 2 high tier', highTier.size());
print('Stage 2 operational high tier', operationalHighTier.size());
print('Stage 2 display high top', displayHighTop.size());
print('Stage 2 medium tier', mediumTier.size());
print('Stage 2 low tier', lowTier.size());


// ==============================
// 5. STYLE LAYERS
// ==============================
var aoiLayer = ui.Map.Layer(
  aoi,
  {color: 'FFFFFF'},
  'AOI CambodiaVietnam',
  false
);

var confirmedLayer = ui.Map.Layer(
  confirmed.style({
    color: 'FF3B30',
    pointSize: 4,
    pointShape: 'circle'
  }),
  {},
  'Confirmed',
  true
);

var suspectedLayer = ui.Map.Layer(
  suspected.style({
    color: 'FFD60A',
    pointSize: 4,
    pointShape: 'circle'
  }),
  {},
  'Suspected',
  false
);

var controlsLayer = ui.Map.Layer(
  controls.style({
    color: '4DD0E1',
    pointSize: 4,
    pointShape: 'circle'
  }),
  {},
  'Controls',
  false
);

var stage1Layer = ui.Map.Layer(
  stage1Ready.style({
    color: 'FF9500',
    pointSize: 2,
    pointShape: 'circle'
  }),
  {},
  'Stage 1 candidate points (p97)',
  false
);

var stage2AllLayer = ui.Map.Layer(
  stage2Ready.style({
    color: 'B0B0B0',
    fillColor: 'B0B0B033',
    width: 1
  }),
  {},
  'Stage 2 all refined',
  false
);

var displayHighTopLayer = ui.Map.Layer(
  displayHighTop.style({
    color: 'FF3B30',
    fillColor: 'FF3B3033',
    width: 1
  }),
  {},
  'Stage 2 display high top',
  true
);

var highTierLayer = ui.Map.Layer(
  highTier.style({
    color: 'FF3B30',
    fillColor: 'FF3B3033',
    width: 1
  }),
  {},
  'Stage 2 high tier',
  false
);

var mediumTierLayer = ui.Map.Layer(
  mediumTier.style({
    color: 'FF9F0A',
    fillColor: 'FF9F0A33',
    width: 1
  }),
  {},
  'Stage 2 medium tier',
  false
);

var lowTierLayer = ui.Map.Layer(
  lowTier.style({
    color: '8E8E93',
    fillColor: '8E8E9333',
    width: 1
  }),
  {},
  'Stage 2 low tier',
  false
);

Map.layers().add(aoiLayer);
Map.layers().add(confirmedLayer);
Map.layers().add(suspectedLayer);
Map.layers().add(controlsLayer);
Map.layers().add(stage1Layer);
Map.layers().add(stage2AllLayer);
Map.layers().add(displayHighTopLayer);
Map.layers().add(highTierLayer);
Map.layers().add(mediumTierLayer);
Map.layers().add(lowTierLayer);


// ==============================
// 6. SIMPLE UI PANEL
// ==============================
var panel = ui.Panel({
  style: {
    width: '360px',
    padding: '10px'
  }
});

var title = ui.Label('Scam Compound Candidates: App-ready Layers', {
  fontWeight: 'bold',
  fontSize: '16px',
  margin: '0 0 8px 0'
});

var subtitle = ui.Label(
  'AOI: CambodiaVietnam | Stage 1 = broad screening | Stage 2 = tiered refinement',
  {fontSize: '12px', margin: '0 0 8px 0'}
);

var methodNote = ui.Label(
  'Current preferred setting: 2024 embedding, p97 threshold, sample scale 20 m, reference limit 3. ' +
  'Use Stage 1 as broad screening and Stage 2 as prioritised candidates rather than definitive detection.',
  {fontSize: '12px', whiteSpace: 'pre-wrap', margin: '0 0 10px 0'}
);

var tierSelectLabel = ui.Label('Stage 2 display mode', {
  fontWeight: 'bold',
  margin: '0 0 4px 0'
});

var tierSelect = ui.Select({
  items: ['display_high_top', 'high', 'medium', 'low', 'all_refined'],
  value: 'display_high_top',
  style: {stretch: 'horizontal'}
});

var toggleStage1 = ui.Checkbox({
  label: 'Show Stage 1 candidate points',
  value: false
});

var toggleConfirmed = ui.Checkbox({
  label: 'Show confirmed points',
  value: true
});

var toggleSuspected = ui.Checkbox({
  label: 'Show suspected points',
  value: false
});

var toggleControls = ui.Checkbox({
  label: 'Show control points',
  value: false
});

var countsLabel = ui.Label('Loading counts...', {
  fontSize: '12px',
  whiteSpace: 'pre-wrap',
  margin: '10px 0 10px 0'
});

var validationTitle = ui.Label('Validation note', {
  fontWeight: 'bold',
  margin: '10px 0 4px 0'
});

var validationText = ui.Label(
  'Stage 1 retained p97 because it was tighter than p95 while preserving near-complete known-site coverage. ' +
  'Refined tiering reduced control hits substantially relative to Stage 1, but recall also dropped, so Stage 2 should be read as prioritisation rather than final confirmation.',
  {fontSize: '12px', whiteSpace: 'pre-wrap', margin: '0 0 10px 0'}
);

var clickTitle = ui.Label('Clicked candidate', {
  fontWeight: 'bold',
  margin: '10px 0 4px 0'
});

var clickInfo = ui.Label(
  'Click a Stage 2 candidate polygon on the map to inspect its attributes.',
  {fontSize: '12px', whiteSpace: 'pre-wrap'}
);

var legendTitle = ui.Label('Legend', {
  fontWeight: 'bold',
  margin: '10px 0 4px 0'
});

function makeLegendRow(color, label) {
  var box = ui.Label('', {
    backgroundColor: color,
    padding: '8px',
    margin: '0 8px 4px 0'
  });

  var text = ui.Label(label, {fontSize: '12px'});

  return ui.Panel([box, text], ui.Panel.Layout.Flow('horizontal'));
}

panel.add(title);
panel.add(subtitle);
panel.add(methodNote);
panel.add(tierSelectLabel);
panel.add(tierSelect);
panel.add(toggleStage1);
panel.add(toggleConfirmed);
panel.add(toggleSuspected);
panel.add(toggleControls);
panel.add(countsLabel);
panel.add(validationTitle);
panel.add(validationText);
panel.add(clickTitle);
panel.add(clickInfo);
panel.add(legendTitle);
panel.add(makeLegendRow('#FF3B30', 'High tier'));
panel.add(makeLegendRow('#FF9F0A', 'Medium tier'));
panel.add(makeLegendRow('#8E8E93', 'Low tier'));
panel.add(makeLegendRow('#FF9500', 'Stage 1 candidate points'));

ui.root.insert(0, panel);


// ==============================
// 7. UI HELPERS
// ==============================
function updateTierVisibility(selected) {
  displayHighTopLayer.setShown(selected === 'display_high_top');
  highTierLayer.setShown(selected === 'high');
  mediumTierLayer.setShown(selected === 'medium');
  lowTierLayer.setShown(selected === 'low');
  stage2AllLayer.setShown(selected === 'all_refined');
}

tierSelect.onChange(function(value) {
  updateTierVisibility(value);
});

toggleStage1.onChange(function(checked) {
  stage1Layer.setShown(checked);
});

toggleConfirmed.onChange(function(checked) {
  confirmedLayer.setShown(checked);
});

toggleSuspected.onChange(function(checked) {
  suspectedLayer.setShown(checked);
});

toggleControls.onChange(function(checked) {
  controlsLayer.setShown(checked);
});

updateTierVisibility(tierSelect.getValue());


// ==============================
// 8. COUNTS FOR PANEL
// ==============================
ee.Dictionary({
  confirmed: confirmed.size(),
  suspected: suspected.size(),
  controls: controls.size(),
  stage1_points: stage1Ready.size(),
  stage2_all: stage2Ready.size(),
  operational_high: operationalHighTier.size(),
  display_high_top: displayHighTop.size(),
  high: highTier.size(),
  medium: mediumTier.size(),
  low: lowTier.size()
}).evaluate(function(d) {
  countsLabel.setValue(
    'Known points and candidate counts\n' +
    'Confirmed: ' + d.confirmed + '\n' +
    'Suspected: ' + d.suspected + '\n' +
    'Controls: ' + d.controls + '\n' +
    'Stage 1 points: ' + d.stage1_points + '\n' +
    'Stage 2 all refined: ' + d.stage2_all + '\n' +
    'Operational high: ' + d.operational_high + '\n' +
    'Display high top (<5 km, NTL>5, dNTL>0): ' + d.display_high_top + '\n' +
    'High: ' + d.high + '\n' +
    'Medium: ' + d.medium + '\n' +
    'Low: ' + d.low
  );
});


// ==============================
// 9. CLICK QUERY
//    Click near a Stage 2 polygon to inspect attributes
// ==============================
function fmtNumber(value, digits) {
  if (value === null || value === undefined) return 'N/A';
  if (typeof value !== 'number') return String(value);
  return value.toFixed(digits);
}

function boolText(value) {
  if (value === null || value === undefined) return 'N/A';
  return value ? 'Yes' : 'No';
}

Map.onClick(function(coords) {
  var clickPoint = ee.Geometry.Point([coords.lon, coords.lat]);

  // Use a small buffer so clicking near the edge still works reasonably well.
  var clicked = stage2Ready
    .filterBounds(clickPoint.buffer(150))
    .limit(1);

  clicked.first().evaluate(function(f) {
    if (!f) {
      clickInfo.setValue(
        'No Stage 2 candidate found near this click.\n' +
        'Try clicking inside a high / medium / low tier polygon.'
      );
      return;
    }

    var p = f.properties || {};

    var borderDistanceDisplay = 'N/A';
    if (p.border_distance_valid && p.dist_to_border_m !== null && p.dist_to_border_m !== undefined) {
      borderDistanceDisplay = fmtNumber(p.dist_to_border_m, 0) + ' m';
    }

    clickInfo.setValue(
      'candidate_id: ' + (p.candidate_id || 'N/A') + '\n' +
      'priority_tier: ' + (p.priority_tier || 'N/A') + '\n' +
      'stage: ' + (p.stage_label || 'N/A') + '\n' +
      '\n' +
      'NTL_2024: ' + fmtNumber(p.NTL_2024, 3) + '\n' +
      'dNDBI_2021_2024: ' + fmtNumber(p.dNDBI_2021_2024, 3) + '\n' +
      'dNDVI_2021_2024: ' + fmtNumber(p.dNDVI_2021_2024, 3) + '\n' +
      'dNTL_2021_2024: ' + fmtNumber(p.dNTL_2021_2024, 3) + '\n' +
      '\n' +
      'dist_to_confirmed_m: ' + fmtNumber(p.dist_to_confirmed_m, 0) + ' m\n' +
      'dist_to_border_m: ' + borderDistanceDisplay + '\n' +
      'area_sqm: ' + fmtNumber(p.area_sqm, 0) + '\n' +
      '\n' +
      'development_flag: ' + boolText(p.development_flag) + '\n' +
      'activity_flag: ' + boolText(p.activity_flag) + '\n' +
      'near_border_flag: ' + boolText(p.near_border_flag)
    );
  });
});


// ==============================
// 10. OPTIONAL QUICK PREVIEW TABLES
// ==============================
print('Stage 2 preview (popup-ready fields)', stage2Ready.select([
  'candidate_id',
  'priority_tier',
  'NTL_2024',
  'dNDVI_2021_2024',
  'dNDBI_2021_2024',
  'dNTL_2021_2024',
  'dist_to_confirmed_m',
  'dist_to_border_m',
  'development_flag',
  'activity_flag',
  'near_border_flag'
]).limit(10));

print('Stage 1 preview', stage1Ready.limit(10));