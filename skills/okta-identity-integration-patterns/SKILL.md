---
name: okta-identity-integration-patterns
description: >-
  Configure Okta for enterprise identity workflows covering OIDC login, group
  claims, and policy-based access controls. Use when building workforce or
  B2B identity scenarios.
metadata:
  upstream:
    disable-model-invocation: true
  category: development
  source:
    repository: 'https://github.com/vaquarkhan/Fullstack-development-agent-skills'
    path: skills/okta-identity-integration-patterns
    license_path: LICENSE
    commit: fb12d1dea34a790f3ac1ccb66d331877b5dc8bd0
---

# Okta Identity Integration Patterns

## Use When

- Enterprise SSO is needed
- Role or group-based access must be derived from identity provider claims

## Workflow

1. Set up Okta app integrations for frontend and backend clients.
2. Map groups, roles, and claims to the application authorization model.
3. Implement OIDC login, callback, and logout flows.
4. Enforce token and session validation at the API gateway and within services.
5. Add break-glass and operational runbooks for identity outage scenarios.

## Required Checks

- Group and role mappings follow least-privilege by default
- AuthN/AuthZ behavior is consistent across all environments
- Audit logs capture identity, action, and policy decision

## Decision Framework

- Treat server-side authorization as the authoritative source for access decisions.
- Default to least-privilege scopes and role mappings.
- When tokens are in use, explicitly define validation, rotation, and revocation behavior.
- When external identity providers are involved, define outage and fallback behavior.

## Common Rationalizations And Rebuttals

- "Client checks are enough." -> Client-side logic can be bypassed; enforce checks at backend boundaries.
- "Broad scopes are easier to manage." -> Broad scopes expand the blast radius and introduce compliance risk.
- "We can add audit logs later." -> Absent audit evidence impedes incident response and compliance reviews.

## Evidence Pack

- Negative test cases covering unauthorized and malformed access attempts
- Scope-to-permission mapping with owner sign-off
- Token and session lifecycle flow with revocation behavior documented
- Audit and security monitoring evidence for sensitive operations

## Exit Criteria

- Okta integration is secure, observable, and operable
- Enterprise access scenarios function without privilege escalation gaps
