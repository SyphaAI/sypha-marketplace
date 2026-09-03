---
name: hadoop
description: >-
  Manage Hadoop clusters with HDFS operations, YARN job tuning, and distributed
  processing diagnostics.
metadata:
  clawdbot:
    emoji: "\U0001F418"
    requires:
      bins:
        - hdfs
        - yarn
        - hadoop
    os:
      - linux
      - darwin
  upstream:
    slug: hadoop
    version: 1.0.0
    homepage: 'https://clawic.com/skills/hadoop'
  category: data
  source:
    repository: 'https://github.com/clawic/skills'
    path: skills/hadoop
    license_path: LICENSE
    commit: ff40511e7588b7b91d4427b65931f420a7412bb0
---

## Setup

If `~/hadoop/` doesn't exist or is empty, read `setup.md` and start the conversation naturally.

## When to Use

The user works within the Hadoop ecosystem (HDFS, YARN, MapReduce, Hive). The agent covers cluster diagnostics, job optimization, storage management, and troubleshooting of distributed processing failures.

## Architecture

Memory lives in `~/hadoop/`. See `memory-template.md` for structure.

```
~/hadoop/
├── memory.md        # Cluster configs, common issues, preferences
├── clusters/        # Per-cluster notes and configs
│   └── {name}.md    # Specific cluster context
└── scripts/         # Custom diagnostic scripts
```

## Quick Reference

| Topic | File |
|-------|------|
| Setup process | `setup.md` |
| Memory template | `memory-template.md` |
| HDFS operations | `hdfs.md` |
| YARN tuning | `yarn.md` |
| Troubleshooting | `troubleshooting.md` |

## Core Rules

### 1. Verify Cluster State First
Before any operation, assess cluster health:
```bash
hdfs dfsadmin -report
yarn node -list
```
Do not assume the cluster is healthy. A single dead DataNode changes the entire picture.

### 2. Storage Before Compute
HDFS problems cascade into job failures. Always verify:
```bash
hdfs dfs -df -h                    # Capacity
hdfs fsck / -files -blocks         # Block health
```
A job failing with "No space left" is a storage issue, not a code defect.

### 3. Resource Calculator Awareness
YARN allocates resources based on the configured scheduler. Know which one is active:
```bash
yarn rmadmin -getServiceState rm1
cat /etc/hadoop/conf/yarn-site.xml | grep scheduler
```
The default (Capacity) scheduler and the Fair scheduler behave very differently.

### 4. Replication Factor Context
Default replication=3. For temporary data, 1-2 replicas saves space:
```bash
hdfs dfs -setrep -w 1 /tmp/scratch/
```
For critical data, confirm replication is being honored:
```bash
hdfs fsck /data/critical -files -blocks -replicaDetails
```

### 5. Log Location Awareness
Hadoop logs are distributed across machines. Key locations:
| Component | Log Path |
|-----------|----------|
| NameNode | /var/log/hadoop-hdfs/hadoop-hdfs-namenode-*.log |
| DataNode | /var/log/hadoop-hdfs/hadoop-hdfs-datanode-*.log |
| ResourceManager | /var/log/hadoop-yarn/yarn-yarn-resourcemanager-*.log |
| NodeManager | /var/log/hadoop-yarn/yarn-yarn-nodemanager-*.log |
| Application | yarn logs -applicationId <app_id> |

### 6. Safe Mode Handling
The NameNode enters safe mode on startup or when the block count is low:
```bash
hdfs dfsadmin -safemode get        # Check status
hdfs dfsadmin -safemode leave      # Exit (if blocks OK)
```
Never force-exit safe mode if blocks are actually missing.

### 7. Memory Settings Matter
90% of "job killed" failures trace back to memory configuration:
```bash
# Container settings
yarn.nodemanager.resource.memory-mb     # Total per node
yarn.scheduler.minimum-allocation-mb    # Min container
mapreduce.map.memory.mb                 # Map task
mapreduce.reduce.memory.mb              # Reduce task
```
Always verify these settings before concluding that the code is the problem.

## HDFS Operations

### Essential Commands
```bash
# Navigation
hdfs dfs -ls /path
hdfs dfs -du -h /path              # Size with human units
hdfs dfs -count -q /path           # Quota info

# Data movement
hdfs dfs -put local.txt /hdfs/     # Upload
hdfs dfs -get /hdfs/file.txt .     # Download
hdfs dfs -cp /src /dst             # Copy within HDFS
hdfs dfs -mv /src /dst             # Move within HDFS

# Maintenance
hdfs dfs -rm -r /path              # Delete (trash)
hdfs dfs -rm -r -skipTrash /path   # Delete (permanent)
hdfs dfs -expunge                  # Empty trash
```

### Block Management
```bash
# Find corrupt blocks
hdfs fsck / -list-corruptfileblocks

# Delete corrupt file (after confirming unrecoverable)
hdfs fsck /path/file -delete

# Force replication
hdfs dfs -setrep -w 3 /important/data/
```

## YARN Job Management

### Application Lifecycle
```bash
# List applications
yarn application -list                    # Running
yarn application -list -appStates ALL     # All states

# Application details
yarn application -status <app_id>

# Kill stuck application
yarn application -kill <app_id>

# Get logs (after completion)
yarn logs -applicationId <app_id>
yarn logs -applicationId <app_id> -containerId <container_id>
```

### Queue Management
```bash
# List queues
yarn queue -list

# Queue status
yarn queue -status <queue_name>

# Move application between queues
yarn application -movetoqueue <app_id> -queue <target_queue>
```

## Common Traps

- **Deleting without -skipTrash on full cluster** → Trash still occupies space; cluster remains full
- **Setting container memory below JVM heap** → Immediate container kill with confusing error messages
- **Ignoring speculative execution on slow jobs** → Resources wasted on duplicated tasks
- **Running fsck on a busy cluster** → Notable performance impact; schedule during maintenance windows
- **Assuming HDFS = POSIX semantics** → No in-place appends, no random writes
- **Forgetting timezone in scheduling** → Oozie/Airflow jobs trigger at unintended times

## Security & Privacy

**Data that stays local:**
- Cluster notes saved in ~/hadoop/clusters/
- Preferences and environment context

**What commands access:**
- hdfs/yarn commands connect to your Hadoop cluster
- Some commands read system paths (/var/log, /etc/hadoop/conf)
- Destructive commands require explicit user confirmation

**This skill does NOT:**
- Store credentials (use kinit/keytab separately)
- Make external API calls beyond your cluster
- Run destructive commands without asking first

## Related Skills
Install with `clawhub install <slug>` if user confirms:
- `linux` — system administration
- `docker` — containerized deployments
- `bash` — shell scripting

## Feedback

- If useful: `clawhub star hadoop`
- Stay updated: `clawhub sync`
