# Project Structure

This document describes the organization of the c0py.me project.

## 📁 Directory Structure

```
c0py.me/
├── README.md                 # Main project README
├── LICENSE                   # MIT License
├── package.json              # Root package.json (Turborepo config)
├── turbo.json                # Turborepo configuration
├── jest.config.js            # Jest test configuration
│
├── apps/                     # Applications
│   ├── web/                  # React frontend application
│   │   ├── src/
│   │   │   ├── components/   # React components
│   │   │   ├── hooks/        # Custom React hooks
│   │   │   ├── pages/        # Page components
│   │   │   ├── types/        # TypeScript types
│   │   │   ├── utils/        # Utility functions
│   │   │   └── services/     # Service layer
│   │   ├── public/           # Static assets
│   │   └── package.json
│   │
│   └── api/                  # Express backend API
│       ├── src/
│       │   ├── routes/        # API routes
│       │   ├── server.ts      # Server entry point
│       │   ├── socketService.ts  # Socket.IO service
│       │   └── ...
│       └── package.json
│
├── packages/                 # Shared packages
│   ├── ui/                   # Shared UI components
│   ├── database/             # Database models and utilities
│   └── config/               # Shared configuration
│
├── tools/                    # Shared tooling
│   ├── eslint-config/        # ESLint configurations
│   └── typescript-config/    # TypeScript configurations
│
├── scripts/                  # Deployment and utility scripts
│   ├── deploy-webhook.sh
│   ├── setup-webhook.sh
│   └── ...
│
└── docs/                     # Documentation
    ├── README.md             # Documentation index
    ├── API.md                # API documentation
    ├── CONTRIBUTING.md        # Contributing guidelines
    ├── CHANGELOG.md           # Project changelog
    │
    ├── architecture/         # Architecture documentation
    │   ├── ARCHITECTURE.md
    │   ├── PROJECT_SUMMARY.md
    │   └── project.md
    │
    ├── deployment/           # Deployment documentation
    │   ├── DEPLOYMENT.md
    │   ├── Dockerfile
    │   └── *.sh              # Deployment scripts
    │
    ├── fixes/                # Bug fixes and improvements
    │   ├── WEBRTC_*.md
    │   ├── WEBSOCKET_*.md
    │   └── ...
    │
    └── development/          # Development documentation
        ├── instructions.md
        ├── demo.md
        └── ...
```

## 📂 Key Directories

### `apps/`
Contains the main applications:
- **web/**: React frontend with TypeScript
- **api/**: Express.js backend with Socket.IO

### `packages/`
Shared packages used across applications:
- **ui/**: Reusable React components
- **database/**: MongoDB models and utilities
- **config/**: Shared configuration and constants

### `tools/`
Shared development tooling:
- **eslint-config/**: ESLint configurations
- **typescript-config/**: TypeScript configurations

### `docs/`
All project documentation organized by category:
- **architecture/**: System design and architecture
- **deployment/**: Deployment guides and scripts
- **fixes/**: Bug fixes and improvements documentation
- **development/**: Development setup and guidelines

### `scripts/`
Deployment and utility scripts for automation.

## 🗑️ Files Removed from Root

The following files have been moved or removed to keep the root directory clean:

- **Markdown files** → Moved to `docs/` with proper organization
- **Deployment scripts** → Moved to `docs/deployment/`
- **Test files** → Removed (`test-connection.js`, `setup.js`)
- **Build artifacts** → Removed (`dist-production/`)

## 📝 Essential Root Files

The root directory now contains only essential files:

- `README.md` - Main project documentation
- `LICENSE` - MIT License
- `package.json` - Root package configuration
- `turbo.json` - Turborepo configuration
- `jest.config.js` - Test configuration (if needed)

## 🔍 Finding Files

### Documentation
All documentation is in `docs/`. See [docs/README.md](README.md) for the complete index.

### Source Code
- Frontend: `apps/web/src/`
- Backend: `apps/api/src/`
- Shared packages: `packages/`

### Configuration
- Build: `turbo.json`
- TypeScript: `tools/typescript-config/`
- ESLint: `tools/eslint-config/`

### Scripts
- Deployment: `scripts/` and `docs/deployment/`

## 📚 Documentation Organization

Documentation is organized by purpose:

1. **Architecture** - System design and technical details
2. **Deployment** - Production deployment guides
3. **Fixes** - Bug fixes and improvements
4. **Development** - Setup and development guidelines

See [docs/README.md](README.md) for the complete documentation index.

---

For more information:
- [Documentation Index](README.md)
- [Contributing Guide](CONTRIBUTING.md)
- [API Documentation](API.md)

