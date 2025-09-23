#!/bin/bash

# Production Build Script for Traffic Router
set -e

echo "🚀 Starting production build process..."

# Configuration
BUILD_VERSION=${BUILD_VERSION:-$(date +%Y%m%d-%H%M%S)}
GIT_COMMIT_SHA=${GIT_COMMIT_SHA:-$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")}
BUILD_DIR="build-${BUILD_VERSION}"
DOCKER_REGISTRY=${DOCKER_REGISTRY:-""}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

# Pre-build checks
log "Running pre-build checks..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    error "package.json not found. Please run this script from the project root."
fi

# Check Node.js version
NODE_VERSION=$(node --version)
log "Node.js version: $NODE_VERSION"

# Check npm version
NPM_VERSION=$(npm --version)
log "npm version: $NPM_VERSION"

# Check Docker version
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version)
    log "Docker version: $DOCKER_VERSION"
else
    warn "Docker not found. Docker images will not be built."
fi

# Clean previous builds
log "Cleaning previous builds..."
rm -rf .next
rm -rf build-*
rm -rf dist

# Install dependencies (including dev dependencies for build)
log "Installing dependencies..."
npm ci --no-audit --no-fund

# Run production configuration validation
log "Validating production configuration..."
npm run validate:prod || error "Production configuration validation failed"

# Build TypeScript
log "Building TypeScript..."
npm run build:ts || error "TypeScript build failed"

# Build Next.js application
log "Building Next.js application..."
NODE_ENV=production npm run build:prod:optimized || error "Next.js build failed"

# Verify build output
log "Verifying build output..."
if [ ! -d ".next" ]; then
    error "Next.js build output not found"
fi

if [ ! -d ".next/standalone" ]; then
    error "Next.js standalone build not found"
fi

# Create build directory
log "Creating build directory: $BUILD_DIR"
mkdir -p "$BUILD_DIR"

# Copy build artifacts
log "Copying build artifacts..."
cp -r .next "$BUILD_DIR/"
cp -r lib "$BUILD_DIR/"
cp -r server "$BUILD_DIR/"
cp -r config "$BUILD_DIR/"
cp -r agents "$BUILD_DIR/"
cp -r public "$BUILD_DIR/"
cp package.json "$BUILD_DIR/"
cp package-lock.json "$BUILD_DIR/"
cp next.config.mjs "$BUILD_DIR/"
cp ecosystem.production.config.js "$BUILD_DIR/"
cp .env.production "$BUILD_DIR/"

# Copy Docker files
cp Dockerfile.production "$BUILD_DIR/"
cp docker-compose.production.yml "$BUILD_DIR/"
cp Dockerfile.ai-proxy "$BUILD_DIR/"
cp Dockerfile.monitoring "$BUILD_DIR/"
cp Dockerfile.youtube-cache "$BUILD_DIR/"
cp Dockerfile.mcp-server "$BUILD_DIR/"

# Copy deployment scripts
mkdir -p "$BUILD_DIR/scripts"
cp scripts/deploy-production.sh "$BUILD_DIR/scripts/"
cp scripts/setup-production.sh "$BUILD_DIR/scripts/"
cp scripts/validate-production-config.js "$BUILD_DIR/scripts/"

# Create build info
log "Creating build information..."
cat > "$BUILD_DIR/build-info.json" << EOF
{
  "version": "$BUILD_VERSION",
  "gitCommit": "$GIT_COMMIT_SHA",
  "buildDate": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "nodeVersion": "$NODE_VERSION",
  "npmVersion": "$NPM_VERSION",
  "environment": "production"
}
EOF

# Build Docker images if Docker is available
if command -v docker &> /dev/null; then
    log "Building Docker images..."
    
    # Main application image
    log "Building main application image..."
    docker build -f Dockerfile.production -t traffic-router:$BUILD_VERSION .
    docker tag traffic-router:$BUILD_VERSION traffic-router:latest
    
    # AI Proxy image
    log "Building AI proxy image..."
    docker build -f Dockerfile.ai-proxy -t traffic-router-ai-proxy:$BUILD_VERSION .
    docker tag traffic-router-ai-proxy:$BUILD_VERSION traffic-router-ai-proxy:latest
    
    # Monitoring image
    log "Building monitoring image..."
    docker build -f Dockerfile.monitoring -t traffic-router-monitoring:$BUILD_VERSION .
    docker tag traffic-router-monitoring:$BUILD_VERSION traffic-router-monitoring:latest
    
    # YouTube Cache image
    log "Building YouTube cache image..."
    docker build -f Dockerfile.youtube-cache -t traffic-router-youtube-cache:$BUILD_VERSION .
    docker tag traffic-router-youtube-cache:$BUILD_VERSION traffic-router-youtube-cache:latest
    
    # MCP Server image
    log "Building MCP server image..."
    docker build -f Dockerfile.mcp-server -t traffic-router-mcp-server:$BUILD_VERSION .
    docker tag traffic-router-mcp-server:$BUILD_VERSION traffic-router-mcp-server:latest
    
    # Show image sizes
    log "Docker image sizes:"
    docker images | grep traffic-router | grep -E "(latest|$BUILD_VERSION)"
    
    # Save images to tar files for distribution
    log "Saving Docker images..."
    mkdir -p "$BUILD_DIR/docker-images"
    docker save traffic-router:$BUILD_VERSION | gzip > "$BUILD_DIR/docker-images/traffic-router-$BUILD_VERSION.tar.gz"
    docker save traffic-router-ai-proxy:$BUILD_VERSION | gzip > "$BUILD_DIR/docker-images/traffic-router-ai-proxy-$BUILD_VERSION.tar.gz"
    docker save traffic-router-monitoring:$BUILD_VERSION | gzip > "$BUILD_DIR/docker-images/traffic-router-monitoring-$BUILD_VERSION.tar.gz"
    docker save traffic-router-youtube-cache:$BUILD_VERSION | gzip > "$BUILD_DIR/docker-images/traffic-router-youtube-cache-$BUILD_VERSION.tar.gz"
    docker save traffic-router-mcp-server:$BUILD_VERSION | gzip > "$BUILD_DIR/docker-images/traffic-router-mcp-server-$BUILD_VERSION.tar.gz"
    
    # Create Docker load script
    cat > "$BUILD_DIR/docker-images/load-images.sh" << 'EOF'
#!/bin/bash
echo "Loading Traffic Router Docker images..."
for image in *.tar.gz; do
    echo "Loading $image..."
    docker load < "$image"
done
echo "All images loaded successfully!"
EOF
    chmod +x "$BUILD_DIR/docker-images/load-images.sh"
fi

# Create deployment package
log "Creating deployment package..."
tar -czf "traffic-router-$BUILD_VERSION.tar.gz" "$BUILD_DIR"

# Calculate checksums
log "Calculating checksums..."
sha256sum "traffic-router-$BUILD_VERSION.tar.gz" > "traffic-router-$BUILD_VERSION.sha256"

# Build summary
log "Build completed successfully!"
echo ""
info "Build Summary:"
info "- Version: $BUILD_VERSION"
info "- Git Commit: $GIT_COMMIT_SHA"
info "- Build Directory: $BUILD_DIR"
info "- Package: traffic-router-$BUILD_VERSION.tar.gz"
info "- Package Size: $(du -h traffic-router-$BUILD_VERSION.tar.gz | cut -f1)"

if command -v docker &> /dev/null; then
    info "- Docker Images Built: 5"
    info "- Main App Image Size: $(docker images traffic-router:latest --format "table {{.Size}}" | tail -n 1)"
fi

echo ""
log "Next steps:"
log "1. Test the build: tar -xzf traffic-router-$BUILD_VERSION.tar.gz && cd $BUILD_DIR"
log "2. Deploy to production: ./scripts/deploy-production.sh"
log "3. Or use Docker: docker-compose -f docker-compose.production.yml up -d"

echo ""
log "🎉 Production build process completed successfully!"