#!/bin/bash

# Build Environment Setup Script for Traffic Router
set -e

echo "🔧 Setting up cross-platform build environment..."

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

# Detect OS
detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        OS="linux"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
    elif [[ "$OSTYPE" == "cygwin" ]] || [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
        OS="windows"
    else
        OS="unknown"
    fi
    
    log "Detected OS: $OS"
}

# Setup Node.js and npm
setup_nodejs() {
    log "Setting up Node.js environment..."
    
    if ! command -v node &> /dev/null; then
        warn "Node.js is not installed. Please install Node.js 18+ first."
        case $OS in
            "linux")
                info "Install with: curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt-get install -y nodejs"
                ;;
            "macos")
                info "Install with: brew install node"
                ;;
            "windows")
                info "Download from: https://nodejs.org/en/download/"
                ;;
        esac
        return 1
    fi
    
    NODE_VERSION=$(node --version)
    log "Node.js version: $NODE_VERSION"
    
    # Check Node.js version (should be 18+)
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
    if [ "$NODE_MAJOR" -lt 18 ]; then
        warn "Node.js version $NODE_VERSION is too old. Please upgrade to Node.js 18+"
        return 1
    fi
    
    # Update npm to latest
    log "Updating npm to latest version..."
    npm install -g npm@latest
    
    log "✅ Node.js environment ready"
}

# Setup Electron build tools
setup_electron() {
    log "Setting up Electron build environment..."
    
    cd clients/desktop
    
    # Install dependencies
    log "Installing Electron dependencies..."
    npm ci
    
    # Install electron-builder globally if not present
    if ! npm list -g electron-builder &> /dev/null; then
        log "Installing electron-builder globally..."
        npm install -g electron-builder
    fi
    
    cd ../..
    
    log "✅ Electron environment ready"
}

# Setup React Native environment
setup_react_native() {
    log "Setting up React Native environment..."
    
    # Install React Native CLI globally
    if ! command -v react-native &> /dev/null; then
        log "Installing React Native CLI..."
        npm install -g @react-native-community/cli
    fi
    
    cd clients/mobile
    
    # Install dependencies
    log "Installing React Native dependencies..."
    npm ci
    
    cd ../..
    
    log "✅ React Native CLI ready"
}

# Setup Android development environment
setup_android() {
    log "Setting up Android development environment..."
    
    # Check Java
    if ! command -v java &> /dev/null; then
        warn "Java is not installed. Android development requires Java 11+"
        case $OS in
            "linux")
                info "Install with: sudo apt-get install openjdk-11-jdk"
                ;;
            "macos")
                info "Install with: brew install openjdk@11"
                ;;
            "windows")
                info "Download from: https://adoptopenjdk.net/"
                ;;
        esac
        return 1
    fi
    
    # Check Android SDK
    if [ -z "$ANDROID_HOME" ]; then
        warn "ANDROID_HOME is not set. Please install Android Studio and set ANDROID_HOME"
        info "Download Android Studio from: https://developer.android.com/studio"
        return 1
    fi
    
    # Check Android SDK tools
    if [ ! -f "$ANDROID_HOME/platform-tools/adb" ]; then
        warn "Android SDK platform-tools not found. Please install via Android Studio SDK Manager"
        return 1
    fi
    
    log "✅ Android environment ready"
    log "ANDROID_HOME: $ANDROID_HOME"
}

# Setup iOS development environment (macOS only)
setup_ios() {
    if [ "$OS" != "macos" ]; then
        log "iOS development is only available on macOS. Skipping iOS setup."
        return 0
    fi
    
    log "Setting up iOS development environment..."
    
    # Check Xcode
    if ! command -v xcodebuild &> /dev/null; then
        warn "Xcode is not installed. Please install Xcode from the App Store"
        return 1
    fi
    
    # Check CocoaPods
    if ! command -v pod &> /dev/null; then
        log "Installing CocoaPods..."
        sudo gem install cocoapods
    fi
    
    # Accept Xcode license
    log "Accepting Xcode license..."
    sudo xcodebuild -license accept 2>/dev/null || true
    
    log "✅ iOS environment ready"
}

# Setup Python environment for Windows GUI
setup_python() {
    log "Setting up Python environment..."
    
    if ! command -v python3 &> /dev/null && ! command -v python &> /dev/null; then
        warn "Python is not installed. Please install Python 3.8+"
        case $OS in
            "linux")
                info "Install with: sudo apt-get install python3 python3-pip python3-venv"
                ;;
            "macos")
                info "Install with: brew install python"
                ;;
            "windows")
                info "Download from: https://www.python.org/downloads/"
                ;;
        esac
        return 1
    fi
    
    # Install PyInstaller for creating executables
    log "Installing PyInstaller..."
    pip3 install pyinstaller || pip install pyinstaller
    
    # Install tkinter if not available
    case $OS in
        "linux")
            log "Installing tkinter..."
            sudo apt-get install python3-tk 2>/dev/null || true
            ;;
    esac
    
    log "✅ Python environment ready"
}

# Setup build directories and assets
setup_build_assets() {
    log "Setting up build assets..."
    
    # Create build directories
    mkdir -p clients/desktop/build
    mkdir -p clients/mobile/android/app/src/main/res
    mkdir -p clients/mobile/ios
    
    # Create placeholder icons if they don't exist
    if [ ! -f "clients/desktop/build/icon.ico" ]; then
        log "Creating placeholder Windows icon..."
        # Create a simple placeholder icon (you should replace this with actual icons)
        echo "Creating placeholder icon files..."
        touch clients/desktop/build/icon.ico
        touch clients/desktop/build/icon.png
        touch clients/desktop/build/icon.icns
    fi
    
    # Create export options for iOS
    if [ "$OS" = "macos" ]; then
        cat > clients/mobile/ios/ExportOptions.plist << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>development</string>
    <key>teamID</key>
    <string>YOUR_TEAM_ID</string>
    <key>uploadBitcode</key>
    <false/>
    <key>uploadSymbols</key>
    <true/>
    <key>compileBitcode</key>
    <false/>
</dict>
</plist>
EOF
    fi
    
    log "✅ Build assets ready"
}

# Create build configuration
create_build_config() {
    log "Creating build configuration..."
    
    cat > build-config.json << EOF
{
  "version": "1.0.0",
  "buildDate": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "environment": {
    "os": "$OS",
    "nodeVersion": "$(node --version 2>/dev/null || echo 'not installed')",
    "npmVersion": "$(npm --version 2>/dev/null || echo 'not installed')",
    "electronVersion": "$(npx electron --version 2>/dev/null || echo 'not installed')",
    "reactNativeVersion": "$(npx react-native --version 2>/dev/null | head -n1 || echo 'not installed')"
  },
  "capabilities": {
    "windows": $([ "$OS" = "windows" ] || [ "$OS" = "linux" ] || [ "$OS" = "macos" ] && echo "true" || echo "false"),
    "linux": $([ "$OS" = "linux" ] || [ "$OS" = "macos" ] && echo "true" || echo "false"),
    "macos": $([ "$OS" = "macos" ] && echo "true" || echo "false"),
    "android": $([ -n "$ANDROID_HOME" ] && echo "true" || echo "false"),
    "ios": $([ "$OS" = "macos" ] && command -v xcodebuild &> /dev/null && echo "true" || echo "false")
  }
}
EOF
    
    log "✅ Build configuration created"
}

# Main setup function
main() {
    log "Starting build environment setup..."
    
    detect_os
    
    # Core setup
    setup_nodejs || warn "Node.js setup failed"
    setup_python || warn "Python setup failed"
    
    # Platform-specific setup
    setup_electron || warn "Electron setup failed"
    setup_react_native || warn "React Native setup failed"
    setup_android || warn "Android setup failed"
    setup_ios || warn "iOS setup failed"
    
    # Final setup
    setup_build_assets
    create_build_config
    
    log "Build environment setup completed!"
    echo ""
    info "Environment Summary:"
    info "- OS: $OS"
    info "- Node.js: $(node --version 2>/dev/null || echo 'not installed')"
    info "- npm: $(npm --version 2>/dev/null || echo 'not installed')"
    info "- Electron: $(npx electron --version 2>/dev/null || echo 'not installed')"
    info "- React Native: $(npx react-native --version 2>/dev/null | head -n1 || echo 'not installed')"
    info "- Java: $(java -version 2>&1 | head -n1 || echo 'not installed')"
    info "- Android SDK: $([ -n "$ANDROID_HOME" ] && echo "installed at $ANDROID_HOME" || echo 'not configured')"
    info "- Xcode: $(xcodebuild -version 2>/dev/null | head -n1 || echo 'not installed')"
    
    echo ""
    log "Next steps:"
    log "1. Run './scripts/build-cross-platform.sh' to build for all platforms"
    log "2. Or run with specific platforms: PLATFORMS='windows,linux' ./scripts/build-cross-platform.sh"
    log "3. Check build-config.json for detailed environment information"
    
    echo ""
    log "🎉 Build environment is ready!"
}

# Run main function
main "$@"