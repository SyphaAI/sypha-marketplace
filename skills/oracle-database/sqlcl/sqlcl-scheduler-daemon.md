# SQLcl Scheduler Daemon

## Overview

The SQLcl Scheduler Daemon executes SQLcl jobs on a cron-based schedule without requiring an active interactive session. It runs as a background process, loads job definitions from a YAML configuration file, and executes SQL, PL/SQL, or SQLcl commands against pre-saved database connections.

Use the scheduler daemon for:
- Recurring nightly or hourly reports
- Scheduled data loads or exports
- Regular maintenance tasks (statistics gathering, purges, health checks)
- Automated schema validation or monitoring queries

The daemon is separate from Oracle's `DBMS_SCHEDULER` — it operates at the OS level within SQLcl rather than inside the database. No database privilege is needed for the scheduler itself, only for the SQL statements it runs.

---

## Prerequisites

- **SQLcl 25.2 or later**
- **JRE 17 or 21**
- Database connections pre-saved with `conn -save -savepwd` (see Step 1 of `sqlcl-mcp-server.md` or `sqlcl-basics.md`)

---

## Managing the Daemon

All daemon lifecycle operations use the `-daemon` flag passed to the `sql` command.

### Start

```shell
sql -daemon start
```

Output:
```
Starting SQLcl daemon...
INFO Mon Jun  9 00:09:38 +01 2025: Daemon started with PID 1666
```

### Stop

```shell
sql -daemon stop
```

### Restart

Stops and starts in a single operation. Use this after changes that do not support live reload (for example, modifying JVM options):

```shell
sql -daemon restart
```

### Status

```shell
sql -daemon status
```

Output:
```
INFO Mon Jun  9 00:15:39 +01 2025: Daemon is running (PID 2464)
```

Only one daemon instance can run per OS user at any given time.

---

## Configuration File

The daemon reads job definitions from:

```
~/.dbtools/schedules/scheduler.yaml
```

This file is generated automatically with a commented-out sample job the first time the daemon starts. Edit it to define your jobs.

### File Structure

```yaml
jobs:
  - name: job-example
    cron: 0/2 * * * * ? *
    connection: named-conn-example
    payload: "@/path/to/script.sql arg1 arg2 arg3"
```

### Job Fields

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Unique job name; also used as the log file name |
| `cron` | Yes | Quartz-compatible cron expression (7 fields: seconds to year) |
| `connection` | No | Saved SQLcl connection name; defaults to `/ as sysdba` if omitted |
| `payload` | Yes | SQL statement, PL/SQL block, SQLcl command, or `@script.sql` reference |

---

## Cron Syntax

The daemon uses **Quartz cron format** with 7 fields, not the standard 5-field Unix cron format:

```
┌─────────────── second (0-59)
│ ┌───────────── minute (0-59)
│ │ ┌─────────── hour (0-23)
│ │ │ ┌───────── day of month (1-31)
│ │ │ │ ┌─────── month (1-12 or JAN-DEC)
│ │ │ │ │ ┌───── day of week (1-7 or SUN-SAT)
│ │ │ │ │ │ ┌── year (optional)
│ │ │ │ │ │ │
* * * * * ? *
```

Common expressions:

| Expression | Meaning |
|------------|---------|
| `0 0 6 * * ?` | Every day at 6:00 AM |
| `0 30 8 ? * MON-FRI` | Weekdays at 8:30 AM |
| `0 0/15 * * * ?` | Every 15 minutes |
| `0 15 10 ? * *` | Every day at 10:15 AM |
| `0 0 0 1 * ?` | First day of every month at midnight |
| `0 0 22 ? * FRI` | Every Friday at 10:00 PM |
| `0 0/5 14,18 * * ?` | Every 5 min, 2:00–2:55 PM and 6:00–6:55 PM |

Use `?` in the day-of-month or day-of-week field (but not both) when the other field carries a value.

---

## Payload Examples

### Inline SQL

```yaml
jobs:
  - name: daily-count
    cron: 0 0 7 * * ?
    connection: my_prod_db
    payload: SELECT COUNT(*) FROM orders WHERE order_date = TRUNC(SYSDATE);
```

### SQLcl Command

```yaml
jobs:
  - name: daily-ddl-snapshot
    cron: 0 0 2 * * ?
    connection: my_prod_db
    payload: desc employees
```

### Script File with Arguments

```yaml
jobs:
  - name: monthly-report
    cron: 0 0 6 1 * ?
    connection: my_reporting_db
    payload: "@/opt/scripts/monthly_report.sql 2024 Q1"
```

### Inline PL/SQL Block

```yaml
jobs:
  - name: nightly-purge
    cron: 0 0 1 * * ?
    connection: my_prod_db
    payload: |
      BEGIN
        DELETE FROM audit_log WHERE log_date < SYSDATE - 90;
        COMMIT;
        DBMS_OUTPUT.PUT_LINE('Purge complete: ' || SQL%ROWCOUNT || ' rows deleted');
      END;
      /
```

### Multiple Statements

```yaml
jobs:
  - name: stats-gather
    cron: 0 0 22 * * ?
    connection: my_prod_db
    payload: |
      BEGIN
        DBMS_STATS.GATHER_SCHEMA_STATS(
          ownname          => 'HR',
          estimate_percent => DBMS_STATS.AUTO_SAMPLE_SIZE,
          method_opt       => 'FOR ALL COLUMNS SIZE AUTO',
          degree           => 4
        );
      END;
      /
```

---

## Live Reload

The daemon watches `scheduler.yaml` for changes using a checksum. When the file is modified:

- New jobs are picked up automatically
- Modified jobs are rescheduled
- Removed jobs are cancelled

**No restart is required.** Changes become active within seconds of saving the file.

---

## Log Files

All logs are stored under `~/.dbtools/schedules/`:

```
~/.dbtools/schedules/
├── logs/
│   ├── jobs.log              # All job scheduling events
│   └── job-<name>.log        # Per-job execution output
├── scheduler.log             # Daemon lifecycle events
├── scheduler.yaml            # Job definitions
└── pid                       # Daemon PID file
```

### scheduler.log — Daemon Lifecycle

Records daemon start, stop, and startup failure events:

```
[2025-06-09T06:00:00] - [STARTED] - [MESSAGE: Daemon started successfully]
[2025-06-09T22:15:00] - [STOPPED] - [MESSAGE: Daemon stopped]
```

### jobs.log — Job Scheduling Events

Records events that affect all jobs, including file loads, validation errors, and scheduling actions:

```
[2025-06-09T06:00:01] - [SCHEDULE_FILE_LOADED] - [SCHEDULE_FILE: /home/user/.dbtools/schedules/scheduler.yaml]
[2025-06-09T06:00:01] - [SCHEDULE_JOB] - [JOB: nightly-purge] - [JOB_LOG: /home/user/.dbtools/schedules/logs/job-nightly-purge.log]
```

### job-\<name\>.log — Per-Job Output

Records each individual execution of a specific job:

```
[2025-06-09T01:00:00] - [RUNNING] - [MESSAGE: Job started]
[2025-06-09T01:00:02] - [COMPLETED] - [JOB_RESULT: Purge complete: 1423 rows deleted]
[2025-06-09T01:00:02] - [FAILED] - [ERROR: ORA-00942: table or view does not exist]
```

Log files are not rotated automatically — watch file sizes when running the daemon over long periods.

---

## Unix Service (systemd)

When SQLcl is installed via the RPM package, a `sql-scheduler` systemd service is bundled:

```shell
# Start the service (as root)
systemctl start sql-scheduler

# Enable on boot
systemctl enable sql-scheduler

# Check service status
systemctl status sql-scheduler
```

The systemd service manages daemons for all users in a designated Unix group, offering centralized daemon management so individual users do not need to start their own instance.

---

## Full Example: Nightly Report Workflow

### 1. Save a database connection

```sql
sql /nolog
conn -save reporting_db -savepwd reporter/SecurePass@//dbhost:1521/REPORTPDB
```

### 2. Create the report script

```sql
-- /opt/scripts/nightly_sales.sql
SET SQLFORMAT CSV
SET FEEDBACK OFF
SET HEADING ON
SPOOL /var/reports/sales_{{date}}.csv
SELECT order_id, customer_id, total_amount, order_date
FROM orders
WHERE order_date = TRUNC(SYSDATE - 1);
SPOOL OFF
EXIT
```

### 3. Add the job to scheduler.yaml

```yaml
jobs:
  - name: nightly-sales-report
    cron: 0 5 6 * * ?
    connection: reporting_db
    payload: "@/opt/scripts/nightly_sales.sql"
```

### 4. Start the daemon

```shell
sql -daemon start
sql -daemon status
```

### 5. Monitor

```shell
tail -f ~/.dbtools/schedules/logs/job-nightly-sales-report.log
```

---

## Best Practices

- Assign each job a descriptive `name` — it becomes the log file name and simplifies troubleshooting.
- Always pre-save connections with `-savepwd`. The daemon cannot prompt for passwords during execution.
- Use absolute paths in `payload` script references — the daemon's working directory may differ from what you expect.
- Test scripts interactively using `sql -S connection @script.sql` before adding them to the schedule.
- Track log file sizes. Log rotation is not built in; set up a separate cron job or logrotate configuration for long-lived daemons.
- When scripts write output files, include the date in the filename to prevent overwriting results from previous runs.
- Include `sql -daemon status` in monitoring scripts to raise an alert when the daemon stops unexpectedly.

---

## Common Mistakes and How to Avoid Them

**Mistake: Job silently not running**
Start by checking `jobs.log`. If the job was never scheduled, the YAML likely contains a syntax error or an invalid cron expression. Validate the YAML structure and inspect `scheduler.log` for `SCHEDULE_FILE_ERROR`.

**Mistake: Connection not found**
The daemon reads from the same `~/.dbtools` connection store as interactive SQLcl. If the connection name in `connection:` does not match any entry in `~/.dbtools`, the job fails. Run `sql /nolog` followed by `conn -list` to view available saved connections.

**Mistake: Password not saved**
If the connection was saved without `-savepwd`, the daemon cannot establish a connection. Re-save it with `conn -save <name> -savepwd user/pass@service`.

**Mistake: Cron expression in 5-field Unix format**
The daemon expects Quartz 7-field cron format. A 5-field expression such as `0 6 * * *` will not work. Prepend the seconds field: `0 0 6 * * ?`.

**Mistake: Log files growing without bound**
Log rotation is not built in. Add a `logrotate` configuration or a separate cleanup job targeting `~/.dbtools/schedules/logs/`.

---

## Related Skills

- `sqlcl-basics.md` — Saving connections with `-save` and `-savepwd`
- `sqlcl-cicd.md` — Non-interactive SQLcl execution patterns
- `sqlcl-scripting.md` — JavaScript automation scripts usable as daemon payloads
- `sqlcl-liquibase.md` — Schedule Liquibase deployments via daemon jobs

---

## Sources

- [Running SQLcl as a Scheduler Daemon](https://docs.oracle.com/en/database/oracle/sql-developer-command-line/25.4/sqcug/running-sqlcl-scheduler-daemon.html)
- [Managing the Scheduler Daemon](https://docs.oracle.com/en/database/oracle/sql-developer-command-line/25.4/sqcug/managing-scheduler-daemon.html)
- [Scheduling Daemon Jobs](https://docs.oracle.com/en/database/oracle/sql-developer-command-line/25.4/sqcug/scheduling-daemon-jobs.html)
- [Monitoring with Log Files](https://docs.oracle.com/en/database/oracle/sql-developer-command-line/25.4/sqcug/monitoring-log-files.html)
