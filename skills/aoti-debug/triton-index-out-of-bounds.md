# AOTI Triton Index Out of Bounds Debug Guide

Apply this guide to investigate AOTI Triton kernel assertion failures that match the `index out of bounds` pattern.

## Error Pattern

Consult this guide when errors such as the following appear:

```
/var/tmp/torchinductor_*/.../*.py:NN: unknown: block: [X,Y,Z], thread: [X,Y,Z]
Assertion `index out of bounds: 0 <= tmpN < ksM` failed.
```

### Key Information from Error

| Field | Value | Meaning |
|-------|-------|---------|
| File Path | `/var/tmp/torchinductor_*/*.py` | The generated Triton kernel file (runtime) |
| Line Number | `:NN` | Line of the generated kernel where the assertion failed |
| Block/Thread | `[X,Y,Z]` | The CUDA block and thread indices |
| Assertion | `0 <= tmpN < ksM` | The index `tmpN` has to fall within `[0, ksM)` |

### Understanding the Assertion

- `tmpN`: An index value calculated within the Triton kernel
- `ksM`: A dynamic kernel size parameter resolved at runtime
- The assertion fires when `tmpN < 0` or `tmpN >= ksM`

---

## Step 1: Collect AOTI Package

The compiled AOTI package must be available. It is typically a `.pt2` package or an extracted archive that contains a `wrapper.cpp` file.

**Key File**: Inside `*.wrapper.cpp` you will find:
- The complete Triton kernel source code (embedded as comments)
- Kernel launch configurations
- Input/output tensor mappings
- Definitions of dynamic shape variables

---

## Step 2: Locate the Failing Kernel in C++ Wrapper

### Search for the Assertion Pattern

Extract the assertion pattern from the error message (e.g., `tmp18 < ks0`) and search for it:

```bash
# Search for the specific assertion
grep -n "tmpN < ksM" /path/to/*.wrapper.cpp

# Get context around the assertion (80 lines before, 20 after)
grep -n -B80 -A20 "tmpN < ksM" /path/to/*.wrapper.cpp
```

### Find the Full Kernel Definition

The kernel is embedded in the C++ wrapper as a Python docstring comment:

```cpp
    /*
    async_compile.triton('triton_red_fused_...', '''
    import triton
    import triton.language as tl
    ...
    def triton_red_fused_...(in_ptr0, out_ptr1, ks0, xnumel, r0_numel, ...):
```

---

## Step 3: Understand the Kernel Logic

Study the code path that leads to the assertion. Common patterns that trigger index out of bounds:

### Pattern: Empty Tensor with ks0 = 0

Given a dynamic shape `ks0 = 0`:
1. `tmp13 = (-1) + 0 = -1`
2. The index wrapping logic produces `-1`
3. The assertion `0 <= -1 < 0` fails

### Example Kernel Pattern

```python
tmp13 = (-1) + ks0           # ks0 - 1
tmp14 = tl.where(tmp12, tmp10, tmp13)  # if condition: use tmp10, else: ks0-1
tmp15 = ks0
tmp16 = tmp14 + tmp15        # wrap-around for negative indices
tmp17 = tmp14 < 0
tmp18 = tl.where(tmp17, tmp16, tmp14)  # if negative: add ks0

# ASSERTION: 0 <= tmp18 < ks0
tl.device_assert(((0 <= tmp18) & (tmp18 < ks0)), "index out of bounds")
```

---

## Step 4: Identify the Dynamic Shape Variable

### Find Where the Kernel is Called

```bash
grep -n "call_triton_KERNEL_NAME" /path/to/*.wrapper.cpp
```

### Example Output

```cpp
call_triton_red_fused_...(arg1415_1, buf696, s607, 1L, s13, ...);
```

### Parameter Mapping

| Parameter | Value | Meaning |
|-----------|-------|---------|
| `in_ptr0` | `arg1415_1` | The input tensor |
| `out_ptr1` | `buf696` | The output buffer |
| `ks0` | `s607` | **Dynamic shape - the bound that fails** |

### Find the Definition of the Shape Variable

```bash
grep -n "int64_t s607 = " /path/to/*.wrapper.cpp
```

The output reveals which input tensor dimension the shape variable originates from:

```cpp
int64_t s607 = arg1416_1_size[0];
```

---

## Step 5: Trace Back to Model Input

### Find Input Index

Inputs are assigned sequential numbers. Determine which input corresponds to the argument:

```bash
grep -n 'inputs_info_\[INDEX\].name = "argNNN_1"' /path/to/*.wrapper.cpp
```

### Check Input Constraints

```bash
grep -n "argNNN_1_size\[0\]" /path/to/*.wrapper.cpp
```

Look for guards like:
```cpp
if (arg_size[0] > 230400) {  // Upper bound check only - no lower bound!
```

**Common Issue**: Upper bound checks are present but lower bound checks for `>= 1` are absent.

---

## Step 6: Map to Model Code

### Use Source Node Comments

Comments in the C++ wrapper identify which PyTorch operations generated each kernel:

```bash
grep -n -B5 "call_triton_KERNEL_NAME" /path/to/*.wrapper.cpp | grep "Source Nodes"
```

### Example Output

```cpp
// Topologically Sorted Source Nodes: [slice_1, sub_89, cumsum, ge_231, where_2, index_copy]
```

### Map Operations to Python Code

| ATen Operation | Python Code Pattern |
|----------------|---------------------|
| `cumsum` | `torch.cumsum(tensor, dim=0)` |
| `sub` | `idx - 1` |
| `ge` | `idx >= 0` |
| `where` | `torch.where(condition, ...)` |
| `index_copy` | `tensor.index_copy(0, indices, source)` |

---

## Root Cause Analysis

### Common Root Causes

1. **Empty tensor at runtime**: A jagged or variable-length tensor has size 0 at runtime, but this was never encountered during compilation
2. **Missing lower bound guards**: AOTI generates only upper bound checks and skips lower bound checks
3. **Edge case absent from sample inputs**: The sample inputs provided for AOTI export never exercised the edge case

---

## Fix Recommendations

### Option 1: Add Guard in Forward Method

```python
def forward(self, lengths: torch.Tensor, ...) -> torch.Tensor:
    if lengths.numel() == 0:
        device = lengths.device
        return torch.empty(0, self.output_dim, device=device)
    # ... rest of method
```

### Option 2: Fix the Specific Operation

Address empty tensors directly within the affected operation:

```python
def process_events(self, lengths: torch.Tensor, ...):
    if lengths.numel() == 0:
        return torch.empty(0, self.emb_dim, device=lengths.device)
    # ... rest of method
```

### Option 3: Include Edge Cases in AOTI Export

Ensure that the sample inputs used for AOTI export include:
- Empty tensors (size 0)
- Minimum-size tensors (size 1)
- The largest expected sizes

---

## Useful Commands Summary

### Searching in AOTI Wrapper

```bash
# Find kernel by assertion pattern
grep -n "tmpN < ksM" *.wrapper.cpp

# Get full kernel context
grep -n -B80 -A20 "ASSERTION_PATTERN" *.wrapper.cpp

# Find kernel call site
grep -n "call_KERNEL_NAME" *.wrapper.cpp

# Find dynamic shape definition
grep -n "int64_t SHAPE_VAR = " *.wrapper.cpp

# Find input mapping
grep -n 'inputs_info_\[INDEX\].name' *.wrapper.cpp

# Find size constraints
grep -n "SHAPE_VAR_size\[0\]" *.wrapper.cpp
```

### Environment Variables for Debugging

```bash
# Enable debug output during torch.compile
export TORCH_COMPILE_DEBUG=1

# Save generated kernels to persistent location
export TORCHINDUCTOR_CACHE_DIR=/path/to/save/kernels

# Enable CUDA launch blocking for accurate stack traces
export CUDA_LAUNCH_BLOCKING=1
```
