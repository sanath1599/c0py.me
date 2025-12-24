# Changelog

All notable changes to c0py.me will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Comprehensive documentation structure in `docs/` folder
- API documentation with REST endpoints and WebSocket events
- Contributing guidelines
- GitHub "Star us" button in navbar and landing page
- MIT License file

### Changed
- Organized all markdown files into `docs/` folder structure
- Updated README to reference documentation folder
- Cleaned up root directory by removing unnecessary files

### Fixed
- Documentation links and references

## [1.0.0] - 2025-01-05

### Added
- Initial release of c0py.me
- Secure P2P file sharing using WebRTC
- Three sharing modes: Jungle, Room, and Family
- Mobile optimizations with IndexedDB support
- Adaptive chunking based on device type and file size
- Flow control for buffer management
- Real-time progress tracking
- Anonymous user system
- Connection authorization
- Admin dashboard
- Client event logging
- Network detection and error handling

### Features
- WebRTC peer-to-peer file transfer
- Socket.IO signaling server
- MongoDB for user sessions
- Redis for pending requests
- Responsive glassmorphic UI
- Cross-platform support (mobile, tablet, desktop)
- Real-time connection status
- File transfer progress tracking
- Multiple file transfer support

---

For detailed information about fixes and improvements, see:
- [Fixes Documentation](fixes/)
- [Architecture Documentation](architecture/ARCHITECTURE.md)

