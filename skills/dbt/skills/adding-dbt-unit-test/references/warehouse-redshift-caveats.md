# Caveats for Redshift

## Unit test limitations for Redshift

- Redshift does not support unit tests when the SQL inside a common table expression (CTE) includes functions such as `LISTAGG`, `MEDIAN`, `PERCENTILE_CONT`, and similar. These functions require execution against a user-created table. Because dbt injects the provided rows as part of the CTE, Redshift cannot process them.

  To support this pattern in the future, dbt would need to "materialize" the input fixtures as tables rather than interpolating them as CTEs. This enhancement is tracked in GitHub issue #8499.

- Redshift does not support unit tests where the sources reside in a different database than the models. Sources in Redshift must exist in the same database as the models.
