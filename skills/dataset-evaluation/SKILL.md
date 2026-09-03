---
name: dataset-evaluation
description: >-
  Validates dataset formatting and quality for SageMaker model fine-tuning (SFT,
  DPO, or RLVR). Invoke when the user says "is my dataset okay", "evaluate my
  data", "check my training data", "I have my own data", or before starting any
  fine-tuning job. Detects file format, checks schema compliance against the
  selected model and technique, and reports whether the data is ready for
  training or evaluation.
metadata:
  version: 1.0.0
  category: data
  source:
    repository: 'https://github.com/awslabs/agent-plugins'
    path: plugins/sagemaker-ai/skills/dataset-evaluation
    license_path: LICENSE
    commit: ba79e65ab968ed456b3cbee5f2d851d58239e864
---

# Workflow Instruction

Follow the workflow described below. Locate the dataset, check the file type, and resolve any issues such as missing files or incorrect file types. Determine the fine-tuning model and strategy. Run the appropriate validation for the model family. Summarize the outcome: is the dataset ready for fine-tuning?

## Prerequisites

- The SDK environment has been verified (SDK version, region, execution role). If this has not been done, activate the `sdk-getting-started` skill first.

---

## Workflow

1. **Locate Dataset**:
   - The full path may be a local file path or an S3 URI
   - Resolve the full path to the dataset file, confirm read permissions are available, and assist the user if the file is not found

2. **Determine strategy and model**:
   - File formatting depends on the currently selected fine-tuning strategy and base model.
   - If the strategy and model are already known from conversation context (e.g., chosen via the model-selection and finetuning-technique skills), use them.
   - If not available in context, activate the model-selection and/or finetuning-technique skills to establish them before proceeding.
   - **Exception:** If the user is validating an evaluation dataset (not a training dataset), neither model nor technique is required — the format detector can validate the eval format (query/response structure) on its own. Do not block on model-selection or finetuning-technique for evaluation dataset validation.

3. **Check File Formatting**: Run format_detector.py to verify the file conforms to formatting requirements.
   - Pass the full path directly to the format_detector script as an argument
   - Do not supply the model or strategy as arguments
   - Do not download data from S3
   - Do not create local copies of the data

4. **Summarize Results**: Inform the user whether their data is ready
   - Review the output of format_detector and compare it against the known strategy and model
   - **Important: training datasets and evaluation datasets have distinct format requirements.**
     - **Training datasets** must conform to the fine-tuning strategy format described in `references/strategy_data_requirements.md`
     - **Evaluation datasets** (for model evaluation) must match one of the [SageMaker evaluation dataset formats](https://docs.aws.amazon.com/sagemaker/latest/dg/model-customize-evaluation-dataset-formats.html).
     - **Custom Scorer evaluation datasets** carry scorer-specific requirements. If the dataset targets Custom Scorer evaluation (Prime Math, Prime Code, or Custom Lambda), read `references/custom-scorer-evaluation-dataset-formats.md` and validate against the scorer-specific schema. The scorer type should be available from conversation context (established in the model-evaluation skill).
   - Tell the user whether their dataset is valid for its intended purpose
   - Warn the user if the dataset is valid but for a different strategy or model
   - Warn the user if the dataset is not valid for any strategy/model combination
   - If the user intends to fine-tune a model with the evaluated dataset, it must be uploaded to an S3 bucket in the same region as the planned training job (usually the default region). Warn the user if this condition is NOT met.
   - If the dataset is NOT in the required format, recommend transforming it with the dataset-transformation skill, wait for user confirmation, and revise the plan based on their response

## Messages to the User

- Introduction: "This skill checks the structure of your dataset for model fine-tuning."
- File types: This skill applies to files formatted according to the [Amazon SageMaker AI Developer Guide](https://docs.aws.amazon.com/sagemaker/latest/dg/autopilot-llms-finetuning-data-format.html#autopilot-llms-finetuning-dataset-format)

# Resources

- scripts/format_detector.py is a self-contained format validation script that runs independently
- model-selection and finetuning-technique skills should have already established the base model and fine-tuning strategy
- references/strategy_data_requirements.md lists data format requirements per strategy

## Script Details

- scripts/format_detector.py is a self-contained format validation script that runs independently:

```bash
# With the file path argument identified in workflow step 1
python scripts/format_detector.py local_path/to/dataset
```

## References

- `scripts/format_detector.py` — Self-contained format validation script
- `references/strategy_data_requirements.md` — Data format requirements per strategy
