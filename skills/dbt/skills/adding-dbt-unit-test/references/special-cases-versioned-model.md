# Unit testing versioned SQL models

When a model has multiple versions, the default unit test will execute against _all_ of them. To target specific version(s) for unit testing, use `include` or `exclude` within the model versions config:

`models/schema.yml`

```yaml

# my test_is_valid_email_address unit test will run on all versions of my_model
unit_tests:
  - name: test_is_valid_email_address
    model: my_model
    ...

# my test_is_valid_email_address unit test will run on ONLY version 2 of my_model
unit_tests:
  - name: test_is_valid_email_address
    model: my_model
    versions:
      include:
        - 2
    ...

# my test_is_valid_email_address unit test will run on all versions EXCEPT 1 of my_model
unit_tests:
  - name: test_is_valid_email_address
    model: my_model
    versions:
      exclude:
        - 1
    ...

```
