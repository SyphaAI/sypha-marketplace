# Emergency Procedures Reference

## Secret Leak Response Playbook

### Severity Classification

| Severity | Definition | Response Time | Example |
|----------|-----------|---------------|---------|
| **P0 — Critical** | Production credentials exposed publicly | Immediate (15 min) | Database password in public GitHub repo |
| **P1 — High** | Internal credentials exposed beyond intended scope | 1 hour | API key in build logs accessible to wider org |
| **P2 — Medium** | Non-production credentials exposed | 4 hours | Staging DB password in internal wiki |
| **P3 — Low** | Expired or limited-scope credential exposed | 24 hours | Rotated API key found in old commit history |

### P0/P1 Response Procedure

**Phase 1: Contain (0-15 minutes)**

1. **Identify the leaked secret**
   - Which credential was exposed? (type, scope, permissions)
   - Where was it exposed? (repo, log, error page, third-party service)
   - When did the exposure first occur? (commit timestamp, log timestamp)
   - Is the exposure still active? (Is the repo public? Is the log accessible?)

2. **Revoke immediately**
   - Database password: `ALTER ROLE app_user WITH PASSWORD 'new_password';`
   - API key: Regenerate via provider console/API
   - Vault token: `vault token revoke <token>`
   - AWS access key: `aws iam delete-access-key --access-key-id <key>`
   - Cloud service account: Delete and recreate the key
   - TLS certificate: Revoke through the CA and generate a replacement

3. **Remove exposure**
   - Public repo: Delete the file, rewrite history to remove it, request a GitHub cache purge
   - Build logs: Remove log artifacts and rotate CI/CD secrets
   - Error page: Deploy a fix to prevent the secret from appearing in error output
   - Third-party: Contact the vendor to request a log purge if applicable

4. **Deploy new credentials**
   - Write the rotated credential to the secret store
   - Restart affected services so they pick up the new credential
   - Confirm that services are healthy with the updated credential

**Phase 2: Assess (15-60 minutes)**

5. **Audit blast radius**
   - Query Vault/cloud SM audit logs for all accesses using the compromised credential
   - Look for unauthorized usage within the exposure window
   - Inspect network logs for suspicious connections originating from unrecognized IPs
   - Determine whether the compromised credential provided access to other secrets (privilege escalation)

6. **Notify stakeholders**
   - Security team (always)
   - Owners of all affected services
   - Compliance team if regulated data was potentially accessed
   - Legal team if customer data may have been compromised
   - Executive leadership for P0 incidents

**Phase 3: Recover (1-24 hours)**

7. **Rotate adjacent credentials**
   - If the leaked credential had access to other secrets, rotate those as well
   - If a Vault token was leaked, review its policies and rotate everything it could access

8. **Harden against recurrence**
   - Install a pre-commit hook to scan for secrets (e.g., `gitleaks`, `detect-secrets`)
   - Review the CI/CD pipeline to ensure secrets are properly masked
   - Audit access to the system where the leak originated

**Phase 4: Post-Mortem (24-72 hours)**

9. **Document incident**
   - Timeline of events
   - Root cause analysis
   - Impact assessment
   - Remediation actions taken
   - Preventive measures introduced

### Response Communication Template

```
SECURITY INCIDENT — SECRET EXPOSURE
Severity: P0/P1
Time detected: YYYY-MM-DD HH:MM UTC
Secret type: [database password / API key / token / certificate]
Exposure vector: [public repo / build log / error output / other]
Status: [CONTAINED / INVESTIGATING / RESOLVED]

Immediate actions taken:
- [ ] Credential revoked at source
- [ ] Exposure removed
- [ ] New credential deployed
- [ ] Services verified healthy
- [ ] Audit log review in progress

Blast radius assessment: [PENDING / COMPLETE — no unauthorized access / COMPLETE — unauthorized access detected]

Next update: [time]
Incident commander: [name]
```

## Vault Seal/Unseal Procedures

### Understanding Seal Status

Vault employs a **seal** mechanism to protect the encryption key hierarchy. While sealed, Vault cannot decrypt any data or respond to any requests.

```
Sealed State:
  Vault process running → YES
  API responding → YES (503 Sealed)
  Serving secrets → NO
  All active leases → FROZEN (not revoked)
  Audit logging → NO

Unsealed State:
  Vault process running → YES
  API responding → YES (200 OK)
  Serving secrets → YES
  Active leases → RESUMING
  Audit logging → YES
```

### When to Seal Vault (Emergency Only)

Seal Vault only when:
- An active intrusion targeting Vault infrastructure is confirmed
- Server compromise is suspected (e.g., unauthorized root access to a Vault node)
- Encryption key material may have been extracted
- A regulatory or legal hold requires immediate prevention of data access

**Do NOT seal for:**
- Routine maintenance — perform a graceful shutdown instead
- A single-node failure in an HA cluster — allow a standby node to take over
- A suspected secret leak — revoke the specific secret rather than sealing Vault

### Seal Procedure

```bash
# Seal a single node
vault operator seal

# Seal all nodes (HA cluster)
# Seal each node individually — leader last
vault operator seal -address=https://vault-standby-1:8200
vault operator seal -address=https://vault-standby-2:8200
vault operator seal -address=https://vault-leader:8200
```

**Impact of sealing:**
- All active client connections are dropped immediately
- All token and lease timers are paused
- Applications lose access to secrets — anticipate cascading failures
- Monitoring systems will generate alerts for the sealed state

### Unseal Procedure (Shamir Keys)

Requires a quorum of key holders (e.g., 3 of 5).

```bash
# Each key holder provides their unseal key
vault operator unseal <key-1>
vault operator unseal <key-2>
vault operator unseal <key-3>
# Vault unseals after reaching threshold
```

**Operational checklist after unseal:**
1. Confirm health: `vault status` shows `Sealed: false`
2. Check audit devices: `vault audit list` — verify all devices are enabled
3. Inspect auth methods: `vault auth list`
4. Confirm HA status: `vault operator raft list-peers`
5. Review lease count: monitor `vault.expire.num_leases`
6. Verify that applications are reconnecting successfully (review application logs)

### Unseal Procedure (Auto-Unseal)

When cloud KMS auto-unseal is configured, Vault unseals on its own after a restart:

```bash
# Restart Vault service
systemctl restart vault

# Verify unseal (should happen within seconds)
vault status
```

**If auto-unseal fails:**
- Verify cloud KMS key permissions (the IAM role may have been changed)
- Confirm network connectivity to the cloud KMS endpoint
- Check the KMS key status (ensure it is not disabled or scheduled for deletion)
- Inspect Vault logs: `journalctl -u vault -f`

## Mass Credential Rotation Procedure

Use this procedure when a broad compromise requires rotating a large number of credentials at the same time.

### Pre-Rotation Checklist

- [ ] Enumerate all credentials within scope
- [ ] Map credential dependencies (identify which services rely on which credentials)
- [ ] Establish the rotation order (databases before applications)
- [ ] Prepare a rollback plan for each credential
- [ ] Notify all affected service owners
- [ ] Book a maintenance window if zero-downtime rotation is not feasible
- [ ] Pre-stage new credentials in the secret store without activating them yet

### Rotation Order

1. **Infrastructure credentials** — Database root passwords, cloud IAM admin keys
2. **Service credentials** — Application database users, API keys
3. **Integration credentials** — Third-party API keys, webhook secrets
4. **Human credentials** — Force password resets, revoke SSO sessions

### Rollback Plan

For each credential, record:
- The previous value (store in a sealed emergency envelope or HSM)
- How to revert (the specific command or API call required)
- A verification step (how to confirm the old credential still works)
- The maximum time allowed to complete a rollback (SLA)

## Vault Recovery Procedures

### Lost Unseal Keys

If unseal keys are lost and auto-unseal has not been configured:

1. **If Vault is currently unsealed:** Enable auto-unseal immediately, then perform a reseal/unseal cycle using KMS
2. **If Vault is sealed:** Data cannot be recovered without the keys. Restore from a Raft snapshot backup
3. **Prevention:** Store unseal keys in separate, secure locations (HSMs, safety deposit boxes) and use auto-unseal for production environments.

### Raft Cluster Recovery

**Single node failure (cluster still has quorum):**
```bash
# Remove failed peer
vault operator raft remove-peer <failed-node-id>

# Add replacement node
# (new node joins via retry_join in config)
```

**Loss of quorum (majority of nodes failed):**
```bash
# On a surviving node with recent data
vault operator raft join -leader-ca-cert=@ca.crt https://surviving-node:8200

# If no node survives, restore from snapshot
vault operator raft snapshot restore /backups/latest.snap
```

### Root Token Recovery

If the root token is lost (it should be revoked following initial setup):

```bash
# Generate new root token (requires unseal key quorum)
vault operator generate-root -init
# Each key holder provides their key
vault operator generate-root -nonce=<nonce> <unseal-key>
# After quorum, decode the encoded token
vault operator generate-root -decode=<encoded-token> -otp=<otp>
```

**Best practice:** Generate a root token only when necessary, complete the required task, then revoke it immediately:
```bash
vault token revoke <root-token>
```

## Incident Severity Escalation Matrix

| Signal | Escalation |
|--------|-----------|
| Single secret exposed in internal log | P2 — Rotate secret, add log masking |
| Secret in public repository (no evidence of use) | P1 — Immediate rotation, history scrub |
| Secret in public repository (evidence of unauthorized use) | P0 — Full incident response, legal notification |
| Vault node compromised | P0 — Seal cluster, rotate all accessible secrets |
| Cloud KMS key compromised | P0 — Create new key, re-encrypt all secrets, rotate all credentials |
| Audit log gap detected | P1 — Investigate cause, assume worst case for gap period |
| Multiple failed auth attempts from unknown source | P2 — Block source, investigate, rotate targeted credentials |
