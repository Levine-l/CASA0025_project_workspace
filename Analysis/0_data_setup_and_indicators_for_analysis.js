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
  'users/LevineLiu/scam_points_cleaned'
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


// ============================================================
// 14. EMBEDDING SIMILARITY ANALYSIS
// ============================================================

// ------------------------------
// PARAMETERS
// ------------------------------
var aoi = aoiCambodiaVietnam;
var aoiName = 'CambodiaVietnam';

// AOI-specific controls are used only in this embedding workflow.
var controlsInAOI = controls.filterBounds(aoi);
print('Controls in AOI', controlsInAOI.size());

var year = 2024;
var startDate = ee.Date.fromYMD(year, 1, 1);
var endDate = startDate.advance(1, 'year');

// Compound/site scale
var sampleScale = 20;//set 20 since perform a bit better than 10 and 30.

// Use 3 references
var referenceLimit = 3;

// Similarity statistics from sampled pixels, not full-region reduction
var statsScale = 60;
var statsNumPixels = 3000;

// Threshold mode
var usePercentileThreshold = true;
var thresholdPercentile = 97;
var fixedThreshold = 0.85;   

// Remove tiny fragments
var minConnectedPixels = 4;

// Coarse vectorization
var vectorScale = 120;

// Rendering
var showCandidatePoints = false; //for better performance in map viewer, set to false by default. Can turn on to see the distribution of candidate points, but do not print size() or limit() to avoid pressure crush of gee.


// ------------------------------
// PREPARE REFERENCE SAMPLES
// ------------------------------
var confirmedInAOI = confirmed.filterBounds(aoi);

var confirmedCambodiaOnly = confirmedInAOI.filter(
  ee.Filter.eq('country', 'Cambodia')
);

// Reproducible small subset
var referenceSamples = confirmedCambodiaOnly
  .randomColumn('rand', 42)
  .sort('rand')
  .limit(referenceLimit);

print('Embedding AOI name', aoiName);
print('Reference samples count', referenceSamples.size());

Map.centerObject(aoi, 8);
Map.addLayer(aoi, {color: 'white'}, 'Embedding AOI', true);
Map.addLayer(referenceSamples, {color: 'red'}, 'Reference confirmed (embedding)', true);


// ------------------------------
// ANALYSIS GEOMETRY
// ------------------------------
var analysisGeometry = aoi;

Map.addLayer(analysisGeometry, {color: 'magenta'}, 'Analysis geometry', true);


// ------------------------------
// LOAD ANNUAL SATELLITE EMBEDDING
// ------------------------------
var embeddings = ee.ImageCollection('GOOGLE/SATELLITE_EMBEDDING/V1/ANNUAL');

var embeddingImage = embeddings
  .filter(ee.Filter.date(startDate, endDate))
  .mosaic()
  .clip(analysisGeometry);

var bandNames = embeddingImage.bandNames();

print('Embedding mosaic', embeddingImage);
print('Embedding band names', bandNames);


// ------------------------------
// SAMPLE EMBEDDINGS AT REFERENCES
// ------------------------------
var sampleEmbeddings = embeddingImage.sampleRegions({
  collection: referenceSamples,
  scale: sampleScale,
  geometries: false,
  tileScale: 4
}).filter(ee.Filter.notNull(bandNames));

print('Sample embeddings count', sampleEmbeddings.size());
print(
  'Sample embeddings first feature dict',
  ee.Feature(sampleEmbeddings.first()).toDictionary()
);


// ------------------------------
// COMPUTE SIMILARITY FROM EACH SAMPLE
// ------------------------------
var similarityImages = ee.ImageCollection.fromImages(
  sampleEmbeddings.toList(sampleEmbeddings.size()).map(function(f) {
    f = ee.Feature(f);

    var sampleValues = ee.List(
      bandNames.map(function(b) {
        return f.get(ee.String(b));
      })
    );

    var sampleVectorImage = ee.Image.constant(sampleValues)
      .rename(bandNames)
      .toFloat();

    var sim = sampleVectorImage
      .multiply(embeddingImage)
      .reduce(ee.Reducer.sum())
      .rename('similarity');

    return sim;
  })
);

var meanSimilarity = similarityImages.mean().rename('similarity');

var similarityVis = {
  min: 0,
  max: 1,
  palette: [
    '000004', '2C105C', '711F81', 'B63679',
    'EE605E', 'FDAE78', 'FCFDBF', 'FFFFFF'
  ]
};

Map.addLayer(meanSimilarity, similarityVis, 'Mean similarity', true);


// ------------------------------
// SAMPLE-BASED SIMILARITY STATS
// Much lighter than reduceRegion over all pixels
// ------------------------------
var simSample = meanSimilarity.sample({
  region: analysisGeometry,
  scale: statsScale,
  numPixels: statsNumPixels,
  geometries: false,
  seed: 42,
  tileScale: 4
}).filter(ee.Filter.notNull(['similarity']));

print('Similarity sample count', simSample.size());

var simMinMax = simSample.reduceColumns({
  reducer: ee.Reducer.minMax(),
  selectors: ['similarity']
});

var simPercentiles = simSample.reduceColumns({
  reducer: ee.Reducer.percentile([95, 97, 99]),
  selectors: ['similarity']
});

print('Similarity sample min/max', simMinMax);
print('Similarity sample percentiles', simPercentiles);

var thresholdValue = ee.Number(
  ee.Algorithms.If(
    usePercentileThreshold,
    simPercentiles.get('p' + thresholdPercentile),
    fixedThreshold
  )
);

print('Applied similarity threshold', thresholdValue);


// ------------------------------
// THRESHOLD
// ------------------------------
var similarPixels = meanSimilarity.gte(thresholdValue)
  .rename('is_match')
  .selfMask()
  .toByte();

Map.addLayer(
  similarPixels,
  {palette: ['00FFFF']},
  'Similar pixels > threshold',
  false
);


// ------------------------------
// REMOVE SMALL FRAGMENTS
// ------------------------------
//var patchSize = similarPixels.connectedPixelCount(100, true);
var patchSize = similarPixels.connectedPixelCount(minConnectedPixels, true);

var cleanedPixels = similarPixels.updateMask(
  patchSize.gte(minConnectedPixels)
).toByte();

Map.addLayer(
  cleanedPixels.selfMask(),
  {palette: ['lime']},
  'Cleaned similar pixels',
  false//to prevent the pressure crush of gee.
);

// ------------------------------
// MATCHED AREA (lighter, recommended)
// ------------------------------
var matchedAreaDict = ee.Image.pixelArea()
  .updateMask(cleanedPixels)
  .reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: analysisGeometry,
    scale: 120,
    crs: embeddingImage.projection(),
    bestEffort: true,
    maxPixels: 1e10,
    tileScale: 16
  });

var matchedAreaM2 = ee.Number(
  ee.Algorithms.If(matchedAreaDict.get('area'), matchedAreaDict.get('area'), 0)
);

print('Matched area (m2)', matchedAreaM2);

var aoiAreaM2 = analysisGeometry.area(1);
print('AOI area (m2)', aoiAreaM2);

print('Matched area share of AOI',
  matchedAreaM2.divide(aoiAreaM2)
);


// ------------------------------
// RASTER VALIDATION
// ------------------------------
function tagRasterHit(fc, bufferMeters, label) {
  return fc.map(function(f) {
    var hit = cleanedPixels.reduceRegion({
      reducer: ee.Reducer.max(),
      geometry: f.geometry().buffer(bufferMeters),
      scale: sampleScale,
      bestEffort: true,
      maxPixels: 1e10,
      tileScale: 8
    }).get('is_match');

    return f.set(label, ee.Number(ee.Algorithms.If(hit, hit, 0)));
  });
}

var suspectedInAOI = suspected.filterBounds(aoi);

var suspectedHit500 = tagRasterHit(suspectedInAOI, 500, 'hit_500m');
var suspectedHit1000 = tagRasterHit(suspectedInAOI, 1000, 'hit_1000m');

print(
  'Suspected with raster hit within 500m',
  suspectedHit500.filter(ee.Filter.eq('hit_500m', 1)).size()
);

print(
  'Suspected with raster hit within 1000m',
  suspectedHit1000.filter(ee.Filter.eq('hit_1000m', 1)).size()
);

var referenceHit500 = tagRasterHit(referenceSamples, 500, 'hit_500m');

print(
  'Reference samples with raster hit within 500m',
  referenceHit500.filter(ee.Filter.eq('hit_500m', 1)).size()
);

var referenceIds = referenceSamples.aggregate_array('system:index');

var nonReferenceConfirmed = confirmedInAOI.filter(
  ee.Filter.inList('system:index', referenceIds).not()
);

var nonReferenceConfirmedHit500 = tagRasterHit(
  nonReferenceConfirmed,
  500,
  'hit_500m'
);

var nonReferenceConfirmedHit1000 = tagRasterHit(
  nonReferenceConfirmed,
  1000,
  'hit_1000m'
);

print(
  'Non-reference confirmed with raster hit within 500m',
  nonReferenceConfirmedHit500.filter(ee.Filter.eq('hit_500m', 1)).size()
);

print(
  'Non-reference confirmed with raster hit within 1000m',
  nonReferenceConfirmedHit1000.filter(ee.Filter.eq('hit_1000m', 1)).size()
);


// ------------------------------
// CONTROL VALIDATION
// ------------------------------
print('Controls in AOI', controlsInAOI.size());

var controlsHit500 = tagRasterHit(controlsInAOI, 500, 'hit_500m');
var controlsHit1000 = tagRasterHit(controlsInAOI, 1000, 'hit_1000m');

print(
  'Controls with raster hit within 500m',
  controlsHit500.filter(ee.Filter.eq('hit_500m', 1)).size()
);

print(
  'Controls with raster hit within 1000m',
  controlsHit1000.filter(ee.Filter.eq('hit_1000m', 1)).size()
);

var controlsCount = controlsInAOI.size();
var controlsHit500Count = controlsHit500.filter(ee.Filter.eq('hit_500m', 1)).size();
var controlsHit1000Count = controlsHit1000.filter(ee.Filter.eq('hit_1000m', 1)).size();

print(
  'Controls hit rate within 500m',
  ee.Number(controlsHit500Count).divide(controlsCount)
);

print(
  'Controls hit rate within 1000m',
  ee.Number(controlsHit1000Count).divide(controlsCount)
);

// ------------------------------
// VECTORIZE POLYGONS
// comment out temporarily for lower pressure.
// ------------------------------
/*
var candidatePolygons = cleanedPixels.selfMask().reduceToVectors({
  geometry: analysisGeometry,
  scale: vectorScale,
  geometryType: 'polygon',
  eightConnected: true,
  bestEffort: true,
  maxPixels: 1e10,
  tileScale: 8
}).map(function(f) {
  return f.set({
    aoi_name: aoiName,
    year: year,
    sample_scale_m: sampleScale,
    threshold_mode: usePercentileThreshold ? 'p' + thresholdPercentile : 'fixed',
    threshold_value: thresholdValue,
    reference_limit: referenceLimit
  });
});

Map.addLayer(candidatePolygons, {color: 'cyan'}, 'Candidate polygons', false);
//print('Candidate polygon preview', candidatePolygons.limit(10));//Comment out to make the pressure of gee lighter.
*/
// ------------------------------
// VECTORIZE CENTROIDS
// ------------------------------
var candidatePoints = cleanedPixels.selfMask().reduceToVectors({
  geometry: analysisGeometry,
  scale: vectorScale,
  geometryType: 'centroid',
  eightConnected: true,
  bestEffort: true,
  maxPixels: 1e10,
  tileScale: 8
}).map(function(f) {
  return f.set({
    aoi_name: aoiName,
    year: year,
    sample_scale_m: sampleScale,
    stats_scale_m: statsScale,
    stats_num_pixels: statsNumPixels,
    threshold_mode: usePercentileThreshold ? 'p' + thresholdPercentile : 'fixed',
    threshold_value: thresholdValue,
    min_connected_pixels: minConnectedPixels,
    vector_scale_m: vectorScale,
    reference_limit: referenceLimit
  });
});

// DO NOT print size() here.
if (showCandidatePoints) {
  Map.addLayer(candidatePoints, {color: 'orange'}, 'Candidate points', true);
}
print('Candidate preview', candidatePoints.limit(10));

// ------------------------------
// EXPORT
// Only uncomment after cleanedPixelCount is clearly > 0
// ------------------------------

Export.table.toDrive({
  collection: candidatePoints,
  description: 'candidate_points_CambodiaVietnam_2024_p97',
  fileFormat: 'CSV'
});

//export to asset
/*
Export.table.toAsset({
  collection: candidatePoints,
  description: 'candidate_points_CambodiaVietnam_2024_p97',
  assetId: 'users/LevineLiu/0025analysis/candidate_points_CambodiaVietnam_2024_p97'
});
*/