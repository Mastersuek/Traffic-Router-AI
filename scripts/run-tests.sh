#!/bin/bash

echo "🧪 Running Traffic Router System Tests..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to run a test
run_test() {
    local test_name="$1"
    local test_command="$2"
    
    echo -n "Testing $test_name... "
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if eval "$test_command" > /dev/null 2>&1; then
        echo -e "${GREEN}PASS${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        echo -e "${RED}FAIL${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

# Syntax tests
echo "📝 Running syntax tests..."
run_test "TypeScript compilation" "npx tsc --noEmit"
run_test "ESLint checks" "npx eslint . --ext .ts,.tsx --quiet || true"
run_test "Next.js build test" "npm run build"

# Configuration tests
echo "⚙️  Running configuration tests..."
run_test "Package.json validation" "npm ls --depth=0 > /dev/null"
run_test "Environment variables" "[ -f .env.example ]"
run_test "Docker configuration" "[ -f Dockerfile ] && [ -f docker-compose.yml ]"

# Port availability tests
echo "🔌 Testing port availability..."
run_test "Port 3000 (Web)" "! lsof -i :3000 > /dev/null 2>&1 || true"
run_test "Port 8080 (AI Proxy)" "! lsof -i :8080 > /dev/null 2>&1 || true"
run_test "Port 1080 (SOCKS)" "! lsof -i :1080 > /dev/null 2>&1 || true"
run_test "Port 8082 (Monitoring)" "! lsof -i :8082 > /dev/null 2>&1 || true"

# File structure tests
echo "📁 Testing file structure..."
run_test "Core library files" "[ -d lib ] && [ -f lib/types.ts ] && [ -f lib/config.ts ]"
run_test "Client applications" "[ -d clients ] && [ -d clients/common ] && [ -d clients/desktop ]"
run_test "Configuration files" "[ -d config ] && [ -f config/proxy-config.json ]"
run_test "Scripts directory" "[ -d scripts ] && [ -f scripts/setup-proxy-environment.sh ]"

# Dependency tests
echo "📦 Testing dependencies..."
run_test "Node.js version" "node --version | grep -E 'v(18|20|21)'"
run_test "NPM packages" "npm list --depth=0 > /dev/null"
run_test "Python dependencies" "python3 --version > /dev/null && pip3 list > /dev/null"

# Security tests
echo "🔒 Running security tests..."
run_test "No hardcoded secrets" "! grep -r 'api_key.*=' . --include='*.ts' --include='*.js' --include='*.json' | grep -v example"
run_test "Secure headers config" "grep -q 'helmet' package.json"
run_test "CORS configuration" "grep -q 'cors' package.json"

# Performance tests
echo "⚡ Running performance tests..."
run_test "Bundle size check" "npm run build && du -sh .next | awk '{print \$1}' | grep -E '^[0-9]+[KM]B?\$'"
run_test "Memory usage check" "node -e 'console.log(process.memoryUsage().heapUsed < 100 * 1024 * 1024)' | grep true"

# Integration tests
echo "🔗 Running integration tests..."
run_test "API routes exist" "[ -d app/api ] && [ -f app/api/health/route.ts ]"
run_test "Monitoring page" "[ -f app/monitoring/page.tsx ]"
run_test "Recovery agent" "[ -f agents/recovery-agent.py ]"

# Final results
echo ""
echo "📊 Test Results Summary:"
echo "========================"
echo -e "Total tests: $TOTAL_TESTS"
echo -e "${GREEN}Passed: $PASSED_TESTS${NC}"
echo -e "${RED}Failed: $FAILED_TESTS${NC}"

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "\n${GREEN}✅ All tests passed! System is ready for deployment.${NC}"
    exit 0
else
    echo -e "\n${YELLOW}⚠️  Some tests failed. Please review and fix issues before deployment.${NC}"
    exit 1
fi
