# 1. Introduction

This document outlines the architectural approach for building the **Shelf Help Assistant**. Its primary goal is to serve as the guiding architectural blueprint for development, ensuring we build a system that is reliable, maintainable, and aligned with our goals.

## Project Context Summary

- **Primary Purpose:** To create a personal, learning AI agent that helps the user manage their reading list and gain insights into their habits.
- **Tech Stack:** A Supabase-centric stack using TypeScript, PostgreSQL with `pgvector`, and Edge Functions.
- **Architecture Style:** A serverless, event-driven architecture.
- **Deployment Method:** Automated CI/CD via GitHub Actions.
- **Available Documentation:**
  - A comprehensive and revised Project Brief.
  - A detailed and revised Product Requirements Document (PRD) with a multi-epic roadmap.
- **Identified Constraints:**
  - The system must operate at zero cost.
  - The system is for a single user only.
  - The V1 interface is exclusively a Telegram Bot.

---
