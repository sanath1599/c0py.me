# ShareDrop Project Overview

## Overview
ShareDrop is a modern, real-time, peer-to-peer file sharing application built with the MERN stack (MongoDB, Express.js, React, Node.js) and WebRTC. It enables users to share files instantly and securely between browsers, with a focus on privacy, speed, and a beautiful user experience.

---

## Core Features
- **Peer-to-Peer File Sharing:** Direct browser-to-browser file transfer using WebRTC.
- **Room/World System:** Users can join or create rooms/worlds for group or private sharing sessions.
- **Chunked File Transfer:** Large files are split into chunks for reliable, resumable transfer.
- **Progress Tracking:** Real-time progress bars and status indicators for file uploads/downloads.
- **No Server File Storage:** Files are never stored on the server; only signaling and metadata are relayed.

---

## Real-time & Networking
- **WebRTC Data Channels:** Used for fast, encrypted, peer-to-peer file transfer.
- **Socket.IO Signaling:** Real-time signaling for connection setup, room management, and peer discovery.
- **Redis Integration:** Used for request storage, pending requests, and scalable signaling.
- **Connection Health:** Automatic reconnection, connection status indicators, and error handling.

---

## Security & Privacy
- **End-to-End Encryption:** All file transfers are encrypted by WebRTC.
- **No File Persistence:** Files are never written to disk on the server.
- **Input Validation:** All user input is validated and sanitized.
- **Session Management:** User sessions are managed securely, with support for anonymous and named users.
- **CORS & Network Security:** Proper CORS configuration and HTTPS support for production.

---

## UI/UX
- **Modern Glassmorphism Design:** Clean, responsive interface with glassmorphism effects.
- **Reusable UI Components:** Shared UI library for buttons, cards, progress bars, and more.
- **Mobile & Desktop Support:** Fully responsive layout and controls.
- **Accessibility:** Semantic HTML and keyboard navigation support.
- **User Feedback:** Real-time notifications, error messages, and success indicators.

---

## Logging & Analytics
- **Client-side Event Logging:** In-memory logging of user actions (clicks, navigation, errors, etc.).
- **Manual Log Export:** Users can download logs as JSON for backup or support.
- **Log Upload & Analysis:** Users can upload logs to view and analyze them in the app.
- **Backend Log Export:** Option to export logs to the backend for support or analytics.
- **Privacy-First:** Logs are not persisted unless exported by the user.

---

## Extensibility & Developer Experience
- **Monorepo with Turborepo:** Modular structure for frontend, backend, and shared packages.
- **TypeScript Everywhere:** Type safety across the stack.
- **Shared Config & Linting:** Centralized ESLint and TypeScript configs for consistency.
- **Easy Local Development:** Fast dev server, hot reload, and simple setup.
- **Testing:** Unit, integration, and E2E test support (Jest, React Testing Library).

---

## Future Enhancements (Ideas)
- **Authentication:** Optional user accounts and OAuth integration.
- **File Previews:** Inline previews for images, videos, and documents.
- **Rate Limiting & Abuse Prevention:** Enhanced security for public rooms.
- **Advanced Analytics:** Visual dashboards for usage and performance.
- **Cross-Device Pairing:** QR code or link-based device pairing.

---

For more details, see the codebase and documentation files. 