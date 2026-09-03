<!--
SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
SPDX-License-Identifier: CC-BY-4.0
-->

# cuDF Microbenchmarks

Measures fine-grained CPU vs. GPU performance on in-memory data without the overhead of Spark.

## Contents
- [ ] Implement MicroBenchRunner
- [ ] Run microbenchmarks

## Implement MicroBenchRunner

Complete the three TODO methods by following the inline docstrings.

## Run Microbenchmarks

Generate data first (reuse the output from GenData), then run:
```bash
./run_micro_benchmark.sh --mode all --data-path data/bench_data_<rows>_rows.parquet --rows <rows>
```

Note that the specified row count will be coalesced into a single cuDF table.
A large table size (>1GB) produces more pronounced GPU performance gains.

## Next Steps

To profile and iteratively tune GPU performance, use the **udf-optimize-cudf** skill.
