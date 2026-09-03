---
name: aoti-debug
description: >-
  Identify and fix AOTInductor (AOTI) errors and crashes. Apply when encountering AOTI
  segfaults, device mismatch errors, constant loading failures, or runtime
  errors raised by aot_compile, aot_load, aoti_compile_and_package, or
  aoti_load_package.
metadata:
  category: development
  source:
    repository: 'https://github.com/pytorch/pytorch'
    path: .claude/skills/aoti-debug
    license_path: LICENSE
    commit: eaa0ca8c6d2c78108a0b715d3e6c8c99506b8e6d
---

# AOTI Debugging Guide

Apply this skill to diagnose and fix common AOTInductor issues.

## Error Pattern Routing

**Review the error message and select the appropriate sub-guide:**

### Triton Index Out of Bounds
When the error looks like this:
```
Assertion `index out of bounds: 0 <= tmpN < ksM` failed
```
**→ Use the guide in `triton-index-out-of-bounds.md`**

### All Other Errors
Work through the sections that follow.

---

## First Step: Always Check Device and Shape Matching

**Regardless of which AOTI error appears (segfault, exception, crash, wrong output), ALWAYS check these items first:**

1. **Compile device == Load device**: The model has to be loaded on the same device type used at compilation
2. **Input devices match**: Inputs at runtime must live on the same device as the compiled model
3. **Input shapes match**: Runtime input shapes must equal the shapes used when compiling (or satisfy the dynamic shape constraints)

```python
# During compilation - note the device and shapes
model = MyModel().eval()           # What device? CPU or .cuda()?
inp = torch.randn(2, 10)           # What device? What shape?
compiled_so = torch._inductor.aot_compile(model, (inp,))

# During loading - device type MUST match compilation
loaded = torch._export.aot_load(compiled_so, "???")  # Must match model/input device above

# During inference - device and shapes MUST match
out = loaded(inp.to("???"))  # Must match compile device, shape must match
```

**Any mismatch among these can produce errors ranging from segfaults and exceptions to incorrect outputs.**

## Key Constraint: Device Type Matching

**AOTI requires that compilation and loading use the same device type.**

- Compiling on CUDA requires loading on CUDA (the device index may vary)
- Compiling on CPU requires loading on CPU
- Cross-device-type loading (e.g., compile on GPU, load on CPU) is NOT supported

## Common Error Patterns

### 1. Device Mismatch Segfault

**Symptom**: A segfault, exception, or crash while running `aot_load()` or executing the model.

**Example error messages**:
- `The specified pointer resides on host memory and is not registered with any CUDA device`
- A crash while constants load in AOTInductorModelBase
- `Expected out tensor to have device cuda:0, but got cpu instead`

**Cause**: The device types used at compile time and load time differ (see "First Step" above).

**Solution**: Ensure compile and load use the same device type. A CPU compile requires a CPU load; a CUDA compile requires a CUDA load.

### 2. Input Device Mismatch at Runtime

**Symptom**: A RuntimeError while the model executes.

**Cause**: The input device does not match the compile device (see "First Step" above).

**Better Debugging**: Set `AOTI_RUNTIME_CHECK_INPUTS=1` to obtain clearer error messages. This flag validates every input property — device type, dtype, sizes, and strides:
```bash
AOTI_RUNTIME_CHECK_INPUTS=1 python your_script.py
```

The result is actionable error messages such as:
```
Error: input_handles[0]: unmatched device type, expected: 0(cpu), but got: 1(cuda)
```


## Debugging CUDA Illegal Memory Access (IMA) Errors

When CUDA illegal memory access errors occur, follow this systematic approach:

### Step 1: Sanity Checks

Begin with these debugging flags before investigating further:

```bash
AOTI_RUNTIME_CHECK_INPUTS=1
TORCHINDUCTOR_NAN_ASSERTS=1
```

Both flags take effect at compilation time (during codegen):

- `AOTI_RUNTIME_CHECK_INPUTS=1` validates inputs against the guards established at compilation
- `TORCHINDUCTOR_NAN_ASSERTS=1` injects codegen around each kernel to check for NaN

### Step 2: Pinpoint the CUDA IMA

CUDA IMA errors can be non-deterministic. The following flags cause the error to occur deterministically:

```bash
PYTORCH_NO_CUDA_MEMORY_CACHING=1
CUDA_LAUNCH_BLOCKING=1
```

Both flags operate at runtime:

- `PYTORCH_NO_CUDA_MEMORY_CACHING=1` disables PyTorch's Caching Allocator, which normally allocates oversized buffers. This over-allocation is the typical cause of non-deterministic CUDA IMA errors.
- `CUDA_LAUNCH_BLOCKING=1` serializes kernel launches. Without this flag, kernels execute asynchronously, producing "CUDA kernel errors might be asynchronously reported" warnings.

### Step 3: Identify Problematic Kernels with Intermediate Value Debugger

The AOTI Intermediate Value Debugger can pinpoint the offending kernel:

```bash
AOT_INDUCTOR_DEBUG_INTERMEDIATE_VALUE_PRINTER=3
```

At runtime this outputs kernels sequentially. Used alongside the earlier flags, it identifies which kernel ran immediately before the error.

To inspect the inputs of a specific kernel:

```bash
AOT_INDUCTOR_FILTERED_KERNELS_TO_PRINT="triton_poi_fused_add_ge_logical_and_logical_or_lt_231,_add_position_embeddings_kernel_5" AOT_INDUCTOR_DEBUG_INTERMEDIATE_VALUE_PRINTER=2
```

If a kernel's inputs appear incorrect, investigate the kernel that produced the bad input.

## Additional Debugging Tools

### Logging and Tracing

- **tlparse / TORCH_TRACE**: Provides the complete output code and records the guards in use
- **TORCH_LOGS**: Set `TORCH_LOGS="+inductor,output_code"` for extra PT2 internal logs
- **TORCH_SHOW_CPP_STACKTRACES**: Setting this to `1` exposes additional C++ stack traces

### Common Sources of Issues

- **Dynamic shapes**: These have historically been a frequent source of IMAs. Apply extra scrutiny to dynamic shape scenarios during debugging.
- **Custom ops**: Especially those implemented in C++ with dynamic shapes. The meta function may require Symint-ification.

## API Notes

### Deprecated API
```python
torch._export.aot_compile()  # Deprecated
torch._export.aot_load()     # Deprecated
```

### Current API
```python
torch._inductor.aoti_compile_and_package()
torch._inductor.aoti_load_package()
```

The new API stores device metadata within the package, so `aoti_load_package()` selects the correct device type automatically. Only the device *index* (e.g., cuda:0 vs cuda:1) can be overridden, not the device *type*.

## Environment Variables Summary

| Variable | When | Purpose |
|----------|------|---------|
| `AOTI_RUNTIME_CHECK_INPUTS=1` | Compile time | Verify inputs against compilation guards |
| `TORCHINDUCTOR_NAN_ASSERTS=1` | Compile time | Test for NaN before/after kernels |
| `PYTORCH_NO_CUDA_MEMORY_CACHING=1` | Runtime | Turn IMA errors deterministic |
| `CUDA_LAUNCH_BLOCKING=1` | Runtime | Launch kernels synchronously |
| `AOT_INDUCTOR_DEBUG_INTERMEDIATE_VALUE_PRINTER=3` | Compile time | Emit kernel prints at runtime |
| `TORCH_LOGS="+inductor,output_code"` | Runtime | View PT2 internal logs |
| `TORCH_SHOW_CPP_STACKTRACES=1` | Runtime | Display C++ stack traces |
