// ============================================================
// CASA0025 - Analysis 02
// Candidate Metrics / Stage 2 Refinement
// Input: candidatePoints from Stage 1 embedding screening
// ============================================================


// ==============================
// 1. IMPORT DATA
// ==============================

// Original scam points
var scam_points = ee.FeatureCollection(
  "projects/project-2736c40e-7bac-492d-b63/assets/scam_sites"
);

// Updated points with controls if needed
var scam_points_updated = ee.FeatureCollection(
  "users/LevineLiu/scam_points_cleaned"
);

// Candidate points from Stage 1
// Replace with your actual exported asset path
var candidatePoints = ee.FeatureCollection(
  "users/LevineLiu/0025analysis/candidate_points_CambodiaVietnam_2024_p97"
);


// ==============================
// 2. BASIC SETUP
// ==============================
var aoi = ee.Geometry.Rectangle([102.0, 10.0, 108.5, 15.5]);
var aoiName = 'CambodiaVietnam';

var analysisYear = 2024;
var baselineYear = 2021;

// Buffer size for converting candidate points into site-level zones
var candidateBufferM = 500;

Map.setCenter(105.0, 12.5, 7);
Map.setOptions('SATELLITE');


// ==============================
// 3. FILTER POINTS
// ==============================
var confirmed = scam_points.filter(ee.Filter.eq('site_status', 'confirmed'))
  .filterBounds(aoi);

var suspected = scam_points.filter(ee.Filter.eq('site_status', 'suspected'))
  .filterBounds(aoi);

// Optional controls from updated asset
var scam_points_updated_geom = scam_points_updated.map(function(f) {
  var lon = ee.Number.parse(ee.String(f.get('lon')));
  var lat = ee.Number.parse(ee.String(f.get('lat')));
  return f.setGeometry(ee.Geometry.Point([lon, lat]));
});

var controls = scam_points_updated_geom
  .filter(ee.Filter.eq('site_status', 'control'))
  .filterBounds(aoi);

print('Candidate points count', candidatePoints.size());
print('Confirmed in AOI', confirmed.size());
print('Suspected in AOI', suspected.size());
print('Controls in AOI', controls.size());

Map.addLayer(candidatePoints, {color: 'orange'}, 'Candidate points', true);
Map.addLayer(confirmed, {color: 'red'}, 'Confirmed', false);
Map.addLayer(suspected, {color: 'yellow'}, 'Suspected', false);
Map.addLayer(controls, {color: 'cyan'}, 'Controls', false);


// ==============================
// 4. HELPER FUNCTIONS
// ==============================
function maskS2Clouds(image) {
  var qa = image.select('QA60');
  var cloudBitMask = 1 << 10;
  var cirrusBitMask = 1 << 11;

  var mask = qa.bitwiseAnd(cloudBitMask).eq(0)
    .and(qa.bitwiseAnd(cirrusBitMask).eq(0));

  return image.updateMask(mask).copyProperties(image, image.propertyNames());
}

function getS2Composite(year, aoi) {
  var startDate = ee.Date.fromYMD(year, 1, 1);
  var endDate = startDate.advance(1, 'year');

  return ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
    .filterBounds(aoi)
    .filterDate(startDate, endDate)
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
    .map(maskS2Clouds)
    .select(['B2', 'B3', 'B4', 'B8', 'B11'])
    .median()
    .clip(aoi);
}

function buildS2MetricsImage(yearA, yearB, aoi) {
  var s2A = getS2Composite(yearA, aoi);
  var s2B = getS2Composite(yearB, aoi);

  var ndviA = s2A.normalizedDifference(['B8', 'B4']).rename('NDVI_' + yearA);
  var ndbiA = s2A.normalizedDifference(['B11', 'B8']).rename('NDBI_' + yearA);

  var ndviB = s2B.normalizedDifference(['B8', 'B4']).rename('NDVI_' + yearB);
  var ndbiB = s2B.normalizedDifference(['B11', 'B8']).rename('NDBI_' + yearB);

  var dNdvi = ndviB.subtract(ndviA).rename('dNDVI_' + yearA + '_' + yearB);
  var dNdbi = ndbiB.subtract(ndbiA).rename('dNDBI_' + yearA + '_' + yearB);

  return ndviA
    .addBands(ndbiA)
    .addBands(ndviB)
    .addBands(ndbiB)
    .addBands(dNdvi)
    .addBands(dNdbi);
}

// VIIRS monthly DNB dataset has avg_rad and cf_cvg bands.
// Docs recommend using cf_cvg to judge coverage quality. :contentReference[oaicite:2]{index=2}
function getAnnualVIIRS(year, aoi) {
  var startDate = ee.Date.fromYMD(year, 1, 1);
  var endDate = startDate.advance(1, 'year');

  var viirs = ee.ImageCollection('NOAA/VIIRS/DNB/MONTHLY_V1/VCMCFG')
    .filterDate(startDate, endDate)
    .filterBounds(aoi)
    .map(function(img) {
      var masked = img.select('avg_rad')
        .updateMask(img.select('cf_cvg').gt(0));
      return masked.copyProperties(img, img.propertyNames());
    })
    .mean()
    .rename('NTL_' + year)
    .clip(aoi);

  return viirs;
}

function buildNTLMetricsImage(yearA, yearB, aoi) {
  var ntlA = getAnnualVIIRS(yearA, aoi);
  var ntlB = getAnnualVIIRS(yearB, aoi);
  var dNtl = ntlB.subtract(ntlA).rename('dNTL_' + yearA + '_' + yearB);

  return ntlA.addBands(ntlB).addBands(dNtl);
}


// ==============================
// 5. BUILD METRICS IMAGE STACK
// ==============================
var s2Metrics = buildS2MetricsImage(baselineYear, analysisYear, aoi);
var ntlMetrics = buildNTLMetricsImage(baselineYear, analysisYear, aoi);

var metricsImage = s2Metrics.addBands(ntlMetrics);

print('Metrics image band names', metricsImage.bandNames());


// ==============================
// 6. CONVERT CANDIDATE POINTS TO BUFFERED ZONES
// ==============================
var candidateZones = candidatePoints.map(function(f) {
  var candidateId = ee.String('cand_').cat(ee.String(f.get('system:index')));

  return f.buffer(candidateBufferM).set({
    candidate_id: candidateId,
    source_geom: 'buffer_from_candidate_point',
    candidate_buffer_m: candidateBufferM
  });
});

Map.addLayer(candidateZones, {color: 'lime'}, 'Candidate zones', false);


// ==============================
// 7. REDUCE IMAGE METRICS TO CANDIDATE ZONES
// ==============================
// reduceRegions attaches image summaries to each feature. :contentReference[oaicite:3]{index=3}
var candidateMetrics = metricsImage.reduceRegions({
  collection: candidateZones,
  reducer: ee.Reducer.mean(),
  scale: 30,       // use 30 m for S2 aggregation over site buffers
  tileScale: 4
});

print('Candidate metrics preview', candidateMetrics.limit(10));


// ==============================
// 8. ADD DISTANCE TO NEAREST CONFIRMED
// ==============================
var confirmedGeom = confirmed.geometry();

candidateMetrics = candidateMetrics.map(function(f) {
  var distToConfirmed = f.geometry().distance(confirmedGeom, 1);

  return f.set({
    dist_to_confirmed_m: distToConfirmed,
    aoi_name: aoiName,
    baseline_year: baselineYear,
    analysis_year: analysisYear
  });
});

print('Candidate metrics with distance preview', candidateMetrics.limit(10));


// ==============================
// 9. OPTIONAL SIMPLE RANKING / FLAGS
// ==============================
// This is just a starter logic. You can refine it later.
candidateMetrics = candidateMetrics.map(function(f) {
  var ntlDelta = ee.Number(f.get('dNTL_' + baselineYear + '_' + analysisYear));
  var ndbiDelta = ee.Number(f.get('dNDBI_' + baselineYear + '_' + analysisYear));
  var ndviDelta = ee.Number(f.get('dNDVI_' + baselineYear + '_' + analysisYear));

  var devFlag = ndbiDelta.gt(0).and(ndviDelta.lt(0));
  var activeFlag = ntlDelta.gt(0);

  return f.set({
    development_flag: devFlag,
    activity_flag: activeFlag
  });
});

print('Candidate metrics final preview', candidateMetrics.limit(10));


// ==============================
// 10. EXPORT
// ==============================
// Export candidate-level metrics for review / ranking
/*
Export.table.toDrive({
  collection: candidateMetrics,
  description: 'candidate_metrics_' + aoiName + '_' + analysisYear,
  fileFormat: 'CSV'
});
*/

/*
Export.table.toAsset({
  collection: candidateMetrics,
  description: 'candidate_metrics_' + aoiName + '_' + analysisYear,
  assetId: 'users/LevineLiu/0025analysis/candidate_metrics_' + aoiName + '_' + analysisYear
});
*/