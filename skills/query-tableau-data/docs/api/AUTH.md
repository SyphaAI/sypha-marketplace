# Tableau HTTP Authentication

The **VizQL Data Service (VDS)** used to query data sources is part of a broader set of HTTP APIs available to users on both Tableau Cloud and Server. It relies on the same authentication mechanisms as the other REST API methods.

Every Tableau HTTP API endpoint requires an authentication token in the `X-Tableau-Auth` header of each request. This token allows Tableau Cloud or Tableau Server to verify your identity and grant access to resources based on your permissions.

To obtain an authentication token, you must call the Tableau REST API `Sign In` method using one of three approaches:

1. Personal Access Token (`PAT`)
2. Username & password
3. Connected Apps (`JWT`)

This skill prefers `PAT` because it is straightforward for users to obtain from their Tableau account page. The `JWT` option is intended for secure server environments and requires site admin access. Username and password authentication should be used only as a fallback.


## Managing Credentials

Secure credential management is a necessary requirement. You will need to create a `.env` file to store environment variables.

Place the `.env` file in the skill root directory, alongside `.env.template` and `pyproject.toml`. The template is available at [.env.template](../../.env.template) — copy it and fill in your values.

The [query_tableau_data_py](../../src/query_tableau_data_py) package handles secure access to environment variables and provides all the foundational components required to query Tableau data securely.


## Permissions

When you sign in using any supported authentication method, you must use the redeemed token for all subsequent HTTP operations. Consequently, all Tableau responses enforce the individual and group permissions configured for those user credentials. Querying data sources is an action available to both regular users and Tableau site admins.

> _NOTE_: Published datasources require the API Access permission to be enabled. This can be done manually through the permissions dialog UI or via the REST API.

---

## Sign In

METHOD: `POST /api/api-version/auth/signin`

> _Note_: For Tableau Cloud, the server address in the URI must contain the pod name, such as prod-ca-a or us-east-1. For example, the URI to sign in to a site in the 10ay pod would be:https://prod-ca-a.online.tableau.com/api/api-version/auth/signin

_Example Sign-In Request_:
```bash
curl "https://{my-server}/api/{api-version}/auth/signin" -X POST -d @signin.json
```

### Personal Access Token (PAT)

REQUEST PAYLOAD:
```json
{
    "credentials": {
        "personalAccessTokenName": "personal-access-token-name",
        "personalAccessTokenSecret": "personal-access-token-secret",
        "site": {
            "contentUrl": "content-url"
        }
    }
}
```

### Username & Password

REQUEST PAYLOAD:
```json
{
    "credentials": {
        "name": "username",
        "password": "password",
        "site": {
            "contentUrl": "content-url"
        }
    }
}
```

### Credentials

All authentication methods return a credentials response:

RESPONSE PAYLOAD:
```json
{
    "credentials": {
        "token": "authentication-token",
        "estimatedTimeToExpiration": "time-to-expiration",
        "site": {
            "id": "site-id",
            "contentUrl": "content-url"
        },
        "user": {
            "id": "user-id-of-signed-in-user"
        }
    }
}
```

Once you receive the response, extract useful values such as the credentials token and supply them to the [query_tableau_data_py](../../src/query_tableau_data_py) package.

By default, the credentials token remains valid for **240 minutes**. If your application needs to make additional calls after the token expires, call Sign In again to obtain a fresh credentials token.

Include the credentials token as the value of the `X-Tableau-Auth` header for all other REST API calls.

_Example Authenticated Request_:
```bash
curl "https://{my-server}/api/{api-version}/sites/{site-id}/{method}" -X GET -H "X-Tableau-Auth: ${TABLEAU_CREDENTIALS_TOKEN:?required}"
```

When you have finished with a session, call `Sign Out`. This invalidates the credentials token, ensuring that no one else can use it to make further REST API calls.

> _Note_: The credentials token is valid for REST API calls, VizQL Data Service calls, and Tableau Metadata API (GraphQL) queries. You cannot use the credentials token as authentication for other operations with Tableau Server or Tableau Cloud. In addition, the credentials token is scoped to the site you signed in to. You cannot sign in to one site and use that token to send requests to a different site. Attempting to do so causes the server to return an `HTTP 403` (Forbidden) error.
