---
layout: example
title: Correlation Example
permalink: /examples/correlation/index.html
spec: correlation
image: /examples/img/correlation.png
---

The [`correlation`](../../docs/transforms/correlation) transform reduces two numeric fields to a single [Pearson correlation coefficient](https://en.wikipedia.org/wiki/Pearson_correlation_coefficient), one per group. This example uses the Seattle weather dataset to compute the autocorrelation of daily maximum temperature at lags of 1, 3, and 6 days, broken out by month. Day-to-day temperature persistence is positive year-round but decays with lag — and the rate of decay varies through the year as synoptic-scale weather systems turn over. For fitted trend lines instead of a summary coefficient, see the [regression](../regression) example.

{% include example spec=page.spec %}
