# API Permissions Guide

This document describes how to configure and manage API permissions for your Microsoft Entra app registration.

## Permission Types

### Delegated Permissions (User Context)

**What:** The application operates on behalf of a signed-in user

**When to use:**
- A user is present and able to consent
- The app must access resources in the context of the user
- Interactive authentication flows are in use

**Examples:**
- Read user's email
- Update user's calendar
- Access user's OneDrive files

**Scope format:** The user must consent (or an admin pre-consents)

### Application Permissions (App Context)

**What:** The application acts under its own identity (no user involved)

**When to use:**
- Background services or daemons
- Scheduled jobs
- API-to-API calls that do not involve a user

**Examples:**
- Read all users in the organization
- Send mail as any user
- Access all SharePoint sites

**Requirement:** Admin consent is always required

## Permission Scopes

### Understanding Scopes

**Scope:** A string that defines what access is granted

**Format:**
```
{resource}/{permission_name}

Examples:
https://graph.microsoft.com/User.Read
https://graph.microsoft.com/Mail.Send
api://myapi-id/access_as_user
```

### .default Scope

A special scope that encompasses all configured permissions:

```
https://graph.microsoft.com/.default
api://your-api-id/.default
```

**When to use:**
- Client credentials flow (always required)
- When you want all pre-configured permissions included
- When migrating from the v1.0 endpoint

## Microsoft Graph Permissions

### Common Delegated Permissions

| Permission | What it allows | Admin Consent Required |
|------------|---------------|----------------------|
| `User.Read` | Read signed-in user's profile | No |
| `User.ReadWrite` | Read and update user profile | No |
| `User.ReadBasic.All` | Read basic info of all users | No |
| `User.Read.All` | Read all users' full profiles | Yes |
| `Mail.Read` | Read user's mail | No |
| `Mail.ReadWrite` | Read and write user's mail | No |
| `Mail.Send` | Send mail as user | No |
| `Calendars.Read` | Read user's calendars | No |
| `Calendars.ReadWrite` | Read and write calendars | No |
| `Files.Read.All` | Read all files user can access | No |
| `Sites.Read.All` | Read items in all site collections | Yes |
| `Directory.Read.All` | Read directory data | Yes |
| `Directory.ReadWrite.All` | Read and write directory data | Yes |

### Common Application Permissions

| Permission | What it allows | Admin Consent Required |
|------------|---------------|----------------------|
| `User.Read.All` | Read all users' full profiles | Yes (Always) |
| `User.ReadWrite.All` | Read and write all users' profiles | Yes (Always) |
| `Mail.Read` | Read mail in all mailboxes | Yes (Always) |
| `Mail.Send` | Send mail as any user | Yes (Always) |
| `Calendars.Read` | Read calendars in all mailboxes | Yes (Always) |
| `Directory.Read.All` | Read directory data | Yes (Always) |
| `Directory.ReadWrite.All` | Read and write directory data | Yes (Always) |
| `Group.ReadWrite.All` | Read and write all groups | Yes (Always) |

## Adding Permissions

### Azure Portal Method

1. Navigate to your app registration
2. Click **"API permissions"** in left menu
3. Click **"+ Add a permission"**
4. Choose API source:
   - **Microsoft APIs** (Graph, Office 365, etc.)
   - **APIs my organization uses** (custom APIs)
   - **My APIs** (your own APIs)

5. Select permission type:
   - **Delegated permissions** (user context)
   - **Application permissions** (app context)

6. Search and select permissions
7. Click **"Add permissions"**

Refer to [cli-commands.md](cli-commands.md) for Azure CLI commands to add API permissions programmatically.

## Finding Permission IDs

### Method 1: Azure Portal

1. Go to Microsoft Entra ID → Enterprise applications
2. Search for "Microsoft Graph"
3. Click on it → Permissions
4. Browse available permissions and copy IDs

### Method 2: Microsoft Graph Explorer

1. Visit https://developer.microsoft.com/graph/graph-explorer
2. Click "Modify permissions"
3. Browse and view permission details

### Method 3: Microsoft Documentation

Visit: https://learn.microsoft.com/en-us/graph/permissions-reference

### Method 4: Azure CLI Query

```bash
# List all Graph permissions (warning: long output)
az ad sp list --filter "appId eq '00000003-0000-0000-c000-000000000000'" \
  --query "[0].{delegated:oauth2PermissionScopes,application:appRoles}" -o json
```

## Granting Admin Consent

### When Admin Consent is Required

**Always required for:**
- All application permissions
- High-privilege delegated permissions
- Situations where the organization has disabled user consent

**Examples requiring admin consent:**
- `User.Read.All` (reading all users)
- `Directory.Read.All` (reading directory data)
- `Mail.Read` (as an application permission)
- `Sites.Read.All` (reading all SharePoint sites)

### How to Grant Admin Consent

**Portal Method:**
1. Go to API permissions
2. Click **"Grant admin consent for [Your Org]"**
3. Confirm the action
4. Check for green checkmarks next to permissions

**CLI Method:**
```bash
az ad app permission admin-consent --id $APP_ID
```

### Verifying Consent Status

**Portal:** Look for green checkmarks in "Status" column

**CLI:**
```bash
az ad app permission list --id $APP_ID
```

Look for `consentType: "AllPrincipals"` (admin consented)

## Custom API Permissions

### Exposing Your API

If you are building an API that other applications will call:

1. In your API's app registration, go to **"Expose an API"**
2. Set **Application ID URI**: `api://your-api-id`
3. Click **"+ Add a scope"**
4. Configure scope:
   - **Scope name:** `access_as_user`
   - **Who can consent:** Admins and users
   - **Display name:** "Access MyAPI as user"
   - **Description:** Clear description of what this allows
5. Click **"Add scope"**

## Effective Permissions

### User + App Permissions

**Delegated permissions:** The effective access is the intersection of the user's permissions and the app's permissions

Example:
- User can: Read all users
- App granted: User.Read.All
- **Effective:** Read all users ✅

- User can: Only read their own profile
- App granted: User.Read.All
- **Effective:** Only read own profile (restricted by the user's own rights)

**Application permissions:** Only the app's permissions matter (no user context applies)

## Troubleshooting Permissions

### "Insufficient privileges" Error

**Causes:**
- Permission not added to the app registration
- Admin consent has not been granted
- The user lacks the required permission in the directory
- The resource being accessed falls outside the permission scope

**Solutions:**
1. Review API permissions in the portal
2. Grant admin consent if it has not been done
3. Confirm the user has access to the target resource
4. Ensure the correct permission scope is in use

### "Consent required" Error

**Causes:**
- The user has not yet consented to the permissions
- Admin consent is required but has not been provided
- The token was obtained before the permission was added

**Solutions:**
1. Prompt the user for consent (interactive flow)
2. Have an admin grant consent (via portal or CLI)
3. Obtain a fresh token after adding the permissions

### Permission Appears Granted but Doesn't Work

**Possible issues:**
- An old cached token is being used (obtain a new one)
- The permission is delegated but the user does not have the necessary rights
- The API requires additional configuration
- The permission is deprecated (switch to a current one)

**Debug steps:**
1. Decode the access token at https://jwt.ms
2. Inspect the `scp` claim (delegated) or `roles` claim (application)
3. Confirm the permission is present in the token
4. Verify the permission type is correct (delegated vs application)

## Permission Best Practices

### Development

✅ **Do:**
- Begin with the minimum required permissions
- Add permissions incrementally as features demand them
- Test using non-admin accounts
- Document the reason each permission is needed

❌ **Don't:**
- Request all permissions as a precaution
- Rely solely on admin accounts for testing
- Neglect to grant admin consent for application permissions

### Production

✅ **Do:**
- Review permissions on a quarterly basis
- Remove permissions that are no longer in use
- Apply the least privilege principle
- Monitor how permissions are being used
- Document all permissions in the README

❌ **Don't:**
- Grant excessive permissions for convenience
- Use application permissions when delegated permissions would suffice
- Neglect to revisit admin consent approvals

### Security

✅ **Do:**
- Prefer delegated permissions over application permissions
- Implement thorough scope validation
- Log permission usage
- Handle consent errors in a graceful manner

❌ **Don't:**
- Hardcode permission scopes in multiple locations
- Skip token validation
- Disregard scope mismatches
- Cache permissions indefinitely

## Reference Tables

### Microsoft Graph Permission IDs

**Delegated Permissions:**
```
User.Read                     : e1fe6dd8-ba31-4d61-89e7-88639da4683d
User.ReadWrite                : b4e74841-8e56-480b-be8b-910348b18b4c
User.ReadBasic.All            : b340eb25-3456-403f-be2f-af7a0d370277
Mail.Read                     : 570282fd-fa5c-430d-a7fd-fc8dc98a9dca
Mail.ReadWrite                : 024d486e-b451-40bb-833d-3e66d98c5c73
Mail.Send                     : e383f46e-2787-4529-855e-0e479a3ffac0
Calendars.Read                : 465a38f9-76ea-45b9-9f34-9e8b0d4b0b42
Calendars.ReadWrite           : 1ec239c2-d7c9-4623-a91a-a9775856bb36
Files.Read.All                : df85f4d6-205c-4ac5-a5ea-6bf408dba283
```

**Application Permissions:**
```
User.Read.All                 : df021288-bdef-4463-88db-98f22de89214
User.ReadWrite.All            : 741f803b-c850-494e-b5df-cde7c675a1ca
Mail.Read                     : 810c84a8-4a9e-49e6-bf7d-12d183f40d01
Mail.Send                     : b633e1c5-b582-4048-a93e-9f11b44c7e96
Directory.Read.All            : 7ab1d382-f21e-4acd-a863-ba3e13f7da61
Directory.ReadWrite.All       : 19dbc75e-c2e2-444c-a770-ec69d8559fc7
```

**Note:** Permission IDs are subject to change. Always cross-check against the official [Microsoft Graph Permissions Reference](https://learn.microsoft.com/en-us/graph/permissions-reference) for the most up-to-date values.

## Additional Resources

- [Microsoft Graph Permissions Reference](https://learn.microsoft.com/en-us/graph/permissions-reference)
- [Permission Types](https://learn.microsoft.com/en-us/entra/identity-platform/permissions-consent-overview)
- [Admin Consent Workflow](https://learn.microsoft.com/en-us/entra/identity/enterprise-apps/configure-admin-consent-workflow)
- [Consent Framework](https://learn.microsoft.com/en-us/entra/identity-platform/consent-framework)
