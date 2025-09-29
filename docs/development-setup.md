# Development Environment Setup

This document contains the verified development tool versions and setup instructions for the Shelf Help Assistant project.

## Verified Tool Versions

The following versions have been tested and verified to work correctly with this project:

### Core Development Tools

| Tool | Version | Installation Method |
|------|---------|-------------------|
| **Deno** | 2.4.5 (stable, release, aarch64-apple-darwin) | Homebrew |
| **Node.js** | v24.9.0 | Homebrew |
| **npm** | 11.6.0 | Included with Node.js |
| **Git** | 2.51.0 | Homebrew |
| **Docker** | 28.3.2, build 578ccf6 | Docker Desktop |
| **Homebrew** | 4.6.14 | Official installer |

### Runtime Details

- **V8 Engine**: 13.7.152.14-rusty (included with Deno)
- **TypeScript**: 5.8.3 (included with Deno)
- **Platform**: macOS (Darwin 24.6.0, aarch64)

## Installation Instructions

### Prerequisites

- macOS with admin permissions
- Stable internet connection
- Terminal.app or equivalent command line interface

### Step-by-Step Installation

1. **Install Homebrew** (if not already installed):
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```

2. **Install Core Development Tools**:
   ```bash
   # Install Deno
   brew install deno

   # Install Node.js LTS
   brew install node

   # Install Git
   brew install git

   # Docker requires Docker Desktop from https://www.docker.com/products/docker-desktop/
   ```

3. **Configure Git**:
   ```bash
   git config --global user.name "Your Name"
   git config --global user.email "your.email@example.com"
   ```

4. **Verify Installation**:
   ```bash
   # Run the verification script
   ./scripts/verify-installation.sh
   ```

## PATH Configuration

Ensure your shell PATH includes these directories:
- `/opt/homebrew/bin` (Homebrew packages)
- `/opt/homebrew/sbin` (Homebrew system packages)
- `/usr/local/bin` (Local installations)

## Verification Commands

You can manually verify each tool with these commands:

```bash
# Check versions
deno --version
node --version
npm --version
git --version
docker --version
brew --version

# Test TypeScript execution
echo 'console.log("TypeScript test:", 2 + 2);' | deno run -

# Check Git configuration
git config --global user.name
git config --global user.email
```

## Troubleshooting

### Tool Not Found Errors

If you get "command not found" errors:

1. **Check if Homebrew is in PATH**:
   ```bash
   echo $PATH
   # Should include /opt/homebrew/bin
   ```

2. **Reload shell configuration**:
   ```bash
   source ~/.zshrc  # or ~/.bash_profile
   ```

3. **Reinstall missing tools**:
   ```bash
   brew install [tool-name]
   ```

### Permission Issues

If you encounter permission errors:

1. **Fix Homebrew permissions**:
   ```bash
   sudo chown -R $(whoami) /opt/homebrew/*
   ```

2. **Reset PATH in shell profile**:
   ```bash
   echo 'export PATH="/opt/homebrew/bin:$PATH"' >> ~/.zshrc
   ```

## Next Steps

After successful installation:

1. Run `./scripts/verify-installation.sh` to confirm everything works
2. Clone the project repository
3. Follow project-specific setup instructions
4. Begin development!

## Support

If you encounter issues not covered here:

1. Check the [Homebrew documentation](https://docs.brew.sh/)
2. Consult the [Deno manual](https://docs.deno.com/)
3. Review [Node.js installation guides](https://nodejs.org/en/download/)
4. Visit [Docker documentation](https://docs.docker.com/)

---

**Last Updated**: 2025-09-29
**Verified Environment**: macOS (Darwin 24.6.0, aarch64)
**Next Review**: When major tool versions are updated