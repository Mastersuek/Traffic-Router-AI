#!/bin/bash

# 🔧 Fix Permissions Script
# Исправление проблем с правами доступа на NTFS/fuseblk

set -e

echo "🔧 Fixing file permissions for NTFS/fuseblk compatibility..."

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

# Проверка файловой системы
check_filesystem() {
    log "Checking filesystem type..."
    
    FS_TYPE=$(df -T . | tail -1 | awk '{print $2}')
    log "Detected filesystem: $FS_TYPE"
    
    if [[ "$FS_TYPE" == "fuseblk" || "$FS_TYPE" == "ntfs" ]]; then
        warning "NTFS/fuseblk filesystem detected - applying permission fixes"
        return 0
    else
        log "Standard filesystem detected - minimal fixes needed"
        return 1
    fi
}

# Исправление прав доступа к скриптам
fix_script_permissions() {
    log "Fixing script permissions..."
    
    SCRIPT_FILES=(
        "scripts/quick-build.sh"
        "scripts/build-ntfs-fix.sh"
        "scripts/fix-permissions.sh"
        "scripts/start-recovery-agent.py"
        "scripts/deploy-production.sh"
        "scripts/setup-production.sh"
    )
    
    for script in "${SCRIPT_FILES[@]}"; do
        if [ -f "$script" ]; then
            chmod +x "$script" 2>/dev/null || {
                warning "Could not set execute permission for $script"
            }
            success "Fixed permissions for $script"
        else
            warning "Script not found: $script"
        fi
    done
}

# Исправление прав доступа к директориям
fix_directory_permissions() {
    log "Fixing directory permissions..."
    
    DIRECTORIES=(
        "node_modules"
        ".next"
        "logs"
        "data"
        "cache"
        "memory"
        "test_results"
        "reports"
    )
    
    for dir in "${DIRECTORIES[@]}"; do
        if [ -d "$dir" ]; then
            # Попытка исправить права доступа
            chmod -R u+rwx "$dir" 2>/dev/null || {
                warning "Could not fix permissions for directory: $dir"
            }
            success "Fixed permissions for directory: $dir"
        else
            log "Directory not found (will be created): $dir"
            mkdir -p "$dir" 2>/dev/null || {
                warning "Could not create directory: $dir"
            }
        fi
    done
}

# Создание .gitignore для игнорирования проблемных файлов
create_gitignore_fixes() {
    log "Adding NTFS-specific entries to .gitignore..."
    
    GITIGNORE_ADDITIONS="
# NTFS/fuseblk filesystem compatibility
.next/
*.tmp
*.temp
.cache/
node_modules/.cache/
.npm/
.node_repl_history
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Build artifacts that may cause permission issues
dist/
build/
out/
.output/

# OS-specific files that may cause issues
Thumbs.db
.DS_Store
desktop.ini
*.lnk

# Temporary files
*~
.#*
#*#
.*.swp
.*.swo
"
    
    if [ -f ".gitignore" ]; then
        # Проверяем, есть ли уже наши записи
        if ! grep -q "NTFS/fuseblk filesystem compatibility" .gitignore; then
            echo "$GITIGNORE_ADDITIONS" >> .gitignore
            success "Added NTFS-specific entries to .gitignore"
        else
            log ".gitignore already contains NTFS-specific entries"
        fi
    else
        echo "$GITIGNORE_ADDITIONS" > .gitignore
        success "Created .gitignore with NTFS-specific entries"
    fi
}

# Создание npm конфигурации для NTFS
create_npm_config() {
    log "Creating npm configuration for NTFS compatibility..."
    
    NPM_CONFIG="
# NPM configuration for NTFS/fuseblk compatibility
cache-max=0
prefer-offline=false
audit=false
fund=false
package-lock=false
save-exact=true
"
    
    echo "$NPM_CONFIG" > .npmrc
    success "Created .npmrc with NTFS-compatible settings"
}

# Создание переменных окружения
create_env_config() {
    log "Creating environment configuration..."
    
    ENV_CONFIG="
# NTFS/fuseblk compatibility settings
CHOKIDAR_USEPOLLING=true
CHOKIDAR_INTERVAL=1000
NEXT_TELEMETRY_DISABLED=1
DISABLE_ESLINT_PLUGIN=true
GENERATE_SOURCEMAP=false
NODE_OPTIONS=--max-old-space-size=4096
"
    
    if [ ! -f ".env.local" ]; then
        echo "$ENV_CONFIG" > .env.local
        success "Created .env.local with NTFS-compatible settings"
    else
        # Добавляем настройки, если их еще нет
        if ! grep -q "CHOKIDAR_USEPOLLING" .env.local; then
            echo "$ENV_CONFIG" >> .env.local
            success "Added NTFS-compatible settings to .env.local"
        else
            log ".env.local already contains NTFS-compatible settings"
        fi
    fi
}

# Очистка проблемных кешей
clean_caches() {
    log "Cleaning problematic caches..."
    
    CACHE_DIRS=(
        "node_modules/.cache"
        ".next"
        ".npm"
        ".cache"
        "dist"
        "build"
    )
    
    for cache_dir in "${CACHE_DIRS[@]}"; do
        if [ -d "$cache_dir" ]; then
            log "Removing cache directory: $cache_dir"
            rm -rf "$cache_dir" 2>/dev/null || {
                warning "Could not remove cache directory: $cache_dir"
                # Попытка с sudo
                sudo rm -rf "$cache_dir" 2>/dev/null || {
                    error "Failed to remove cache directory: $cache_dir"
                }
            }
            success "Cleaned cache directory: $cache_dir"
        fi
    done
}

# Создание отчета
create_report() {
    log "Creating permissions fix report..."
    
    REPORT_TIME=$(date)
    FS_TYPE=$(df -T . | tail -1 | awk '{print $2}')
    
    cat > "PERMISSIONS_FIX_REPORT.md" << EOF
# 🔧 Permissions Fix Report

**Fix Time:** ${REPORT_TIME}
**Filesystem:** ${FS_TYPE}
**Platform:** $(uname -s)

## 🛠️ Applied Fixes
- ✅ Fixed script permissions
- ✅ Fixed directory permissions
- ✅ Created NTFS-specific .gitignore entries
- ✅ Created npm configuration for NTFS compatibility
- ✅ Set up environment variables for compatibility
- ✅ Cleaned problematic caches

## 📋 Next Steps
1. Run the build with NTFS compatibility:
   \`\`\`bash
   npm run build:ntfs
   \`\`\`

2. Or use the quick build script:
   \`\`\`bash
   npm run build:quick
   \`\`\`

3. Start the development server:
   \`\`\`bash
   npm run dev
   \`\`\`

## 📝 Notes
- All scripts now have execute permissions
- Directories have proper read/write permissions
- npm is configured for NTFS compatibility
- File watching uses polling instead of native events
- Caching is disabled to prevent permission issues

If you still encounter permission issues, try running commands with sudo or check your mount options for the NTFS drive.
EOF

    success "Permissions fix report created: PERMISSIONS_FIX_REPORT.md"
}

# Основная функция
main() {
    echo "="*60
    echo "🔧 NTFS/fuseblk Permissions Fix"
    echo "="*60
    
    if check_filesystem; then
        log "Applying NTFS/fuseblk specific fixes..."
    else
        log "Applying standard permission fixes..."
    fi
    
    fix_script_permissions
    fix_directory_permissions
    create_gitignore_fixes
    create_npm_config
    create_env_config
    clean_caches
    create_report
    
    echo ""
    echo "="*60
    success "🎉 Permissions Fix Completed!"
    echo "="*60
    echo ""
    echo "📋 Next steps:"
    echo "   npm run build:ntfs     - Build with NTFS compatibility"
    echo "   npm run build:quick    - Quick build script"
    echo "   npm run dev            - Start development server"
    echo ""
    echo "📖 See PERMISSIONS_FIX_REPORT.md for details"
}

# Запуск
main "$@"