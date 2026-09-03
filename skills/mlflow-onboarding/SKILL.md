---
name: mlflow-onboarding
description: >-
  Guides users through MLflow onboarding by identifying their use case (GenAI
  agents/apps or traditional ML/deep learning) and walking them through the
  appropriate quickstart tutorials and initial integration steps. Provide an
  experiment ID when available to help determine the correct path. Activate when
  the user wants to get started with MLflow, set up tracking, add observability,
  or integrate MLflow into their project. Triggers on "get started with MLflow",
  "set up MLflow", "onboard to MLflow", "add MLflow to my project", "how do I
  use MLflow".
metadata:
  category: data
  source:
    repository: 'https://github.com/mlflow/skills'
    path: mlflow-onboarding
    license_path: LICENSE
    commit: 5f561418262bdcaa9e705bdf7facc72f17b181fc
---

# MLflow Onboarding

MLflow addresses two broad use cases, each requiring a distinct onboarding path:

- **GenAI applications and agents**: LLM-powered apps, chatbots, RAG pipelines, and tool-calling agents. Relevant MLflow features include **tracing** for observability, **evaluation** with LLM judges, and **prompt management**, among others.
- **Traditional ML / deep learning models**: scikit-learn, PyTorch, TensorFlow, XGBoost, and similar frameworks. Relevant MLflow features include **experiment tracking** (parameters, metrics, artifacts), **model logging**, and **model deployment**, among others.

Identifying which use case applies is the first and most critical step. The onboarding path, quickstart tutorials, and integration steps differ considerably between the two.

## Step 1: Determine the Use Case

Before suggesting tutorials or integration steps, establish which use case the user is working on. Evaluate the signals below in order. **If the signals are ambiguous or absent, you MUST ask the user directly.**

### Signal 1: Check the Codebase

Scan the user's project for imports and usage patterns that reveal the use case:

**GenAI indicators** (any one of these points to GenAI):
- Imports from LLM client libraries: `openai`, `anthropic`, `google.generativeai`, `google.genai`, `langchain`, `langchain_openai`, `langgraph`, `llamaindex`, `litellm`, `autogen`, `crewai`, `dspy`
- Imports from MLflow GenAI modules: `mlflow.genai`, `mlflow.tracing`, `mlflow.openai`, `mlflow.langchain`
- Use of chat completions, embeddings, or agent frameworks
- Prompt templates or prompt engineering code

**Traditional ML indicators** (any one of these points to ML):
- Imports from ML frameworks: `sklearn`, `torch`, `tensorflow`, `keras`, `xgboost`, `lightgbm`, `catboost`, `statsmodels`, `scipy`
- Imports from MLflow ML modules: `mlflow.sklearn`, `mlflow.pytorch`, `mlflow.tensorflow`
- Model training loops, `.fit()` calls, or hyperparameter tuning code
- Dataset loading with tabular, image, or time-series data

```bash
# Search for GenAI indicators
grep -rl --include='*.py' -E '(import openai|import anthropic|from langchain|from langgraph|import litellm|from mlflow\.genai|from mlflow\.tracing|mlflow\.openai|mlflow\.langchain|ChatCompletion|chat\.completions)' .

# Search for ML indicators
grep -rl --include='*.py' -E '(from sklearn|import torch|import tensorflow|import keras|import xgboost|import lightgbm|mlflow\.sklearn|mlflow\.pytorch|mlflow\.tensorflow|\.fit\()' .
```

### Signal 2: Check the Experiment Type Tag

If the codebase or project directory is the MLflow repository itself, skip ahead to Signal 3 — the MLflow repo contains code covering all use cases and does not reflect the user's intent.

When the experiment ID is known, inspect its `mlflow.experimentKind` tag. MLflow sets this tag to indicate the experiment type:

```bash
mlflow experiments get --experiment-id <EXPERIMENT_ID> --output json > /tmp/exp_detail.json
jq -r '.tags["mlflow.experimentKind"] // "not set"' /tmp/exp_detail.json
```

- **`genai_development`** → GenAI use case
- **`custom_model_development`** → Traditional ML use case
- **Not set** → Proceed to Signal 3

If the experiment ID is unavailable, skip to Signal 3.

### Signal 3: Ask the User

When both the codebase and experiment signals are inconclusive, ask directly:

> Are you building a **GenAI application** (e.g., an LLM-powered chatbot, RAG pipeline, or tool-calling agent) or a **traditional ML/deep learning model** (e.g., a classifier, regression model, or neural network)?

**Do not guess.** The onboarding paths differ enough that taking the wrong one wastes the user's time.

## Step 2: Recommend Quickstart Tutorials

Once the use case is confirmed, present the relevant quickstart tutorials from the MLflow documentation. Show them to the user and ask whether they would like to follow along or go straight to integrating MLflow into their project.

### GenAI Path

The MLflow GenAI documentation is at: https://mlflow.org/docs/latest/genai/getting-started/

Select the most relevant tutorials based on the user's context and the information they have shared. Available tutorials include:

- **Tracing Quickstart** (https://mlflow.org/docs/latest/genai/tracing/quickstart/) — Activating automatic tracing for LLM calls. Covers launching an MLflow server, creating an experiment, enabling autologging, and reviewing traces in the UI.
  - Python + OpenAI variant: https://mlflow.org/docs/latest/genai/tracing/quickstart/python-openai/
  - TypeScript + OpenAI variant: https://mlflow.org/docs/latest/genai/tracing/quickstart/typescript-openai
  - OpenTelemetry (language-agnostic) variant: also linked from the quickstart page
- **Evaluation Quickstart** (https://mlflow.org/docs/latest/genai/eval-monitor/quickstart/) — Assessing GenAI application quality with LLM judges (scorers). Covers defining datasets, prediction functions, and both built-in and custom scorers.
- **Version Tracking Quickstart** (https://mlflow.org/docs/latest/genai/version-tracking/quickstart/) — Prompt management, application versioning, and linking tracing to versioned prompts.

If none of these tutorials fit the user's needs, consult the MLflow GenAI documentation for more targeted guides.

### Traditional ML Path

The MLflow ML documentation is at: https://mlflow.org/docs/latest/ml/getting-started/

Select the most relevant tutorials based on the user's context and the information they have shared. Available tutorials include:

- **Tracking Quickstart** (https://mlflow.org/docs/latest/ml/tracking/quickstart/) — Experiment tracking with scikit-learn: autologging, manual logging of parameters/metrics/models, and exploring results in the MLflow UI.
- **Deep Learning Tutorial** (https://mlflow.org/docs/latest/ml/getting-started/deep-learning/) — Training a PyTorch model with MLflow logging covering parameters, metrics, checkpoints, and system metrics (GPU utilization, memory).
- **Hyperparameter Tuning Tutorial** (https://mlflow.org/docs/latest/ml/getting-started/hyperparameter-tuning/) — Running hyperparameter searches with Optuna + MLflow, comparing run results, and identifying the best model.

If none of these tutorials fit the user's needs, consult the MLflow ML documentation for more targeted guides.

## Step 3: Integrate MLflow into the User's Project

After the user has reviewed the quickstart tutorials (or decided to skip them), offer to integrate MLflow directly into their codebase. **Always obtain the user's consent before making any changes to their code.**

### GenAI Integration

The central integration point for GenAI apps is **tracing** — automatically capturing LLM calls, tool invocations, and agent steps.

**If asked to create an example project:** Do not assume the user holds LLM API keys (e.g., OpenAI, Anthropic). Instead, generate traces with mock data using `@mlflow.trace` and `mlflow.start_span()` to demonstrate tracing without needing external API access. For example:

```python
import mlflow

mlflow.set_experiment("example-genai-app")

@mlflow.trace
def mock_chat(query: str) -> str:
    with mlflow.start_span(name="retrieve_context") as span:
        context = "Mock retrieved context for: " + query
        span.set_inputs({"query": query})
        span.set_outputs({"context": context})
    with mlflow.start_span(name="generate_response") as span:
        response = "Mock response based on: " + context
        span.set_inputs({"context": context, "query": query})
        span.set_outputs({"response": response})
    return response

mock_chat("What is MLflow?")
```

**What to configure (for an existing project):**

1. **Autologging** — When the user's code relies on a supported framework, a single line automatically traces all calls to their LLM provider. See https://mlflow.org/docs/latest/genai/tracing/ for the full list of supported providers. If the provider is supported:

   ```python
   import mlflow

   # Pick the one that matches the user's LLM provider:
   mlflow.openai.autolog()       # OpenAI SDK
   mlflow.anthropic.autolog()    # Anthropic SDK
   mlflow.gemini.autolog()       # Google Gemini (google-genai SDK)
   mlflow.langchain.autolog()    # LangChain / LangGraph
   mlflow.litellm.autolog()      # LiteLLM
   ```

   Add this call once at application startup (e.g., at the top of `main.py`, `app.py`, or the entry point module). It must run before any LLM calls are made.

   If the provider is **not** supported by autologging, skip to step 3 (Custom tracing) and use `@mlflow.trace` to instrument the relevant functions manually.

2. **Experiment configuration** — Set the experiment to keep traces organized:

   ```python
   mlflow.set_experiment("my-genai-app")
   ```

   Or via environment variable: `export MLFLOW_EXPERIMENT_NAME="my-genai-app"`

3. **Custom tracing** (optional) — For functions not covered by autologging (custom tools, business logic), apply the `@mlflow.trace` decorator:

   ```python
   @mlflow.trace
   def my_custom_tool(query: str) -> str:
       # ... tool logic ...
       return result
   ```

**Where to add it:** Locate the application's entry point or initialization module and place the autologging call there. Search for the main LLM client instantiation (e.g., `openai.OpenAI()`, `ChatOpenAI()`) to identify the right location.

### Traditional ML Integration

The central integration point for ML is **experiment tracking** — capturing parameters, metrics, and models produced during training runs.

**What to configure:**

1. **Autologging** — When the user's code uses a supported framework, a single line automatically logs parameters, metrics, and models during training. See https://mlflow.org/docs/latest/ml/ for the full list of supported frameworks. If the framework is supported:

   ```python
   import mlflow

   # Pick the one that matches the user's ML framework:
   mlflow.sklearn.autolog()      # scikit-learn
   mlflow.pytorch.autolog()      # PyTorch / PyTorch Lightning
   mlflow.tensorflow.autolog()   # TensorFlow / Keras
   mlflow.xgboost.autolog()      # XGBoost
   mlflow.lightgbm.autolog()     # LightGBM
   ```

   Add this call once before training begins. It automatically captures `model.fit()` calls, logged metrics, and model artifacts.

   If the framework is **not** supported by autologging, skip to step 3 (Manual logging) and use `mlflow.log_param()`, `mlflow.log_metric()`, and `mlflow.log_artifact()` to record data explicitly.

2. **Experiment configuration** — Set the experiment to keep runs organized:

   ```python
   mlflow.set_experiment("my-ml-experiment")
   ```

   Or via environment variable: `export MLFLOW_EXPERIMENT_NAME="my-ml-experiment"`

3. **Manual logging** (optional) — For metrics or parameters not covered by autologging:

   ```python
   with mlflow.start_run():
       mlflow.log_param("custom_param", value)
       mlflow.log_metric("custom_metric", value)
   ```

**Where to add it:** Find the training script or module where `model.fit()` (or its equivalent) is called. Place the autologging call before the training loop starts.

## Verification

After completing the integration, confirm that MLflow is capturing data as expected:

### GenAI Verification

1. Run the application and trigger at least one LLM call
2. Check for traces:
   ```bash
   mlflow traces search \
     --experiment-id <EXPERIMENT_ID> \
     --max-results 5 \
     --extract-fields 'info.trace_id,info.state,info.request_time' \
     --output json > /tmp/verify_traces.json
   jq '.traces | length' /tmp/verify_traces.json
   ```
3. If traces appear, open the MLflow UI to review them visually

### ML Verification

1. Execute the training script
2. Check for runs:
   ```bash
   mlflow runs search \
     --experiment-id <EXPERIMENT_ID> \
     --max-results 5 \
     --output json > /tmp/verify_runs.json
   jq '.runs | length' /tmp/verify_runs.json
   ```
3. If runs appear, open the MLflow UI to review the logged parameters, metrics, and artifacts
