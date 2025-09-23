# Project Structure

## Root Level Organization

```
traffic-router/
├── app/                    # Next.js App Router pages and API routes
├── agents/                 # Python AI agents and recovery systems
├── clients/                # Platform-specific client applications
├── components/             # React UI components (shadcn/ui based)
├── config/                 # Configuration files (JSON/YAML)
├── lib/                    # Core TypeScript libraries and utilities
├── server/                 # Standalone server applications
├── scripts/                # Build and deployment scripts
├── logs/                   # Application logs and reports
├── memory/                 # AI agent memory and entity storage
└── tests/                  # Test files and test utilities
```

## Key Directories

### `/app` - Next.js Application
- **API Routes**: RESTful endpoints under `app/api/`
- **Pages**: React components for UI routes
- **Layout**: Global layout and styling configuration

### `/agents` - AI Recovery System
- **Enhanced Recovery Agent**: Main AI agent with MCP integration
- **Simple Recovery Agent**: Lightweight fallback agent
- **Dockerfiles**: Containerized agent deployments

### `/clients` - Multi-platform Clients
- **`common/`**: Shared client configuration and utilities
- **`desktop/`**: Electron-based desktop applications
- **`mobile/`**: React Native mobile applications
- **`windows/`**: Python/Tkinter Windows GUI

### `/components` - UI Components
- **`ui/`**: Shadcn/ui component library
- **Theme Provider**: Dark/light mode support
- **Custom Components**: Project-specific UI elements

### `/lib` - Core Libraries
- **Configuration Management**: `config.ts`, type definitions
- **Proxy Handling**: Traffic routing and proxy management
- **AI Services**: OpenAI, Anthropic, Google AI integrations
- **Monitoring**: Performance metrics and alerting
- **Utilities**: Common helper functions

### `/server` - Standalone Services
- **AI Proxy Server**: Handles AI API requests with geo-spoofing
- **Monitoring Server**: System metrics and health checks
- **MCP Integration Server**: Model Context Protocol server
- **YouTube Cache Server**: Video caching and streaming

## File Naming Conventions

### TypeScript/JavaScript
- **Components**: PascalCase (`TrafficRouter.tsx`)
- **Utilities**: kebab-case (`traffic-router.ts`)
- **API Routes**: kebab-case (`ai-services/route.ts`)
- **Types**: kebab-case with `.types.ts` suffix

### Python
- **Modules**: snake_case (`enhanced_recovery_agent.py`)
- **Scripts**: kebab-case (`start-recovery-agent.py`)

### Configuration
- **JSON Config**: kebab-case (`proxy-config.json`)
- **Environment**: UPPER_SNAKE_CASE (`.env` files)

## Import Patterns

### Path Aliases
```typescript
// Use @ alias for root imports
import { TrafficRouter } from '@/lib/traffic-router'
import { Button } from '@/components/ui/button'
```

### Relative Imports
```typescript
// For same-level or nearby files
import { config } from './config'
import { utils } from '../utils'
```

## Configuration Structure

### `/config` Directory
- **`ai-services-config.json`**: AI service endpoints and settings
- **`proxy-config.json`**: Proxy pools and routing rules
- **`recovery-config.yaml`**: AI agent recovery strategies

### Environment Configuration
- **`config.env`**: Main environment variables
- **`.env.local`**: Local development overrides

## Logging and Monitoring

### `/logs` Directory
- **System Logs**: Service-specific log files
- **Test Reports**: Automated test results
- **Analysis Reports**: System health and performance analysis

### `/memory` Directory
- **Entity Storage**: AI agent memory persistence
- **System State**: Current system status and history

## Architecture Patterns

### Service Separation
- Each major service runs on dedicated ports
- Clear separation between web UI, proxy, monitoring, and caching
- Independent scaling and deployment capabilities

### Configuration Management
- Centralized configuration in `/config`
- Environment-specific overrides
- Type-safe configuration with TypeScript interfaces

### Cross-platform Support
- Shared business logic in `/lib`
- Platform-specific implementations in `/clients`
- Common utilities and types across all platforms