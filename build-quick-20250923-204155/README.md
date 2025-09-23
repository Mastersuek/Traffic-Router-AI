# Traffic Router - Quick Build

**Build Version:** 20250923-204155  
**Build Date:** Вт 23 сен 2025 20:43:28 +07  
**Build Type:** Quick Build (no environment setup)

## Available Builds

❌ Windows (Electron) - Not built
✅ **Windows (Python)** - Lightweight GUI application
✅ **Linux (Electron)** - Desktop application
❌ macOS (Electron) - Not built
❌ Android - Not built
❌ iOS - Not built
✅ **Web (Portable)** - Browser-based interface
✅ **Web Interface** - Simple web control panel

## Quick Start

1. **Web Interface**: Open `web-interface/index.html` in any browser
2. **Windows**: Run executable from `windows/` or `windows-python/` folder
3. **Linux**: Run AppImage from `linux/` folder
4. **Android**: Install APK from `android/` folder
5. **macOS**: Run app from `macos/` folder

## Requirements

- **Backend Server**: Make sure Traffic Router server is running on port 8080
- **Network**: Ensure firewall allows connections to localhost:8080
- **Permissions**: Some platforms may require administrator/root permissions

## Notes

This is a quick build that only creates applications for available tools on your system.
For full cross-platform builds with all optimizations, use the complete build system.

## Support

- Check server status at: http://localhost:8080/health
- View logs in the application directories
- Report issues with build information above
