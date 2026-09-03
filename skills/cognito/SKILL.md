---
name: cognito
description: >-
  AWS Cognito authentication and authorization service for users. Use when
  creating user pools, configuring identity pools, implementing OAuth flows,
  managing user attributes, or integrating social identity providers.
metadata:
  category: development
  source:
    repository: 'https://github.com/itsmostafa/aws-agent-skills'
    path: skills/cognito
    license_path: LICENSE
    commit: 4ab904a69cda893b5c98f97966bf9a48311823e9
---

# AWS Cognito

Amazon Cognito delivers authentication, authorization, and user management for web and mobile applications. Users can authenticate directly or via federated identity providers.

## Table of Contents

- [Core Concepts](#core-concepts)
- [Common Patterns](#common-patterns)
- [CLI Reference](#cli-reference)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)
- [References](#references)

## Core Concepts

### User Pools

User directory for registration and sign-in. Offers:
- User registration and authentication
- OAuth 2.0 / OpenID Connect tokens
- MFA and password policies
- Customizable UI and flows

### Identity Pools (Federated Identities)

Issue temporary AWS credentials for accessing AWS services. Supported user types include:
- Cognito User Pool users
- Social identity (Google, Facebook, Apple)
- SAML/OIDC enterprise identity
- Anonymous guests

### Tokens

| Token | Purpose | Lifetime |
|-------|---------|----------|
| **ID Token** | User identity claims | 1 hour |
| **Access Token** | API authorization | 1 hour |
| **Refresh Token** | Get new ID/Access tokens | 30 days (configurable) |

## Common Patterns

### Create User Pool

**AWS CLI:**

```bash
aws cognito-idp create-user-pool \
  --pool-name my-app-users \
  --policies '{
    "PasswordPolicy": {
      "MinimumLength": 12,
      "RequireUppercase": true,
      "RequireLowercase": true,
      "RequireNumbers": true,
      "RequireSymbols": true
    }
  }' \
  --auto-verified-attributes email \
  --username-attributes email \
  --mfa-configuration OPTIONAL \
  --user-attribute-update-settings '{
    "AttributesRequireVerificationBeforeUpdate": ["email"]
  }'
```

### Create App Client

```bash
aws cognito-idp create-user-pool-client \
  --user-pool-id us-east-1_abc123 \
  --client-name my-web-app \
  --generate-secret \
  --explicit-auth-flows ALLOW_USER_SRP_AUTH ALLOW_REFRESH_TOKEN_AUTH \
  --supported-identity-providers COGNITO \
  --callback-urls https://myapp.com/callback \
  --logout-urls https://myapp.com/logout \
  --allowed-o-auth-flows code \
  --allowed-o-auth-scopes openid email profile \
  --allowed-o-auth-flows-user-pool-client \
  --access-token-validity 60 \
  --id-token-validity 60 \
  --refresh-token-validity 30 \
  --token-validity-units '{
    "AccessToken": "minutes",
    "IdToken": "minutes",
    "RefreshToken": "days"
  }'
```

### Sign Up User

```python
import boto3
import hmac
import hashlib
import base64

cognito = boto3.client('cognito-idp')

def get_secret_hash(username, client_id, client_secret):
    message = username + client_id
    dig = hmac.new(
        client_secret.encode('utf-8'),
        message.encode('utf-8'),
        digestmod=hashlib.sha256
    ).digest()
    return base64.b64encode(dig).decode()

import os

username = 'user@example.invalid'
client_id = os.environ['COGNITO_CLIENT_ID']
client_secret = os.environ['COGNITO_CLIENT_SECRET']

response = cognito.sign_up(
    ClientId=client_id,
    SecretHash=get_secret_hash(username, client_id, client_secret),
    Username=username,
    Password=os.environ['COGNITO_INITIAL_PASSWORD'],
    UserAttributes=[
        {'Name': 'email', 'Value': username},
        {'Name': 'name', 'Value': 'Example User'}
    ]
)
```

### Confirm Sign Up

```python
cognito.confirm_sign_up(
    ClientId='client-id',
    SecretHash=get_secret_hash('user@example.com', 'client-id', 'client-secret'),
    Username='user@example.com',
    ConfirmationCode='123456'
)
```

### Authenticate User

```python
response = cognito.initiate_auth(
    ClientId='client-id',
    AuthFlow='USER_SRP_AUTH',
    AuthParameters={
        'USERNAME': 'user@example.com',
        'SECRET_HASH': get_secret_hash('user@example.com', 'client-id', 'client-secret'),
        'SRP_A': srp_a  # From SRP library
    }
)

# For simple password auth (not recommended for production)
response = cognito.admin_initiate_auth(
    UserPoolId='us-east-1_abc123',
    ClientId='client-id',
    AuthFlow='ADMIN_USER_PASSWORD_AUTH',
    AuthParameters={
        'USERNAME': 'user@example.com',
        'PASSWORD': 'password',
        'SECRET_HASH': get_secret_hash('user@example.com', 'client-id', 'client-secret')
    }
)

tokens = response['AuthenticationResult']
id_token = tokens['IdToken']
access_token = tokens['AccessToken']
refresh_token = tokens['RefreshToken']
```

### Refresh Tokens

```python
response = cognito.initiate_auth(
    ClientId='client-id',
    AuthFlow='REFRESH_TOKEN_AUTH',
    AuthParameters={
        'REFRESH_TOKEN': refresh_token,
        'SECRET_HASH': get_secret_hash('user@example.com', 'client-id', 'client-secret')
    }
)
```

### Create Identity Pool

```bash
aws cognito-identity create-identity-pool \
  --identity-pool-name my-app-identities \
  --allow-unauthenticated-identities \
  --cognito-identity-providers \
    ProviderName=cognito-idp.us-east-1.amazonaws.com/us-east-1_abc123,\
ClientId=client-id,\
ServerSideTokenCheck=true
```

### Get AWS Credentials

```python
import boto3

cognito_identity = boto3.client('cognito-identity')

# Get identity ID
response = cognito_identity.get_id(
    IdentityPoolId='us-east-1:12345678-1234-1234-1234-123456789012',
    Logins={
        'cognito-idp.us-east-1.amazonaws.com/us-east-1_abc123': id_token
    }
)
identity_id = response['IdentityId']

# Get credentials
response = cognito_identity.get_credentials_for_identity(
    IdentityId=identity_id,
    Logins={
        'cognito-idp.us-east-1.amazonaws.com/us-east-1_abc123': id_token
    }
)

credentials = response['Credentials']
# Use credentials['AccessKeyId'], credentials['SecretKey'], credentials['SessionToken']
```

## CLI Reference

### User Pool

| Command | Description |
|---------|-------------|
| `aws cognito-idp create-user-pool` | Create user pool |
| `aws cognito-idp describe-user-pool` | Get pool details |
| `aws cognito-idp update-user-pool` | Update pool settings |
| `aws cognito-idp delete-user-pool` | Delete pool |
| `aws cognito-idp list-user-pools` | List pools |

### Users

| Command | Description |
|---------|-------------|
| `aws cognito-idp admin-create-user` | Create user (admin) |
| `aws cognito-idp admin-delete-user` | Delete user |
| `aws cognito-idp admin-get-user` | Get user details |
| `aws cognito-idp list-users` | List users |
| `aws cognito-idp admin-set-user-password` | Set password |
| `aws cognito-idp admin-disable-user` | Disable user |

### Authentication

| Command | Description |
|---------|-------------|
| `aws cognito-idp initiate-auth` | Start authentication |
| `aws cognito-idp respond-to-auth-challenge` | Respond to MFA |
| `aws cognito-idp admin-initiate-auth` | Admin authentication |

## Best Practices

### Security

- **Enable MFA** for all users (at minimum as optional)
- **Enforce strong password policies**
- **Activate advanced security features** (adaptive auth)
- **Verify email/phone** prior to permitting sign-in
- **Keep token lifetimes short** for sensitive applications
- **Never embed client secrets** in frontend code

### User Experience

- **Use hosted UI** for rapid implementation
- **Customize UI** via CSS
- **Build proper error handling**
- **Communicate password requirements** clearly

### Architecture

- **Use identity pools** to access AWS resources
- **Use access tokens** with API Gateway
- **Store refresh tokens in a secure location**
- **Refresh tokens proactively** before they expire

## Troubleshooting

### User Cannot Sign In

**Causes:**
- User account not confirmed
- Incorrect password
- User account disabled
- Account locked after too many failed attempts

**Debug:**

```bash
aws cognito-idp admin-get-user \
  --user-pool-id us-east-1_abc123 \
  --username user@example.com
```

### Token Validation Failed

**Causes:**
- Token has expired
- Incorrect user pool or client ID
- Invalid token signature

**Validate JWT:**

```python
import jwt
import requests

# Get JWKS
jwks_url = f'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_abc123/.well-known/jwks.json'
jwks = requests.get(jwks_url).json()

# Decode and verify (use python-jose or similar)
from jose import jwt

claims = jwt.decode(
    token,
    jwks,
    algorithms=['RS256'],
    audience='client-id',
    issuer='https://cognito-idp.us-east-1.amazonaws.com/us-east-1_abc123'
)
```

### Hosted UI Not Working

**Check:**
- Callback URLs are configured correctly
- A domain is configured for the user pool
- OAuth settings are enabled

```bash
# Check domain
aws cognito-idp describe-user-pool \
  --user-pool-id us-east-1_abc123 \
  --query 'UserPool.Domain'
```

### Rate Limiting

**Symptom:** `TooManyRequestsException`

**Solutions:**
- Apply exponential backoff
- Submit a quota increase request
- Cache tokens where appropriate

## References

- [Cognito Developer Guide](https://docs.aws.amazon.com/cognito/latest/developerguide/)
- [Cognito User Pools API](https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/)
- [Cognito Identity API](https://docs.aws.amazon.com/cognitoidentity/latest/APIReference/)
- [Cognito CLI Reference](https://docs.aws.amazon.com/cli/latest/reference/cognito-idp/)
