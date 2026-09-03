---
name: db2-rhel
description: >-
  Apply when installing, configuring, or administering IBM DB2 LUW on RHEL 9
  (and AlmaLinux/Rocky 9) — instance creation, database administration, buffer
  pool and tablespace management, backup/restore with HADR, performance tuning
  (db2advis, db2pd, MON functions), runstats/reorg, SELinux contexts, firewalld
  rules, and DB2 pureScale. Part of the db2-* skill family.
metadata:
  category: data
  source:
    repository: 'https://github.com/joogy06/agent-foundry'
    path: skills/db2-rhel
    license_path: LICENSE
    commit: 527e3a8e9d395f564d62a63ef3bff5ff44bc9b6f
---

# IBM DB2 LUW — Administration on RHEL 9

Companion skill to `rhel-server-admin` and `rhel-databases`. For Python DB2 connectivity, see `python-enterprise-connectors`.

<HARD-RULE>
Always run RUNSTATS after bulk loads and before production queries — stale statistics lead to poor access plans. The optimizer relies on distribution statistics to choose join methods, index paths, and sort strategies. Stale or missing stats silently degrade performance by orders of magnitude.
</HARD-RULE>

<HARD-RULE>
Never alter DB2 registry variables on a running production instance without scheduling a maintenance window — most require db2stop/db2start to take effect, and some (DB2_WORKLOAD, DB2_PARALLEL_IO) change optimizer behavior globally. Always run db2set -lr to list variables and test in a non-production environment first.
</HARD-RULE>

<HARD-RULE>
Always exercise HADR takeover procedures on a regular schedule — untested failover is not HA. Execute TAKEOVER HADR on the standby at least quarterly during a maintenance window. Confirm that automatic client reroute (ACR) reconnects applications. Document RTO/RPO and validate those figures.
</HARD-RULE>

<HARD-RULE>
Never disable SELinux for DB2 — use the correct contexts and fcontext rules. DB2 directories (/opt/ibm/db2, instance home, database paths) require proper SELinux labels. See the RHEL-Specific section for the exact fcontext commands.
</HARD-RULE>

---

## Reference Files

Detailed code examples, patterns, and configuration details are contained in the reference files below. Read the relevant file when working in that area.

| File | Covers |
|---|---|
| [install-admin.md](install-admin.md) | DB2 installation on RHEL, instance management, and database administration (tablespaces, buffer pools, schemas, tables) |
| [performance-monitoring-rhel.md](performance-monitoring-rhel.md) | performance tuning (db2advis, db2pd, MON functions), monitoring, maintenance, RHEL-specific configuration, and DB2 pureScale |
| [security-backup-recovery.md](security-backup-recovery.md) | DB2 security (authentication, authorization, roles, audit), backup strategies, and HADR recovery |

---

---

## Anti-Patterns

| Anti-Pattern | Why It Fails | Correct Approach |
|---|---|---|
| Running DB2 with default buffer pool sizes | The default 1000 pages is far too small for production; causes excessive disk I/O and degraded query performance | Size buffer pools to match the workload: OLTP requires 60-80% of data held in memory; run db2pd -bufferpools to track the hit ratio |
| Skipping RUNSTATS after bulk data loads | The optimizer operates on stale cardinality estimates; previously fast queries regress to full table scans | Run RUNSTATS WITH DISTRIBUTION on tables and indexes after every significant data change |
| Using HADR without automatic client reroute | Failover succeeds but applications cannot locate the new primary; manual intervention is needed | Configure ALTERNATE SERVER in the database directory and enable ACR in application connection strings |
| Not setting LOGFILSIZ and LOGPRIMARY appropriately | Default log sizes cause log-full conditions during batch loads; transactions roll back and retry indefinitely | Size transaction logs to accommodate the largest anticipated transaction; monitor with db2pd -logs; configure LOGSECOND as overflow capacity |
| Running backups without testing restore | Backup jobs succeed but restore fails because of missing log files, incorrect paths, or version mismatches | Test restores to a separate instance quarterly; validate with RESTORE DB ... WITHOUT ROLLING FORWARD |

---

## Related Skills

| Workload | Skill |
|---|---|
| Core RHEL admin (dnf, SELinux, firewalld, LVM) | `rhel-server-admin` |
| PostgreSQL, MySQL, Redis on RHEL | `rhel-databases` |
| Python DB2/Oracle/SQL Server connectors | `python-enterprise-connectors` |
| Web servers (Nginx, Apache, Caddy) | `rhel-web-servers` |
| Docker / Podman containers | `rhel-docker-host` |
| Monitoring (Prometheus, Grafana, PCP) | `rhel-monitoring` |
