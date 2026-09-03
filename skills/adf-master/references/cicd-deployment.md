# ADF CI/CD Deployment (ARM, PrePostDeploymentScript, GitHub Actions, Azure DevOps)

A detailed look at ADF deployment: generating ARM templates, the `PrePostDeploymentScript.ps1` pattern (stopping/starting triggers around deploys and cleaning up removed resources), and full GitHub Actions + Azure DevOps pipeline YAMLs. Deprecated features, 2025-2026 updates, documentation sources, troubleshooting, and best practices stay in SKILL.md; the deployment material lives in this reference.

## CI/CD Deployment Methods

### Modern Automated Approach (Recommended)

**npm Package:** `@microsoft/azure-data-factory-utilities`
- **Latest Version:** 1.0.3+ (check npm for current version)
- **npm URL:** https://www.npmjs.com/package/@microsoft/azure-data-factory-utilities
- **Node.js Requirement:** Version 20.x or compatible

**Key Features:**
- Checks ADF resources for validity without involving the service
- Produces ARM templates programmatically
- Makes true CI/CD possible with no manual publish button
- Offers a preview mode for selective trigger management

**package.json Configuration:**
```json
{
  "scripts": {
    "build": "node node_modules/@microsoft/azure-data-factory-utilities/lib/index",
    "build-preview": "node node_modules/@microsoft/azure-data-factory-utilities/lib/index --preview"
  },
  "dependencies": {
    "@microsoft/azure-data-factory-utilities": "^1.0.3"
  }
}
```

**Commands:**
```bash
# Validate resources
npm run build validate <rootFolder> <factoryId>

# Generate ARM templates
npm run build export <rootFolder> <factoryId> [outputFolder]

# Preview mode (only stop/start modified triggers)
npm run build-preview export <rootFolder> <factoryId> [outputFolder]
```

**Official Documentation:**
- URL: https://learn.microsoft.com/en-us/azure/data-factory/continuous-integration-delivery-improvements
- Last Updated: January 2025
- Topics: Setup, configuration, build commands, CI/CD integration

### Traditional Manual Approach (Legacy)

**Method:** Git integration + Publish button

**Process:**
1. Set up Git integration through the ADF UI (Dev environment only)
2. Author changes in ADF Studio
3. Press the "Publish" button, which generates the ARM templates
4. The templates land in the `adf_publish` branch
5. Release pipelines then deploy from the `adf_publish` branch

**When to Use:**
- You are migrating from an existing setup
- There is no build pipeline infrastructure
- Deployments are simple and skip validation

**Limitations:**
- A manual publish action is required
- Nothing is validated until publish time
- Not genuine CI/CD (a manual step remains)
- Validation on pull requests is not possible

**Migration Path:** For new implementations, the modern approach is recommended

## ARM Template Deployment

### PowerShell Deployment

**Primary Command:** `New-AzResourceGroupDeployment`

**Syntax:**
```powershell
New-AzResourceGroupDeployment `
  -ResourceGroupName "<resource-group-name>" `
  -TemplateFile "ARMTemplateForFactory.json" `
  -TemplateParameterFile "ARMTemplateParametersForFactory.<environment>.json" `
  -factoryName "<factory-name>" `
  -Mode Incremental `
  -Verbose
```

**Validation:**
```powershell
Test-AzResourceGroupDeployment `
  -ResourceGroupName "<resource-group-name>" `
  -TemplateFile "ARMTemplateForFactory.json" `
  -TemplateParameterFile "ARMTemplateParametersForFactory.<environment>.json" `
  -factoryName "<factory-name>"
```

**What-If Analysis:**
```powershell
New-AzResourceGroupDeployment `
  -ResourceGroupName "<resource-group-name>" `
  -TemplateFile "ARMTemplateForFactory.json" `
  -TemplateParameterFile "ARMTemplateParametersForFactory.<environment>.json" `
  -factoryName "<factory-name>" `
  -WhatIf
```

### Azure CLI Deployment

**Primary Command:** `az deployment group create`

**Syntax:**
```bash
az deployment group create \
  --resource-group <resource-group-name> \
  --template-file ARMTemplateForFactory.json \
  --parameters ARMTemplateParametersForFactory.<environment>.json \
  --parameters factoryName=<factory-name> \
  --mode Incremental
```

**Validation:**
```bash
az deployment group validate \
  --resource-group <resource-group-name> \
  --template-file ARMTemplateForFactory.json \
  --parameters ARMTemplateParametersForFactory.<environment>.json \
  --parameters factoryName=<factory-name>
```

**What-If Analysis:**
```bash
az deployment group what-if \
  --resource-group <resource-group-name> \
  --template-file ARMTemplateForFactory.json \
  --parameters ARMTemplateParametersForFactory.<environment>.json \
  --parameters factoryName=<factory-name>
```

## PrePostDeploymentScript

### Current Version: Ver2

**Location:** https://github.com/Azure/Azure-DataFactory/blob/507f4d4a53da29edc684d934161aa880befd3e0c/SamplesV2/ContinuousIntegrationAndDelivery/PrePostDeploymentScript.Ver2.ps1

**Key Improvement in Ver2:**
- Stops and restarts ONLY the triggers that were modified
- Ver1 stopped/started every trigger (slower and more disruptive)
- Detects changes by comparing trigger payloads

**Download Command:**
```bash
# Linux/macOS/Git Bash
curl -o PrePostDeploymentScript.Ver2.ps1 https://raw.githubusercontent.com/Azure/Azure-DataFactory/507f4d4a53da29edc684d934161aa880befd3e0c/SamplesV2/ContinuousIntegrationAndDelivery/PrePostDeploymentScript.Ver2.ps1

# PowerShell
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/Azure/Azure-DataFactory/507f4d4a53da29edc684d934161aa880befd3e0c/SamplesV2/ContinuousIntegrationAndDelivery/PrePostDeploymentScript.Ver2.ps1" -OutFile "PrePostDeploymentScript.Ver2.ps1"
```

### Parameters

**Pre-Deployment (Stop Triggers):**
```powershell
./PrePostDeploymentScript.Ver2.ps1 `
  -armTemplate "<path-to-ARMTemplateForFactory.json>" `
  -ResourceGroupName "<resource-group-name>" `
  -DataFactoryName "<factory-name>" `
  -predeployment $true `
  -deleteDeployment $false
```

**Post-Deployment (Start Triggers & Cleanup):**
```powershell
./PrePostDeploymentScript.Ver2.ps1 `
  -armTemplate "<path-to-ARMTemplateForFactory.json>" `
  -ResourceGroupName "<resource-group-name>" `
  -DataFactoryName "<factory-name>" `
  -predeployment $false `
  -deleteDeployment $true
```

### PowerShell Requirements

**Version:** PowerShell Core (7.0+) is the recommended version
- Azure DevOps: set `pwsh: true` in the AzurePowerShell@5 task
- Locally: run the `pwsh` command, not `powershell`

**Modules Required:**
- Az.DataFactory
- Az.Resources

**Official Documentation:**
- URL: https://learn.microsoft.com/en-us/azure/data-factory/continuous-integration-delivery-sample-script
- Last Updated: January 2025

## GitHub Actions CI/CD

### Official Resources

**Medium Article (Recent 2025):**
- URL: https://medium.com/microsoftazure/azure-data-factory-build-and-deploy-with-new-ci-cd-flow-using-github-actions-cd46c95054e0
- Author: Jared Zagelbaum (Microsoft Azure)
- Topics: Modern CI/CD flow, npm package usage, GitHub Actions setup

**Microsoft Community Hub:**
- URL: https://techcommunity.microsoft.com/blog/fasttrackforazureblog/azure-data-factory-cicd-with-github-actions/3768493
- Topics: End-to-end GitHub Actions setup, workload identity federation

**Community Blog (February 2025):**
- URL: https://linusdata.blog/2025/03/14/automating-azure-data-factory-deployments-with-github-actions/
- Topics: Practical implementation guide, troubleshooting tips

### Key GitHub Actions

**Essential Actions:**
- `actions/checkout@v4` - Check out the repository
- `actions/setup-node@v4` - Install Node.js
- `actions/upload-artifact@v4` - Publish the ARM templates
- `actions/download-artifact@v4` - Fetch the ARM templates in the deploy workflow
- `azure/login@v2` - Sign in to Azure
- `azure/arm-deploy@v2` - Deploy the ARM templates
- `azure/powershell@v2` - Execute PrePostDeploymentScript

### Authentication Methods

**Service Principal (JSON credentials):**
```json
{
  "clientId": "<GUID>",
  "clientSecret": "<STRING>",
  "subscriptionId": "<GUID>",
  "tenantId": "<GUID>"
}
```
Save this in the GitHub secret `AZURE_CREDENTIALS`

**Workload Identity Federation (More secure):**
- No secrets are kept anywhere
- Relies on OIDC (OpenID Connect)
- The recommended option for production
- Setup: https://learn.microsoft.com/en-us/azure/developer/github/connect-from-azure

## Azure DevOps CI/CD

### Official Resources

**Microsoft Learn:**
- URL: https://learn.microsoft.com/en-us/azure/data-factory/continuous-integration-delivery-automate-azure-pipelines
- Topics: Build pipeline, release pipeline, service connections, variable groups

**Community Guides:**
- Adam Marczak Blog: https://marczak.io/posts/2023/02/quick-cicd-for-data-factory/
- Topics: Quick setup, best practices, folder structure

**Towards Data Science:**
- URL: https://towardsdatascience.com/azure-data-factory-ci-cd-made-simple-building-and-deploying-your-arm-templates-with-azure-devops-30c30595afa5
- Topics: ARM template build and deployment workflow

### Key Azure DevOps Tasks

**Build Pipeline Tasks:**
- `UseNode@1` - Install Node.js
- `Npm@1` - Install packages, run build commands
- `PublishPipelineArtifact@1` - Publish ARM templates

**Release Pipeline Tasks:**
- `DownloadPipelineArtifact@2` - Download ARM templates
- `AzurePowerShell@5` - Run PrePostDeploymentScript
- `AzureResourceManagerTemplateDeployment@3` - Deploy ARM template

### Service Connection Requirements

**Permissions Needed:**
- Data Factory Contributor (on all Data Factories)
- Contributor (on Resource Groups)
- Key Vault access policies (if using secrets)
**Configuration:**
- Project Settings → Service connections → New service connection
- Type: Azure Resource Manager
- Authentication: Service Principal (recommended) or Managed Identity
