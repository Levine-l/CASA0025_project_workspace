// ============================================================
// CASA0025: Building Spatial Applications with Big Data
// Group Name: con.casa
// Project: Scam Compounds Detection in Southeast Asia
// Complete analysis-ready baseline + embedding similarity script
// ============================================================


// ==============================
// 1. IMPORT DATA
// ==============================
var scam_points = ee.FeatureCollection(
  "projects/project-2736c40e-7bac-492d-b63/assets/scam_sites"
);

var scam_points_updated = ee.FeatureCollection(
  'projects/casa0025wk6/assets/scam_points_cleaned'
);

// Rebuild point geometry from lon/lat because the uploaded cleaned control asset
//is being used as a table-like collection rather than a ready point feature collection.
var scam_points_updated_geom = scam_points_updated.map(function(f) {
  var lon = ee.Number.parse(ee.String(f.get('lon')));
  var lat = ee.Number.parse(ee.String(f.get('lat')));
  return f.setGeometry(ee.Geometry.Point([lon, lat]));
});

var controls = scam_points_updated_geom.filter(ee.Filter.eq('site_status', 'control'));


// ==============================
// 2. MAP VIEW
// ==============================
Map.setCenter(101.5, 15.0, 5);
Map.setOptions('SATELLITE');


// ==============================
// 3. SPLIT CONFIRMED / SUSPECTED
// ==============================
var confirmed = scam_points.filter(ee.Filter.eq('site_status', 'confirmed'));
var suspected = scam_points.filter(ee.Filter.eq('site_status', 'suspected'));


// ==============================
// 4. DEFINE AOIs
// ==============================
var aoiCambodiaVietnam = ee.Geometry.Rectangle([102.0, 10.0, 108.5, 15.5]);
var aoiMyanmarThailand = ee.Geometry.Rectangle([97.5, 15.0, 99.8, 18.8]);
var aoiGoldenTriangle = ee.Geometry.Rectangle([99.0, 19.0, 101.5, 21.8]);

Map.addLayer(aoiCambodiaVietnam, {color: 'cyan'}, 'AOI Cambodia-Vietnam', true);
Map.addLayer(aoiMyanmarThailand, {color: 'green'}, 'AOI Myanmar-Thai', true);
Map.addLayer(aoiGoldenTriangle, {color: 'orange'}, 'AOI Golden Triangle', true);


// ==============================
// 5. DISPLAY POINTS
// ==============================
Map.addLayer(confirmed, {color: 'red'}, 'Confirmed', false);
Map.addLayer(suspected, {color: 'yellow'}, 'Suspected', false);
Map.addLayer(controls, {color: 'cyan'}, 'Controls', true);


// ==============================
// 6. BASIC CHECKS
// ==============================
print('All sites count', scam_points.size());
print('Confirmed count', confirmed.size());
print('Suspected count', suspected.size());

/*//data check for controls, comment out for lighter pressure.
print('Total controls', controls.size());
print('Controls by country', controls.aggregate_histogram('country'));
print('Controls in Cambodia AOI', controls.filterBounds(aoiCambodiaVietnam).size());
print('Controls in Myanmar AOI', controls.filterBounds(aoiMyanmarThailand).size());
print('Controls in Golden Triangle AOI', controls.filterBounds(aoiGoldenTriangle).size());
*/

// ==============================
// 7. SENTINEL-2 CLOUD MASK
// ==============================
function maskS2Clouds(image) {
  var qa = image.select('QA60');
  var cloudBitMask = 1 << 10;
  var cirrusBitMask = 1 << 11;

  var mask = qa.bitwiseAnd(cloudBitMask).eq(0)
    .and(qa.bitwiseAnd(cirrusBitMask).eq(0));

  return image.updateMask(mask).copyProperties(image, image.propertyNames());
}


// ==============================
// 8. GET SENTINEL-2 COMPOSITE
// ==============================
function getS2Composite(aoi, startDate, endDate) {
  var s2Collection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
    .filterBounds(aoi)
    .filterDate(startDate, endDate)
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
    .map(maskS2Clouds)
    .select(['B2', 'B3', 'B4', 'B8', 'B11']);

  var composite = s2Collection.median().clip(aoi);

  return {
    collection: s2Collection,
    composite: composite
  };
}


// ==============================
// 9. BUILD INDICATOR IMAGE
// ==============================
function getIndicators(s2Composite) {
  var ndvi = s2Composite.normalizedDifference(['B8', 'B4']).rename('NDVI');
  var ndbi = s2Composite.normalizedDifference(['B11', 'B8']).rename('NDBI');
  return ndvi.addBands(ndbi);
}


// ==============================
// 10. SAMPLE INDICATORS INSIDE AOI
// ==============================
function sampleIndicatorsForAOI(indicatorImage, points, aoi, aoiName) {
  var pointsInAOI = points.filterBounds(aoi);

  var sampled = indicatorImage.sampleRegions({
    collection: pointsInAOI,
    properties: ['site_status', 'country'],
    scale: 10,
    geometries: true
  })
  .filter(ee.Filter.notNull(['NDVI', 'NDBI']))
  .map(function(f) {
    return f.set('aoi_name', aoiName);
  });

  return sampled;
}


// ==============================
// 11. PRINT AOI SUMMARY
// ==============================
function printAOISummary(sampled, aoiName) {
  var sampledConfirmed = sampled.filter(ee.Filter.eq('site_status', 'confirmed'));
  var sampledSuspected = sampled.filter(ee.Filter.eq('site_status', 'suspected'));

  print('----- ' + aoiName + ' -----');
  print('Sampled points', sampled.size());
  print('Confirmed sampled', sampledConfirmed.size());
  print('Suspected sampled', sampledSuspected.size());

  print('Mean NDVI (Confirmed)', sampledConfirmed.aggregate_mean('NDVI'));
  print('Mean NDVI (Suspected)', sampledSuspected.aggregate_mean('NDVI'));

  print('Mean NDBI (Confirmed)', sampledConfirmed.aggregate_mean('NDBI'));
  print('Mean NDBI (Suspected)', sampledSuspected.aggregate_mean('NDBI'));
}


// ==============================
// 12. RUN BASELINE FOR ONE AOI
// ==============================
function runBaselineForAOI(aoi, aoiName, startDate, endDate) {
  var pointsInAOI = scam_points.filterBounds(aoi);
  var confirmedInAOI = confirmed.filterBounds(aoi);
  var suspectedInAOI = suspected.filterBounds(aoi);

  var s2Result = getS2Composite(aoi, startDate, endDate);
  var s2Composite = s2Result.composite;
  var s2Collection = s2Result.collection;

  var indicators = getIndicators(s2Composite);

  var sampled = sampleIndicatorsForAOI(indicators, scam_points, aoi, aoiName);

  Map.addLayer(
    s2Composite,
    {bands: ['B4', 'B3', 'B2'], min: 0, max: 3000},
    'Sentinel-2 RGB ' + aoiName,
    false
  );

  Map.addLayer(
    indicators.select('NDVI'),
    {min: -1, max: 1, palette: ['brown', 'yellow', 'green']},
    'NDVI ' + aoiName,
    false
  );

  Map.addLayer(
    indicators.select('NDBI'),
    {min: -1, max: 1, palette: ['blue', 'white', 'red']},
    'NDBI ' + aoiName,
    false
  );

  print('AOI name', aoiName);
  print('Points in AOI', pointsInAOI.size());
  print('Confirmed in AOI', confirmedInAOI.size());
  print('Suspected in AOI', suspectedInAOI.size());
  print('Sentinel-2 collection size ' + aoiName, s2Collection.size());

  printAOISummary(sampled, aoiName);

  return {
    aoi: aoi,
    aoiName: aoiName,
    pointsInAOI: pointsInAOI,
    confirmedInAOI: confirmedInAOI,
    suspectedInAOI: suspectedInAOI,
    s2Collection: s2Collection,
    s2Composite: s2Composite,
    indicators: indicators,
    sampled: sampled
  };
}


// ==============================
// 13. RUN BASELINE
// ==============================
var baselineCambodia = runBaselineForAOI(
  aoiCambodiaVietnam,
  'CambodiaVietnam',
  '2023-01-01',
  '2023-12-31'
);

var baselineMyanmar = runBaselineForAOI(
  aoiMyanmarThailand,
  'MyanmarThailand',
  '2023-01-01',
  '2023-12-31'
);

// Golden Triangle has no reported samples for baseline summary.
// Leave it for later transfer / prediction testing.


