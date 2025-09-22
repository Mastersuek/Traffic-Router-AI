#!/usr/bin/env node

/**
 * Production Configuration Validation Script
 * Validates all production configurations before deployment
 */

const fs = require('fs');
const path = require('path');

// Colors for output
const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function error(message) {
    log(`❌ ERROR: ${message}`, 'red');
}

function warn(message) {
    log(`⚠️  WARNING: ${message}`, 'yellow');
}

function success(message) {
    log(`✅ ${message}`, 'green');
}

function info(message) {
    log(`ℹ️  ${message}`, 'blue');
}

class ProductionValidator {
    constructor() {
        this.errors = [];
        this.warnings = [];
        this.checks = 0;
        this.passed = 0;
    }

    check(condition, successMsg, errorMsg, isWarning = false) {
        this.checks++;
        if (condition) {
            success(successMsg);
            this.passed++;
        } else {
            if (isWarning) {
                warn(errorMsg);
                this.warnings.push(errorMsg);
            } else {
                error(errorMsg);
                this.errors.push(errorMsg);
            }
        }
    }

    validateEnvironmentFile() {
        info('Validating .env.production file...');
        
        const envPath = '.env.production';
        this.check(
            fs.existsSync(envPath),
            '.env.production file exists',
            '.env.production file is missing'
        );

        if (fs.existsSync(envPath)) {
            const envContent = fs.readFileSync(envPath, 'utf8');
            
            // Required environment variables
            const requiredVars = [
                'NODE_ENV',
                'PORT',
                'AI_PROXY_PORT',
                'MONITORING_PORT',
                'YOUTUBE_CACHE_PORT',
                'DATABASE_URL',
                'REDIS_URL'
            ];

            requiredVars.forEach(varName => {
                this.check(
                    envContent.includes(`${varName}=`),
                    `${varName} is defined`,
                    `${varName} is missing from .env.production`
                );
            });

            // Check for placeholder values
            const placeholders = ['your_', 'test-', 'example.com'];
            placeholders.forEach(placeholder => {
                this.check(
                    !envContent.includes(placeholder),
                    `No placeholder values found for "${placeholder}"`,
                    `Placeholder value "${placeholder}" found in .env.production`,
                    true
                );
            });

            // Check NODE_ENV
            this.check(
                envContent.includes('NODE_ENV=production'),
                'NODE_ENV is set to production',
                'NODE_ENV is not set to production'
            );
        }
    }

    validatePackageJson() {
        info('Validating package.json...');
        
        this.check(
            fs.existsSync('package.json'),
            'package.json exists',
            'package.json is missing'
        );

        if (fs.existsSync('package.json')) {
            const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
            
            // Check production scripts
            const requiredScripts = [
                'build',
                'build:ts',
                'build:prod',
                'start',
                'start:prod'
            ];

            requiredScripts.forEach(script => {
                this.check(
                    pkg.scripts && pkg.scripts[script],
                    `Script "${script}" is defined`,
                    `Script "${script}" is missing`
                );
            });

            // Check for security vulnerabilities in dependencies
            this.check(
                !pkg.dependencies || !Object.keys(pkg.dependencies).some(dep => 
                    dep.includes('test') || dep.includes('debug')
                ),
                'No test/debug dependencies in production',
                'Test/debug dependencies found in production dependencies',
                true
            );
        }
    }

    validateDockerFiles() {
        info('Validating Docker configuration...');
        
        const dockerFiles = [
            'Dockerfile.production',
            'docker-compose.production.yml',
            'Dockerfile.ai-proxy',
            'Dockerfile.monitoring',
            'Dockerfile.youtube-cache',
            'Dockerfile.mcp-server'
        ];

        dockerFiles.forEach(file => {
            this.check(
                fs.existsSync(file),
                `${file} exists`,
                `${file} is missing`
            );

            if (fs.existsSync(file)) {
                const content = fs.readFileSync(file, 'utf8');
                
                // Check for production optimizations
                if (file.includes('Dockerfile')) {
                    this.check(
                        content.includes('NODE_ENV=production'),
                        `${file} sets NODE_ENV=production`,
                        `${file} doesn't set NODE_ENV=production`
                    );

                    this.check(
                        content.includes('HEALTHCHECK'),
                        `${file} includes health check`,
                        `${file} missing health check`,
                        true
                    );
                }
            }
        });
    }

    validateConfigFiles() {
        info('Validating configuration files...');
        
        const configFiles = [
            'config/logging-production.json',
            'config/monitoring-production.json',
            'ecosystem.production.config.js',
            'next.config.mjs'
        ];

        configFiles.forEach(file => {
            this.check(
                fs.existsSync(file),
                `${file} exists`,
                `${file} is missing`
            );

            if (fs.existsSync(file) && file.endsWith('.json')) {
                try {
                    JSON.parse(fs.readFileSync(file, 'utf8'));
                    success(`${file} is valid JSON`);
                    this.passed++;
                } catch (e) {
                    error(`${file} contains invalid JSON: ${e.message}`);
                    this.errors.push(`${file} contains invalid JSON`);
                }
                this.checks++;
            }
        });
    }

    validateScripts() {
        info('Validating deployment scripts...');
        
        const scripts = [
            'scripts/deploy-production.sh',
            'scripts/setup-production.sh'
        ];

        scripts.forEach(script => {
            this.check(
                fs.existsSync(script),
                `${script} exists`,
                `${script} is missing`
            );

            if (fs.existsSync(script)) {
                const stats = fs.statSync(script);
                this.check(
                    (stats.mode & parseInt('755', 8)) === parseInt('755', 8),
                    `${script} is executable`,
                    `${script} is not executable`,
                    true
                );
            }
        });
    }

    validateBuildOutput() {
        info('Validating build output...');
        
        // Check if TypeScript compiles
        this.check(
            fs.existsSync('tsconfig.json'),
            'TypeScript configuration exists',
            'TypeScript configuration is missing'
        );

        // Check for common build artifacts
        const buildArtifacts = [
            'lib',
            'server',
            'components'
        ];

        buildArtifacts.forEach(artifact => {
            this.check(
                fs.existsSync(artifact),
                `${artifact} directory exists`,
                `${artifact} directory is missing`
            );
        });
    }

    validateSecurity() {
        info('Validating security configuration...');
        
        // Check for sensitive files that shouldn't be in production
        const sensitiveFiles = [
            '.env.local',
            '.env.development',
            'test.env',
            'debug.log'
        ];

        sensitiveFiles.forEach(file => {
            this.check(
                !fs.existsSync(file),
                `Sensitive file ${file} not present`,
                `Sensitive file ${file} found in production`,
                true
            );
        });

        // Check .gitignore
        if (fs.existsSync('.gitignore')) {
            const gitignore = fs.readFileSync('.gitignore', 'utf8');
            const shouldIgnore = ['.env.production', 'logs/', 'cache/', 'node_modules/'];
            
            shouldIgnore.forEach(pattern => {
                this.check(
                    gitignore.includes(pattern),
                    `${pattern} is in .gitignore`,
                    `${pattern} should be in .gitignore`,
                    true
                );
            });
        }
    }

    validateDirectories() {
        info('Validating required directories...');
        
        const requiredDirs = [
            'logs',
            'cache',
            'memory',
            'config'
        ];

        requiredDirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                success(`Created missing directory: ${dir}`);
            } else {
                success(`Directory ${dir} exists`);
            }
            this.passed++;
            this.checks++;
        });
    }

    run() {
        log('\n🔍 Starting Production Configuration Validation\n', 'blue');
        
        this.validateEnvironmentFile();
        this.validatePackageJson();
        this.validateDockerFiles();
        this.validateConfigFiles();
        this.validateScripts();
        this.validateBuildOutput();
        this.validateSecurity();
        this.validateDirectories();
        
        // Summary
        log('\n📊 Validation Summary\n', 'blue');
        log(`Total checks: ${this.checks}`);
        log(`Passed: ${this.passed}`, 'green');
        log(`Warnings: ${this.warnings.length}`, 'yellow');
        log(`Errors: ${this.errors.length}`, 'red');
        
        if (this.errors.length > 0) {
            log('\n❌ Critical Issues Found:', 'red');
            this.errors.forEach(err => log(`  • ${err}`, 'red'));
        }
        
        if (this.warnings.length > 0) {
            log('\n⚠️  Warnings:', 'yellow');
            this.warnings.forEach(warn => log(`  • ${warn}`, 'yellow'));
        }
        
        if (this.errors.length === 0) {
            log('\n🎉 Production configuration validation passed!', 'green');
            log('Your application is ready for production deployment.', 'green');
            return true;
        } else {
            log('\n💥 Production configuration validation failed!', 'red');
            log('Please fix the critical issues before deploying to production.', 'red');
            return false;
        }
    }
}

// Run validation
const validator = new ProductionValidator();
const validationResult = validator.run();
process.exit(validationResult ? 0 : 1);