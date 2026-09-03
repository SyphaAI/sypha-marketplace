# Azure Databricks — Deployment

> This file serves as a reference companion to the main [SKILL.md](SKILL.md). To retrieve documentation content, this skill needs **network access**:
- **Preferred**: Call `mcp_microsoftdocs:microsoft_docs_fetch` with the query string `from=learn-agent-skill`. Output is Markdown.
- **Fallback**: Call `fetch_webpage` with the query string `from=learn-agent-skill&accept=text/markdown`. Output is Markdown.

### Deployment
| Topic | URL |
|-------|-----|
| Set up managed disaster recovery in Azure Databricks | https://learn.microsoft.com/en-us/azure/databricks/admin/managed-disaster-recovery |
| Create and administer serverless SQL warehouses in Databricks | https://learn.microsoft.com/en-us/azure/databricks/admin/sql/serverless |
| Use the Azure CLI to deploy Azure Databricks workspaces | https://learn.microsoft.com/en-us/azure/databricks/admin/workspace/azure-cli |
| Create Azure Databricks workspaces through the Azure Portal | https://learn.microsoft.com/en-us/azure/databricks/admin/workspace/create-workspace |
| Use PowerShell to deploy Azure Databricks workspaces | https://learn.microsoft.com/en-us/azure/databricks/admin/workspace/powershell |
| Use the legacy Stack CLI to deploy Databricks stacks | https://learn.microsoft.com/en-us/azure/databricks/archive/dev-tools/cli/stack-cli |
| Serve MLflow models via legacy Databricks Model Serving | https://learn.microsoft.com/en-us/azure/databricks/archive/legacy-model-serving/model-serving |
| Set up Git-based CI/CD for Databricks dashboards | https://learn.microsoft.com/en-us/azure/databricks/dashboards/automate/git-support |
| Move Databricks dashboards between workspaces via export and import | https://learn.microsoft.com/en-us/azure/databricks/dashboards/automate/import-export |
| Migrate Azure Databricks Hive tables to Unity Catalog | https://learn.microsoft.com/en-us/azure/databricks/data-governance/unity-catalog/migrate |
| Migrate workspaces to Unity Catalog with UCX utilities | https://learn.microsoft.com/en-us/azure/databricks/data-governance/unity-catalog/ucx |
| Use Docker to run Databricks bundles in air-gapped environments | https://learn.microsoft.com/en-us/azure/databricks/dev-tools/bundles/airgapped-environment |
| Move Databricks bundles onto the direct deployment engine | https://learn.microsoft.com/en-us/azure/databricks/dev-tools/bundles/direct |
| Run and deploy Declarative Automation Bundles from the workspace | https://learn.microsoft.com/en-us/azure/databricks/dev-tools/bundles/workspace-deploy |
| Build CI/CD pipelines for Azure Databricks | https://learn.microsoft.com/en-us/azure/databricks/dev-tools/ci-cd/ |
| Use Azure DevOps for CI/CD on Azure Databricks | https://learn.microsoft.com/en-us/azure/databricks/dev-tools/ci-cd/azure-devops |
| Plan CI/CD workflows and practices on Databricks | https://learn.microsoft.com/en-us/azure/databricks/dev-tools/ci-cd/flows |
| Run CI/CD on Azure Databricks with GitHub Actions | https://learn.microsoft.com/en-us/azure/databricks/dev-tools/ci-cd/github |
| Configure Jenkins-based CI/CD pipelines for Azure Databricks | https://learn.microsoft.com/en-us/azure/databricks/dev-tools/ci-cd/jenkins |
| Use GitHub Actions to automate Databricks Apps deployment | https://learn.microsoft.com/en-us/azure/databricks/dev-tools/databricks-apps/cicd-github-actions |
| Get the workspace and local environment ready for Databricks Apps | https://learn.microsoft.com/en-us/azure/databricks/dev-tools/databricks-apps/configure-env |
| Deploy Databricks apps using the UI and CLI | https://learn.microsoft.com/en-us/azure/databricks/dev-tools/databricks-apps/deploy |
| Work with Declarative Automation Bundles in Databricks VS Code | https://learn.microsoft.com/en-us/azure/databricks/dev-tools/vscode-ext/bundles |
| Use Databricks Apps to deploy custom AI agents | https://learn.microsoft.com/en-us/azure/databricks/generative-ai/agent-framework/author-agent |
| Ship chat UI agents on Databricks Apps | https://learn.microsoft.com/en-us/azure/databricks/generative-ai/agent-framework/chat-app |
| Build GitHub Actions CI/CD pipelines for Databricks Apps agents | https://learn.microsoft.com/en-us/azure/databricks/generative-ai/agent-framework/cicd-agent-app |
| Use Model Serving to deploy Databricks AI agents | https://learn.microsoft.com/en-us/azure/databricks/generative-ai/agent-framework/deploy-agent |
| Move Databricks Apps agents to production with governance and scaling | https://learn.microsoft.com/en-us/azure/databricks/generative-ai/agent-framework/productionize-agent |
| Work with the Azure Databricks Genie mobile app on iOS and Android | https://learn.microsoft.com/en-us/azure/databricks/genie-one/mobile |
| Create GitHub ingestion pipelines using Lakeflow Connect | https://learn.microsoft.com/en-us/azure/databricks/ingestion/lakeflow-connect/github-pipeline |
| Build managed Google Ads ingestion pipelines | https://learn.microsoft.com/en-us/azure/databricks/ingestion/lakeflow-connect/google-ads-pipeline |
| Load GA4 data through Lakeflow Connect and BigQuery | https://learn.microsoft.com/en-us/azure/databricks/ingestion/lakeflow-connect/google-analytics-pipeline |
| Create HubSpot ingestion pipelines using Lakeflow Connect | https://learn.microsoft.com/en-us/azure/databricks/ingestion/lakeflow-connect/hubspot-pipeline |
| Build managed Jira ingestion pipelines in Databricks | https://learn.microsoft.com/en-us/azure/databricks/ingestion/lakeflow-connect/jira-pipeline |
| Manage Azure Databricks jobs programmatically with CLI, SDK, and REST | https://learn.microsoft.com/en-us/azure/databricks/jobs/automate |
| Compile and run JARs on Databricks serverless compute | https://learn.microsoft.com/en-us/azure/databricks/jobs/how-to/use-jars-in-workflows |
| Build Databricks-compatible JARs for Lakeflow Jobs | https://learn.microsoft.com/en-us/azure/databricks/jobs/jar-create |
| Constraints and requirements for standalone pipelines | https://learn.microsoft.com/en-us/azure/databricks/ldp/dbsql/compute |
| Trigger Databricks pipelines from Jobs, Airflow, or Data Factory | https://learn.microsoft.com/en-us/azure/databricks/ldp/workflows |
| Roll out provisioned throughput Foundation Model APIs in Databricks | https://learn.microsoft.com/en-us/azure/databricks/machine-learning/foundation-model-apis/deploy-prov-throughput-foundation-model-apis |
| Set up CI/CD for machine learning on Databricks | https://learn.microsoft.com/en-us/azure/databricks/machine-learning/mlops/ci-cd-for-ml |
| Use Stacks to automate Databricks MLOps | https://learn.microsoft.com/en-us/azure/databricks/machine-learning/mlops/mlops-stacks |
| Apply express deployments to Databricks model endpoints | https://learn.microsoft.com/en-us/azure/databricks/machine-learning/model-serving/express-deployments |
| Launch Ray clusters as jobs on Azure Databricks | https://learn.microsoft.com/en-us/azure/databricks/machine-learning/ray/start-ray |
| Manage the model lifecycle with MLflow 3 deployment jobs | https://learn.microsoft.com/en-us/azure/databricks/mlflow/deployment-job |
| Ship Databricks GenAI apps with automatic tracing | https://learn.microsoft.com/en-us/azure/databricks/mlflow3/genai/tracing/prod-tracing |
| Move Databricks HTTP routing onto serverless compute | https://learn.microsoft.com/en-us/azure/databricks/query-federation/http-migration |
| Bring Databricks Git folders into CI/CD workflows | https://learn.microsoft.com/en-us/azure/databricks/repos/ci-cd |
| Look up Azure Databricks feature availability per region | https://learn.microsoft.com/en-us/azure/databricks/resources/feature-region-support |
| Learn about Azure Databricks platform release windows | https://learn.microsoft.com/en-us/azure/databricks/resources/platform-release |
| Move legacy line charts to the new Databricks chart types | https://learn.microsoft.com/en-us/azure/databricks/visualizations/legacy-charts |
