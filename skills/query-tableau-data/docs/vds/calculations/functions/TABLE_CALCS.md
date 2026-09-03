## Table Calculation Functions

Table calculation functions compute values across rows in a table (the result set from a query). Each function operates row by row within a **partition** — a group of rows scoped by the calculation definition.

### VDS Usage Constraint

**In VDS, all table calculation functions must be wrapped in the `tableCalculation` object — function syntax cannot be placed directly in a `calculation` string.** The `tableCalcType` field determines which operation is performed. Raw function syntax (e.g., `RUNNING_SUM(SUM([Sales]))`) is valid only when `tableCalcType` is set to `"CUSTOM"`.

Requires **Tableau >= 2025.3**.

> **For the full `tableCalculation` object schema, partitioning semantics, and worked examples for each type, see [TABLE_CALCULATIONS.md](../TABLE_CALCULATIONS.md).**

---

## Table calculation functions

### FIRST()

Returns the row offset from the current row back to the first row in the partition.

#### Example

When the current row index is 3, `FIRST() = -2`.

---

### INDEX()

Returns the position of the current row within the partition, independent of any value-based ordering. Indexing begins at 1.

#### Example

For the third row in the partition, `INDEX() = 3`.

---

### LAST()

Returns the row offset from the current row to the last row in the partition.

#### Example

When the current row index is 3 of 7, `LAST() = 4`.

---

### LOOKUP(expression, [offset])

Retrieves the value of the expression from a target row identified by a relative offset from the current row. Use `FIRST()+n` and `LAST()-n` to reference offsets from the first or last rows in the partition. When `offset` is omitted, the comparison row is set on the field itself. Returns NULL if the target row cannot be resolved.

#### Example

`LOOKUP(SUM([Profit]), FIRST()+2)` computes the SUM(Profit) in the third row of the partition.

---

### PREVIOUS_VALUE(expression)

Returns the result of this calculation from the preceding row. If the current row is the first in the partition, the given expression is returned instead.

#### Example

`SUM([Profit]) * PREVIOUS_VALUE(1)` computes the running product of SUM(Profit).

---

### RANK(expression, ['asc' | 'desc'])

Returns the standard competition rank of the current row within the partition. Tied values receive the same rank. The default sort order is descending.

With this function, the set of values (6, 9, 9, 14) would be ranked (4, 2, 2, 1).

Ranking functions exclude null values. Nulls are not assigned a rank and are not factored into the total record count for percentile rank calculations.

> In VDS, use `tableCalcType: "RANK"` in the `tableCalculation` object rather than calling `RANK()` directly in a calculation string.

#### Example

`RANK(SUM([Profit]))` ranks each row by sum of profit, descending, with gaps for ties.

---

### RANK_DENSE(expression, ['asc' | 'desc'])

Returns the dense rank of the current row in the partition. Tied values receive the same rank, but the ranking sequence contains no gaps. The default sort order is descending.

With this function, the set of values (6, 9, 9, 14) would be ranked (3, 2, 2, 1).

Nulls are ignored in ranking functions.

---

### RANK_MODIFIED(expression, ['asc' | 'desc'])

Returns the modified competition rank of the current row within the partition. Tied values receive the same rank. The default sort order is descending.

With this function, the set of values (6, 9, 9, 14) would be ranked (4, 3, 3, 1).

Nulls are ignored in ranking functions.

---

### RANK_PERCENTILE(expression, ['asc' | 'desc'])

Returns the percentile rank of the current row within the partition. The default sort order is ascending.

With this function, the set of values (6, 9, 9, 14) would be ranked (0.00, 0.67, 0.67, 1.00).

Nulls are ignored in ranking functions.

> In VDS, use `tableCalcType: "PERCENTILE"` in the `tableCalculation` object.

---

### RANK_UNIQUE(expression, ['asc' | 'desc'])

Returns a unique rank for the current row within the partition. Tied values are assigned distinct ranks. The default sort order is descending.

With this function, the set of values (6, 9, 9, 14) would be ranked (4, 2, 3, 1).

Nulls are ignored in ranking functions.

---

### RUNNING_AVG(expression)

Computes the cumulative average of the specified expression from the first row in the partition through the current row.

> In VDS, use `tableCalcType: "RUNNING_TOTAL"` with the appropriate aggregation in the `tableCalculation` object.

#### Example

`RUNNING_AVG(SUM([Profit]))` computes the running average of SUM(Profit).

---

### RUNNING_COUNT(expression)

Computes the cumulative count of the specified expression from the first row in the partition through the current row.

#### Example

`RUNNING_COUNT(SUM([Profit]))` computes the running count of SUM(Profit).

---

### RUNNING_MAX(expression)

Computes the cumulative maximum of the specified expression from the first row in the partition through the current row.

#### Example

`RUNNING_MAX(SUM([Profit]))` computes the running maximum of SUM(Profit).

---

### RUNNING_MIN(expression)

Computes the cumulative minimum of the specified expression from the first row in the partition through the current row.

#### Example

`RUNNING_MIN(SUM([Profit]))` computes the running minimum of SUM(Profit).

---

### RUNNING_SUM(expression)

Computes the cumulative sum of the specified expression from the first row in the partition through the current row.

#### Example

`RUNNING_SUM(SUM([Profit]))` computes the running sum of SUM(Profit).

---

### SIZE()

Returns the total row count within the partition.

#### Example

`SIZE() = 5` when the current partition contains five rows.

---

### TOTAL(expression)

Returns the aggregate total of the given expression across the full table calculation partition, irrespective of the current row position.

> In VDS, use `tableCalcType: "PERCENT_OF_TOTAL"` or `"PERCENT_FROM"` in the `tableCalculation` object for total-based calculations.

#### Example

`TOTAL(SUM([Sales]))` returns the sum of all Sales values within the partition.

---

### WINDOW_AVG(expression, [start, end])

Returns the average of the expression over the specified window. The window boundaries are defined as offsets relative to the current row. Use `FIRST()+n` and `LAST()-n` to reference offsets from the partition's first or last row. When start and end are omitted, the entire partition is used.

> In VDS, use `tableCalcType: "MOVING_CALCULATION"` for windowed aggregations.

#### Example

`WINDOW_AVG(SUM([Profit]), -2, 0)` returns the window average of SUM(Profit) from the two previous rows to the current row.

---

### WINDOW_CORR(expression1, expression2, [start, end])

Returns the Pearson correlation coefficient for two expressions over the specified window. Values range from -1 to +1, where 1 indicates a perfect positive linear relationship, 0 indicates no linear relationship, and -1 indicates a perfect negative relationship. When start and end are omitted, the entire partition is used.

> Note: The aggregate equivalent `CORR` is not supported in VDS. `WINDOW_CORR` is only available via `tableCalcType: "CUSTOM"` with a `tableCalculation` wrapper.

#### Example

`WINDOW_CORR(SUM([Profit]), SUM([Sales]), -5, 0)` returns the Pearson correlation of SUM(Profit) and SUM(Sales) from the five previous rows to the current row.

---

### WINDOW_COUNT(expression, [start, end])

Returns the count of the expression over the specified window. When start and end are omitted, the entire partition is used.

#### Example

`WINDOW_COUNT(SUM([Profit]), FIRST()+1, 0)` computes the count of SUM(Profit) from the second row to the current row.

---

### WINDOW_COVAR(expression1, expression2, [start, end])

Returns the *sample covariance* of two expressions over the specified window. Applies n-1 normalization, which is appropriate when working with a random sample drawn from a larger population. When start and end are omitted, the entire partition is used.

> Note: The aggregate equivalent `COVAR` is not supported in VDS. `WINDOW_COVAR` is only available via `tableCalcType: "CUSTOM"` with a `tableCalculation` wrapper.

#### Example

`WINDOW_COVAR(SUM([Profit]), SUM([Sales]), -2, 0)` returns the sample covariance from the two previous rows to the current row.

---

### WINDOW_COVARP(expression1, expression2, [start, end])

Returns the *population covariance* of two expressions over the specified window. Applies n normalization, which is appropriate when the data represents the full population. When start and end are omitted, the entire partition is used.

> Note: The aggregate equivalent `COVARP` is not supported in VDS. `WINDOW_COVARP` is only available via `tableCalcType: "CUSTOM"` with a `tableCalculation` wrapper.

#### Example

`WINDOW_COVARP(SUM([Profit]), SUM([Sales]), -2, 0)` returns the population covariance from the two previous rows to the current row.

---

### WINDOW_MEDIAN(expression, [start, end])

Returns the median of the expression over the specified window. When start and end are omitted, the entire partition is used.

#### Example

`WINDOW_MEDIAN(SUM([Profit]), FIRST()+1, 0)` computes the median of SUM(Profit) from the second row to the current row.

---

### WINDOW_MAX(expression, [start, end])

Returns the maximum of the expression over the specified window. When start and end are omitted, the entire partition is used.

#### Example

`WINDOW_MAX(SUM([Profit]), FIRST()+1, 0)` computes the maximum of SUM(Profit) from the second row to the current row.

---

### WINDOW_MIN(expression, [start, end])

Returns the minimum of the expression over the specified window. When start and end are omitted, the entire partition is used.

#### Example

`WINDOW_MIN(SUM([Profit]), FIRST()+1, 0)` computes the minimum of SUM(Profit) from the second row to the current row.

---

### WINDOW_PERCENTILE(expression, number, [start, end])

Returns the value at the specified percentile within the window. When start and end are omitted, the entire partition is used.

#### Example

`WINDOW_PERCENTILE(SUM([Profit]), 0.75, -2, 0)` returns the 75th percentile for SUM(Profit) from the two previous rows to the current row.

---

### WINDOW_STDEV(expression, [start, end])

Returns the sample standard deviation of the expression over the specified window. When start and end are omitted, the entire partition is used.

#### Example

`WINDOW_STDEV(SUM([Profit]), FIRST()+1, 0)` computes the standard deviation of SUM(Profit) from the second row to the current row.

---

### WINDOW_STDEVP(expression, [start, end])

Returns the biased (population) standard deviation of the expression over the specified window. When start and end are omitted, the entire partition is used.

> Note: The aggregate equivalent `STDEVP` is not supported in VDS. `WINDOW_STDEVP` is only available via `tableCalcType: "CUSTOM"` with a `tableCalculation` wrapper.

#### Example

`WINDOW_STDEVP(SUM([Profit]), FIRST()+1, 0)` computes the biased standard deviation of SUM(Profit) from the second row to the current row.

---

### WINDOW_SUM(expression, [start, end])

Returns the sum of the expression over the specified window. When start and end are omitted, the entire partition is used.

#### Example

`WINDOW_SUM(SUM([Profit]), FIRST()+1, 0)` computes the sum of SUM(Profit) from the second row to the current row.

---

### WINDOW_VAR(expression, [start, end])

Returns the sample variance of the expression over the specified window. When start and end are omitted, the entire partition is used.

#### Example

`WINDOW_VAR(SUM([Profit]), FIRST()+1, 0)` computes the variance of SUM(Profit) from the second row to the current row.

---

### WINDOW_VARP(expression, [start, end])

Returns the biased (population) variance of the expression over the specified window. When start and end are omitted, the entire partition is used.

> Note: The aggregate equivalent `VARP` is not supported in VDS. `WINDOW_VARP` is only available via `tableCalcType: "CUSTOM"` with a `tableCalculation` wrapper.

#### Example

`WINDOW_VARP(SUM([Profit]), FIRST()+1, 0)` computes the biased variance of SUM(Profit) from the second row to the current row.
