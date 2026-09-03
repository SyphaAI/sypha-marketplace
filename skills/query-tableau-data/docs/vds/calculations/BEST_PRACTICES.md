## Best Practices for Creating Calculations in Tableau

This article outlines tips and guidelines for writing efficient calculations in Tableau. These recommendations are intended to help you improve workbook performance. For additional ways to enhance workbook performance, refer to the Optimize Workbook Performance series.

## General Rule: Avoid using a calculated field multiple times in another calculation

Referencing the same calculated field more than once inside another calculation leads to performance degradation. When nesting calculations (i.e., using one calculated field inside another), try to reference it only once.

Note that referencing a terminal field (a direct data source field) multiple times within a calculation does not degrade performance.

### Example

Suppose you create a calculated field that uses a complex multi-line calculation to extract mentions, or Twitter handles, from tweets. The calculated field is named Twitter Handle. Each returned handle begins with the '@' symbol (for example: @user).

For your analysis, you want to strip out the '@' symbol.

You can use the following calculation to remove the first character from the string:

`RIGHT([Twitter Handle], LEN([Twitter Handle]) -1)`

This calculation is straightforward. However, because it references the Twitter Handle calculation twice, it executes that calculation twice for each record in your data source: once for the RIGHT function and again for the LEN function.

To avoid computing the same calculation more than once, rewrite it so that Twitter Handle is referenced only a single time. In this example, MID achieves the same result:

`MID([Twitter Handle], 2)`

## Tip 1: Convert multiple equality comparisons to a CASE expression or a group

Consider the following calculation, which references the calculated field Person (calc) repeatedly and uses a chain of OR operators. Although this is a straightforward logical expression, it causes query performance issues because it evaluates Person (calc) at least ten times.

`IF [Person (calc)] = 'Henry Wilson'
OR [Person (calc)] = 'Jane Johnson'
OR [Person (calc)] = 'Michelle Kim'
OR [Person (calc)] = 'Fred Suzuki'
OR [Person (calc)] = 'Alan Wang'
THEN 'Lead'
ELSEIF [Person (calc)] = 'Susan Nguyen'
OR [Person (calc)] = 'Laura Rodriguez'
OR [Person (calc)] = 'Ashley Garcia'
OR [Person (calc)] = 'Andrew Smith'
OR [Person (calc)] = 'Adam Davis'
THEN 'IC'
END`

Instead of chaining equality comparisons, consider one of the following alternatives.

### Solution 1

Use a CASE expression. For example:

`CASE [Person (calc)]
WHEN 'Henry Wilson' THEN 'Lead'
WHEN 'Jane Johnson' THEN 'Lead'
WHEN 'Michelle Kim' THEN 'Lead'
WHEN 'Fred Suzuki' THEN 'Lead'
WHEN 'Alan Wang' THEN 'Lead'

WHEN 'Susan Nguyen' THEN 'IC'
WHEN 'Laura Rodriguez' THEN 'IC'
WHEN 'Ashley Garcia' THEN 'IC'
WHEN 'Andrew Smith' THEN 'IC'
WHEN 'Adam Davis' THEN 'IC'
END`

In this version, the calculated field Person (calc) is referenced only once and evaluated a single time. CASE expressions are also further optimized within the query pipeline, providing an additional performance benefit.

### Solution 2

Create a group rather than a calculated field. For more information, see Group Your Data.

## Tip 2: Convert multiple string calculations into a single REGEXP expression

> **VDS Note**: REGEXP functions are only available when the underlying published data source uses a supported connector (Text File, Hadoop Hive, Google BigQuery, PostgreSQL, Tableau Data Extract, Microsoft Excel, Salesforce, Vertica, Pivotal Greenplum, Teradata 14.1+, Snowflake, Oracle). If the data source does not support REGEXP, this optimization cannot be used in a VDS `calculation` field.



### Example 1: CONTAINS

Consider the following calculation, which references the calculated field Category (calc) multiple times. Although it is a simple logical expression, it degrades query performance by evaluating Category (calc) repeatedly.

`IF CONTAINS([Segment (calc)],'UNKNOWN')
OR CONTAINS([Segment (calc)],'LEADER')
OR CONTAINS([Segment (calc)],'ADVERTISING')
OR CONTAINS([Segment (calc)],'CLOSED')
OR CONTAINS([Segment (calc)],'COMPETITOR')
OR CONTAINS([Segment (calc)],'REPEAT')
THEN 'UNKNOWN'
ELSE [Segment (calc)] END`

A REGEXP expression can produce the same output with far less repetition.

#### Solution

`IF REGEXP_MATCH([Segment (calc)], 'UNKNOWN|LEADER|ADVERTISING|CLOSED|COMPETITOR|REPEAT') THEN 'UNKNOWN'
ELSE [Segment (calc)] END`



The same REGEXP approach applies to string calculations that follow a similar pattern.

### Example 2: STARTSWITH

`IF STARTSWITH([Segment (calc)],'UNKNOWN')
OR STARTSWITH([Segment (calc)],'LEADER')
OR STARTSWITH([Segment (calc)],'ADVERTISING')
OR STARTSWITH([Segment (calc)],'CLOSED')
OR STARTSWITH([Segment (calc)],'COMPETITOR')
OR STARTSWITH([Segment (calc)],'REPEAT')
THEN 'UNKNOWN'`

#### Solution

`IF REGEXP_MATCH([Segment (calc)], '^(UNKNOWN|LEADER|ADVERTISING|CLOSED|COMPETITOR|REPEAT)') THEN 'UNKNOWN'
ELSE [Segment (calc)] END`

Note that the '^' symbol is used in this solution.

### Example 3: ENDSWITH

`IF ENDSWITH([Segment (calc)],'UNKNOWN')
OR ENDSWITH([Segment (calc)],'LEADER')
OR ENDSWITH([Segment (calc)],'ADVERTISING')
OR ENDSWITH([Segment (calc)],'CLOSED')
OR ENDSWITH([Segment (calc)],'COMPETITOR')
OR ENDSWITH([Segment (calc)],'REPEAT')
THEN 'UNKNOWN'
ELSE [Segment (calc)] END`

#### Solution

`IF REGEXP_MATCH([Segment (calc)], '(UNKNOWN|LEADER|ADVERTISING|CLOSED|COMPETITOR|REPEAT)$') THEN 'UNKNOWN'
ELSE [Segment (calc)] END`

Note that the '$' symbol is used in this solution.

## Tip 3: Manipulate strings with REGEXP instead of LEFT, MID, RIGHT, FIND, LEN

Regular expressions are a powerful tool. When performing complex string manipulation, consider using them — in many cases, a regular expression yields a shorter and more efficient calculation.

> **VDS Note**: See the connector restrictions in Tip 2 above — REGEXP is only usable if your data source supports it.

### Example 1

Consider the following calculation, which strips protocols from URLs. For example: "https://www.tableau.com" becomes "www.tableau.com".

`IF (STARTSWITH([Server], "http://")) THEN
MID([Server], Len("http://") + 1)
ELSEIF(STARTSWITH([Server], "https://")) THEN
MID([Server], Len("https://") + 1)
ELSEIF(STARTSWITH([Server], "tcp:")) THEN
MID([Server], Len("tcp:") + 1)
ELSEIF(STARTSWITH([Server], "\\")) THEN
MID([Server], Len("\\") + 1)
ELSE [Server]
END`

#### Solution

You can simplify the calculation and improve performance using a REGEXP\_REPLACE function.

`REGEXP_REPLACE([Server], "^(http://|https://|tcp:|\\\\)", "")`

### Example 2

Consider the following calculation, which returns the second segment of an IPv4 address. For example: "172.16.0.1" becomes "16".

`IF (FINDNTH([Server], ".", 2) > 0) THEN
MID([Server],
FIND([Server], ".") + 1,
FINDNTH([Server], ".", 2) - FINDNTH([Server], ".", 1) - 1
)
END`

#### Solution

You can simplify the calculation and improve performance using a REGEXP\_EXTRACT function.

`REGEXP_EXTRACT([Server], "\.([^\.]*)\.")`
