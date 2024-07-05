# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Node.js reference implementation of the Blueground Logging Policy, demonstrating structured logging patterns with Mapped Diagnostic Context (MDC) across multiple frameworks and messaging systems. The application showcases logging best practices using Pino with async-mdc for correlation tracking.

## Commands

- `npm run build` - Build the project using esbuild
- `npm run dev:fastify` - Run development server with Fastify framework (with pino-pretty formatting)
- `npm run dev:express` - Run development server with Express framework (with pino-pretty formatting)
- `npm run dev:koa` - Run development server with Koa framework (with pino-pretty formatting)
- `npm run start:fastify` - Run production build with Fastify
- `npm run start:express` - Run production build with Express
- `npm run lint` - Run all linting checks (prettier, eslint, typescript)
- `npm run format` - Format code with prettier
- `npm run apidoc` - Generate API documentation

## Architecture Notes

- **ESM Module**: Uses ES modules (import/export syntax) as specified by `"type": "module"` in package.json
- **Logging Framework**: Built around Pino logger with async-mdc for correlation tracking
- **Multi-Framework Support**: Demonstrates logging patterns across:
  - Fastify server with plugins and hooks
  - Express server with middleware
  - Koa server with middleware
  - Kafka consumers and producers
  - RabbitMQ consumers and producers
  - Bull.js job processors
- **MDC (Mapped Diagnostic Context)**: Uses @bluegroundltd/async-mdc to maintain context across async operations
- **Path Aliases**: Configured in tsconfig.json:
  - `@logger` → `src/logger/index.ts`
  - `@service` → `src/service/index.ts`
  - `@mdc` → `src/mdc.ts`
- **Custom Type Definitions**: Located in `@types/` directory for framework extensions

## Core Components

- **Logger Module** (`src/logger/`): Core logging configuration with MDC integration
- **Server Implementations**: Separate directories for each framework (fastify-server, express-server, koa-server)
- **Messaging Systems**: Kafka and RabbitMQ implementations with logging hooks
- **Job Processing**: Bull.js integration with correlation tracking
- **Debug Tools**: Async monitoring via async_hooks for debugging async operations

## Development Considerations

- Use environment variables for configuration (LOG_LEVEL, LOG_DISABLED, PORT, HOST)
- All async operations should maintain MDC context for correlation tracking
- Each server framework demonstrates different middleware/plugin approaches for logging
- The main.ts entry point supports CLI arguments to choose which server to run
- Type safety is enforced with strict TypeScript configuration