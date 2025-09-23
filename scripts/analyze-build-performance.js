#!/usr/bin/env node

/**
 * Build Performance Analysis Script
 * Analyzes build size, performance metrics, and optimization opportunities
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Colors for output
const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getDirectorySize(dirPath) {
    if (!fs.existsSync(dirPath)) return 0;
    
    let totalSize = 0;
    try {
        const files = fs.readdirSync(dirPath);
        
        for (const file of files) {
            const filePath = path.join(dirPath, file);
            try {
                const stats = fs.statSync(filePath);
                
                if (stats.isDirectory()) {
                    totalSize += getDirectorySize(filePath);
                } else {
                    totalSize += stats.size;
                }
            } catch (error) {
                // Skip files that can't be accessed (broken symlinks, etc.)
                continue;
            }
        }
    } catch (error) {
        // Skip directories that can't be read
        return 0;
    }
    
    return totalSize;
}

function analyzeNextJsBuild() {
    log('\n📊 Next.js Build Analysis', 'blue');
    log('=' .repeat(50), 'blue');
    
    const buildDir = '.next';
    if (!fs.existsSync(buildDir)) {
        log('❌ Next.js build directory not found', 'red');
        return;
    }
    
    // Analyze build directories
    const directories = [
        'static',
        'server',
        'standalone',
        'cache'
    ];
    
    let totalSize = 0;
    
    for (const dir of directories) {
        const dirPath = path.join(buildDir, dir);
        const size = getDirectorySize(dirPath);
        totalSize += size;
        
        if (size > 0) {
            log(`📁 ${dir.padEnd(15)} ${formatBytes(size)}`, 'cyan');
        }
    }
    
    log(`📦 Total Build Size: ${formatBytes(totalSize)}`, 'green');
    
    // Analyze bundle sizes from build manifest
    try {
        const buildManifest = JSON.parse(fs.readFileSync(path.join(buildDir, 'build-manifest.json'), 'utf8'));
        
        log('\n📋 JavaScript Bundles:', 'yellow');
        
        let totalJSSize = 0;
        const jsFiles = [];
        
        // Collect all JS files
        for (const [route, files] of Object.entries(buildManifest.pages)) {
            for (const file of files) {
                if (file.endsWith('.js')) {
                    const filePath = path.join(buildDir, 'static', file);
                    if (fs.existsSync(filePath)) {
                        const size = fs.statSync(filePath).size;
                        jsFiles.push({ route, file, size });
                        totalJSSize += size;
                    }
                }
            }
        }
        
        // Sort by size and show top 10
        jsFiles.sort((a, b) => b.size - a.size);
        jsFiles.slice(0, 10).forEach(({ route, file, size }) => {
            log(`  ${route.padEnd(20)} ${formatBytes(size)}`, 'cyan');
        });
        
        log(`📊 Total JS Size: ${formatBytes(totalJSSize)}`, 'green');
        
    } catch (error) {
        log('⚠️  Could not analyze bundle manifest', 'yellow');
    }
}

function analyzeDockerImages() {
    log('\n🐳 Docker Images Analysis', 'blue');
    log('=' .repeat(50), 'blue');
    
    try {
        const output = execSync('docker images | grep traffic-router', { encoding: 'utf8' });
        const lines = output.trim().split('\n');
        
        let totalSize = 0;
        
        for (const line of lines) {
            const parts = line.split(/\s+/);
            if (parts.length >= 7) {
                const name = parts[0];
                const tag = parts[1];
                const size = parts[6];
                
                log(`🏷️  ${name}:${tag}`.padEnd(40) + ` ${size}`, 'cyan');
                
                // Convert size to bytes for total calculation (rough estimate)
                const sizeNum = parseFloat(size);
                if (size.includes('MB')) {
                    totalSize += sizeNum * 1024 * 1024;
                } else if (size.includes('GB')) {
                    totalSize += sizeNum * 1024 * 1024 * 1024;
                }
            }
        }
        
        log(`📦 Total Docker Images Size: ${formatBytes(totalSize)}`, 'green');
        
    } catch (error) {
        log('⚠️  Could not analyze Docker images (Docker not available or no images found)', 'yellow');
    }
}

function analyzeSourceCode() {
    log('\n📝 Source Code Analysis', 'blue');
    log('=' .repeat(50), 'blue');
    
    const directories = [
        { name: 'app', path: 'app' },
        { name: 'components', path: 'components' },
        { name: 'lib', path: 'lib' },
        { name: 'server', path: 'server' },
        { name: 'agents', path: 'agents' },
        { name: 'config', path: 'config' }
    ];
    
    let totalSourceSize = 0;
    let totalFiles = 0;
    
    for (const { name, path: dirPath } of directories) {
        if (fs.existsSync(dirPath)) {
            const size = getDirectorySize(dirPath);
            const files = countFiles(dirPath);
            totalSourceSize += size;
            totalFiles += files;
            
            log(`📁 ${name.padEnd(15)} ${formatBytes(size).padEnd(10)} (${files} files)`, 'cyan');
        }
    }
    
    log(`📊 Total Source Size: ${formatBytes(totalSourceSize)} (${totalFiles} files)`, 'green');
}

function countFiles(dirPath) {
    if (!fs.existsSync(dirPath)) return 0;
    
    let count = 0;
    try {
        const files = fs.readdirSync(dirPath);
        
        for (const file of files) {
            const filePath = path.join(dirPath, file);
            try {
                const stats = fs.statSync(filePath);
                
                if (stats.isDirectory()) {
                    count += countFiles(filePath);
                } else {
                    count++;
                }
            } catch (error) {
                // Skip files that can't be accessed
                continue;
            }
        }
    } catch (error) {
        // Skip directories that can't be read
        return 0;
    }
    
    return count;
}

function analyzeDependencies() {
    log('\n📦 Dependencies Analysis', 'blue');
    log('=' .repeat(50), 'blue');
    
    try {
        const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        
        const prodDeps = Object.keys(packageJson.dependencies || {}).length;
        const devDeps = Object.keys(packageJson.devDependencies || {}).length;
        
        log(`📋 Production Dependencies: ${prodDeps}`, 'green');
        log(`🔧 Development Dependencies: ${devDeps}`, 'yellow');
        
        // Analyze node_modules size
        const nodeModulesSize = getDirectorySize('node_modules');
        log(`📁 node_modules Size: ${formatBytes(nodeModulesSize)}`, 'cyan');
        
        // Check for large dependencies
        if (fs.existsSync('node_modules')) {
            const largeDeps = [];
            const deps = fs.readdirSync('node_modules');
            
            for (const dep of deps.slice(0, 20)) { // Check first 20 to avoid too much processing
                if (!dep.startsWith('.')) {
                    const depPath = path.join('node_modules', dep);
                    if (fs.statSync(depPath).isDirectory()) {
                        const size = getDirectorySize(depPath);
                        if (size > 10 * 1024 * 1024) { // > 10MB
                            largeDeps.push({ name: dep, size });
                        }
                    }
                }
            }
            
            if (largeDeps.length > 0) {
                log('\n🔍 Large Dependencies (>10MB):', 'yellow');
                largeDeps
                    .sort((a, b) => b.size - a.size)
                    .slice(0, 10)
                    .forEach(({ name, size }) => {
                        log(`  ${name.padEnd(30)} ${formatBytes(size)}`, 'red');
                    });
            }
        }
        
    } catch (error) {
        log('⚠️  Could not analyze dependencies', 'yellow');
    }
}

function generateOptimizationRecommendations() {
    log('\n💡 Optimization Recommendations', 'blue');
    log('=' .repeat(50), 'blue');
    
    const recommendations = [];
    
    // Check build size
    const buildSize = getDirectorySize('.next');
    if (buildSize > 100 * 1024 * 1024) { // > 100MB
        recommendations.push('🔧 Consider enabling tree shaking and code splitting');
        recommendations.push('📦 Review and optimize large dependencies');
    }
    
    // Check for source maps in production
    if (fs.existsSync('.next/static') && process.env.NODE_ENV === 'production') {
        const staticFiles = fs.readdirSync('.next/static', { recursive: true });
        const hasSourceMaps = staticFiles.some(file => file.includes('.map'));
        if (hasSourceMaps) {
            recommendations.push('🗺️  Disable source maps in production (GENERATE_SOURCEMAP=false)');
        }
    }
    
    // Check Docker image sizes
    try {
        const dockerOutput = execSync('docker images | grep traffic-router', { encoding: 'utf8' });
        const lines = dockerOutput.trim().split('\n');
        
        for (const line of lines) {
            const parts = line.split(/\s+/);
            if (parts.length >= 7) {
                const size = parts[6];
                const sizeNum = parseFloat(size);
                
                if (size.includes('GB') || (size.includes('MB') && sizeNum > 500)) {
                    recommendations.push('🐳 Consider multi-stage Docker builds to reduce image size');
                    break;
                }
            }
        }
    } catch (error) {
        // Docker not available, skip
    }
    
    // Check for unused dependencies
    const nodeModulesSize = getDirectorySize('node_modules');
    if (nodeModulesSize > 500 * 1024 * 1024) { // > 500MB
        recommendations.push('📦 Run npm audit and remove unused dependencies');
        recommendations.push('🧹 Consider using npm prune --production');
    }
    
    if (recommendations.length === 0) {
        log('✅ Build appears to be well optimized!', 'green');
    } else {
        recommendations.forEach(rec => log(rec, 'yellow'));
    }
}

function generateBuildReport() {
    const timestamp = new Date().toISOString();
    const buildInfo = {
        timestamp,
        nextjsBuildSize: getDirectorySize('.next'),
        sourceCodeSize: getDirectorySize('app') + getDirectorySize('components') + getDirectorySize('lib'),
        nodeModulesSize: getDirectorySize('node_modules'),
        totalProjectSize: getDirectorySize('.') - getDirectorySize('node_modules') - getDirectorySize('.git')
    };
    
    fs.writeFileSync('build-analysis-report.json', JSON.stringify(buildInfo, null, 2));
    log(`\n📄 Build report saved to: build-analysis-report.json`, 'green');
}

// Main execution
function main() {
    log('🔍 Traffic Router Build Performance Analysis', 'magenta');
    log('=' .repeat(60), 'magenta');
    
    analyzeSourceCode();
    analyzeNextJsBuild();
    analyzeDockerImages();
    analyzeDependencies();
    generateOptimizationRecommendations();
    generateBuildReport();
    
    log('\n✅ Analysis completed!', 'green');
}

// Run the analysis
main();