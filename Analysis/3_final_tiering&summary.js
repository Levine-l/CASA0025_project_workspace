// ============================================================
// CASA0025 - Analysis 03 (Optimized to prevent Timeout)
// Purpose: Final Tiering and Summary Table using pre-calculated metrics
// ============================================================

// 1. Import the results from Analysis 02 (which already contains the Deltas)
var candidateMetrics = ee.FeatureCollection(
  'projects/casa0025wk6/assets/candidate_metrics_CambodiaVietnam_2024'
);

var aoiName = 'CambodiaVietnam';

// 2. Final Risk Classification (Tiering)
// Since 02 already calculated the Deltas, we just apply the logic here.
var finalSummary = candidateMetrics.map(function(f) {
  // Extract pre-calculated deltas from your 02 Asset
  var dNdbi = ee.Number(f.get('dNDBI_2021_2024'));
  var dNdvi = ee.Number(f.get('dNDVI_2021_2024'));
  var dNtl = ee.Number(f.get('dNTL_2021_2024'));
  var ntl2024 = ee.Number(f.get('NTL_2024'));
  var distConfirmed = ee.Number(f.get('dist_to_confirmed_m'));
  var distBorder = ee.Number(f.get('dist_to_border_m'));

  // Define Logic Flags
  var developmentFlag = dNdbi.gt(0).and(dNdvi.lt(0));
  var activityFlag = dNtl.gt(0);
  var nearBorderFlag = distBorder.lt(10000);

  // High Priority: Development + Activity
  var mediumPriority = developmentFlag.or(activityFlag);
  var highPriority = developmentFlag.and(activityFlag);
  var operationalHighFlag = highPriority
    .and(distConfirmed.lt(5000))
    .and(ntl2024.gt(5))
    .and(dNtl.gt(0));

  var tier = ee.String(ee.Algorithms.If(highPriority, 'high',
                ee.Algorithms.If(mediumPriority, 'medium', 'low')));
  var operationalTier = ee.String(ee.Algorithms.If(
    operationalHighFlag,
    'operational_high',
    tier
  ));

  return f.set({
    'development_flag': developmentFlag,
    'activity_flag': activityFlag,
    'near_border_flag': nearBorderFlag,
    'priority_tier': tier,
    'operational_high_flag': operationalHighFlag,
    'operational_priority_tier': operationalTier
  });
});

// 3. Field Cleanup for the Final Professional Report
var finalColumns = [
  'candidate_id', 'priority_tier', 'area_sqm', 'dist_to_border_m', 
  'dist_to_confirmed_m', 'NTL_2024', 'dNDVI_2021_2024', 'dNDBI_2021_2024', 
  'dNTL_2021_2024', 'development_flag', 'activity_flag', 'near_border_flag',
  'operational_high_flag', 'operational_priority_tier'
];
var finalExportTable = finalSummary.select(finalColumns);

// This will now print instantly because it's just a table, no heavy image math!
print('Final Table Preview (Instantly Computed)', finalExportTable.limit(10));

// 4. Export Final Summary Table
/*
Export.table.toDrive({
  collection: finalExportTable,
  description: 'Final_Scam_Candidate_Summary_Table',
  fileFormat: 'CSV'
});

Export.table.toAsset({
  collection: finalExportTable,
  description: 'Final_Summary_Table_Asset',
  assetId: 'projects/casa0025wk6/assets/Final_Summary_Table_Complete'
});
*/