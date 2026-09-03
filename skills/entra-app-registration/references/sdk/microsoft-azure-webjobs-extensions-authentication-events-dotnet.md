# Authentication Events — .NET SDK Quick Reference

> Summarized from **microsoft-azure-webjobs-extensions-authentication-events-dotnet**.
> Complete patterns (attribute collection, OTP customization, external data enrichment)
> available in the source plugin skill if installed.

## Install
dotnet add package Microsoft.Azure.WebJobs.Extensions.AuthenticationEvents

## Quick Start
```csharp
using Microsoft.Azure.WebJobs.Extensions.AuthenticationEvents;
using Microsoft.Azure.WebJobs.Extensions.AuthenticationEvents.TokenIssuanceStart;

[FunctionName("OnTokenIssuanceStart")]
public static WebJobsAuthenticationEventResponse Run(
    [WebJobsAuthenticationEventsTrigger] WebJobsTokenIssuanceStartRequest request,
    ILogger log)
{
    var response = new WebJobsTokenIssuanceStartResponse();
    response.Actions.Add(new WebJobsProvideClaimsForToken
    {
        Claims = new Dictionary<string, string> { { "claim", "value" } }
    });
    return response;
}
```

## Best Practices
- Validate all inputs — treat request data as untrusted and validate it before use
- Handle errors gracefully — return proper error responses instead of throwing exceptions
- Log correlation IDs — include CorrelationId in logs to aid troubleshooting
- Keep functions fast — authentication events are subject to timeout constraints
- Use managed identity — the secure way to access Azure resources from your function
- Cache external data — prevent slow dependency lookups from running on every request
- Test locally — leverage Azure Functions Core Tools with representative sample payloads
- Monitor with App Insights — observe function execution and surface errors proactively
