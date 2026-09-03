---
name: aws-cognito-admin
description: >-
  Administer Cognito user pools — find users, confirm accounts, reset
  passwords, edit custom attributes, enable/disable accounts, and inspect
  pool configuration. User pools are discovered at runtime. Trigger on "look
  up a user", "Cognito", "reset password", "disable an account", "fix
  subscription", or /aws-cognito-admin.
metadata:
  category: development
  source:
    repository: 'https://github.com/monahand1023/claude-code-skills'
    path: aws-cognito-admin
    license_path: LICENSE
    commit: 9549ae50374a9755990ab924840dc4679ce4778b
---

# AWS Cognito Admin

Administer Cognito user pools with no hardcoded pool IDs — every resource is discovered at runtime.

---

## Step 0 — Discover user pools (skip if user already named a pool)

```bash
aws cognito-idp list-user-pools --max-results 60 \
  --query 'UserPools[*].{Name:Name,Id:Id}' \
  --output table --no-cli-pager
```

Show the list and ask which pool the user wants (or infer it from context). When exactly one pool exists, use it automatically. Keep the pool ID in `$POOL_ID` for the commands that follow.

---

## Step 1 — Look up a user by email or username

```bash
aws cognito-idp admin-get-user \
  --user-pool-id "$POOL_ID" \
  --username "$EMAIL_OR_USERNAME" \
  --no-cli-pager
```

Present every attribute clearly. Points to watch:
- `UserStatus` — should be `CONFIRMED`. Call out `UNCONFIRMED`, `FORCE_CHANGE_PASSWORD`, `DISABLED`, or `UNKNOWN`.
- `Enabled` — a value of `false` means the account is disabled.
- All `custom:` attributes — these commonly hold subscription status, plan tier, external IDs (e.g. Stripe customer ID), and role flags. Describe what each one probably represents.
- `UserCreateDate` and `UserLastModifiedDate` — mention whether the account is brand new or has gone unmodified for a long time.

---

## Step 2 — List users matching a filter

Apply prefix filters against email or other standard attributes:

```bash
aws cognito-idp list-users \
  --user-pool-id "$POOL_ID" \
  --filter 'email ^= "user@example"' \
  --query 'Users[*].{Username:Username,Email:Attributes[?Name==`email`]|[0].Value,Status:UserStatus,Enabled:Enabled}' \
  --output table --no-cli-pager
```

Filter operators that are supported: `=`, `^=` (starts-with), `$=` (ends-with), `*=` (contains), `!=`.
Attributes you can filter on: `username`, `email`, `phone_number`, `name`, `given_name`, `family_name`, `preferred_username`, `cognito:user_status`, `status`, `sub`.

---

## Step 3 — Force-confirm an unconfirmed account

Apply this when a user never received or never clicked the confirmation email but should still be activated:

```bash
aws cognito-idp admin-confirm-sign-up \
  --user-pool-id "$POOL_ID" \
  --username "$USERNAME" \
  --no-cli-pager
```

Afterwards, fetch the user again (Step 1) and verify that `UserStatus` has become `CONFIRMED`.

---

## Step 4 — Reset a user's password

This sends a temporary reset code to the email or phone registered for the user:

```bash
aws cognito-idp admin-reset-user-password \
  --user-pool-id "$POOL_ID" \
  --username "$USERNAME" \
  --no-cli-pager
```

Once run, a reset code is delivered to the user and their status moves to `RESET_REQUIRED`. Tell the user to look for it in their inbox.

---

## Step 5 — Disable or enable a user

**Disable** (immediately blocks every sign-in):

```bash
aws cognito-idp admin-disable-user \
  --user-pool-id "$POOL_ID" \
  --username "$USERNAME" \
  --no-cli-pager
```

**Enable** (gives sign-in access back):

```bash
aws cognito-idp admin-enable-user \
  --user-pool-id "$POOL_ID" \
  --username "$USERNAME" \
  --no-cli-pager
```

Disabling leaves the user and their attributes intact. Sessions that already exist can stay valid until expiry — Cognito does not revoke tokens when an account is disabled.

---

## Step 6 — Update a custom attribute

Use this to hand-correct subscription status, plan tier, role flags, or any other custom attribute:

```bash
aws cognito-idp admin-update-user-attributes \
  --user-pool-id "$POOL_ID" \
  --username "$USERNAME" \
  --user-attributes Name="custom:subscription_status",Value="active" \
  --no-cli-pager
```

To change several attributes in one call, repeat the `Name=...,Value=...` entries:

```bash
aws cognito-idp admin-update-user-attributes \
  --user-pool-id "$POOL_ID" \
  --username "$USERNAME" \
  --user-attributes \
    Name="custom:subscription_status",Value="active" \
    Name="custom:plan",Value="pro" \
  --no-cli-pager
```

Once updated, fetch the user again (Step 1) to verify the change was applied.

Note: When auto-verification is enabled, `email` or `phone_number` cannot be changed directly with this command. Either include `email_verified` set to `true` in the same `admin-update-user-attributes` call, or do it via the console.

---

## Step 7 — Delete a user

**This cannot be undone. Always confirm before you proceed.**

Prior to deletion, display the full user profile (Step 1) and spell out exactly what will be lost:
- The Cognito account together with every attribute on it
- The ability to sign in using this username/email
- Any downstream records keyed on the Cognito `sub` (UUID) will be left orphaned

Then request explicit confirmation, and continue only once the user has confirmed.

```bash
aws cognito-idp admin-delete-user \
  --user-pool-id "$POOL_ID" \
  --username "$USERNAME" \
  --no-cli-pager
```

---

## Step 8 — Describe pool configuration

```bash
aws cognito-idp describe-user-pool \
  --user-pool-id "$POOL_ID" \
  --no-cli-pager \
  | jq '{
      Name: .UserPool.Name,
      MFA: .UserPool.MfaConfiguration,
      PasswordPolicy: .UserPool.Policies.PasswordPolicy,
      UsernameAttributes: .UserPool.UsernameAttributes,
      AutoVerifiedAttributes: .UserPool.AutoVerifiedAttributes,
      EstimatedNumberOfUsers: .UserPool.EstimatedNumberOfUsers,
      SchemaAttributes: [.UserPool.SchemaAttributes[]? | select(.Name | startswith("custom:"))]
    }'
```

This displays MFA settings, the password policy, whether email/phone serves as the username, and every custom attribute defined in the schema.

---

## Step 9 — List app clients

```bash
aws cognito-idp list-user-pool-clients \
  --user-pool-id "$POOL_ID" \
  --query 'UserPoolClients[*].{Name:ClientName,Id:ClientId}' \
  --output table --no-cli-pager
```

To examine the OAuth flows and callback URLs of a particular client:

```bash
aws cognito-idp describe-user-pool-client \
  --user-pool-id "$POOL_ID" \
  --client-id "$CLIENT_ID" \
  --no-cli-pager \
  | jq '{
      ClientName: .UserPoolClient.ClientName,
      AllowedOAuthFlows: .UserPoolClient.AllowedOAuthFlows,
      CallbackURLs: .UserPoolClient.CallbackURLs,
      LogoutURLs: .UserPoolClient.LogoutURLs,
      ExplicitAuthFlows: .UserPoolClient.ExplicitAuthFlows
    }'
```
