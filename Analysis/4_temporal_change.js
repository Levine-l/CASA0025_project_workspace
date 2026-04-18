// ============================================================
// CASA0025 - Analysis 04
// Temporal Change + Candidate Summary Table
// ============================================================


// ==============================
// 1. IMPORTS
// ==============================

// Output from 02_candidate_metrics.js
var candidateMetricsStatic = ee.FeatureCollection(
  'users/LevineLiu/0025analysis/candidate_metrics_static_CambodiaVietnam_2024'
);

var scam_points = ee.FeatureCollection(
  'projects/project-2736c40e-7bac-492d-b63/assets/scam_sites'
);

var aoi = ee.Geometry.Rectangle([102.0, 10.0, 108.5, 15.5]);
var aoiName = 'CambodiaVietnam';

var baselineYear = 2021;
var analysisYear = 2024;

Map.setCenter(105.0, 12.5, 7);
Map.setOptions('SATELLITE');


// ==============================
// 2. HELPER FUNCTIONS
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

function getAnnualVIIRS(year, aoi) {
  var startDate = ee.Date.fromYMD(year, 1, 1);
  var endDate = startDate.advance(1, 'year');

  return ee.ImageCollection('NOAA/VIIRS/DNB/MONTHLY_V1/VCMCFG')
    .filterDate(startDate, endDate)
    .filterBounds(aoi)
    .map(function(img) {
      return img.select('avg_rad')
        .updateMask(img.select('cf_cvg').gt(0))
        .copyProperties(img, img.propertyNames());
    })
    .mean()
    .rename('NTL_' + year)
    .clip(aoi);
}


// ==============================
// 3. BUILD TEMPORAL METRICS IMAGE
// ==============================
var s2_2021 = getS2Composite(baselineYear, aoi);
var s2_2024 = getS2Composite(analysisYear, aoi);

var ndvi_2021 = s2_2021.normalizedDifference(['B8', 'B4']).rename('NDVI_2021');
var ndbi_2021 = s2_2021.normalizedDifference(['B11', 'B8']).rename('NDBI_2021');

var ndvi_2024 = s2_2024.normalizedDifference(['B8', 'B4']).rename('NDVI_2024');
var ndbi_2024 = s2_2024.normalizedDifference(['B11', 'B8']).rename('NDBI_2024');

var dNDVI = ndvi_2024.subtract(ndvi_2021).rename('dNDVI_2021_2024');
var dNDBI = ndbi_2024.subtract(ndbi_2021).rename('dNDBI_2021_2024');

var ntl_2021 = getAnnualVIIRS(baselineYear, aoi);
var ntl_2024 = getAnnualVIIRS(analysisYear, aoi);
var dNTL = ntl_2024.subtract(ntl_2021).rename('dNTL_2021_2024');

var temporalMetricsImage = ndvi_2021
  .addBands(ndbi_2021)
  .addBands(ndvi_2024)
  .addBands(ndbi_2024)
  .addBands(dNDVI)
  .addBands(dNDBI)
  .addBands(ntl_2021)
  .addBands(ntl_2024)
  .addBands(dNTL);

print('Temporal metrics bands', temporalMetricsImage.bandNames());


// ==============================
// 4. REDUCE TEMPORAL METRICS TO CANDIDATE ZONES
// ==============================
var candidateSummary = temporalMetricsImage.reduceRegions({
  collection: candidateMetricsStatic,
  reducer: ee.Reducer.mean(),
  scale: 30,
  tileScale: 4
});


// ==============================
// 5. ADD SIMPLE DEVELOPMENT / ACTIVITY FLAGS
// ==============================
candidateSummary = candidateSummary.map(function(f) {
  var dNdbi = ee.Number(f.get('dNDBI_2021_2024'));
  var dNdvi = ee.Number(f.get('dNDVI_2021_2024'));
  var dNtl = ee.Number(f.get('dNTL_2021_2024'));

  var developmentFlag = dNdbi.gt(0).and(dNdvi.lt(0));
  var activityFlag = dNtl.gt(0);

  return f.set({
    development_flag: developmentFlag,
    activity_flag: activityFlag
  });
});


// ==============================
// 6. OPTIONAL TIERING
// ==============================
candidateSummary = candidateSummary.map(function(f) {
  var developmentFlag = ee.Boolean(f.get('development_flag'));
  var activityFlag = ee.Boolean(f.get('activity_flag'));
  var distToBorder = ee.Number(f.get('dist_to_border_m'));

  var highPriority = developmentFlag.and(activityFlag).and(distToBorder.lt(50000));
  var mediumPriority = developmentFlag.or(activityFlag);

  return f.set({
    priority_tier: ee.Algorithms.If(
      highPriority,
      'high',
      ee.Algorithms.If(mediumPriority, 'medium', 'low')
    )
  });
});

print('Candidate summary preview', candidateSummary.limit(10));


// ==============================
// 7. OPTIONAL FIELD CLEANUP
// ==============================
// You can later keep only the fields you want in the final export.


// ==============================
// 8. EXPORT FINAL SUMMARY TABLE
// ==============================
/*
Export.table.toDrive({
  collection: candidateSummary,
  description: 'candidate_summary_table_' + aoiName + '_' + analysisYear,
  fileFormat: 'CSV'
});
*/

/*
Export.table.toAsset({
  collection: candidateSummary,
  description: 'candidate_summary_table_' + aoiName + '_' + analysisYear,
  assetId: 'users/LevineLiu/0025analysis/candidate_summary_table_' + aoiName + '_' + analysisYear
});
*/