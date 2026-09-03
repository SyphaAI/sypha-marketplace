# Troubleshooting Microsoft Entra App Registration

Use this guide to identify and resolve common problems with app registrations and authentication.

## Table of Contents

- [Authentication Errors](#authentication-errors)
- [Token Issues](#token-issues)
- [Permission Problems](#permission-problems)
- [Redirect URI Issues](#redirect-uri-issues)
- [Application Configuration](#application-configuration)
- [Debugging Tools](#debugging-tools)

## Authentication Errors

### Redirect URI Mismatch

**Error message:**
```
AADSTS50011: The redirect URI 'http://localhost:3000' specified in the request
does not match the redirect URIs configured for the application.
```

**Cause:** The redirect URI supplied in the authentication request does not exactly match any URI configured in the registration.

**Solutions:**

1. **Check exact match** (case-sensitive, trailing slash matters):
   ```
   Registered: https://myapp.com/callback
   Request:    https://myapp.com/callback/  ❌ (trailing slash)
   Request:    https://MyApp.com/callback   ❌ (case difference)
   Request:    https://myapp.com/callback   ✅
   ```

2. **Add URI to app registration:**
   ```bash
   # Portal: Authentication → Add redirect URI
   # CLI:
   az ad app update --id $APP_ID \
     --web-redirect-uris "http://localhost:3000" "https://myapp.com/callback"
   ```

3. **Check platform type:**
   - Web URIs go in "Web" platform
   - SPA URIs go in "Single-page application"
   - Desktop/mobile URIs go in "Public client/native"

### Invalid Client Secret

**Error message:**
```
AADSTS7000215: Invalid client secret provided.
Ensure the secret being sent in the request is the client secret value, not the client secret ID.
```

**Causes:**
- The client secret has expired
- Incorrect secret value was used (the secret ID was copied instead of the actual value)
- The secret does not correspond to this app registration

**Solutions:**

1. **Check expiration:**
   ```bash
   az ad app credential list --id $APP_ID
   ```
2. **Create new secret:**
   ```bash
   az ad app credential reset --id $APP_ID --years 1
   ```
   Copy the `password` value (not the `keyId`)

### User Consent Required

**Error message:**
```
AADSTS65001: The user or administrator has not consented to use the application
```

**Causes:**
- The application requires admin consent for one or more permissions
- The user has not yet consented to the delegated permissions
- Previously granted consent was revoked

**Solutions:**

1. **Grant admin consent (if admin):**
   ```bash
   az ad app permission admin-consent --id $APP_ID
   ```

2. **Request user consent (interactive flow):**
   The client application must have access to a UI surface such as a browser or terminal window. Follow the best practices for your client application when implementing the interactive consent flow.

3. **Check API permissions in portal:**
   - Ensure permissions are added
   - Look for green checkmarks (granted)
   - Yellow warning means not granted

### Grant Declined

**Error message:**
```
AADSTS70000: The request was denied because one or more permissions have been declined
```

**Cause:** The user or an administrator explicitly refused to grant consent.

**Solutions:**

1. **Re-request with explanation:**
   - Communicate clearly why each permission is needed
   - Ask only for the permissions that are strictly necessary

2. **Check if admin consent is required:**
   - Some organizations have disabled user-level consent
   - Reach out to an administrator to have consent granted on their behalf

3. **Reduce permission scope:**
   - Start by requesting the minimum required permissions
   - Add further permissions incrementally as each feature is needed

### Application Not Found

**Error message:**
```
AADSTS700016: Application with identifier '{app-id}' was not found in the directory
```

**Causes:**
- The application ID is incorrect
- The tenant ID is incorrect
- No service principal has been created for the app
- The application belongs to a different tenant

**Solutions:**

1. **Verify application ID:**
   ```bash
   az ad app list --display-name "MyApp" --query "[].{Name:displayName, AppId:appId}"
   ```

2. **Verify tenant ID:**
   ```bash
   az account show --query tenantId -o tsv
   ```

### Application Doesn't have a Service Principal

**Error message:**
```
The app is trying to access a service 'your_app_id'(your_app_name) that your organization 'your_tenant_id' lacks a service principal for
```

**Causes:**
- The tenant is not set up to automatically provision service principals for app registrations created within it.

**Solutions:**

1. **Create service principal:**
   ```bash
   az ad sp create --id $APP_ID
   ```

### Missing Required Field

**Error message:**
```
AADSTS90014: The required field 'client_id' is missing from the request
```

This may occur when the client application is not compatible with Entra. Check with the owner of the client application to confirm whether Entra is supported.

## Token Issues

When the access token is not encrypted, you can safely decode and inspect its claims at https://jwt.ms. **Do not** use any other website for this purpose. Cross-reference the claims in the token against the app registration's configuration to pinpoint discrepancies.

## Debugging Tools

### JWT Token Decoder

**Tool:** https://jwt.ms

**How to use:**
1. Copy your access token
2. Paste into jwt.ms
3. Review claims:
   - `aud` - Audience (should match your API)
   - `iss` - Issuer (should be login.microsoftonline.com)
   - `scp` - Delegated permissions
   - `roles` - Application permissions
   - `exp` - Expiration timestamp
   - `oid` - User object ID

---

### Fiddler

**Use for:** Examining HTTP requests and responses

**What to check:**
- Authorization header format: `Bearer {token}`
- Confirm the token is included in the request
- Response status codes and associated error messages

### Entra Sign-in Logs

**Access:** Azure Portal → Microsoft Entra ID → Sign-in logs

**What to check:**
- Sign-in failures and their frequency
- Error codes and accompanying messages
- Current user consent status
- Failures caused by Conditional Access policies

## Common Error Codes Reference

| Error Code | Meaning | Common Cause |
|------------|---------|--------------|
| AADSTS50011 | Redirect URI mismatch | URI not registered or doesn't match |
| AADSTS50020 | Invalid tenant | Wrong tenant in authority URL |
| AADSTS50034 | User not found | User doesn't exist in tenant |
| AADSTS50053 | Account locked | Too many failed attempts |
| AADSTS50055 | Password expired | User needs to reset password |
| AADSTS50057 | Account disabled | User account disabled |
| AADSTS50058 | Silent sign-in failed | Interactive auth required |
| AADSTS50059 | Tenant not found | Invalid tenant ID |
| AADSTS65001 | Consent required | User/admin hasn't consented |
| AADSTS70000 | Grant declined | User denied consent |
| AADSTS70001 | App disabled | App registration disabled |
| AADSTS700016 | App not found | Invalid app ID or wrong tenant |
| AADSTS7000215 | Invalid client secret | Wrong/expired secret |
| AADSTS90014 | Missing field | Required parameter not sent |
| AADSTS90072 | Consent needed | Admin consent required |

## Best Practices for Troubleshooting

### Systematic Approach

1. **Collect information:**
   - The exact error message and its code
   - When the problem first appeared
   - Any recent changes that may be relevant
   - The affected environment (dev/test/prod)

2. **Check basics first:**
   - App ID and tenant ID are correct
   - Permissions have been added and consented
   - Redirect URIs are configured properly
   - Secrets and certificates are still valid

3. **Use debugging tools:**
   - Decode tokens at jwt.ms
   - Review sign-in logs for failures
   - Enable MSAL logging for detailed output
   - Use a network inspector to trace requests

4. **Test incrementally:**
   - Begin testing with the minimum required permissions
   - Introduce permissions one at a time
   - Test each authentication flow in isolation

## Getting Help

### Microsoft Resources

- [Microsoft Q&A](https://learn.microsoft.com/answers/)
- [Microsoft Identity Platform Documentation](https://learn.microsoft.com/entra/identity-platform/)
