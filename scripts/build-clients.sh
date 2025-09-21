#!/bin/bash

# Скрипт сборки клиентских приложений для всех платформ

echo "Building Traffic Router Client Applications..."

# Создание директорий для сборки
mkdir -p build/{windows,linux,macos,android,ios}

# Сборка десктопного приложения (Electron)
echo "Building desktop application..."
cd clients/desktop

# Установка зависимостей
npm install

# Сборка для разных платформ
npm run build:windows
npm run build:linux  
npm run build:macos

# Копирование в директорию сборки
cp -r dist/win-unpacked/* ../../build/windows/
cp -r dist/linux-unpacked/* ../../build/linux/
cp -r dist/mac/* ../../build/macos/

cd ../..

# Сборка Windows GUI (Python)
echo "Building Windows Python GUI..."
cd clients/windows

# Создание виртуального окружения
python -m venv venv
source venv/bin/activate || venv\Scripts\activate

# Установка зависимостей
pip install -r requirements.txt
pip install pyinstaller

# Сборка исполняемого файла
pyinstaller --onefile --windowed --name="TrafficRouter" traffic_router_gui.py

# Копирование в директорию сборки
cp dist/TrafficRouter.exe ../../build/windows/

cd ../..

# Сборка мобильного приложения (React Native)
echo "Building mobile applications..."
cd clients/mobile/react-native

# Установка зависимостей
npm install

# Сборка для Android
echo "Building Android APK..."
cd android
./gradlew assembleRelease
cp app/build/outputs/apk/release/app-release.apk ../../../build/android/TrafficRouter.apk
cd ..

# Сборка для iOS (только на macOS)
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "Building iOS app..."
    cd ios
    xcodebuild -workspace TrafficRouter.xcworkspace -scheme TrafficRouter -configuration Release -destination generic/platform=iOS archive -archivePath ../../../build/ios/TrafficRouter.xcarchive
    cd ..
else
    echo "iOS build skipped (requires macOS)"
fi

cd ../../..

# Создание установочных пакетов
echo "Creating installation packages..."

# Windows Installer (NSIS)
if command -v makensis &> /dev/null; then
    echo "Creating Windows installer..."
    makensis scripts/windows-installer.nsi
fi

# Linux Package (DEB)
if command -v dpkg-deb &> /dev/null; then
    echo "Creating Linux DEB package..."
    mkdir -p build/linux-package/DEBIAN
    mkdir -p build/linux-package/usr/bin
    mkdir -p build/linux-package/usr/share/applications
    mkdir -p build/linux-package/usr/share/icons
    
    # Control file
    cat > build/linux-package/DEBIAN/control << EOF
Package: traffic-router
Version: 1.0.0
Section: net
Priority: optional
Architecture: amd64
Depends: nodejs (>= 14.0.0)
Maintainer: Traffic Router Team
Description: Traffic routing system with geolocation
 Multi-platform traffic routing application with geolocation-based
 traffic sorting for bypassing blocks and optimizing AI service access.
EOF
    
    # Desktop entry
    cat > build/linux-package/usr/share/applications/traffic-router.desktop << EOF
[Desktop Entry]
Name=Traffic Router
Comment=Traffic routing system with geolocation
Exec=/usr/bin/traffic-router
Icon=traffic-router
Terminal=false
Type=Application
Categories=Network;
EOF
    
    # Copy files
    cp build/linux/traffic-router build/linux-package/usr/bin/
    chmod +x build/linux-package/usr/bin/traffic-router
    
    # Build package
    dpkg-deb --build build/linux-package build/traffic-router_1.0.0_amd64.deb
fi

# macOS Package (PKG)
if [[ "$OSTYPE" == "darwin"* ]] && command -v pkgbuild &> /dev/null; then
    echo "Creating macOS package..."
    pkgbuild --root build/macos --identifier com.trafficrouter.app --version 1.0.0 build/TrafficRouter-1.0.0.pkg
fi

# Создание архивов для распространения
echo "Creating distribution archives..."

cd build

# Windows
zip -r TrafficRouter-Windows-1.0.0.zip windows/

# Linux
tar -czf TrafficRouter-Linux-1.0.0.tar.gz linux/

# macOS
if [[ "$OSTYPE" == "darwin"* ]]; then
    zip -r TrafficRouter-macOS-1.0.0.zip macos/
fi

# Android
if [ -f android/TrafficRouter.apk ]; then
    cp android/TrafficRouter.apk TrafficRouter-Android-1.0.0.apk
fi

# iOS
if [ -d ios/TrafficRouter.xcarchive ]; then
    zip -r TrafficRouter-iOS-1.0.0.zip ios/
fi

cd ..

echo "Build completed!"
echo "Distribution files created in build/ directory:"
ls -la build/*.{zip,tar.gz,deb,pkg,apk} 2>/dev/null || echo "Some packages may not be available on this platform"

# Создание checksums
echo "Creating checksums..."
cd build
find . -name "*.zip" -o -name "*.tar.gz" -o -name "*.deb" -o -name "*.pkg" -o -name "*.apk" | xargs sha256sum > checksums.txt
cd ..

echo "Build process completed successfully!"
