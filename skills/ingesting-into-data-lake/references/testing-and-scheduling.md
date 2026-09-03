# Testing and Scheduling Guide

End-to-end reference for testing Glue ETL jobs, confirming data loads, and configuring recurring schedules for external data import pipelines.

## Overview

Once a Glue ETL job has been created, the following steps are required:

1. **Test the job** - Run it manually to confirm it works correctly
2. **Validate data** - Verify that data was ingested into the target table as expected
3. **Schedule the job** - Configure recurring execution for ongoing pipelines
4. **Monitor execution** - Track job runs and respond to failures

## Testing the Job

### Run the Job Manually

Before setting up a schedule, execute the job once to validate the full workflow.

```bash
JOB_RUN_ID=$(aws glue start-job-run \
  --job-name "external-import-<source>-<table>" \
  --region <region> \
  --query 'JobRunId' --output text)

echo "Job run started: $JOB_RUN_ID"
```

### Monitor Job Execution

Inspect job status and logs:

```bash
# Get job run status
aws glue get-job-run \
  --job-name "external-import-<source>-<table>" \
  --run-id "$JOB_RUN_ID" \
  --region <region>

# Check if job succeeded
STATUS=$(aws glue get-job-run \
  --job-name "external-import-<source>-<table>" \
  --run-id "$JOB_RUN_ID" \
  --query 'JobRun.JobRunState' \
  --output text)

echo "Job status: $STATUS"
```

**Job states:**

- `STARTING` - Job is initializing
- `RUNNING` - Job is actively executing
- `SUCCEEDED` - Job completed without errors
- `FAILED` - Job encountered an error (review logs for details)
- `TIMEOUT` - Job ran past its timeout limit
- `STOPPED` - Job was manually stopped

### View CloudWatch Logs

Glue streams logs to CloudWatch Logs:

```bash
# Get log stream name
LOG_STREAM=$(aws glue get-job-run \
  --job-name "external-import-<source>-<table>" \
  --run-id "$JOB_RUN_ID" \
  --query 'JobRun.LogGroupName' \
  --output text)

# Tail logs
aws logs tail /aws-glue/jobs/output --follow \
  --log-stream-names "<job-name>-<run-id>" \
  --region <region>
```

**Key log messages to look for:**

- `Last watermark: <value>` - The starting point for the incremental load
- `Loading X new/updated records` - Number of records identified for loading
- `Updated watermark to: <value>` - New watermark recorded after a successful run
- `Successfully loaded X records` - Confirmation that the append/upsert completed
- `ERROR` or `Exception` - Messages indicating the cause of a failure

### Common Issues During Testing

#### Connection Timeouts

**Symptom**: Job fails with "Connection timeout" or "Unable to connect to database"

**Causes:**

- VPC/subnet configuration is incorrect
- Security groups are blocking traffic
- Database firewall rules are too restrictive
- Network ACLs are blocking Glue's IP ranges

**Solution:**

1. Test the connection in the Glue console: Connections → Select connection → Test
2. Confirm that security groups permit inbound traffic from Glue's security group
3. Check that the database firewall allows connections from the Glue subnet CIDR
4. Ensure a NAT gateway or internet gateway is in place for outbound connectivity if required

#### Authentication Failures

**Symptom**: "Access denied" or "Invalid username/password"

**Causes:**

- Credentials stored in the connection are incorrect
- Password has expired
- Database user is missing required permissions
- IP-based restrictions are blocking the database user

**Solution:**

1. Verify credentials by connecting manually (e.g., via a SQL client)
2. Confirm the database user has SELECT permission on the source tables
3. Ensure the user is permitted to connect from Glue's IP or subnet
4. For AWS Secrets Manager: verify the secret ARN and the associated IAM permissions

#### Schema Mismatches

**Symptom**: "Type mismatch" or "Cannot cast X to Y"

**Causes:**

- A source column type is incompatible with the target schema
- A source column is NULL but the target does not allow NULLs
- Decimal precision or scale does not match

**Solution:**

1. Add explicit type casts in the PySpark script
2. Use `.cast("string")` as a fallback for columns that cause cast failures
3. Add NULL handling: `when(col("x").isNotNull(), col("x")).otherwise(default_value)`
4. Update the target schema to more closely match the source types

#### Performance Issues

**Symptom**: Job runs slowly or times out

**Causes:**

- Source database query is slow due to missing indexes or a full table scan
- Too few Glue workers are allocated
- Network bandwidth is a bottleneck
- A single batch is reading too much data at once

**Solution:**

1. Add indexes on the watermark column in the source database
2. Increase the Glue worker count
3. Enable parallel reads using the `numPartitions` option
4. Reduce batch size by targeting smaller date ranges
5. Optimize the source query by adding WHERE clauses and selecting only required columns

#### Watermark Not Advancing

**Symptom**: Job completes but no new records are loaded and the watermark does not change

**Causes:**

- There is no new data in the source
- The watermark column comparison is wrong due to a timezone difference
- S3 permissions prevent the watermark file from being updated
- The filter logic itself is incorrect

**Solution:**

1. Confirm that new data exists in the source by querying it directly
2. Review timezone handling and convert all timestamps to UTC
3. Verify that the Glue job role has S3 write access to the watermark bucket
4. Add debug logging to print watermark values and the filter query being applied

## Validating Data Load

Once the job has completed successfully, verify that data was loaded as expected.

### Check Row Count

Query the target S3 Table to confirm that records were written:

```sql
-- Count total rows
SELECT COUNT(*) FROM "<catalog>"."<namespace>"."<table>";
```

Compare against the expected count from the job logs (e.g., "Successfully loaded X records").

### Inspect Latest Records

Review the most recently ingested records:

```sql
-- Get latest records by watermark column
SELECT *
FROM "<catalog>"."<namespace>"."<table>"
ORDER BY <watermark-column> DESC
LIMIT 10;
```

Confirm:

- Columns match the expected schema
- Data types are correct
- Values appear reasonable
- Timestamps are in the expected timezone

### Verify Watermark Updated

Confirm that the watermark file was updated correctly:

```bash
# Read watermark file from S3
aws s3 cp s3://<bucket>/watermarks/<table-name>.txt -

# Should show the new watermark value matching the job logs
```

### Compare Source and Target

For critical tables, cross-check aggregations between source and target:

**Source (via Glue connection):**

```sql
SELECT COUNT(*), SUM(amount), MAX(updated_at)
FROM <schema>.<table>
WHERE updated_at > '<last-watermark>';
```

**Target (S3 Table):**

```sql
SELECT COUNT(*), SUM(amount), MAX(load_timestamp)
FROM "<catalog>"."<namespace>"."<table>"
WHERE load_timestamp >= '<job-start-time>';
```

Row counts and sums must match.

### Validate Data Quality

Execute basic data quality checks:

```sql
-- Check for NULL values in key columns
SELECT COUNT(*) FROM "<catalog>"."<namespace>"."<table>"
WHERE customer_id IS NULL OR email IS NULL;

-- Check for duplicates (if using append instead of upsert)
SELECT customer_id, COUNT(*)
FROM "<catalog>"."<namespace>"."<table>"
GROUP BY customer_id
HAVING COUNT(*) > 1;

-- Check date range
SELECT MIN(order_date), MAX(order_date)
FROM "<catalog>"."<namespace>"."<table>";
```

For production pipelines, consider adopting AWS Glue Data Quality rules to automate these validation checks.

## Scheduling Recurring Pipelines

Once testing passes, configure a schedule for ongoing data synchronization.

### Determine Schedule Frequency

Select a frequency based on the data freshness requirements:

**Real-time (<1 minute latency):**

- Do not use Glue batch jobs — use AWS DMS, Glue Streaming, or Kinesis instead

**Near real-time (5-15 minute latency):**

- Schedule: Every 15 minutes: `cron(0/15 * * * ? *)`
- Factor in costs — Glue jobs are billed at a minimum of 1 minute per run

**Hourly:**

- Schedule: At the top of each hour: `cron(0 * * * ? *)`
- Good for: Transaction logs, event streams

**Every 6 hours:**

- Schedule: `cron(0 */6 * * ? *)`
- Good for: Slowly changing data, reporting tables

**Daily:**

- Schedule: 2 AM UTC: `cron(0 2 * * ? *)`
- Good for: Dimension tables, reference data
- Prefer off-peak hours to minimize load on the source database

**Weekly:**

- Schedule: Monday at 2 AM: `cron(0 2 ? * MON *)`
- Good for: Historical archives, full refreshes

**Coordinate with source system:**

- Avoid windows when the source database experiences peak load
- Schedule runs after source-side batch processes complete, where applicable
- Account for any scheduled maintenance windows

### Create Glue Trigger

Glue Triggers control when a job runs on a schedule.

```bash
aws glue create-trigger \
  --name "external-import-<table>-schedule" \
  --type SCHEDULED \
  --schedule "cron(0 */6 * * ? *)" \
  --actions JobName="external-import-<source>-<table>" \
  --description "Scheduled sync from <source> to S3 Tables" \
  --start-on-creation \
  --region <region>
```

**Cron expression format:**

```
cron(Minutes Hours Day-of-month Month Day-of-week Year)
```

**Examples:**

- Every 15 minutes: `cron(0/15 * * * ? *)`
- Hourly: `cron(0 * * * ? *)`
- Every 6 hours: `cron(0 */6 * * ? *)`
- Daily at 2 AM UTC: `cron(0 2 * * ? *)`
- Weekdays at 6 AM UTC: `cron(0 6 ? * MON-FRI *)`
- First day of month at midnight: `cron(0 0 1 * ? *)`

### Start/Stop Triggers

**Start a trigger** (enable scheduling):

```bash
aws glue start-trigger \
  --name "external-import-<table>-schedule" \
  --region <region>
```

**Stop a trigger** (disable scheduling):

```bash
aws glue stop-trigger \
  --name "external-import-<table>-schedule" \
  --region <region>
```

### View Trigger Status

Check trigger details and recent runs:

```bash
aws glue get-trigger \
  --name "external-import-<table>-schedule" \
  --region <region>
```

## Monitoring Scheduled Jobs

### CloudWatch Alarms

Configure CloudWatch alarms to notify on job failures:

```bash
# Create alarm for job failures
aws cloudwatch put-metric-alarm \
  --alarm-name "glue-job-failure-<table>" \
  --alarm-description "Alert when Glue job fails" \
  --metric-name JobFailure \
  --namespace AWS/Glue \
  --statistic Sum \
  --period 300 \
  --threshold 1 \
  --comparison-operator GreaterThanOrEqualToThreshold \
  --dimensions Name=JobName,Value="external-import-<source>-<table>" \
  --evaluation-periods 1 \
  --alarm-actions <sns-topic-arn>
```

**Metrics to track:**

- `glue.driver.aggregate.recordsRead` - Records read from the source
- `glue.driver.aggregate.elapsedTime` - Total job duration
- Job run state (SUCCEEDED, FAILED, TIMEOUT)

### View Recent Job Runs

Retrieve a list of recent executions for a job:

```bash
aws glue get-job-runs \
  --job-name "external-import-<source>-<table>" \
  --region <region> \
  --max-results 10
```

### Track Watermark Progression

Observe how the watermark advances across runs:

```bash
# List watermark history (if versioning enabled on S3 bucket)
aws s3api list-object-versions \
  --bucket <bucket> \
  --prefix watermarks/<table-name>.txt \
  --query 'Versions[*].[LastModified,VersionId]' \
  --output table
```

Deploy a Lambda function to record watermark values to CloudWatch Logs after each job run, enabling historical tracking.

## Advanced Scheduling Patterns

### Conditional Triggers

Execute a job only after a predecessor job succeeds:

```bash
aws glue create-trigger \
  --name "external-import-orders-after-customers" \
  --type CONDITIONAL \
  --actions JobName="external-import-orders" \
  --predicate '{
    "Conditions": [{
      "LogicalOperator": "EQUALS",
      "JobName": "external-import-customers",
      "State": "SUCCEEDED"
    }]
  }' \
  --start-on-creation
```

Use for:

- Ensuring dimension tables are loaded before fact tables
- Enforcing dependency ordering between jobs
- Chaining sequential transformation steps

### Event-Driven Triggers

Fire a job in response to EventBridge events:

```bash
# Create EventBridge rule to trigger Glue job
aws events put-rule \
  --name "trigger-glue-on-event" \
  --event-pattern '{
    "source": ["aws.s3"],
    "detail-type": ["Object Created"],
    "detail": {
      "bucket": {
        "name": ["source-data-bucket"]
      }
    }
  }'

aws events put-targets \
  --rule "trigger-glue-on-event" \
  --targets "Id=1,Arn=arn:aws:glue:region:account:job/external-import-job"
```

### On-Demand Triggers

Let users start jobs manually through the API or console, without any schedule:

```bash
# Don't create a trigger, just run the job when needed
aws glue start-job-run \
  --job-name "external-import-<source>-<table>"
```

## Best Practices

### Testing

1. **Test connection first** - Use the Glue console's "Test connection" feature before creating the job
2. **Start small** - Begin testing with a small data subset or a short time window
3. **Validate thoroughly** - Check row counts, data quality, and watermark progression
4. **Test failure scenarios** - Kill the job mid-run to confirm the watermark is not corrupted

### Scheduling

1. **Start conservatively** - Begin with a lower frequency and increase it if needed
2. **Avoid peak hours** - Run jobs during off-peak periods for the source database
3. **Set appropriate timeouts** - Build in buffer for unexpectedly large data volumes
4. **Use conditional triggers** - For dependent jobs, prefer conditional triggers over fixed time delays

### Monitoring

1. **Set up CloudWatch alarms** - Alert on failures, excessive durations, and runs with zero records loaded
2. **Track watermark progression** - Confirm the watermark advances after every run
3. **Monitor source lag** - Compare the source max timestamp against the max timestamp loaded
4. **Review logs regularly** - Watch for warnings and signs of performance degradation

### Maintenance

1. **Review and adjust schedules** - Update run frequency or worker count as data volumes evolve
2. **Store scripts in Git** - Version-control all job scripts
3. **Test changes in development** - Validate script updates before promoting to production
4. **Archive old watermarks** - Retain historical watermark values to aid debugging

## Summary

Testing and scheduling workflow:

1. **Run job manually** - Trigger the job and observe its execution
2. **Check CloudWatch logs** - Confirm no errors and that the watermark advanced
3. **Validate data load** - Query the target table, check row counts, and inspect the data
4. **Verify watermark** - Ensure the watermark file was updated correctly
5. **Create trigger** - Configure a recurring schedule at the appropriate frequency
6. **Set up monitoring** - Add CloudWatch alarms covering failures, duration, and data lag
7. **Monitor initial runs** - Pay close attention to the first few scheduled executions

With thorough testing and solid monitoring in place, scheduled Glue jobs deliver reliable, automated data pipelines from external databases to S3 Tables.
