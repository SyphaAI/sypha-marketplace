---
name: bigquery-ai-ml
description: >-
  Uses BigQuery's native machine learning and GenAI features for advanced
  data analytics. Use when writing SQL queries that perform time-series
  forecasting, detect outliers, or apply generative AI capabilities in
  BigQuery.
metadata:
  category: data
  source:
    repository: 'https://github.com/google/skills'
    path: skills/cloud/bigquery-ai-ml
    license_path: LICENSE
    commit: 28d90a333c4d900bcc76e498363e0c835dc69a5c
---

# BigQuery AI & ML

BigQuery connects with Vertex AI to expose machine learning and generative AI
capabilities directly inside SQL queries through built-in functions such as
`AI.FORECAST`, `AI.DETECT_ANOMALIES`, and `AI.GENERATE`.

## Reference Directory

-   [AI Forecast](references/ai_forecast.md): Using the pre-trained
    TimesFM model to generate forecasts without training a custom model.

-   [AI Detect Anomalies](references/ai_detect_anomalies.md): Spotting
    deviations in time series data with the pre-trained TimesFM model.

-   [AI Generate](references/ai_generate.md): General-purpose text and
    content generation powered by Gemini models.

## Related Skills

- [BigQuery Basics Skill](../bigquery-basics):
  SKILL.md file covering core BigQuery concepts, resource management, CLI,
  and client libraries.
