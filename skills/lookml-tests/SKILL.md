---
name: lookml-tests
description: >-
  Standards and best practices for authoring LookML tests to verify data
  integrity, accuracy, and business logic correctness.
metadata:
  category: data
  source:
    repository: 'https://github.com/looker-open-source/looker-skills'
    path: skills/lookml-tests
    license_path: LICENSE
    commit: c530d1b7efee1db49851a04563ce946adfd191a8
---

# LookML Testing Standards

Testing is essential for preserving trust in data. LookML tests let you confirm that the semantic model behaves as intended and that the underlying data matches your assumptions.

## 1. File Organization

-   **Location**: Write tests in `tests/[explore_name].test.lkml`.
-   **One Suite Per Explore**: Each file should contain *all* test definitions for a given Explore.
-   **Naming Convention**: `[explore_name].test.lkml` (e.g., `orders.test.lkml`).

## 2. Test Structure

Each test is composed of an `explore_source` query paired with an `assert` statement.

```lookml
test: [test_name] {
  explore_source: [explore_name] {
    column: [column_name] { field: [view_name].[field_name] }
    filters: {
      field: [view_name].[field_name]
      value: "[value]"
    }
  }

  assert: [assertion_name] {
    expression: ${[view_name].[field_name]} [operator] [value] ;;
  }
}
```

## 3. Types of Tests

### A. Integrity Checks (Critical)
Confirm that Primary Keys remain unique after joins are applied. This is the most effective guard against "fanout" errors introduced by incorrectly defined `one_to_many` joins.

**Example: Primary Key Uniqueness**
```lookml
test: orders_pk_is_unique {
  explore_source: orders {
    column: order_id {}
    column: count {}
    # Limit to recent data to save costs/time if table is large
    filters: {
      field: orders.created_date
      value: "last 7 days"
    }
  }

  assert: order_id_is_unique {
    expression: ${orders.count} = 1 ;;
  }
}
```

### B. Accuracy Tests
Verify that specific measure values match known constants or expected thresholds.

**Example: Revenue is Positive**
```lookml
test: revenue_is_positive {
  explore_source: orders {
    column: total_revenue {}
    filters: {
      field: orders.created_date
      value: "yesterday"
    }
  }

  assert: revenue_greater_than_zero {
    expression: ${orders.total_revenue} >= 0 ;;
  }
}
```

### C. Business Logic Validation
Confirm that derived calculations produce correct results. For instance, verifying that `gross_margin` never exceeds `revenue`, or that `lifetime_orders` is never NULL for an active user.

**Example: Logic Check**
```lookml
test: margin_less_than_revenue {
  explore_source: orders {
    column: total_revenue {}
    column: total_margin {}
  }

  assert: margin_is_valid {
    expression: ${orders.total_margin} <= ${orders.total_revenue} ;;
  }
}
```

## 4. Best Practices

-   **Descriptive Extensions**: Choose meaningful names for both tests (`orders_pk_is_unique`) and assertions (`order_id_is_unique`).
-   **Performance**: Apply filters (e.g., `last 7 days`) to bound the scan on large tables, unless full historical validation is explicitly required.
-   **Model Inclusion**: Make sure test files are referenced in the model file (e.g., `include: "/tests/*.test.lkml"`).
