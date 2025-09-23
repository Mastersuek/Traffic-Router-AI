#!/usr/bin/env python3
"""
Build script for creating Windows executable from Traffic Router GUI
"""

import os
import sys
import subprocess
import shutil
from pathlib import Path

def check_dependencies():
    """Check if required dependencies are installed"""
    try:
        import PyInstaller
        print("✅ PyInstaller is available")
    except ImportError:
        print("❌ PyInstaller not found. Installing...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pyinstaller"])
        
    try:
        import requests
        print("✅ requests is available")
    except ImportError:
        print("❌ requests not found. Installing...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "requests"])

def create_spec_file():
    """Create PyInstaller spec file"""
    spec_content = '''# -*- mode: python ; coding: utf-8 -*-

block_cipher = None

a = Analysis(
    ['traffic_router_gui.py'],
    pathex=[],
    binaries=[],
    datas=[
        ('../../lib', 'lib'),
        ('../../server', 'server'),
        ('../../config', 'config'),
    ],
    hiddenimports=[
        'tkinter',
        'tkinter.ttk',
        'tkinter.messagebox',
        'requests',
        'json',
        'threading',
        'time',
        'math',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='TrafficRouter',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='icon.ico'
)
'''
    
    with open('traffic_router.spec', 'w') as f:
        f.write(spec_content)
    
    print("✅ Created PyInstaller spec file")

def create_icon():
    """Create a simple icon file if it doesn't exist"""
    if not os.path.exists('icon.ico'):
        print("⚠️  No icon.ico found, creating placeholder...")
        # Create a simple 16x16 ICO file (placeholder)
        ico_data = b'\x00\x00\x01\x00\x01\x00\x10\x10\x00\x00\x01\x00\x08\x00h\x05\x00\x00\x16\x00\x00\x00(\x00\x00\x00\x10\x00\x00\x00 \x00\x00\x00\x01\x00\x08\x00\x00\x00\x00\x00@\x05\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x01\x00\x00\x00\x01\x00\x00\x00\x00\x00\x00\x80\x00\x00\x80\x00\x00\x00\x80\x80\x00\x80\x00\x00\x00\x80\x00\x80\x00\x80\x80\x00\x00\x80\x80\x80\x00\xc0\xc0\xc0\x00\x00\x00\xff\x00\x00\xff\x00\x00\x00\xff\xff\x00\xff\x00\x00\x00\xff\x00\xff\x00\xff\xff\x00\x00\xff\xff\xff\x00' + b'\x00' * (256 * 4 - 32) + b'\x00' * 1024
        
        with open('icon.ico', 'wb') as f:
            f.write(ico_data)
        
        print("✅ Created placeholder icon")

def build_executable():
    """Build the executable using PyInstaller"""
    print("🔨 Building executable...")
    
    # Clean previous builds
    if os.path.exists('dist'):
        shutil.rmtree('dist')
    if os.path.exists('build'):
        shutil.rmtree('build')
    
    # Build with PyInstaller
    cmd = [
        'pyinstaller',
        '--onefile',
        '--windowed',
        '--name=TrafficRouter',
        '--icon=icon.ico',
        '--add-data=../../lib;lib',
        '--add-data=../../server;server',
        '--add-data=../../config;config',
        '--hidden-import=tkinter',
        '--hidden-import=tkinter.ttk',
        '--hidden-import=tkinter.messagebox',
        '--hidden-import=requests',
        '--clean',
        'traffic_router_gui.py'
    ]
    
    try:
        result = subprocess.run(cmd, check=True, capture_output=True, text=True)
        print("✅ Build completed successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Build failed: {e}")
        print(f"stdout: {e.stdout}")
        print(f"stderr: {e.stderr}")
        return False

def create_installer():
    """Create NSIS installer script"""
    nsis_script = '''
; Traffic Router Installer Script
!define APPNAME "Traffic Router"
!define COMPANYNAME "Traffic Router Team"
!define DESCRIPTION "Система маршрутизации трафика"
!define VERSIONMAJOR 1
!define VERSIONMINOR 0
!define VERSIONBUILD 0
!define HELPURL "https://github.com/traffic-router/desktop"
!define UPDATEURL "https://github.com/traffic-router/desktop/releases"
!define ABOUTURL "https://github.com/traffic-router/desktop"
!define INSTALLSIZE 50000

RequestExecutionLevel admin
InstallDir "$PROGRAMFILES\\${APPNAME}"
Name "${APPNAME}"
Icon "icon.ico"
outFile "TrafficRouter-Setup.exe"

!include LogicLib.nsh

page directory
page instfiles

!macro VerifyUserIsAdmin
UserInfo::GetAccountType
pop $0
${If} $0 != "admin"
    messageBox mb_iconstop "Administrator rights required!"
    setErrorLevel 740
    quit
${EndIf}
!macroend

function .onInit
    setShellVarContext all
    !insertmacro VerifyUserIsAdmin
functionEnd

section "install"
    setOutPath $INSTDIR
    file "dist\\TrafficRouter.exe"
    file "icon.ico"
    
    writeUninstaller "$INSTDIR\\uninstall.exe"
    
    createDirectory "$SMPROGRAMS\\${APPNAME}"
    createShortCut "$SMPROGRAMS\\${APPNAME}\\${APPNAME}.lnk" "$INSTDIR\\TrafficRouter.exe" "" "$INSTDIR\\icon.ico"
    createShortCut "$DESKTOP\\${APPNAME}.lnk" "$INSTDIR\\TrafficRouter.exe" "" "$INSTDIR\\icon.ico"
    
    WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${APPNAME}" "DisplayName" "${APPNAME}"
    WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${APPNAME}" "UninstallString" "$INSTDIR\\uninstall.exe"
    WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${APPNAME}" "InstallLocation" "$INSTDIR"
    WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${APPNAME}" "DisplayIcon" "$INSTDIR\\icon.ico"
    WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${APPNAME}" "Publisher" "${COMPANYNAME}"
    WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${APPNAME}" "HelpLink" "${HELPURL}"
    WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${APPNAME}" "URLUpdateInfo" "${UPDATEURL}"
    WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${APPNAME}" "URLInfoAbout" "${ABOUTURL}"
    WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${APPNAME}" "DisplayVersion" "${VERSIONMAJOR}.${VERSIONMINOR}.${VERSIONBUILD}"
    WriteRegDWORD HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${APPNAME}" "VersionMajor" ${VERSIONMAJOR}
    WriteRegDWORD HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${APPNAME}" "VersionMinor" ${VERSIONMINOR}
    WriteRegDWORD HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${APPNAME}" "NoModify" 1
    WriteRegDWORD HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${APPNAME}" "NoRepair" 1
    WriteRegDWORD HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${APPNAME}" "EstimatedSize" ${INSTALLSIZE}
sectionEnd

section "uninstall"
    delete "$INSTDIR\\TrafficRouter.exe"
    delete "$INSTDIR\\icon.ico"
    delete "$INSTDIR\\uninstall.exe"
    
    delete "$SMPROGRAMS\\${APPNAME}\\${APPNAME}.lnk"
    rmDir "$SMPROGRAMS\\${APPNAME}"
    delete "$DESKTOP\\${APPNAME}.lnk"
    
    DeleteRegKey HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${APPNAME}"
    
    rmDir $INSTDIR
sectionEnd
'''
    
    with open('installer.nsi', 'w') as f:
        f.write(nsis_script)
    
    print("✅ Created NSIS installer script")
    
    # Try to build installer if NSIS is available
    try:
        subprocess.run(['makensis', 'installer.nsi'], check=True)
        print("✅ Created Windows installer")
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("⚠️  NSIS not found. Installer script created but not compiled.")
        print("   Install NSIS from https://nsis.sourceforge.io/ to create installer")

def main():
    """Main build function"""
    print("🚀 Building Traffic Router Windows executable...")
    
    # Change to the script directory
    os.chdir(Path(__file__).parent)
    
    # Check and install dependencies
    check_dependencies()
    
    # Create necessary files
    create_icon()
    create_spec_file()
    
    # Build executable
    if build_executable():
        print("\n✅ Build completed successfully!")
        
        if os.path.exists('dist/TrafficRouter.exe'):
            size = os.path.getsize('dist/TrafficRouter.exe')
            print(f"📦 Executable size: {size / (1024*1024):.1f} MB")
            print(f"📁 Location: {os.path.abspath('dist/TrafficRouter.exe')}")
            
            # Create installer
            create_installer()
            
            print("\n🎉 Windows build completed!")
            print("Next steps:")
            print("1. Test the executable: dist/TrafficRouter.exe")
            print("2. Install NSIS and run 'makensis installer.nsi' to create installer")
            print("3. Sign the executable for distribution")
        else:
            print("❌ Executable not found after build")
            return False
    else:
        print("❌ Build failed")
        return False
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)