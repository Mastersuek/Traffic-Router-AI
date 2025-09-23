# Technology Stack

## Core Technologies

### Backend
- **Node.js 18+** with **TypeScript** - Main application logic
- **Express.js** - HTTP server framework
- **WebSocket** - Real-time communication
- **Python 3.8+** - AI agent and recovery systems
- **FFmpeg** - Video processing for YouTube caching

### Frontend
- **Next.js 14** - React-based web framework
- **React 18** - UI library
- **Tailwind CSS 4** - Utility-first styling
- **Radix UI** - Accessible component primitives
- **Shadcn/ui** - Pre-built component library

### Mobile & Desktop
- **React Native** - Cross-platform mobile apps
- **Electron** - Desktop applications
- **Python/Tkinter** - Alternative Windows GUI

### Infrastructure
- **Docker** - Containerization
- **PM2** - Process management
- **Redis** - Caching layer
- **Winston** - Logging

## Build System & Commands

### Development
```bash
# Start all services
npm run dev:all

# Individual services
npm run dev              # Next.js web server (port 13000)
npm run dev:proxy        # AI proxy server (port 13081)
npm run dev:monitor      # Monitoring server (port 13082)
npm run dev:youtube      # YouTube cache server (port 13083)
npm run dev:mcp          # MCP server (port 3001)
```

### Build & Compilation
```bash
npm run build            # Next.js production build
npm run build:ts         # TypeScript compilation
npm run build:ts:watch   # TypeScript watch mode
npm run compile:lib      # Compile lib files to CommonJS
```

### Production
```bash
npm start                # Start Next.js production server
npm run proxy:start      # Start AI proxy server
npm run monitor:start    # Start monitoring server
```

### Python Components
```bash
# Install Python dependencies
pip install -r requirements.txt
pip install -r requirements-agent.txt

# Start recovery agent
python agents/start-recovery-agent.py
```

## Port Configuration

The system uses non-standard ports to avoid conflicts:
- **13000** - Next.js web interface
- **13081** - AI proxy server
- **13082** - Monitoring dashboard
- **13083** - YouTube cache server
- **3001** - MCP server
- **11080** - SOCKS5 proxy
- **13128** - HTTP proxy

## Key Dependencies

### Production Dependencies
- **axios** - HTTP client
- **cors** - CORS middleware
- **express** - Web framework
- **helmet** - Security middleware
- **winston** - Logging
- **ws** - WebSocket implementation
- **@distube/ytdl-core** - YouTube video processing (maintained fork)
- **fluent-ffmpeg** - FFmpeg wrapper

### Development Tools
- **TypeScript 5** - Type checking
- **concurrently** - Run multiple commands
- **cross-env** - Cross-platform environment variables

## Configuration Files

- **tsconfig.json** - TypeScript configuration with Next.js plugin
- **next.config.mjs** - Next.js configuration with build optimizations
- **docker-compose.yml** - Multi-service Docker setup
- **ecosystem.config.js** - PM2 process management
- **package.json** - Dependencies and scripts