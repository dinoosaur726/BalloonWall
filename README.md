# 🎈 BalloonWall

**BalloonWall** is a dynamic, interactive overlay application designed for streamers. It visualizes donations or events as stackable cards ("balloons") that drop onto the screen. It features physics-like stacking, drag-and-drop organization, and comprehensive theme customization, making it perfect for creative broadcast setups.

## ✨ Features

- **Dynamic Card Stacking**: Cards stack automatically when dropped on top of each other.
- **Interactive Physics**: Drag and drop stacks, scale them up/down, and organize your wall.
- **OBS Integration**: 
    - **Green Screen Mode**: Chroma key support.
    - **Transparent Mode**: Native window transparency support.
    - **WebSocket API**: Trigger events remotely via a simple TCP WebSocket connection.
- **Visual Themes**:
    - Customize card images based on donation amounts (e.g., Bronze, Silver, Gold tiers).
    - Set custom text colors for different tiers.
    - Support for custom local images.
- **Session Management**: Save and load your current layout state (snapshots).
- **Auto-Organize**: Automatically arrange scattered cards into neat rows.

## 🛠️ Tech Stack

- **Framework**: [Electron](https://www.electronjs.org/) + [React](https://react.dev/)
- **Language**: TypeScript
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Drag & Drop**: [@dnd-kit](https://dndkit.com/)
- **Bundler**: [Vite](https://vitejs.dev/)

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/dinoosaur726/BalloonWall.git
   cd BalloonWall
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run in Development Mode:
   ```bash
   npm run dev
   ```

### Building for Production

To create a standalone application (dmg/exe):

```bash
npm run build
```

The output will be in the `release` or `dist` folder.

## 📡 WebSocket API (OBS / Stream Deck Integration)

BalloonWall runs a local WebSocket server (default port: **3000**) to listen for incoming donation events.

- **URL**: `ws://localhost:3000`
- **Message Format**: `Nickname/Amount`

### Example (JavaScript/Node.js):
```javascript
const ws = new WebSocket('ws://localhost:3000');
ws.onopen = () => {
    // Send a donation event
    ws.send('Fan123/5000'); 
};
```

This will spawn a card nicknamed **Fan123** with a value of **5000**.

## 🎮 Controls

- **Drag**: Move stacks or individual cards.
- **Scroll Wheel**: Scale the hovered stack size up or down.
- **Escape**: Toggle the Settings / Control Panel.
- **Right Click / Long Press**: Context interactions (if configured).

## 📝 License

Proprietary / Personal Use (Update as needed)
