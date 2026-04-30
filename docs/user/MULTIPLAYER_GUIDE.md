# Online Multiplayer Mode - User Guide

**Version**: 1.0  
**Last Updated**: 2026-04-30

---

## Table of Contents

1. [What is Online Multiplayer?](#what-is-online-multiplayer)
2. [System Requirements](#system-requirements)
3. [How to Create a Game](#how-to-create-a-game)
4. [How to Join a Game](#how-to-join-a-game)
5. [How to Play](#how-to-play)
6. [Troubleshooting](#troubleshooting)
7. [FAQ](#faq)

---

## What is Online Multiplayer?

Online Multiplayer Mode allows you to play OLManager with a friend over the internet. Each player controls their own team, and you compete in the same league with AI-controlled teams.

### Key Features

- **2-Player Online**: Play against a friend in real-time
- **Host-Authoritative**: The host's game is the source of truth
- **State Synchronization**: Game state is automatically synced between players
- **Disconnect Recovery**: Continue playing offline if your opponent disconnects

### Game Modes

| Mode | Description |
|------|-------------|
| **Offline** | Single-player mode (existing) |
| **Hotseat** | Two players taking turns on the same device |
| **Online** | Two players playing over the internet |

---

## System Requirements

### Minimum Requirements

- **OS**: Windows 10+, macOS 11+, or Linux (Ubuntu 20.04+)
- **Processor**: Intel Core i5 / AMD Ryzen 5 or better
- **Memory**: 8 GB RAM
- **Storage**: 500 MB available space
- **Network**: Internet connection required (minimum 5 Mbps)

### Network Requirements

- **TCP/UDP Ports**: 3478, 3479, 3480 (for WebRTC)
- **HTTPS**: Required for signaling server connection
- **Firewall**: Must allow outbound connections to signaling server

### Signalling Server

The game connects to a signaling server to establish P2P connections. The default server is hosted at:

```
wss://olmanager-signaling.example.com
```

> **Note**: Your host must deploy their own signaling server for private games. See [SIGNALING_SERVER_DEPLOYMENT.md](../deployment/SIGNALING_SERVER_DEPLOYMENT.md) for details.

---

## How to Create a Game

Follow these steps to create an online game as the host:

### Step 1: Start the Game

1. Launch OLManager
2. From the main menu, click **"Multiplayer"**

![Main Menu](screenshots/main-menu-multiplayer.png)

### Step 2: Create a Room

1. The Multiplayer Menu will open
2. Ensure the **"Create Game"** tab is selected
3. Enter a name for your game (e.g., "My League")
4. Click **"Create Room"**

![Create Game Tab](screenshots/create-game-tab.png)

### Step 3: Share Room Code

1. A 6-character room code will be displayed (e.g., `ABC123`)
2. Click **"Copy to Clipboard"** to copy the code
3. Share this code with your opponent

![Room Code](screenshots/room-code.png)

### Step 4: Wait for Opponent

1. The game will wait for your opponent to join
2. You can see "Waiting for Player..." status
3. Click **"Cancel"** to cancel and return to the menu

### Step 5: Player Selection

Once your opponent joins:

1. Both players will see the Player Selection screen
2. **You are Player 1 (Host)** - your team is pre-selected
3. Click **"Confirm Selection"** to lock in your player

![Player Selection](screenshots/player-selection.png)

### Step 6: Start the Game

1. When both players have confirmed their selection
2. Click **"Start Game"** to begin

![Start Game](screenshots/start-game.png)

---

## How to Join a Game

Follow these steps to join a game as a client:

### Step 1: Get Room Code

1. Ask your friend for the 6-character room code
2. Make sure they've created a room and are waiting

### Step 2: Join the Room

1. Launch OLManager
2. Click **"Multiplayer"**
3. Click the **"Join Game"** tab
4. Enter the room code (e.g., `ABC123`)
5. Click **"Join Room"**

![Join Game Tab](screenshots/join-game-tab.png)

### Step 3: Connect

1. The game will connect to your friend's room
2. You'll see "Connecting..." while establishing the connection
3. Once connected, you'll see the Player Selection screen

### Step 4: Player Selection

1. **You are Player 2 (Client)** - your team is pre-selected
2. Click **"Confirm Selection"** to lock in your player

### Step 5: Wait for Host

1. Wait for the host to start the game
2. The game will begin when both players are ready

---

## How to Play

### During the Day

Each day, both players can perform the following actions:

- **Transfers**: Scout players, make transfer bids, negotiate contracts
- **Tactics**: Set formation, play style, training schedule
- **Staff**: Hire or fire staff members
- **Academy**: Promote youth players to the main squad

### Marking Ready

When you've completed your actions for the day:

1. Click the **"Ready for Next Day"** button
2. Wait for your opponent to also mark ready
3. When both are ready, the day advances

![Ready Button](screenshots/ready-button.png)

### Day Advancement

- Only the **Host** can advance the day
- The day advances automatically when both players are ready
- Both players see the same results (match outcomes, news, etc.)

### Connection Status

The connection status is always visible:

- **Green**: Connected - everything is working
- **Yellow**: Reconnecting - attempting to restore connection
- **Red**: Disconnected - connection lost

![Connection Status](screenshots/connection-status.png)

### Sync Indicator

State synchronization happens automatically:

- **Synced**: Checksum verified - states match
- **Syncing...**: State is being transferred
- **Sync Error**: Checksum mismatch - requesting full sync

![Sync Indicator](screenshots/sync-indicator.png)

---

## Troubleshooting

### Connection Issues

#### "Failed to connect to room"

**Cause**: The signaling server is unreachable or room doesn't exist.

**Solutions**:
1. Check your internet connection
2. Verify the room code is correct
3. Ask the host to restart their game
4. Check firewall settings

#### "Connection timed out"

**Cause**: Network latency or P2P connection failure.

**Solutions**:
1. Wait a few seconds and try again
2. Check NAT traversal settings on your router
3. Use a different network (e.g., mobile hotspot)

#### "Room is full"

**Cause**: Someone else already joined the room.

**Solutions**:
1. Ask the host to create a new room
2. Wait for the current game to end

### Gameplay Issues

#### "My transfers don't appear"

**Cause**: State desynchronization or network issue.

**Solutions**:
1. Click the **Sync** button to force a sync
2. Wait for the next automatic sync
3. If issue persists, ask host to verify their actions

#### "Day didn't advance"

**Cause**: One player hasn't marked ready yet.

**Solutions**:
1. Wait for opponent to mark ready
2. Check if opponent's connection is stable
3. Host can check player readiness in the status bar

#### "Opponent's changes don't show"

**Cause**: Sync delay or failure.

**Solutions**:
1. Wait for automatic sync (every 30 seconds)
2. Click **"Request Sync"** to trigger manual sync
3. Reconnect if issues persist

### Disconnect Recovery

#### "Host disconnected"

When the host disconnects, you'll see a recovery modal:

![Disconnect Recovery](screenshots/disconnect-recovery.png)

**Options**:
- **Continue Offline**: Load last backup and continue as single-player
- **Quit to Menu**: Return to the main menu

> **Warning**: Progress since the last sync may be lost.

#### "Client disconnected"

The host will see a toast notification. The client will attempt to reconnect automatically.

---

## FAQ

### General

**Q: Can I play with more than 2 players?**
> A: Not currently. Online multiplayer supports exactly 2 players (Host + Client).

**Q: Can I save my game in multiplayer?**
> A: Yes, but only the host can save. The client's game is restored from the host's save.

**Q: Can I pause the game?**
> A: No. Multiplayer games don't support pausing. Both players must be online to play.

**Q: What happens if I close the game?**
> - **Host**: Game ends for both players
> - **Client**: Can reconnect within 5 minutes; otherwise, game ends

### Technical

**Q: Why do I need a signaling server?**
> A: The signaling server helps establish the initial P2P connection between players. After connecting, all data flows directly between clients.

**Q: Can I host on a different port?**
> A: Yes, you can configure the signaling server port in the deployment settings.

**Q: Is my game data secure?**
> A: Yes. All game data is transmitted over encrypted WebRTC data channels. The signaling server only handles connection establishment.

**Q: What happens if checksums don't match?**
> A: The client automatically requests a full state sync from the host to resolve the mismatch.

### Troubleshooting

**Q: Why is my ping so high?**
> A: Ping depends on your network distance to the other player. Higher ping may affect gameplay experience.

**Q: Can I use a VPN?**
> A: Yes, but it may increase latency. Not recommended for competitive play.

**Q: My game crashed. Can I rejoin?**
> - **Host**: No - game ends when host disconnects
> - **Client**: Yes - if backup exists, you can continue offline

---

## Quick Reference

### Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Open Multiplayer Menu | `M` (from main menu) |
| Mark Ready | `R` (during gameplay) |
| Request Sync | `S` (during gameplay) |

### Menu Flow

```
Main Menu
    └── Multiplayer
            ├── Create Game (Host)
            │       └── Waiting for Player
            │               └── Player Selection → Game
            │
            └── Join Game (Client)
                    └── Player Selection → Game
```

### Game Flow

```
Day Start
    → Player Actions (Transfers, Tactics, etc.)
    → Mark Ready (both players)
    → Day Advances (host only)
    → Match Results (if match day)
    → Repeat
```

---

## Support

If you encounter issues not covered in this guide:

1. Check the [Technical Troubleshooting Guide](../technical/MULTIPLAYER_TROUBLESHOOTING.md)
2. Search for existing issues on GitHub
3. Create a new issue with:
   - Steps to reproduce
   - Expected vs actual behavior
   - Network information (ping, firewall status)
   - Log files (if applicable)

---

**Document Version**: 1.0  
**Last Updated**: 2026-04-30  
**Game Version**: 0.1.1+ (with online-mvp branch)