# Changelog

## [0.2.0] - 2024-12-25

### Added
- ✅ **Azure OpenAI Support** - Full support for Azure OpenAI Service
  - Added `@ai-sdk/azure` dependency
  - New provider option: `AI_PROVIDER=azure`
  - Azure-specific configuration (resource name, deployment, API version)
  - Complete setup guide in `AZURE_SETUP.md`

### Configuration
- New environment variables for Azure:
  - `AZURE_API_KEY` - Azure OpenAI API key
  - `AZURE_RESOURCE_NAME` - Azure resource name
  - `AZURE_DEPLOYMENT` - Deployment name
  - `AZURE_API_VERSION` - API version (default: 2024-02-01)

### Documentation
- Added `AZURE_SETUP.md` - Complete Azure configuration guide
- Updated `README.md` with Azure provider information
- Updated `.env.example` with Azure configuration

### Technical Changes
- Updated `shared/types.ts` - Added `azure` to provider union type
- Updated `packages/backend/src/config.ts` - Azure configuration loader
- Updated `packages/backend/src/agent.ts` - Azure model initialization
- Updated `packages/backend/package.json` - Added `@ai-sdk/azure` dependency

## [0.1.0] - 2024-12-25

### Initial Release
- ✅ Chrome Extension (Manifest V3)
  - Side Panel UI with React
  - Background service worker
  - Content script executor
  - Permission gates

- ✅ Backend (Node.js + AI SDK)
  - WebSocket server
  - AI SDK Agent integration
  - Browser action tools
  - MCP integration architecture

- ✅ Browser Commands
  - `navigate(url)` - Navigate to URL
  - `click(selector)` - Click element
  - `type(selector, text)` - Type text
  - `extract(selector)` - Extract content
  - `snapshot()` - Get page info

- ✅ AI Provider Support
  - Anthropic Claude
  - OpenAI GPT-4/3.5

- ✅ Documentation
  - README.md - Complete documentation
  - QUICKSTART.md - 5-minute setup
  - ARCHITECTURE.md - Technical architecture
  - SETUP.md - Installation guide
  - PROJECT_SUMMARY.md - Overview
  - DELIVERABLES.md - Completion checklist
  - COMPLETE.md - Final summary
