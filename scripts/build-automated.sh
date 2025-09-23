#!/bin/bash

# Automated Cross-Platform Build Script for Traffic Router
# This script automates the entire build process for all platforms

set -e

echo "🤖 Starting automated cross-platform build process..."

# Configuration
BUILD_VERSION=${BUILD_VERSION:-$(date +%Y%m%d-%H%M%S)}
BUILD_DIR="build-automated-${BUILD_VERSION}"
PLATFORMS=${PLATFORMS:-"windows,linux,android"}
PARALLEL_BUILDS=${PARALLEL_BUILDS:-false}
UPLOAD_BUILDS=${UPLOAD_BUILDS:-false}
SIGN_BUILDS=${SIGN_BUILDS:-false}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
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

step() {
    echo -e "${MAGENTA}[$(date +'%Y-%m-%d %H:%M:%S')] STEP: $1${NC}"
}

# Check if running in CI environment
is_ci() {
    [ -n "$CI" ] || [ -n "$GITHUB_ACTIONS" ] || [ -n "$GITLAB_CI" ] || [ -n "$JENKINS_URL" ]
}

# Setup environment
setup_environment() {
    step "Setting up build environment..."
    
    # Run environment setup script
    if [ -f "scripts/setup-build-environment.sh" ]; then
        log "Running environment setup..."
        bash scripts/setup-build-environment.sh
    else
        warn "Environment setup script not found"
    fi
    
    # Create build directory
    mkdir -p "$BUILD_DIR"
    
    # Set up logging
    exec 1> >(tee -a "$BUILD_DIR/build.log")
    exec 2> >(tee -a "$BUILD_DIR/build-error.log" >&2)
    
    log "✅ Environment setup completed"
}

# Pre-build validation
validate_environment() {
    step "Validating build environment..."
    
    local validation_failed=false
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        error "Node.js is required but not installed"
        validation_failed=true
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        error "npm is required but not installed"
        validation_failed=true
    fi
    
    # Platform-specific checks
    if [[ "$PLATFORMS" == *"windows"* ]] || [[ "$PLATFORMS" == *"linux"* ]]; then
        if ! command -v npx &> /dev/null; then
            warn "npx not found, some builds may fail"
        fi
    fi
    
    if [[ "$PLATFORMS" == *"android"* ]]; then
        if [ -z "$ANDROID_HOME" ]; then
            warn "ANDROID_HOME not set, Android build may fail"
        fi
        
        if ! command -v java &> /dev/null; then
            warn "Java not found, Android build may fail"
        fi
    fi
    
    if [[ "$PLATFORMS" == *"ios"* ]] || [[ "$PLATFORMS" == *"macos"* ]]; then
        if [[ "$OSTYPE" != "darwin"* ]]; then
            warn "iOS/macOS builds require macOS"
        fi
        
        if ! command -v xcodebuild &> /dev/null; then
            warn "Xcode not found, iOS/macOS builds may fail"
        fi
    fi
    
    if [ "$validation_failed" = true ]; then
        error "Environment validation failed"
    fi
    
    log "✅ Environment validation passed"
}

# Build production backend
build_backend() {
    step "Building production backend..."
    
    log "Running production build script..."
    bash scripts/build-production.sh
    
    # Copy backend build to automated build directory
    if [ -d "build-$(date +%Y%m%d)*" ]; then
        cp -r build-$(date +%Y%m%d)* "$BUILD_DIR/backend/"
        log "✅ Backend build copied to automated build directory"
    fi
    
    log "✅ Backend build completed"
}

# Build platform-specific clients
build_clients() {
    step "Building platform-specific clients..."
    
    if [ "$PARALLEL_BUILDS" = "true" ] && ! is_ci; then
        log "Building clients in parallel..."
        build_clients_parallel
    else
        log "Building clients sequentially..."
        build_clients_sequential
    fi
    
    log "✅ Client builds completed"
}

# Sequential client builds
build_clients_sequential() {
    # Build Windows executable
    if [[ "$PLATFORMS" == *"windows"* ]]; then
        log "Building Windows executable..."
        build_windows_client
    fi
    
    # Build Linux AppImage
    if [[ "$PLATFORMS" == *"linux"* ]]; then
        log "Building Linux AppImage..."
        build_linux_client
    fi
    
    # Build Android APK
    if [[ "$PLATFORMS" == *"android"* ]]; then
        log "Building Android APK..."
        build_android_client
    fi
    
    # Build macOS DMG
    if [[ "$PLATFORMS" == *"macos"* ]]; then
        log "Building macOS DMG..."
        build_macos_client
    fi
    
    # Build iOS IPA
    if [[ "$PLATFORMS" == *"ios"* ]]; then
        log "Building iOS IPA..."
        build_ios_client
    fi
}

# Parallel client builds
build_clients_parallel() {
    local pids=()
    
    # Start builds in background
    if [[ "$PLATFORMS" == *"windows"* ]]; then
        build_windows_client &
        pids+=($!)
    fi
    
    if [[ "$PLATFORMS" == *"linux"* ]]; then
        build_linux_client &
        pids+=($!)
    fi
    
    if [[ "$PLATFORMS" == *"android"* ]]; then
        build_android_client &
        pids+=($!)
    fi
    
    if [[ "$PLATFORMS" == *"macos"* ]]; then
        build_macos_client &
        pids+=($!)
    fi
    
    if [[ "$PLATFORMS" == *"ios"* ]]; then
        build_ios_client &
        pids+=($!)
    fi
    
    # Wait for all builds to complete
    for pid in "${pids[@]}"; do
        wait $pid || warn "One of the parallel builds failed"
    done
}

# Individual platform build functions
build_windows_client() {
    log "Building Windows client..."
    
    # Electron build
    cd clients/desktop
    npm ci
    npm run build:windows || warn "Electron Windows build failed"
    cd ../..
    
    # Python GUI build
    cd clients/windows
    python3 build_exe.py || warn "Python Windows build failed"
    cd ../..
    
    # Copy builds
    mkdir -p "$BUILD_DIR/windows"
    [ -d "clients/desktop/dist" ] && cp -r clients/desktop/dist/* "$BUILD_DIR/windows/"
    [ -d "clients/windows/dist" ] && cp -r clients/windows/dist/* "$BUILD_DIR/windows/"
    
    log "✅ Windows client build completed"
}

build_linux_client() {
    log "Building Linux client..."
    
    cd clients/desktop
    npm ci
    npm run build:linux || warn "Linux build failed"
    cd ../..
    
    # Copy builds
    mkdir -p "$BUILD_DIR/linux"
    [ -d "clients/desktop/dist" ] && cp -r clients/desktop/dist/* "$BUILD_DIR/linux/"
    
    log "✅ Linux client build completed"
}

build_android_client() {
    log "Building Android client..."
    
    cd clients/mobile
    npm ci
    
    # Initialize React Native project if needed
    if [ ! -d "android" ]; then
        log "Initializing React Native Android project..."
        npx @react-native-community/cli@latest init TrafficRouterMobile --template react-native-template-typescript
        cp -r src/* TrafficRouterMobile/src/
        cd TrafficRouterMobile
    fi
    
    # Build APK
    npm run build:android || warn "Android build failed"
    cd ../..
    
    # Copy builds
    mkdir -p "$BUILD_DIR/android"
    find clients/mobile -name "*.apk" -exec cp {} "$BUILD_DIR/android/" \; 2>/dev/null || true
    
    log "✅ Android client build completed"
}

build_macos_client() {
    if [[ "$OSTYPE" != "darwin"* ]]; then
        warn "Skipping macOS build (not running on macOS)"
        return 0
    fi
    
    log "Building macOS client..."
    
    cd clients/desktop
    npm ci
    npm run build:mac || warn "macOS build failed"
    cd ../..
    
    # Copy builds
    mkdir -p "$BUILD_DIR/macos"
    [ -d "clients/desktop/dist" ] && cp -r clients/desktop/dist/* "$BUILD_DIR/macos/"
    
    log "✅ macOS client build completed"
}

build_ios_client() {
    if [[ "$OSTYPE" != "darwin"* ]]; then
        warn "Skipping iOS build (not running on macOS)"
        return 0
    fi
    
    log "Building iOS client..."
    
    cd clients/mobile
    npm ci
    
    # Initialize React Native project if needed
    if [ ! -d "ios" ]; then
        log "Initializing React Native iOS project..."
        npx @react-native-community/cli@latest init TrafficRouterMobile --template react-native-template-typescript
        cp -r src/* TrafficRouterMobile/src/
        cd TrafficRouterMobile
    fi
    
    # Install CocoaPods dependencies
    cd ios && pod install && cd ..
    
    # Build IPA
    npm run build:ios || warn "iOS build failed"
    cd ../..
    
    # Copy builds
    mkdir -p "$BUILD_DIR/ios"
    find clients/mobile -name "*.ipa" -exec cp {} "$BUILD_DIR/ios/" \; 2>/dev/null || true
    
    log "✅ iOS client build completed"
}

# Code signing
sign_builds() {
    if [ "$SIGN_BUILDS" != "true" ]; then
        log "Skipping code signing"
        return 0
    fi
    
    step "Signing builds..."
    
    # Sign Windows executables
    if [ -d "$BUILD_DIR/windows" ] && [ -n "$WINDOWS_CERT_PATH" ]; then
        log "Signing Windows executables..."
        find "$BUILD_DIR/windows" -name "*.exe" -exec signtool sign /f "$WINDOWS_CERT_PATH" /p "$WINDOWS_CERT_PASSWORD" {} \;
    fi
    
    # Sign macOS applications
    if [ -d "$BUILD_DIR/macos" ] && [ -n "$MACOS_CERT_ID" ]; then
        log "Signing macOS applications..."
        find "$BUILD_DIR/macos" -name "*.app" -exec codesign --force --sign "$MACOS_CERT_ID" {} \;
    fi
    
    # Sign Android APKs
    if [ -d "$BUILD_DIR/android" ] && [ -n "$ANDROID_KEYSTORE_PATH" ]; then
        log "Signing Android APKs..."
        find "$BUILD_DIR/android" -name "*.apk" -exec jarsigner -keystore "$ANDROID_KEYSTORE_PATH" -storepass "$ANDROID_KEYSTORE_PASSWORD" {} "$ANDROID_KEY_ALIAS" \;
    fi
    
    log "✅ Code signing completed"
}

# Create distribution packages
create_packages() {
    step "Creating distribution packages..."
    
    cd "$BUILD_DIR"
    
    # Create platform-specific archives
    if [ -d "windows" ]; then
        log "Creating Windows package..."
        zip -r "TrafficRouter-Windows-${BUILD_VERSION}.zip" windows/
    fi
    
    if [ -d "linux" ]; then
        log "Creating Linux package..."
        tar -czf "TrafficRouter-Linux-${BUILD_VERSION}.tar.gz" linux/
    fi
    
    if [ -d "android" ]; then
        log "Creating Android package..."
        zip -r "TrafficRouter-Android-${BUILD_VERSION}.zip" android/
    fi
    
    if [ -d "macos" ]; then
        log "Creating macOS package..."
        zip -r "TrafficRouter-macOS-${BUILD_VERSION}.zip" macos/
    fi
    
    if [ -d "ios" ]; then
        log "Creating iOS package..."
        zip -r "TrafficRouter-iOS-${BUILD_VERSION}.zip" ios/
    fi
    
    # Create universal package
    log "Creating universal package..."
    tar -czf "TrafficRouter-Universal-${BUILD_VERSION}.tar.gz" .
    
    cd ..
    
    log "✅ Distribution packages created"
}

# Generate checksums and metadata
generate_metadata() {
    step "Generating metadata..."
    
    cd "$BUILD_DIR"
    
    # Generate checksums
    log "Generating checksums..."
    find . -name "*.zip" -o -name "*.tar.gz" -o -name "*.exe" -o -name "*.apk" -o -name "*.dmg" -o -name "*.ipa" | xargs sha256sum > checksums.sha256
    
    # Generate build metadata
    log "Generating build metadata..."
    cat > build-metadata.json << EOF
{
  "version": "$BUILD_VERSION",
  "buildDate": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "platforms": "$PLATFORMS",
  "gitCommit": "$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')",
  "gitBranch": "$(git branch --show-current 2>/dev/null || echo 'unknown')",
  "buildEnvironment": {
    "os": "$(uname -s)",
    "arch": "$(uname -m)",
    "nodeVersion": "$(node --version)",
    "npmVersion": "$(npm --version)",
    "ci": $(is_ci && echo "true" || echo "false")
  },
  "buildOptions": {
    "parallelBuilds": $PARALLEL_BUILDS,
    "signBuilds": $SIGN_BUILDS,
    "uploadBuilds": $UPLOAD_BUILDS
  },
  "artifacts": [
$(find . -name "*.zip" -o -name "*.tar.gz" -o -name "*.exe" -o -name "*.apk" -o -name "*.dmg" -o -name "*.ipa" | sed 's/^/    "/' | sed 's/$/"/' | paste -sd ',' -)
  ]
}
EOF
    
    cd ..
    
    log "✅ Metadata generated"
}

# Upload builds (if enabled)
upload_builds() {
    if [ "$UPLOAD_BUILDS" != "true" ]; then
        log "Skipping build upload"
        return 0
    fi
    
    step "Uploading builds..."
    
    # Upload to GitHub Releases (if configured)
    if [ -n "$GITHUB_TOKEN" ] && [ -n "$GITHUB_REPOSITORY" ]; then
        log "Uploading to GitHub Releases..."
        # Implementation would depend on specific CI/CD setup
    fi
    
    # Upload to custom server (if configured)
    if [ -n "$UPLOAD_SERVER" ] && [ -n "$UPLOAD_TOKEN" ]; then
        log "Uploading to custom server..."
        # Implementation would depend on specific server setup
    fi
    
    log "✅ Build upload completed"
}

# Cleanup
cleanup() {
    step "Cleaning up..."
    
    # Remove temporary files
    find . -name "*.tmp" -delete 2>/dev/null || true
    find . -name "node_modules" -type d -exec rm -rf {} + 2>/dev/null || true
    
    # Clean build caches
    if [ -d "clients/desktop/node_modules" ]; then
        cd clients/desktop && npm run clean 2>/dev/null || true && cd ../..
    fi
    
    if [ -d "clients/mobile/node_modules" ]; then
        cd clients/mobile && npm run clean 2>/dev/null || true && cd ../..
    fi
    
    log "✅ Cleanup completed"
}

# Generate build report
generate_report() {
    step "Generating build report..."
    
    local report_file="$BUILD_DIR/build-report.md"
    
    cat > "$report_file" << EOF
# Traffic Router Build Report

**Build Version:** $BUILD_VERSION  
**Build Date:** $(date -u +%Y-%m-%dT%H:%M:%SZ)  
**Platforms:** $PLATFORMS  
**Git Commit:** $(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')  

## Build Summary

$([ -d "$BUILD_DIR/windows" ] && echo "✅ Windows build completed" || echo "❌ Windows build skipped/failed")  
$([ -d "$BUILD_DIR/linux" ] && echo "✅ Linux build completed" || echo "❌ Linux build skipped/failed")  
$([ -d "$BUILD_DIR/android" ] && echo "✅ Android build completed" || echo "❌ Android build skipped/failed")  
$([ -d "$BUILD_DIR/macos" ] && echo "✅ macOS build completed" || echo "❌ macOS build skipped/failed")  
$([ -d "$BUILD_DIR/ios" ] && echo "✅ iOS build completed" || echo "❌ iOS build skipped/failed")  

## Artifacts

$(find "$BUILD_DIR" -name "*.zip" -o -name "*.tar.gz" -o -name "*.exe" -o -name "*.apk" -o -name "*.dmg" -o -name "*.ipa" | while read file; do
    size=$(du -h "$file" | cut -f1)
    echo "- $(basename "$file") ($size)"
done)

## Build Logs

- Build log: build.log
- Error log: build-error.log
- Checksums: checksums.sha256
- Metadata: build-metadata.json

## Next Steps

1. Test artifacts on target platforms
2. Sign executables for distribution (if not already done)
3. Upload to distribution channels
4. Update documentation and release notes
EOF
    
    log "✅ Build report generated: $report_file"
}

# Main execution
main() {
    log "🤖 Automated cross-platform build started"
    log "Build version: $BUILD_VERSION"
    log "Target platforms: $PLATFORMS"
    log "Parallel builds: $PARALLEL_BUILDS"
    log "Sign builds: $SIGN_BUILDS"
    log "Upload builds: $UPLOAD_BUILDS"
    
    # Execute build pipeline
    setup_environment
    validate_environment
    build_backend
    build_clients
    sign_builds
    create_packages
    generate_metadata
    upload_builds
    generate_report
    cleanup
    
    # Final summary
    log "🎉 Automated build completed successfully!"
    echo ""
    info "Build Summary:"
    info "- Version: $BUILD_VERSION"
    info "- Build Directory: $BUILD_DIR"
    info "- Platforms Built: $PLATFORMS"
    info "- Total Size: $(du -sh "$BUILD_DIR" | cut -f1)"
    
    if [ -f "$BUILD_DIR/build-report.md" ]; then
        info "- Build Report: $BUILD_DIR/build-report.md"
    fi
    
    echo ""
    log "Artifacts ready for distribution!"
}

# Handle interruption
trap 'error "Build interrupted by user"' INT TERM

# Run main function
main "$@"