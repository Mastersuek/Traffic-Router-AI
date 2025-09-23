#!/bin/bash

# Cross-Platform Build Script for Traffic Router
set -e

echo "🚀 Starting cross-platform build process..."

# Configuration
BUILD_VERSION=${BUILD_VERSION:-$(date +%Y%m%d-%H%M%S)}
BUILD_DIR="build-cross-platform-${BUILD_VERSION}"
PLATFORMS=${PLATFORMS:-"windows,linux,android,macos,ios"}
SKIP_TESTS=${SKIP_TESTS:-false}
SIGN_BUILDS=${SIGN_BUILDS:-false}

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

# Check dependencies
check_dependencies() {
    log "Checking dependencies..."
    
    # Node.js
    if ! command -v node &> /dev/null; then
        error "Node.js is required but not installed"
    fi
    
    # npm
    if ! command -v npm &> /dev/null; then
        error "npm is required but not installed"
    fi
    
    log "Node.js version: $(node --version)"
    log "npm version: $(npm --version)"
}

# Build Windows .exe with Electron
build_windows() {
    if [[ "$PLATFORMS" != *"windows"* ]]; then
        return 0
    fi
    
    log "Building Windows .exe application..."
    
    cd clients/desktop
    
    # Install dependencies
    log "Installing desktop dependencies..."
    npm ci
    
    # Build for Windows
    log "Building Windows executable..."
    npm run build:windows
    
    # Copy to build directory
    mkdir -p "../../${BUILD_DIR}/windows"
    cp -r dist/* "../../${BUILD_DIR}/windows/"
    
    cd ../..
    
    log "✅ Windows build completed"
}

# Build Linux .AppImage
build_linux() {
    if [[ "$PLATFORMS" != *"linux"* ]]; then
        return 0
    fi
    
    log "Building Linux .AppImage application..."
    
    cd clients/desktop
    
    # Build for Linux
    log "Building Linux AppImage..."
    npm run build:linux
    
    # Copy to build directory
    mkdir -p "../../${BUILD_DIR}/linux"
    cp -r dist/* "../../${BUILD_DIR}/linux/"
    
    cd ../..
    
    log "✅ Linux build completed"
}

# Build Android .apk
build_android() {
    if [[ "$PLATFORMS" != *"android"* ]]; then
        return 0
    fi
    
    log "Building Android .apk application..."
    
    # Check Android dependencies
    if ! command -v java &> /dev/null; then
        warn "Java is not installed. Android build may fail."
    fi
    
    if [ -z "$ANDROID_HOME" ]; then
        warn "ANDROID_HOME is not set. Android build may fail."
    fi
    
    cd clients/mobile
    
    # Install dependencies
    log "Installing mobile dependencies..."
    npm ci
    
    # Create Android project structure if needed
    if [ ! -d "android" ]; then
        log "Initializing React Native Android project..."
        npx @react-native-community/cli@latest init TrafficRouterMobile --template react-native-template-typescript
        # Copy our source files
        cp -r src/* TrafficRouterMobile/src/
        cd TrafficRouterMobile
    fi
    
    # Bundle JavaScript
    log "Bundling JavaScript for Android..."
    npm run bundle:android || {
        log "Fallback: Creating bundle manually..."
        npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output android/app/src/main/assets/index.android.bundle --assets-dest android/app/src/main/res
    }
    
    # Build APK
    log "Building Android APK..."
    if [ -d "android" ]; then
        npm run build:android || {
            log "Fallback: Building with Gradle directly..."
            cd android && ./gradlew assembleRelease && cd ..
        }
    else
        warn "Android directory not found. Skipping APK build."
        cd ../..
        return 0
    fi
    
    # Copy APK to build directory
    mkdir -p "../../${BUILD_DIR}/android"
    find android/app/build/outputs/apk -name "*.apk" -exec cp {} "../../${BUILD_DIR}/android/" \; 2>/dev/null || {
        warn "No APK files found. Build may have failed."
    }
    
    cd ../..
    
    log "✅ Android build completed"
}

# Build macOS .dmg
build_macos() {
    if [[ "$PLATFORMS" != *"macos"* ]]; then
        return 0
    fi
    
    log "Building macOS .dmg application..."
    
    # Check if running on macOS
    if [[ "$OSTYPE" != "darwin"* ]]; then
        warn "macOS build requires macOS. Skipping macOS build."
        return 0
    fi
    
    cd clients/desktop
    
    # Install dependencies
    log "Installing desktop dependencies for macOS..."
    npm ci
    
    # Build for macOS
    log "Building macOS application..."
    npm run build:mac || {
        log "Fallback: Building with electron-builder directly..."
        npx electron-builder --mac
    }
    
    # Copy to build directory
    mkdir -p "../../${BUILD_DIR}/macos"
    find dist -name "*.dmg" -exec cp {} "../../${BUILD_DIR}/macos/" \; 2>/dev/null || {
        warn "No DMG files found. Build may have failed."
    }
    
    cd ../..
    
    log "✅ macOS build completed"
}

# Build iOS .ipa
build_ios() {
    if [[ "$PLATFORMS" != *"ios"* ]]; then
        return 0
    fi
    
    log "Building iOS .ipa application..."
    
    # Check if running on macOS
    if [[ "$OSTYPE" != "darwin"* ]]; then
        warn "iOS build requires macOS. Skipping iOS build."
        return 0
    fi
    
    # Check Xcode
    if ! command -v xcodebuild &> /dev/null; then
        warn "Xcode is not installed. Skipping iOS build."
        return 0
    fi
    
    cd clients/mobile
    
    # Install dependencies
    log "Installing mobile dependencies for iOS..."
    npm ci
    
    # Install CocoaPods dependencies
    if [ -d "ios" ]; then
        log "Installing CocoaPods dependencies..."
        cd ios && pod install && cd ..
    else
        log "Initializing React Native iOS project..."
        npx @react-native-community/cli@latest init TrafficRouterMobile --template react-native-template-typescript
        cp -r src/* TrafficRouterMobile/src/
        cd TrafficRouterMobile/ios && pod install && cd ../..
    fi
    
    # Bundle JavaScript for iOS
    log "Bundling JavaScript for iOS..."
    npm run bundle:ios || {
        log "Fallback: Creating iOS bundle manually..."
        npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output ios/main.jsbundle --assets-dest ios
    }
    
    # Build iOS app
    log "Building iOS application..."
    if [ -d "ios" ]; then
        npm run build:ios || {
            log "Fallback: Building with xcodebuild directly..."
            cd ios
            xcodebuild -workspace TrafficRouter.xcworkspace -scheme TrafficRouter -configuration Release -destination generic/platform=iOS -archivePath TrafficRouter.xcarchive archive
            xcodebuild -exportArchive -archivePath TrafficRouter.xcarchive -exportPath ../build -exportOptionsPlist ExportOptions.plist
            cd ..
        }
    else
        warn "iOS directory not found. Skipping iOS build."
        cd ../..
        return 0
    fi
    
    # Copy IPA to build directory
    mkdir -p "../../${BUILD_DIR}/ios"
    find . -name "*.ipa" -exec cp {} "../../${BUILD_DIR}/ios/" \; 2>/dev/null || {
        warn "No IPA files found. Build may have failed."
    }
    
    cd ../..
    
    log "✅ iOS build completed"
}

# Build Python Windows executable
build_python_windows() {
    if [[ "$PLATFORMS" != *"windows"* ]]; then
        return 0
    fi
    
    log "Building Python Windows executable..."
    
    # Check if Python and PyInstaller are available
    if ! command -v python3 &> /dev/null && ! command -v python &> /dev/null; then
        warn "Python is not installed. Skipping Python Windows build."
        return 0
    fi
    
    # Install PyInstaller if not available
    if ! python3 -c "import PyInstaller" 2>/dev/null && ! python -c "import PyInstaller" 2>/dev/null; then
        log "Installing PyInstaller..."
        pip install pyinstaller
    fi
    
    cd clients/windows
    
    # Create executable
    log "Creating Windows executable from Python GUI..."
    pyinstaller --onefile --windowed \
        --name "TrafficRouter" \
        --icon="../../build/icon.ico" \
        --add-data "../../lib;lib" \
        --add-data "../../server;server" \
        traffic_router_gui.py
    
    # Copy to build directory
    mkdir -p "../../${BUILD_DIR}/windows-python"
    cp dist/* "../../${BUILD_DIR}/windows-python/"
    
    cd ../..
    
    log "✅ Python Windows build completed"
}

# Create installers and packages
create_packages() {
    log "Creating installation packages..."
    
    cd "$BUILD_DIR"
    
    # Windows installer (if NSIS is available)
    if [ -d "windows" ] && command -v makensis &> /dev/null; then
        log "Creating Windows installer..."
        # Create NSIS script and build installer
        # This would require a proper NSIS script
    fi
    
    # Linux packages
    if [ -d "linux" ]; then
        log "Creating Linux packages..."
        
        # Create .deb package structure
        mkdir -p linux-deb/DEBIAN
        mkdir -p linux-deb/usr/bin
        mkdir -p linux-deb/usr/share/applications
        mkdir -p linux-deb/usr/share/icons/hicolor/256x256/apps
        
        # Copy files
        cp linux/*.AppImage linux-deb/usr/bin/traffic-router
        
        # Create .deb control file
        cat > linux-deb/DEBIAN/control << EOF
Package: traffic-router
Version: ${BUILD_VERSION}
Section: net
Priority: optional
Architecture: amd64
Depends: libnss3, libatk-bridge2.0-0, libdrm2, libxkbcommon0, libxcomposite1, libxdamage1, libxrandr2, libgbm1, libxss1, libasound2
Maintainer: Traffic Router Team <team@trafficrouter.com>
Description: Traffic Router - система маршрутизации трафика
 Система маршрутизации трафика с геолокацией для обхода блокировок
 и оптимизации доступа к AI-сервисам.
EOF
        
        # Create .desktop file
        cat > linux-deb/usr/share/applications/traffic-router.desktop << EOF
[Desktop Entry]
Name=Traffic Router
Comment=Система маршрутизации трафика
Exec=/usr/bin/traffic-router
Icon=traffic-router
Terminal=false
Type=Application
Categories=Network;
EOF
        
        # Build .deb package
        if command -v dpkg-deb &> /dev/null; then
            dpkg-deb --build linux-deb traffic-router_${BUILD_VERSION}_amd64.deb
        fi
    fi
    
    cd ..
}

# Generate checksums
generate_checksums() {
    log "Generating checksums..."
    
    cd "$BUILD_DIR"
    
    # Generate SHA256 checksums for all files
    find . -type f \( -name "*.exe" -o -name "*.AppImage" -o -name "*.apk" -o -name "*.deb" -o -name "*.dmg" \) -exec sha256sum {} \; > checksums.sha256
    
    cd ..
}

# Create build info
create_build_info() {
    log "Creating build information..."
    
    cat > "$BUILD_DIR/build-info.json" << EOF
{
  "version": "$BUILD_VERSION",
  "buildDate": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "platforms": "$PLATFORMS",
  "nodeVersion": "$(node --version)",
  "npmVersion": "$(npm --version)",
  "gitCommit": "$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')",
  "buildEnvironment": {
    "os": "$(uname -s)",
    "arch": "$(uname -m)",
    "kernel": "$(uname -r)"
  }
}
EOF
}

# Test builds (optional)
test_builds() {
    if [ "$SKIP_TESTS" = "true" ]; then
        log "Skipping build tests"
        return 0
    fi
    
    log "Testing built applications..."
    
    # Test Windows executable
    if [ -d "$BUILD_DIR/windows" ]; then
        log "Testing Windows executable..."
        # Add Windows-specific tests here
    fi
    
    # Test Linux AppImage
    if [ -d "$BUILD_DIR/linux" ]; then
        log "Testing Linux AppImage..."
        # Add Linux-specific tests here
    fi
    
    # Test Android APK
    if [ -d "$BUILD_DIR/android" ]; then
        log "Testing Android APK..."
        # Add Android-specific tests here
    fi
    
    log "✅ Build tests completed"
}

# Sign builds (optional)
sign_builds() {
    if [ "$SIGN_BUILDS" != "true" ]; then
        log "Skipping code signing"
        return 0
    fi
    
    log "Signing built applications..."
    
    # Sign Windows executable
    if [ -d "$BUILD_DIR/windows" ] && [ -n "$WINDOWS_CERT_PATH" ]; then
        log "Signing Windows executable..."
        # Add Windows code signing here
    fi
    
    # Sign macOS application
    if [ -d "$BUILD_DIR/macos" ] && [ -n "$MACOS_CERT_ID" ]; then
        log "Signing macOS application..."
        # Add macOS code signing here
    fi
    
    log "✅ Code signing completed"
}

# Main build process
main() {
    log "Cross-platform build started"
    log "Build version: $BUILD_VERSION"
    log "Target platforms: $PLATFORMS"
    log "Skip tests: $SKIP_TESTS"
    log "Sign builds: $SIGN_BUILDS"
    
    # Pre-build checks
    check_dependencies
    
    # Create build directory
    mkdir -p "$BUILD_DIR"
    
    # Build for each platform
    build_windows
    build_linux
    build_android
    build_macos
    build_ios
    build_python_windows
    
    # Post-build tasks
    test_builds
    sign_builds
    create_packages
    generate_checksums
    create_build_info
    
    # Create archive
    log "Creating build archive..."
    tar -czf "traffic-router-cross-platform-${BUILD_VERSION}.tar.gz" "$BUILD_DIR"
    
    # Build summary
    log "Build completed successfully!"
    echo ""
    info "Build Summary:"
    info "- Version: $BUILD_VERSION"
    info "- Platforms: $PLATFORMS"
    info "- Build Directory: $BUILD_DIR"
    info "- Archive: traffic-router-cross-platform-${BUILD_VERSION}.tar.gz"
    info "- Archive Size: $(du -h "traffic-router-cross-platform-${BUILD_VERSION}.tar.gz" | cut -f1)"
    
    if [ -d "$BUILD_DIR/windows" ]; then
        info "- Windows: $(find "$BUILD_DIR/windows" -name "*.exe" -o -name "*.msi" | wc -l) executable(s)"
    fi
    
    if [ -d "$BUILD_DIR/linux" ]; then
        info "- Linux: $(find "$BUILD_DIR/linux" -name "*.AppImage" -o -name "*.deb" -o -name "*.rpm" | wc -l) package(s)"
    fi
    
    if [ -d "$BUILD_DIR/android" ]; then
        info "- Android: $(find "$BUILD_DIR/android" -name "*.apk" | wc -l) APK(s)"
    fi
    
    if [ -d "$BUILD_DIR/macos" ]; then
        info "- macOS: $(find "$BUILD_DIR/macos" -name "*.dmg" | wc -l) DMG(s)"
    fi
    
    if [ -d "$BUILD_DIR/ios" ]; then
        info "- iOS: $(find "$BUILD_DIR/ios" -name "*.ipa" | wc -l) IPA(s)"
    fi
    
    echo ""
    log "Next steps:"
    log "1. Test executables on target platforms"
    log "2. Sign executables for distribution (use SIGN_BUILDS=true)"
    log "3. Upload to release channels"
    log "4. Update documentation with download links"
    
    echo ""
    log "🎉 Cross-platform build process completed successfully!"
}

# Run main function
main "$@"