# Mecatube

<p align="center">
  <img src="src/assets/logo.png" width="140" height="140" alt="Mecatube Logo" />
</p>

<p align="center">
  <strong>Automated AI-Powered Stickman Video Production Studio</strong><br />
  Streamlined workflow bridging AI scriptwriting, voiceover synthesis, scene illustration, and animation.
</p>

---

## Overview

**Mecatube** is a desktop application engineered to automate the end-to-end production of 2D educational stickman videos. By orchestrating LLM prompt engineering, voice synthesis, browser automation for asset generation, and project management into a single unified desktop experience, Mecatube eliminates manual copy-pasting and maintains strict character and visual consistency across entire video narratives.

---

## Key Features

- **Stickman Narrative & Art Direction**:
  - Structured prompt generation following a proven 5-stage sequential pipeline.
  - Strict 85/15 ratio enforcement (85% narrative scene illustrations, 15% educational diagrammatic explainers).
  - High character consistency with character sheets, prompt templates, and distinct visual IDs.

- **Mecatube Bridge (Chrome MV3 Extension)**:
  - Real-time WebSocket connection bridging the desktop application with browser tabs.
  - Automates script generation via `chat.deepseek.com`.
  - Drives asset and animation generation via Google Flow (`flow.google.com`).

- **Voiceover Synthesis (Cartesia Integration)**:
  - High-fidelity streaming text-to-speech with ultra-low latency.
  - Custom voice library management, saved voice profiles, and credit usage tracking.
  - Audio playback and narration extraction directly aligned with script timestamps.

- **Timeline & Video Project Hub**:
  - Visual stage progression (Scripting → Voiceover → Illustrations → Animations → Final Assembly).
  - Workspace isolation allowing multiple parallel channels or video topics.

---

## Architecture & Tech Stack

- **Desktop Shell**: [Electron](https://www.electronjs.org/) (Custom frameless window, IPC bridges, native file system persistence).
- **Frontend UI**: [React 19](https://react.dev/), [Vite](https://vitejs.dev/), [Motion](https://motion.dev/) (smooth micro-interactions).
- **Extension**: Chrome Manifest V3 service worker & content scripts with WebSocket protocol.
- **Voice Engine**: Cartesia TTS API over custom streaming protocols.

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v20+ recommended)
- Google Chrome or Chromium-based browser (for the companion extension)

### Installation

1. Clone the repository and install dependencies:
   ```bash
   git clone https://github.com/your-username/mecatube.git
   cd mecatube
   npm install
   ```

2. Run the application in development mode:
   ```bash
   npm run dev
   ```
   This concurrently boots the Vite dev server and launches Electron with hot-reloading.

### Installing the Browser Extension

1. Open Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** in the top-right corner.
3. Click **Load unpacked** and select the [`extension/`](extension/) directory from this repository.
4. Ensure the Mecatube desktop app is running; the extension icon will indicate an active WebSocket bridge.

---

## Best Practices & Workflow Rules

1. **Character Consistency in Google Flow**: Avoid re-uploading character images between scenes; reuse the existing character asset from the project within Google Flow to preserve identity and seed stability.
2. **Multi-Character Management**: Ensure each character maintains their unique sheet number and distinguishing flat garment/props to prevent model confusion.
3. **85/15 Balance**: Never cluster explanation diagrams together; distribute diagrammatic explainers evenly to maintain viewer engagement.

---

## License

ISC License.
