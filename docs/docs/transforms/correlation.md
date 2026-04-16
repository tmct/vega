---
layout: transform
title: Correlation Transform
permalink: /docs/transforms/correlation/index.html
---

The **correlation** transform computes the [Pearson correlation coefficient](https://en.wikipedia.org/wiki/Pearson_correlation_coefficient) between two numeric fields, producing a single coefficient per group. An optional per-row _weight_ field selects a [weighted Pearson correlation](https://en.wikipedia.org/wiki/Pearson_correlation_coefficient#Weighted_correlation_coefficient); when omitted, each row is treated as having weight 1 and the result is the standard unweighted coefficient.

For fitted trend lines rather than a summary coefficient, see the [regression](../regression) transform, which accepts the same optional _weight_ parameter for weighted least squares.

## Transform Parameters

| Property            | Type                           | Description   |
| :------------------ | :----------------------------: | :------------ |
| x                   | {% include type t="Field" %}   | {% include required %} The data field for the first variable.|
| y                   | {% include type t="Field" %}   | {% include required %} The data field for the second variable.|
| weight              | {% include type t="Field" %}   | An optional data field of per-row weights. When specified, the weighted Pearson correlation is computed. Rows with negative weights are ignored with a warning.|
| groupby             | {% include type t="Field[]" %} | The data fields to group by. If not specified, a single group containing all data objects will be used.|
| as                  | {% include type t="String[]" %}| The output field name for the correlation coefficient. The default is `["corr"]`.|

## Output

The transform emits one data object per group. Each object contains the group-by fields and the correlation coefficient (named `corr` by default, or as configured via _as_). Groups with zero total weight or with zero variance in either field emit a `null` coefficient.

## Usage

### Unweighted Correlation

Compute the lag-1 autocorrelation of daily maximum temperature — i.e. the Pearson correlation between today's `temp_max` and yesterday's (`temp_yesterday`, produced upstream with a `window` lag transform):

```json
{
  "type": "correlation",
  "x": "temp_yesterday",
  "y": "temp_max"
}
```

### Grouped Correlation

Break the same autocorrelation out by month to see how day-to-day temperature persistence varies across the year:

```json
{
  "type": "correlation",
  "x": "temp_yesterday",
  "y": "temp_max",
  "groupby": ["month"],
  "as": ["corr"]
}
```

The resulting stream has one object per month with a `corr` field carrying the correlation coefficient. Add an optional `"weight": "<field>"` to switch to a weighted Pearson coefficient (for example, to emphasize days with larger temperature swings).
