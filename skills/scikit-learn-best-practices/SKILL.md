---
name: scikit-learn-best-practices
description: >-
  Guidelines and best practices for scikit-learn machine learning workflows,
  model development, evaluation, and Python deployment
metadata:
  category: data
  source:
    repository: 'https://github.com/mindrally/skills'
    path: scikit-learn-best-practices
    license_path: LICENSE
    commit: 05a71308897983093248d719a2ffa1bca61d0768
---

# Scikit-learn Best Practices

Authoritative guidelines for scikit-learn development, covering machine learning workflows, model building, evaluation, and recommended practices.

## Code Style and Structure

- Write clear, technical responses backed by accurate Python examples
- Make reproducibility a priority in machine learning workflows
- Apply functional programming patterns to data pipelines
- Apply object-oriented programming to custom estimators
- Favor vectorized operations over explicit loops
- Adhere to PEP 8 style guidelines

## Machine Learning Workflow

### Data Preparation

- Split data into train/validation/test sets before any preprocessing
- Pass `random_state` to `train_test_split()` to ensure reproducibility
- Use `stratify=y` for imbalanced classification tasks
- Hold out the test set entirely until final model evaluation

### Feature Engineering

- Scale features appropriately when using distance-based algorithms
- Apply `StandardScaler` to normally distributed features
- Apply `MinMaxScaler` to features with a bounded range
- Apply `RobustScaler` when data contains outliers
- Encode categorical variables with `OneHotEncoder`, `OrdinalEncoder`, or `LabelEncoder`
- Impute missing values using `SimpleImputer` or `KNNImputer`

### Pipelines

- Always wrap preprocessing and modeling steps in a `Pipeline`
- Fitting transformers only on training data prevents data leakage
- Pipelines produce cleaner, more reproducible code
- They also simplify deployment and model serialization

```python
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier

pipeline = Pipeline([
    ('scaler', StandardScaler()),
    ('classifier', RandomForestClassifier(random_state=42))
])
```

### Column Transformers

- Use `ColumnTransformer` to apply distinct preprocessing to different feature types
- Combine numeric and categorical transformations in a single unified pipeline

## Model Selection and Tuning

### Cross-Validation

- Apply cross-validation to obtain reliable performance estimates
- Use `cross_val_score()` for rapid evaluation of a single metric
- Use `cross_validate()` when tracking multiple metrics simultaneously
- Select an appropriate CV strategy:
  - `KFold` for regression
  - `StratifiedKFold` for classification
  - `TimeSeriesSplit` for temporal data
  - `GroupKFold` for grouped data

### Hyperparameter Tuning

- Use `GridSearchCV` for exhaustive search over a parameter grid
- Use `RandomizedSearchCV` when the parameter space is large
- Tune hyperparameters on training/validation data only; the test set must remain untouched
- Set `n_jobs=-1` to take advantage of parallel processing

## Model Evaluation

### Classification Metrics

- Choose metrics that match the problem characteristics:
  - `accuracy_score` when class distribution is balanced
  - `precision_score`, `recall_score`, `f1_score` for imbalanced classes
  - `roc_auc_score` to measure ranking ability
- Use `classification_report()` for a comprehensive summary
- Inspect `confusion_matrix()` to understand error patterns

### Regression Metrics

- `mean_squared_error` (MSE) as a general-purpose loss
- `mean_absolute_error` (MAE) for easier interpretation
- `r2_score` to quantify explained variance

### Evaluation Best Practices

- Report confidence intervals rather than point estimates alone
- Consult multiple metrics to get a complete picture of model behavior
- Benchmark against meaningful baselines
- Run evaluation on the held-out test set exactly once, at the very end

## Handling Imbalanced Data

- Apply stratified splitting and cross-validation throughout
- Consider setting `class_weight='balanced'` on the estimator
- Rely on metrics such as F1 and AUC-PR rather than accuracy
- Tune the decision threshold to reflect actual business requirements

## Feature Selection

- Apply `SelectKBest` with appropriate statistical tests
- Use `RFE` (Recursive Feature Elimination) for wrapper-based selection
- Apply `SelectFromModel` for model-driven selection
- Review feature importances from tree-based models

## Model Persistence

- Use `joblib` to save and reload models
- Persist complete pipelines rather than isolated model objects
- Track model artifacts under version control
- Record model metadata and configuration decisions

## Performance Optimization

- Enable parallel processing with `n_jobs=-1` wherever supported
- Use `warm_start=True` to continue iterative training from a prior fit
- Represent high-dimensional sparse data as sparse matrices
- For very large datasets, consider incremental learning via `partial_fit()`

## Key Conventions

- Import from submodules: `from sklearn.ensemble import RandomForestClassifier`
- Always set `random_state` to guarantee reproducibility
- Use pipelines to guard against data leakage
- Document model choices and hyperparameter decisions
