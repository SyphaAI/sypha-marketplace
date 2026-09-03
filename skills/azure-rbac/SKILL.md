---
name: azure-rbac
description: >-
  Assists users in identifying the appropriate Azure RBAC role for an identity
  using least-privilege principles, then generates CLI commands and Bicep code
  to perform the assignment. Also explains the permissions needed to grant
  roles. WHEN: bicep for role assignment, what role should I assign, least
  privilege role, RBAC role for, role to read blobs, role for managed identity,
  custom role definition, assign role to identity, what role do I need to grant
  access, permissions to assign roles.
metadata:
  author: Microsoft
  version: 1.1.1
  category: development
  source:
    repository: 'https://github.com/microsoft/azure-skills'
    path: skills/azure-rbac
    license_path: LICENSE
    commit: 2cd48ca625cddcc1d377d2861fbddd54417c70cc
---
Use the 'azure__documentation' tool to locate the minimal role definition that satisfies the permissions the user needs to assign to an identity. When no built-in role covers the required permissions, use the 'azure__extension_cli_generate' tool to produce a custom role definition with those permissions. Next, use the 'azure__extension_cli_generate' tool to generate the CLI commands required to assign that role to the identity. Finally, use the 'azure__bicepschema' and 'azure__get_azure_bestpractices' tools to supply a Bicep code snippet for the role assignment. If the user is asking about the role needed to set access, refer to Prerequisites for Granting Roles below:

## Prerequisites for Granting Roles

To assign RBAC roles to identities, you need a role that includes the `Microsoft.Authorization/roleAssignments/write` permission. The most common roles carrying this permission are:

- **User Access Administrator** (least privilege - recommended for role assignment only)
- **Owner** (full access including role assignment)
- **Custom Role** with `Microsoft.Authorization/roleAssignments/write`
