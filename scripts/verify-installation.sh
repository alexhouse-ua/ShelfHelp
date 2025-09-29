#!/bin/bash

# Installation Verification Script for Shelf Help Assistant
# This script verifies that all required development tools are properly installed and configured

set -e  # Exit on any error

echo "🔍 Verifying Shelf Help Assistant Development Environment"
echo "=================================================="

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track verification status
ALL_GOOD=true

# Function to check if a command exists and get version
check_tool() {
    local tool_name="$1"
    local command="$2"
    local version_flag="$3"

    echo -n "Checking $tool_name... "

    if command -v "$command" >/dev/null 2>&1; then
        local version=$($command $version_flag 2>&1 | head -1)
        echo -e "${GREEN}✓${NC} Found: $version"
        return 0
    else
        echo -e "${RED}✗${NC} Not found"
        ALL_GOOD=false
        return 1
    fi
}

# Function to check TypeScript execution
check_typescript() {
    echo -n "Checking TypeScript execution... "

    local test_output=$(echo 'console.log("TS test:", 2 + 2);' | deno run - 2>&1)
    if [[ "$test_output" == *"TS test: 4"* ]]; then
        echo -e "${GREEN}✓${NC} TypeScript execution works"
        return 0
    else
        echo -e "${RED}✗${NC} TypeScript execution failed"
        echo "Output: $test_output"
        ALL_GOOD=false
        return 1
    fi
}

# Function to check Git configuration
check_git_config() {
    echo -n "Checking Git configuration... "

    local git_name=$(git config --global user.name 2>/dev/null || echo "")
    local git_email=$(git config --global user.email 2>/dev/null || echo "")

    if [[ -n "$git_name" && -n "$git_email" ]]; then
        echo -e "${GREEN}✓${NC} Configured (${git_name}, ${git_email})"
        return 0
    else
        echo -e "${RED}✗${NC} Missing user.name or user.email"
        ALL_GOOD=false
        return 1
    fi
}

# Core tool verification
echo -e "\n${YELLOW}Core Development Tools:${NC}"
check_tool "Deno" "deno" "--version"
check_tool "Node.js" "node" "--version"
check_tool "npm" "npm" "--version"
check_tool "Git" "git" "--version"
check_tool "Docker" "docker" "--version"
check_tool "Homebrew" "brew" "--version"

# Additional checks
echo -e "\n${YELLOW}Environment Configuration:${NC}"
check_typescript
check_git_config

# PATH verification
echo -n "Checking PATH configuration... "
if [[ ":$PATH:" == *":/opt/homebrew/bin:"* ]] && [[ ":$PATH:" == *":/usr/local/bin:"* ]]; then
    echo -e "${GREEN}✓${NC} PATH includes Homebrew and system directories"
else
    echo -e "${YELLOW}⚠${NC} PATH might be missing some directories"
fi

# Final status
echo -e "\n=================================================="
if $ALL_GOOD; then
    echo -e "${GREEN}✅ All development tools verified successfully!${NC}"
    echo -e "Environment is ready for Shelf Help Assistant development."
    exit 0
else
    echo -e "${RED}❌ Some tools are missing or misconfigured.${NC}"
    echo -e "Please install missing tools and run this script again."
    exit 1
fi