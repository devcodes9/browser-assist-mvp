# Azure OpenAI Setup Guide

This guide explains how to configure Browser Assist AI to use Azure OpenAI instead of Anthropic or OpenAI.

## Prerequisites

1. An Azure subscription
2. Azure OpenAI service deployed
3. A deployed model (e.g., GPT-4, GPT-3.5 Turbo)

## Step 1: Get Azure OpenAI Credentials

### Find Your Resource Name

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to your Azure OpenAI resource
3. The resource name is in the URL: `https://{YOUR-RESOURCE-NAME}.openai.azure.com`

### Get Your API Key

1. In Azure Portal, go to your Azure OpenAI resource
2. Click "Keys and Endpoint" in the left sidebar
3. Copy either KEY 1 or KEY 2

### Get Your Deployment Name

1. In Azure Portal, go to your Azure OpenAI resource
2. Click "Model deployments" or go to Azure OpenAI Studio
3. Note your deployment name (e.g., "gpt-4", "gpt-35-turbo")

## Step 2: Configure Environment Variables

Edit `packages/backend/.env`:

```bash
# Set provider to azure
AI_PROVIDER=azure

# Azure API Key
AZURE_API_KEY=your-azure-api-key-here

# Azure Resource Name (from portal)
AZURE_RESOURCE_NAME=your-resource-name

# Azure Deployment Name (from model deployments)
AZURE_DEPLOYMENT=gpt-4

# API Version (optional, defaults to 2024-02-01)
AZURE_API_VERSION=2024-02-01

# Other settings
PORT=8080
MAX_STEPS=10
```

## Step 3: Verify Configuration

Start the backend:

```bash
npm run dev:backend
```

You should see:
```
🚀 WebSocket server started on ws://localhost:8080
```

If you see errors about missing configuration, check that all required variables are set.

## Complete Example Configuration

```bash
# .env file for Azure OpenAI

# Provider
AI_PROVIDER=azure

# Azure Credentials
AZURE_API_KEY=abc123def456...
AZURE_RESOURCE_NAME=my-openai-resource
AZURE_DEPLOYMENT=gpt-4
AZURE_API_VERSION=2024-02-01

# Server
PORT=8080
MAX_STEPS=10
```

## Supported Models

Azure OpenAI supports various models through deployments:

- **GPT-4**: Most capable model
  - `gpt-4`
  - `gpt-4-32k`
- **GPT-3.5 Turbo**: Faster, more cost-effective
  - `gpt-35-turbo` (note: 35, not 3.5)
  - `gpt-35-turbo-16k`

Your deployment name in Azure determines which model you use.

## API Versions

Azure OpenAI uses API versions for compatibility:

- `2024-02-01` (default, recommended)
- `2023-12-01-preview`
- `2023-05-15`

## Troubleshooting

### Error: "Missing AZURE_RESOURCE_NAME"

Make sure you've set `AZURE_RESOURCE_NAME` in `.env`:
```bash
AZURE_RESOURCE_NAME=your-resource-name
```

### Error: "Missing AZURE_DEPLOYMENT"

Make sure you've set `AZURE_DEPLOYMENT` in `.env`:
```bash
AZURE_DEPLOYMENT=gpt-4
```

### Error: "Invalid API Key"

1. Check your API key is correct
2. Make sure there are no extra spaces
3. Verify the key is active in Azure Portal

### Error: "Deployment not found"

1. Verify your deployment name matches exactly (case-sensitive)
2. Check the deployment is active in Azure OpenAI Studio
3. Ensure the deployment is in the same resource

### Connection Issues

If you can't connect:

1. Check your Azure resource is in a supported region
2. Verify your subscription has access to Azure OpenAI
3. Ensure your IP isn't blocked by Azure firewall rules

## Cost Optimization

Azure OpenAI charges per token:

- **GPT-4**: More expensive, better quality
- **GPT-3.5 Turbo**: Cheaper, good for most tasks

You can reduce costs by:

1. Using GPT-3.5 Turbo instead of GPT-4
2. Reducing `MAX_STEPS` in configuration
3. Using more specific prompts

## Switching Between Providers

To switch back to Anthropic or OpenAI, change `AI_PROVIDER`:

```bash
# For Anthropic
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...

# For OpenAI
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...

# For Azure
AI_PROVIDER=azure
AZURE_API_KEY=...
```

## Security Best Practices

1. **Never commit .env files** - Already in .gitignore
2. **Rotate keys regularly** - Use Azure Key Vault for production
3. **Use managed identities** - For Azure-hosted deployments
4. **Monitor usage** - Set up Azure cost alerts

## Production Deployment

For production on Azure:

1. Use Azure App Service or Container Apps
2. Store secrets in Azure Key Vault
3. Use Managed Identity instead of API keys
4. Enable Azure monitoring and logging
5. Set up Azure Front Door for global availability

Example with Managed Identity:

```typescript
// For production, use DefaultAzureCredential
import { DefaultAzureCredential } from '@azure/identity';

// Get token instead of API key
const credential = new DefaultAzureCredential();
const token = await credential.getToken('https://cognitiveservices.azure.com/.default');
```

## Getting Help

- [Azure OpenAI Documentation](https://learn.microsoft.com/en-us/azure/ai-services/openai/)
- [Azure OpenAI Quickstart](https://learn.microsoft.com/en-us/azure/ai-services/openai/quickstart)
- [AI SDK Azure Provider](https://sdk.vercel.ai/providers/ai-sdk-providers/azure)

## Summary

Azure OpenAI configuration requires:

1. ✅ `AI_PROVIDER=azure`
2. ✅ `AZURE_API_KEY` - From Azure Portal
3. ✅ `AZURE_RESOURCE_NAME` - Your resource name
4. ✅ `AZURE_DEPLOYMENT` - Your deployment name
5. ✅ `AZURE_API_VERSION` - API version (optional)

Once configured, the backend will use Azure OpenAI for all AI operations!
