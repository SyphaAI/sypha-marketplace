# BigQuery Core Concepts

BigQuery is a fully managed, AI-ready data platform for managing and analyzing
data using built-in capabilities such as machine learning, search, geospatial
analysis, and business intelligence. Its serverless architecture lets teams
use languages like SQL and Python to answer their most demanding analytical
questions without managing any infrastructure.

BigQuery offers a unified interface for both structured and unstructured data
and supports open table formats such as Apache Iceberg. Streaming ingestion
enables continuous data intake and analysis, while BigQuery's scalable,
distributed analysis engine can query terabytes in seconds and petabytes in
minutes.

## Architecture

BigQuery's architecture decouples compute from storage and links them via a
petabit-scale network.

-   **BigQuery Storage:** A columnar storage format tuned for analytical
    queries. Data can be replicated across multiple locations for high
    availability.

-   **BigQuery Analytics:** A scalable, distributed analysis engine capable of
    processing data stored in BigQuery as well as data from external sources.

## Resource Hierarchy

BigQuery arranges resources within a structured hierarchy:

1.  **Organization/Folder/Project:** Standard Google Cloud resource containers.
2.  **Dataset:** The primary container for tables and views.
3.  **Table/View:** The fundamental unit of data storage and logical representation.

## Analytics Workflows

-   **Ad Hoc Analysis:** Running interactive queries with GoogleSQL.

-   **Geospatial Analysis:** Processing and visualizing spatial data through
    geography types.

-   **Machine Learning (BigQuery ML):** Building and running ML models
    entirely within BigQuery using SQL statements.

-   **Gemini in BigQuery:** AI-assisted support for data preparation, SQL
    generation, and visualization. See the [Gemini
    Models](https://ai.google.dev/gemini-api/docs/models) page for details.

-   **Stream Processing (BigQuery continuous queries):** Persistent SQL
    statements that analyze and transform incoming data in near real time as it
    lands in BigQuery. This feature supports unbounded streaming pipelines for
    real-time AI inference (via Vertex AI) and Reverse ETL to downstream
    systems. Results may be directed to Pub/Sub, Bigtable, Spanner, or
    additional BigQuery tables. Note that continuous queries require a BigQuery
    reservation with a `CONTINUOUS` assignment type.

## BigQuery Studio

A unified workspace for data engineering, analysis, and predictive modeling.

-   **SQL Editor:** Includes code completion and generation capabilities.

-   **Python Notebooks:** Native support for Colab Enterprise and BigQuery
    DataFrames (BigFrames).

-   **Data Discovery:** Integrated with Dataplex for dataset search and
    profiling.

## Pricing

BigQuery charges are split across two main components: compute (analysis) costs
and storage costs.

-   **Storage:** Fees are determined by the volume of data held in BigQuery
    tables. Storage falls into two tiers: active storage (any table or partition
    modified within the past 90 days) and long-term storage (data unchanged for
    90 consecutive days, which receives a price reduction of roughly 50%).

-   **Analysis:** Charged according to bytes processed (On-demand) or the
    number of dedicated slots reserved (Capacity/Reservations).

For up-to-date pricing details, visit: [BigQuery
Pricing](https://cloud.google.com/bigquery/pricing).
