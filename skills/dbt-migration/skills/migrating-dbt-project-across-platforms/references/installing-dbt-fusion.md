# Installing dbt Fusion

## PROBLEM

dbt Fusion (`dbtf`) is a first-party tool maintained by [dbt Labs](https://github.com/dbt-labs). It must be installed and operational before a cross-platform migration can begin. Fusion supplies the real-time compilation engine and detailed error diagnostics that drive the migration workflow.

## SOLUTION

### Check if Fusion is already installed

```bash
dbtf --version
```

If this returns a version number, Fusion is installed. Confirm it can connect to your project:

```bash
dbtf debug
```

### Install Fusion

If `dbtf` is not found, follow the [official dbt Fusion installation guide](https://docs.getdbt.com/docs/fusion/install-fusion-cli) to install it.

**Verify installation**:
```bash
dbtf --version
dbtf debug
```

### Minimum requirements

- dbt Fusion must be capable of connecting to both the source and target platforms
- Run `dbtf debug` with each profile to verify connectivity before the migration begins

## CHALLENGES

### Connection errors with dbtf debug

If `dbtf debug` fails to connect:
1. Confirm your `profiles.yml` contains the correct credentials
2. Verify that the target warehouse/cluster is running and reachable
3. Ensure any required drivers are installed (e.g., Databricks ODBC/Simba driver)
4. Attempt the connection with standard `dbt debug` first to isolate issues specific to Fusion

### Fusion version compatibility

If you encounter unexpected parsing or compilation behavior, confirm you are running a recent version of Fusion:
```bash
dbtf --version
```

If Fusion is already installed, you can updated it to the latest version with
```bash
dbtf system update
```
