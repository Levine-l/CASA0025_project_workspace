// ============================================================
// 03_validation.js
// Validation for Stage-1 embedding screening
// Based on:
// - 0_data_setup_and_indicators_for_analysis.js
// - 1_embedding_similarity.js
// ============================================================

// ------------------------------------------------------------
// 0. STANDALONE DATA SETUP
// ------------------------------------------------------------
var scam_points_updated = ee.FeatureCollection(
  'projects/casa0025wk6/assets/scam_points_cleaned'
);

var scam_points_updated_geom = scam_points_updated.map(function(f) {
  var lon = ee.Number.parse(ee.String(f.get('lon')));
  var lat = ee.Number.parse(ee.String(f.get('lat')));
  return f.setGeometry(ee.Geometry.Point([lon, lat]));
});

var aoiCambodiaVietnam = ee.Geometry.Rectangle([102.0, 10.0, 108.5, 15.5]);

var confirmed = scam_points_updated_geom
  .filter(ee.Filter.eq('site_status', 'confirmed'));

var suspected = scam_points_updated_geom
  .filter(ee.Filter.eq('site_status', 'suspected'));

var controls = scam_points_updated_geom
  .filter(ee.Filter.eq('site_status', 'control'));


// ------------------------------------------------------------
// 1. FIXED SCREENING SETTINGS (same as current preferred run)
// ------------------------------------------------------------
var aoi = aoiCambodiaVietnam;
var aoiName = 'CambodiaVietnam';

var year = 2024;
var startDate = ee.Date.fromYMD(year, 1, 1);
var endDate = startDate.advance(1, 'year');

var sampleScale = 20;
var referenceLimit = 3;
var statsScale = 60;
var statsNumPixels = 3000;
var usePercentileThreshold = true;
var thresholdPercentile = 97;
var fixedThreshold = 0.85;
var minConnectedPixels = 4;

// Validation settings
var hitBuffer500 = 500;
var hitBuffer1000 = 1000;

// Held-out settings
var holdoutFraction = 0.20;   // 20% confirmed held out each run
var heldoutSeeds = [11, 22, 33, 44, 55];  // repeat several times


// ------------------------------------------------------------
// 2. FILTER AOI POINTS
// ------------------------------------------------------------
var confirmedInAOI = confirmed.filterBounds(aoi);
var suspectedInAOI = suspected.filterBounds(aoi);
var controlsInAOI = controls.filterBounds(aoi);

var confirmedCambodiaOnly = confirmedInAOI.filter(
  ee.Filter.eq('country', 'Cambodia')
);

print('Confirmed in AOI', confirmedInAOI.size());
print('Suspected in AOI', suspectedInAOI.size());
print('Controls in AOI', controlsInAOI.size());


// ------------------------------------------------------------
// 3. BUILD EMBEDDING SCREENING LAYER
//    (same logic as 1_embedding_similarity.js, but lighter:
//     no vectorization, only cleaned raster + summary)
// ------------------------------------------------------------
function buildEmbeddingScreen(referenceSamples) {
  var embeddings = ee.ImageCollection('GOOGLE/SATELLITE_EMBEDDING/V1/ANNUAL');

  var embeddingImage = embeddings
    .filter(ee.Filter.date(startDate, endDate))
    .mosaic()
    .clip(aoi);

  var bandNames = embeddingImage.bandNames();

  var sampleEmbeddings = embeddingImage.sampleRegions({
    collection: referenceSamples,
    scale: sampleScale,
    geometries: false,
    tileScale: 4
  }).filter(ee.Filter.notNull(bandNames));

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

  var simSample = meanSimilarity.sample({
    region: aoi,
    scale: statsScale,
    numPixels: statsNumPixels,
    geometries: false,
    seed: 42,
    tileScale: 4
  }).filter(ee.Filter.notNull(['similarity']));

  var simPercentiles = simSample.reduceColumns({
    reducer: ee.Reducer.percentile([95, 97, 99]),
    selectors: ['similarity']
  });

  var thresholdValue = ee.Number(
    ee.Algorithms.If(
      usePercentileThreshold,
      simPercentiles.get('p' + thresholdPercentile),
      fixedThreshold
    )
  );

  var similarPixels = meanSimilarity.gte(thresholdValue)
    .rename('is_match')
    .selfMask()
    .toByte();

  var patchSize = similarPixels.connectedPixelCount(minConnectedPixels, true);

  var cleanedPixels = similarPixels.updateMask(
    patchSize.gte(minConnectedPixels)
  ).toByte();

  var matchedAreaDict = ee.Image.pixelArea()
    .updateMask(cleanedPixels)
    .reduceRegion({
      reducer: ee.Reducer.sum(),
      geometry: aoi,
      scale: 120,
      crs: embeddingImage.projection(),
      bestEffort: true,
      maxPixels: 1e10,
      tileScale: 16
    });

  var matchedAreaM2 = ee.Number(
    ee.Algorithms.If(matchedAreaDict.get('area'), matchedAreaDict.get('area'), 0)
  );

  return {
    embeddingImage: embeddingImage,
    meanSimilarity: meanSimilarity,
    cleanedPixels: cleanedPixels,
    thresholdValue: thresholdValue,
    matchedAreaM2: matchedAreaM2,
    referenceSamples: referenceSamples
  };
}


// ------------------------------------------------------------
// 4. RASTER HIT HELPERS
// ------------------------------------------------------------
function tagRasterHit(fc, cleanedPixels, bufferMeters, label) {
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

function countHits(fc, label) {
  return fc.filter(ee.Filter.eq(label, 1)).size();
}


// ------------------------------------------------------------
// 5. SCREENING-LAYER VALIDATION SUMMARY
//    Reproduces current preferred p97 screening behaviour
// ------------------------------------------------------------
function summarizeCurrentScreening(referenceSamples, runId) {
  var screen = buildEmbeddingScreen(referenceSamples);

  var referenceIds = referenceSamples.aggregate_array('system:index');
  var nonReferenceConfirmed = confirmedInAOI.filter(
    ee.Filter.inList('system:index', referenceIds).not()
  );

  var suspectedHit500 = tagRasterHit(suspectedInAOI, screen.cleanedPixels, hitBuffer500, 'hit_500m');
  var suspectedHit1000 = tagRasterHit(suspectedInAOI, screen.cleanedPixels, hitBuffer1000, 'hit_1000m');

  var referenceHit500 = tagRasterHit(referenceSamples, screen.cleanedPixels, hitBuffer500, 'hit_500m');

  var nonReferenceConfirmedHit500 = tagRasterHit(nonReferenceConfirmed, screen.cleanedPixels, hitBuffer500, 'hit_500m');
  var nonReferenceConfirmedHit1000 = tagRasterHit(nonReferenceConfirmed, screen.cleanedPixels, hitBuffer1000, 'hit_1000m');

  var controlsHit500 = tagRasterHit(controlsInAOI, screen.cleanedPixels, hitBuffer500, 'hit_500m');
  var controlsHit1000 = tagRasterHit(controlsInAOI, screen.cleanedPixels, hitBuffer1000, 'hit_1000m');

  var aoiAreaM2 = aoi.area(1);

  return ee.Feature(null, {
    run_id: runId,
    validation_type: 'screening_summary',
    aoi_name: aoiName,
    year: year,
    reference_limit: referenceLimit,
    sample_scale_m: sampleScale,
    threshold_percentile: thresholdPercentile,
    threshold_value: screen.thresholdValue,
    matched_area_m2: screen.matchedAreaM2,
    aoi_area_m2: aoiAreaM2,
    matched_area_share_of_aoi: ee.Number(screen.matchedAreaM2).divide(aoiAreaM2),

    suspected_in_aoi: suspectedInAOI.size(),
    suspected_raster_hit_500m: countHits(suspectedHit500, 'hit_500m'),
    suspected_raster_hit_1000m: countHits(suspectedHit1000, 'hit_1000m'),

    reference_samples_count: referenceSamples.size(),
    reference_raster_hit_500m: countHits(referenceHit500, 'hit_500m'),

    non_reference_confirmed_in_aoi: nonReferenceConfirmed.size(),
    non_reference_confirmed_raster_hit_500m: countHits(nonReferenceConfirmedHit500, 'hit_500m'),
    non_reference_confirmed_raster_hit_1000m: countHits(nonReferenceConfirmedHit1000, 'hit_1000m'),

    controls_in_aoi: controlsInAOI.size(),
    controls_raster_hit_500m: countHits(controlsHit500, 'hit_500m'),
    controls_raster_hit_1000m: countHits(controlsHit1000, 'hit_1000m'),
    controls_hit_rate_500m: ee.Number(countHits(controlsHit500, 'hit_500m')).divide(controlsInAOI.size()),
    controls_hit_rate_1000m: ee.Number(countHits(controlsHit1000, 'hit_1000m')).divide(controlsInAOI.size())
  });
}


// ------------------------------------------------------------
// 6. HELD-OUT CONFIRMED RECALL
//    Hold out 20% of confirmed, use remaining pool to select
//    3 reference samples, then test whether held-out confirmed
//    are hit by the screening raster.
// ------------------------------------------------------------
function runHeldOutValidation(splitSeed) {
  var splitFc = confirmedCambodiaOnly.randomColumn('split_rand', splitSeed);

  var heldOutConfirmed = splitFc.filter(
    ee.Filter.gt('split_rand', ee.Number(1).subtract(holdoutFraction))
  );

  var trainingPool = splitFc.filter(
    ee.Filter.lte('split_rand', ee.Number(1).subtract(holdoutFraction))
  );

  var trainingReferences = trainingPool
    .randomColumn('ref_rand', 42)
    .sort('ref_rand')
    .limit(referenceLimit);

  var screen = buildEmbeddingScreen(trainingReferences);

  var heldOutHit500 = tagRasterHit(heldOutConfirmed, screen.cleanedPixels, hitBuffer500, 'hit_500m');
  var heldOutHit1000 = tagRasterHit(heldOutConfirmed, screen.cleanedPixels, hitBuffer1000, 'hit_1000m');

  var heldOutCount = heldOutConfirmed.size();
  var heldOutHit500Count = countHits(heldOutHit500, 'hit_500m');
  var heldOutHit1000Count = countHits(heldOutHit1000, 'hit_1000m');

  var aoiAreaM2 = aoi.area(1);

  return ee.Feature(null, {
    run_id: ee.String('heldout_seed_').cat(ee.Number(splitSeed).format()),
    validation_type: 'heldout_confirmed_recall',
    aoi_name: aoiName,
    year: year,
    split_seed: splitSeed,
    holdout_fraction: holdoutFraction,
    training_reference_count: trainingReferences.size(),
    heldout_confirmed_count: heldOutCount,

    sample_scale_m: sampleScale,
    threshold_percentile: thresholdPercentile,
    threshold_value: screen.thresholdValue,
    matched_area_m2: screen.matchedAreaM2,
    aoi_area_m2: aoiAreaM2,
    matched_area_share_of_aoi: ee.Number(screen.matchedAreaM2).divide(aoiAreaM2),

    heldout_confirmed_hit_500m: heldOutHit500Count,
    heldout_confirmed_hit_1000m: heldOutHit1000Count,
    heldout_confirmed_recall_500m: ee.Number(heldOutHit500Count).divide(heldOutCount),
    heldout_confirmed_recall_1000m: ee.Number(heldOutHit1000Count).divide(heldOutCount)
  });
}


// ------------------------------------------------------------
// 7. RUN VALIDATION
// ------------------------------------------------------------

// Reproduce current preferred screening summary
var currentReferenceSamples = confirmedCambodiaOnly
  .randomColumn('rand', 42)
  .sort('rand')
  .limit(referenceLimit);

var currentSummary = summarizeCurrentScreening(
  currentReferenceSamples,
  'CV_2024_full_ref3_p97_s20_validation_summary'
);

// Held-out repeated runs
var heldOutSummaries = ee.FeatureCollection(
  heldoutSeeds.map(function(seed) {
    return runHeldOutValidation(seed);
  })
);

// Merge into one exportable validation table
var validationSummary = ee.FeatureCollection([currentSummary]).merge(heldOutSummaries);

print('Validation summary table', validationSummary);
print('Current screening summary', currentSummary);
print('Held-out summaries', heldOutSummaries);


// ------------------------------------------------------------
// 8. OPTIONAL AGGREGATE HELD-OUT RECALL
// ------------------------------------------------------------
print(
  'Mean held-out recall within 500m',
  heldOutSummaries.aggregate_mean('heldout_confirmed_recall_500m')
);

print(
  'Mean held-out recall within 1000m',
  heldOutSummaries.aggregate_mean('heldout_confirmed_recall_1000m')
);


// ------------------------------------------------------------
// 9. EXPORT
// ------------------------------------------------------------
/*
Export.table.toDrive({
  collection: validationSummary,
  description: 'validation_summary_CambodiaVietnam_2024_p97',
  fileFormat: 'CSV'
});
*/

/*
Export.table.toAsset({
  collection: validationSummary,
  description: 'validation_summary_CambodiaVietnam_2024_p97',
  assetId: 'users/LevineLiu/0025analysis/validation_summary_CambodiaVietnam_2024_p97'
});
*/

// ============================================================
// 10. STAGE-2 REFINED VALIDATION (robust version)
//    Validate refined tiers directly from candidate_metrics asset
//    instead of relying on final summary asset geometry.
// ============================================================

// Read candidate metrics asset from Analysis 02
var candidateMetricsRefined = ee.FeatureCollection(
  'projects/casa0025wk6/assets/candidate_metrics_CambodiaVietnam_2024'
);

print('Candidate metrics rows', candidateMetricsRefined.size());
/*
print('Candidate metrics first feature', candidateMetricsRefined.first());
print('Candidate metrics first geometry', ee.Feature(candidateMetricsRefined.first()).geometry());
print('Candidate metrics first geometry type', ee.Feature(candidateMetricsRefined.first()).geometry().type());
print('Candidate metrics bounds sample', candidateMetricsRefined.geometry().bounds());
*/
// Rebuild the same tier logic used in Analysis 04
var refinedWithTier = candidateMetricsRefined.map(function(f) {
  var dNdbi = ee.Number(f.get('dNDBI_2021_2024'));
  var dNdvi = ee.Number(f.get('dNDVI_2021_2024'));
  var dNtl = ee.Number(f.get('dNTL_2021_2024'));
  var distBorder = ee.Number(f.get('dist_to_border_m'));

  var developmentFlag = dNdbi.gt(0).and(dNdvi.lt(0));
  var activityFlag = dNtl.gt(0);
  var nearBorderFlag = distBorder.lt(10000);

  var highPriority = developmentFlag.and(activityFlag);
  var mediumPriority = developmentFlag.or(activityFlag);

  var tier = ee.String(ee.Algorithms.If(
    highPriority, 'high',
    ee.Algorithms.If(mediumPriority, 'medium', 'low')
  ));

  return f.set({
    development_flag: developmentFlag,
    activity_flag: activityFlag,
    near_border_flag: nearBorderFlag,
    priority_tier: tier
  });
});

print('Refined table with rebuilt tiers', refinedWithTier.limit(5));


// ------------------------------------------------------------
// 10.1 Filter by tier
// ------------------------------------------------------------
var highTier = refinedWithTier.filter(ee.Filter.eq('priority_tier', 'high'));
var mediumTier = refinedWithTier.filter(ee.Filter.eq('priority_tier', 'medium'));
var lowTier = refinedWithTier.filter(ee.Filter.eq('priority_tier', 'low'));

print('High tier count', highTier.size());
print('Medium tier count', mediumTier.size());
print('Low tier count', lowTier.size());


// ------------------------------------------------------------
// 10.2 Generic overlap helper for vector candidate zones
// ------------------------------------------------------------
function tagVectorHit(pointsFc, candidateFc, bufferMeters, label) {
  return pointsFc.map(function(f) {
    var hit = candidateFc
      .filterBounds(f.geometry().buffer(bufferMeters))
      .size()
      .gt(0);

    return f.set(label, ee.Number(ee.Algorithms.If(hit, 1, 0)));
  });
}

function countVectorHits(fc, label) {
  return fc.filter(ee.Filter.eq(label, 1)).size();
}


// ------------------------------------------------------------
// 10.3 Rebuild non-reference confirmed set
// ------------------------------------------------------------
var currentReferenceSamples_refined = confirmedCambodiaOnly
  .randomColumn('rand', 42)
  .sort('rand')
  .limit(referenceLimit);

var referenceIds_refined = currentReferenceSamples_refined.aggregate_array('system:index');

var nonReferenceConfirmed_refined = confirmedInAOI.filter(
  ee.Filter.inList('system:index', referenceIds_refined).not()
);


// ------------------------------------------------------------
// 10.4 Summarize refined-layer performance for one tier
// ------------------------------------------------------------
function summarizeTierValidation(candidateFc, tierName) {
  var suspectedHit500 = tagVectorHit(suspectedInAOI, candidateFc, hitBuffer500, 'hit_500m');
  var suspectedHit1000 = tagVectorHit(suspectedInAOI, candidateFc, hitBuffer1000, 'hit_1000m');

  var confirmedHit500 = tagVectorHit(nonReferenceConfirmed_refined, candidateFc, hitBuffer500, 'hit_500m');
  var confirmedHit1000 = tagVectorHit(nonReferenceConfirmed_refined, candidateFc, hitBuffer1000, 'hit_1000m');

  var controlsHit500 = tagVectorHit(controlsInAOI, candidateFc, hitBuffer500, 'hit_500m');
  var controlsHit1000 = tagVectorHit(controlsInAOI, candidateFc, hitBuffer1000, 'hit_1000m');

  return ee.Feature(null, {
    run_id: ee.String('refined_validation_').cat(tierName),
    validation_type: 'refined_layer_validation',
    aoi_name: aoiName,
    year: year,
    tier_name: tierName,
    candidate_count: candidateFc.size(),

    suspected_in_aoi: suspectedInAOI.size(),
    suspected_hit_500m: countVectorHits(suspectedHit500, 'hit_500m'),
    suspected_hit_1000m: countVectorHits(suspectedHit1000, 'hit_1000m'),
    suspected_hit_rate_500m: ee.Number(countVectorHits(suspectedHit500, 'hit_500m')).divide(suspectedInAOI.size()),
    suspected_hit_rate_1000m: ee.Number(countVectorHits(suspectedHit1000, 'hit_1000m')).divide(suspectedInAOI.size()),

    non_reference_confirmed_in_aoi: nonReferenceConfirmed_refined.size(),
    non_reference_confirmed_hit_500m: countVectorHits(confirmedHit500, 'hit_500m'),
    non_reference_confirmed_hit_1000m: countVectorHits(confirmedHit1000, 'hit_1000m'),
    non_reference_confirmed_hit_rate_500m: ee.Number(countVectorHits(confirmedHit500, 'hit_500m')).divide(nonReferenceConfirmed_refined.size()),
    non_reference_confirmed_hit_rate_1000m: ee.Number(countVectorHits(confirmedHit1000, 'hit_1000m')).divide(nonReferenceConfirmed_refined.size()),

    controls_in_aoi: controlsInAOI.size(),
    controls_hit_500m: countVectorHits(controlsHit500, 'hit_500m'),
    controls_hit_1000m: countVectorHits(controlsHit1000, 'hit_1000m'),
    controls_hit_rate_500m: ee.Number(countVectorHits(controlsHit500, 'hit_500m')).divide(controlsInAOI.size()),
    controls_hit_rate_1000m: ee.Number(countVectorHits(controlsHit1000, 'hit_1000m')).divide(controlsInAOI.size())
  });
}


// ------------------------------------------------------------
// 10.5 Run refined validation by tier
// ------------------------------------------------------------
var highSummary = summarizeTierValidation(highTier, 'high');
var mediumSummary = summarizeTierValidation(mediumTier, 'medium');
var lowSummary = summarizeTierValidation(lowTier, 'low');
var allRefinedSummary = summarizeTierValidation(refinedWithTier, 'all_refined');

var refinedValidationSummary = ee.FeatureCollection([
  highSummary,
  mediumSummary,
  lowSummary,
  allRefinedSummary
]);

print('Refined validation summary', refinedValidationSummary);

var suspectedHit500_debug = tagVectorHit(suspectedInAOI, refinedWithTier, hitBuffer500, 'hit_500m');
print('Debug suspected hit sample', suspectedHit500_debug.limit(5));

print(
  'Debug all_refined suspected hits 500m',
  countVectorHits(suspectedHit500_debug, 'hit_500m')
);

// ------------------------------------------------------------
// 10.6 Export refined validation only
// ------------------------------------------------------------
/*
Export.table.toDrive({
  collection: refinedValidationSummary,
  description: 'refined_validation_summary_CambodiaVietnam_2024_1',
  fileFormat: 'CSV'
});

Export.table.toAsset({
  collection: refinedValidationSummary,
  description: 'refined_validation_summary_CambodiaVietnam_2024',
  assetId: 'projects/casa0025wk6/assets/refined_validation_summary_CambodiaVietnam_2024'
});
*/