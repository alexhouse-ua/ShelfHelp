---
name: installation-configuration
status: backlog
created: 2025-09-29T00:01:08Z
progress: 0%
prd: .claude/prds/installation-configuration.md
github: https://github.com/alexhouse-ua/ShelfHelp/issues/8
last_sync: 2025-09-29T00:56:13Z
---

# Epic: Installation & Configuration Setup

## Overview

Establish a complete, reproducible development environment for the Shelf Help Assistant project. This includes installing core development tools (Deno, Node.js, Git, Docker), creating service accounts (Supabase, Telegram, Google AI), configuring secure environment variables, and validating all integrations work correctly. The goal is zero-friction development setup that can be completed in under 30 minutes.

## Architecture Decisions

- **Local-First Development**: Use local Supabase instance with Docker for database development
- **Environment Variable Management**: Use `.env` files with clear naming conventions (not committed to git)
- **Version Pinning Strategy**: Pin all tool versions to specific stable releases for reproducibility
- **macOS-First Approach**: Focus on macOS compatibility for solo developer workflow
- **Manual Setup Process**: Prioritize clear documentation over automation scripts for transparency
- **Free Tier Architecture**: Ensure all services work within generous free tier limits

## Technical Approach

### Development Tools Stack
- **Deno**: Primary runtime for Supabase Edge Functions (required by platform)
- **Node.js LTS**: Development tooling ecosystem (npm, Husky, testing tools)
- **Supabase CLI**: Local development environment and deployment management
- **Git**: Version control with proper user configuration
- **Docker**: Local PostgreSQL database for development

### Service Configuration
- **Supabase Project**: PostgreSQL database with pgvector extension enabled
- **Telegram Bot**: Created via BotFather with webhook permissions
- **Google AI Studio**: API key for Gemini model access
- **GitHub Repository**: Proper branch protection and CI/CD setup

### Environment Architecture
```
Development Environment:
├── Local Tools (Deno, Node.js, Git, Docker)
├── Service Accounts (Supabase, Telegram, Google AI)
├── Environment Variables (.env, secure storage)
├── Local Database (Docker + Supabase CLI)
└── Validation Scripts (connectivity tests)
```

### Security Pattern
- Environment variables follow `SERVICE_PURPOSE_TYPE` naming (e.g., `SUPABASE_PROJECT_URL`)
- All credentials stored in `.env` files (gitignored)
- API keys configured with minimal required permissions
- Local development uses secure HTTPS endpoints where possible

## Implementation Strategy

### Development Phases
1. **Tool Installation**: Core development environment setup
2. **Service Registration**: External service account creation
3. **Configuration**: Environment variables and local setup
4. **Validation**: End-to-end connectivity testing

### Risk Mitigation
- **Service Account Delays**: Apply for accounts immediately, validate manually before automated testing
- **Version Compatibility**: Document exact versions, test before finalizing
- **API Rate Limits**: Verify free tier limits support development needs
- **Setup Complexity**: Create validation checkpoints at each phase

### Testing Approach
- **Installation Verification**: Each tool responds to `--version` commands
- **Service Integration**: API endpoints return successful authentication
- **Environment Validation**: All variables loaded and accessible
- **End-to-End Test**: Simple request/response cycle through full stack

## Task Breakdown Preview

High-level task categories that will be created:
- [ ] **Development Tools Setup**: Install and configure Deno, Node.js, Git, Docker with version verification
- [ ] **Service Account Creation**: Register with Supabase, Telegram BotFather, Google AI Studio, GitHub
- [ ] **Environment Configuration**: Set up secure environment variables, local database, webhook endpoints
- [ ] **Integration Validation**: Test all API connections, validate environment, create troubleshooting guide

## Dependencies

### External Dependencies
- **Stable Internet Connection**: Required for service registration and tool downloads
- **Service Provider Access**: Supabase, Telegram, Google AI Studio websites accessible
- **macOS Environment**: Primary development platform (Intel or Apple Silicon)
- **Admin Permissions**: Ability to install software via Homebrew or direct downloads

### Internal Dependencies
- **Project Specifications**: Complete and finalized (✅ Available)
- **Technology Stack Decisions**: Confirmed Supabase-centric architecture (✅ Complete)
- **Repository Setup**: GitHub repository created and accessible

### Prerequisite Knowledge
- Basic command line navigation and usage
- Understanding of environment variables and configuration
- Familiarity with API key management concepts

## Success Criteria (Technical)

### Performance Benchmarks
- **Complete Setup Time**: < 30 minutes from start to finish
- **Tool Response Time**: All version commands execute in < 2 seconds
- **API Response Time**: All service connectivity tests complete in < 10 seconds
- **Local Database Startup**: Supabase local instance starts in < 60 seconds

### Quality Gates
- **Zero Installation Errors**: All tools install successfully without manual intervention
- **100% API Connectivity**: All external services respond successfully to test requests
- **Complete Environment**: All required environment variables set and validated
- **Documentation Quality**: Setup process reproducible by following documentation alone

### Acceptance Criteria
- [ ] Deno runtime executes TypeScript code without errors
- [ ] Supabase CLI successfully connects to project and local instance
- [ ] Telegram Bot API responds to webhook configuration tests
- [ ] Google Gemini API processes test queries successfully
- [ ] Local PostgreSQL database accepts connections and queries
- [ ] All environment variables properly loaded and accessible by applications
- [ ] Troubleshooting guide addresses common setup issues

## Estimated Effort

### Overall Timeline
- **Phase 1 (Tools)**: 1-2 hours (including download time)
- **Phase 2 (Services)**: 1-2 hours (including approval wait time)
- **Phase 3 (Configuration)**: 30-60 minutes
- **Phase 4 (Validation)**: 30-45 minutes
- **Total Estimated Time**: 3-5 hours

### Resource Requirements
- **Developer Time**: 4-6 hours including documentation
- **Network Bandwidth**: ~500MB for tool downloads
- **Disk Space**: ~2GB for development tools and local database

### Critical Path Items
1. **Service Account Creation**: May have approval delays (Supabase, Google AI)
2. **API Key Generation**: Required before environment configuration
3. **Local Database Setup**: Foundation for all subsequent development
4. **Integration Testing**: Validates entire setup before development begins

### Risk Factors
- **Service Approval Delays**: Google AI Studio may require manual approval
- **Network Issues**: Tool downloads may fail in poor connectivity
- **Version Conflicts**: New tool releases may break compatibility
- **API Changes**: Service providers may update endpoints or requirements

## Success Metrics

### Immediate Success Indicators
- All development tools installed and operational
- All service accounts created with valid API keys
- Environment variables configured and tested
- Local development environment functional

### Long-term Success Indicators
- Zero development blockers due to environment issues
- Other developers can reproduce setup using documentation
- Environment remains stable throughout development cycle
- Easy transition from development to production deployment

## Tasks Created
- [ ] #10 - Core Development Tools Installation (parallel: true)
- [ ] #15 - Container and Database Setup (parallel: false, depends on 10)
- [ ] #17 - Tool Configuration and Version Verification (parallel: false, depends on 10, 15)
- [ ] #12 - Supabase Project and Database Configuration (parallel: true)
- [ ] #13 - Telegram Bot Registration and Configuration (parallel: true)
- [ ] #14 - Google AI Studio API Key Setup (parallel: true)
- [ ] #9 - Environment Variables Setup and Security (parallel: false, depends on 12, 13, 14)
- [ ] #11 - Local Development Environment Integration (parallel: false, depends on 15, 9)
- [ ] #16 - End-to-End Validation and Testing (parallel: false, depends on 10, 15, 17, 12, 13, 14, 9, 11)

Total tasks: 9
Parallel tasks: 4 (10, 12, 13, 14)
Sequential tasks: 5 (15, 17, 9, 11, 16)
Estimated total effort: 22-27 hours
