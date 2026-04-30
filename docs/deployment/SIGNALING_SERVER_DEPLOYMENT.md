# Signaling Server Deployment Guide

**Version**: 1.0  
**Last Updated**: 2026-04-30

---

## Table of Contents

1. [What is the Signaling Server](#what-is-the-signaling-server)
2. [Deployment Options](#deployment-options)
3. [Render Deployment](#render-deployment)
4. [Railway Deployment](#railway-deployment)
5. [Fly.io Deployment](#flyio-deployment)
6. [Environment Variables](#environment-variables)
7. [Testing Your Deployment](#testing-your-deployment)
8. [Monitoring and Logs](#monitoring-and-logs)
9. [Troubleshooting](#troubleshooting)

---

## What is the Signaling Server

The signaling server is a crucial component of the online multiplayer system. It facilitates the initial connection between the host and client using WebRTC.

### How It Works

```
┌──────────┐         ┌──────────────────┐         ┌──────────┐
│  Host    │────────▶│  Signaling Server │◀────────│  Client  │
│  (P1)    │         │                  │         │  (P2)    │
└──────────┘         └──────────────────┘         └──────────┘
       │                                                 │
       │         WebRTC Data Channel (P2P)               │
       └─────────────────────────────────────────────────┘
```

### Responsibilities

1. **Room Creation**: Generate unique room codes
2. **SDP Exchange**: Exchange Session Description Protocol offers/answers
3. **ICE Candidates**: Exchange Interactive Connectivity Establishment candidates
4. **Connection State**: Track active rooms and players

### Technical Details

- **Technology**: Rust with Axum web framework
- **Protocol**: WebSocket (WSS) for real-time communication
- **Storage**: In-memory HashMap (ephemeral)
- **Default Port**: 3000 (configurable)

---

## Deployment Options

### Comparison

| Platform | Free Tier | Auto-sleep | Custom Domain | Complexity |
|----------|-----------|------------|---------------|------------|
| Render   | Yes       | Yes        | Yes           | Low        |
| Railway  | Yes       | No         | Yes           | Low        |
| Fly.io   | No        | No         | Yes           | Medium     |
| Railway  | Yes       | No         | Yes           | Low        |

### Recommended Options

- **For testing**: Render (free, easy setup)
- **For production**: Railway or Fly.io (better uptime)

---

## Render Deployment

Render is the easiest option for deploying the signaling server.

### Step 1: Prepare Your Code

The signaling server code is in `src-tauri/src/signaling_server.rs`. You need to extract it into a standalone application.

```bash
# Create a new directory for the server
mkdir -p signaling-server
cd signaling-server

# Copy the signaling server files
# (This would be done during build process)
```

### Step 2: Create Render Account

1. Go to [render.com](https://render.com)
2. Sign up with GitHub
3. Connect your repository

### Step 3: Create a Web Service

1. Click **"New +"** → **"Web Service"**
2. Connect your GitHub repository
3. Configure the service:

```
Name: olmanager-signaling
Region: Oregon (or closest to you)
Build Command: cargo build --release
Start Command: ./target/release/signaling-server
```

### Step 4: Set Environment Variables

In the Render dashboard, add these environment variables:

```
PORT=3000
RUST_LOG=info
MAX_ROOMS=100
ROOM_TIMEOUT_SECS=3600
```

### Step 5: Deploy

1. Click **"Create Web Service"**
2. Wait for the build to complete
3. Your server will be available at `https://olmanager-signaling.onrender.com`

### Step 6: Configure CORS

If needed, add CORS configuration:

```
ALLOWED_ORIGINS=https://your-olmanager-domain.com
```

---

## Railway Deployment

Railway offers straightforward deployment with minimal configuration.

### Step 1: Prepare

1. Fork or clone the OLManager repository
2. Install Railway CLI: `npm i -g @railway/cli`
3. Login: `railway login`

### Step 2: Create Project

```bash
railway init
# Select "Empty Project"
# Project name: olmanager-signaling
```

### Step 3: Configure

Create a `railway.json`:

```json
{
  "$schema": "https://railway.app/schema.json",
  "build": {
    "builder": "NIXPACKS_RUST_CARGO"
  },
  "deploy": {
    "numReplicas": 1,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyLimit": 3
  }
}
```

### Step 4: Deploy

```bash
railway up
# Follow the prompts
```

### Step 5: Set Environment Variables

```bash
railway variables set PORT=3000
railway variables set RUST_LOG=info
```

### Step 6: Get URL

```bash
railway domain
# Returns your deployment URL
```

---

## Fly.io Deployment

Fly.io provides better performance and global distribution.

### Step 1: Install Fly CLI

```bash
# macOS
brew install flyctl

# Linux
curl -L https://fly.io/install.sh | sh

# Windows
powershell -Command "iwr https://fly.io/install.ps1 | iex"
```

### Step 2: Login

```bash
fly auth login
```

### Step 3: Create App

```bash
fly apps create olmanager-signaling
```

### Step 4: Configure

Create `fly.toml`:

```toml
app = "olmanager-signaling"

[build]
  builder = "paketobuildpacks/builder:rust"

[deploy]
  release_command = ""
  process = "app"

[[services]]
  http_checks = []
  internal_port = 3000
  processes = ["app"]
  protocol = "tcp"
  auto_stop_machines = false
  auto_start_machines = true
  min_machines = 1
  max_machines = 1

[[services.ports]]
  handlers = ["http"]
  port = 80

[[services.ports]]
  handlers = ["tls", "http"]
  port = 443
```

### Step 5: Set Secrets

```bash
fly secrets set RUST_LOG=info
fly secrets set MAX_ROOMS=100
fly secrets set ROOM_TIMEOUT_SECS=3600
```

### Step 6: Deploy

```bash
fly deploy
```

### Step 7: Get URL

```bash
fly apps info olmanager-signaling
# Look for the hostname
```

---

## Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | Server port | 3000 | Yes |
| `RUST_LOG` | Log level | info | No |
| `MAX_ROOMS` | Maximum concurrent rooms | 100 | No |
| `ROOM_TIMEOUT_SECS` | Room timeout | 3600 | No |
| `ALLOWED_ORIGINS` | CORS allowed origins | * | No |
| `WS_MAX_FRAME_SIZE` | WebSocket max frame size | 16384 | No |

### Production Recommendations

```bash
# For production, use:
RUST_LOG=warn
MAX_ROOMS=500
ROOM_TIMEOUT_SECS=7200
ALLOWED_ORIGINS=https://your-domain.com
```

---

## Testing Your Deployment

### Health Check

```bash
# Basic health check
curl https://your-server.com/health

# Expected response
{"status":"ok","rooms":0}
```

### Room Creation

```bash
# Create a room
curl -X POST https://your-server.com/room

# Expected response
{"room_code":"ABC123"}
```

### Room Status

```bash
# Get room status
curl https://your-server.com/room/ABC123

# Expected response (before join)
{"room_code":"ABC123","status":"waiting","host_sdp":null,"client_sdp":null}
```

### Full Integration Test

1. Create two terminal sessions
2. Use a WebSocket client (like wscat) to connect
3. Host creates room: `POST /room`
4. Client joins room: `POST /room/{code}/join`
5. Verify SDP exchange occurs

```bash
# Using wscat
npm install -g wscat
wscat -c wss://your-server.com/ws
```

---

## Monitoring and Logs

### Render

```bash
# View logs
railway logs -f
```

### Railway

```bash
# View logs
render logs -f olmanager-signaling
```

### Fly.io

```bash
# View logs
fly logs -f olmanager-signaling

# View metrics
fly metrics
```

### Key Metrics to Monitor

| Metric | What to Watch |
|--------|---------------|
| **Active Rooms** | Shouldn't exceed MAX_ROOMS |
| **Connection Errors** | Indicates network issues |
| **Response Time** | Should be < 100ms |
| **Memory Usage** | Should stay under 256MB |
| **CPU Usage** | Should stay under 50% |

### Alerting

Set up alerts for:

- Room count > 80% of MAX_ROOMS
- Error rate > 5%
- Memory > 200MB

---

## Troubleshooting

### Server Won't Start

**Error**: `Address already in use`

**Solution**:
```bash
# Check what's using the port
lsof -i :3000

# Kill the process or use a different port
PORT=3001 ./signaling-server
```

### Connection Failures

**Error**: `WebSocket connection failed`

**Solutions**:
1. Check firewall rules allow WebSocket connections
2. Verify TLS certificates are valid
3. Check server logs for specific error

### CORS Errors

**Error**: `CORS policy blocked`

**Solution**:
```bash
# Set allowed origins
ALLOWED_ORIGINS=https://example.com,https://app.example.com

# Or allow all (development only)
ALLOWED_ORIGINS=*
```

### Memory Leaks

**Error**: Server memory keeps growing

**Solutions**:
1. Check for stuck WebSocket connections
2. Verify rooms are being cleaned up
3. Restart server periodically (if no other fix)

### High Latency

**Error**: Slow response times

**Solutions**:
1. Deploy to region closest to users
2. Enable caching (if applicable)
3. Upgrade to paid tier with better resources

---

## Security Considerations

### TLS/SSL

Always use HTTPS/WSS in production:

```bash
# Let's Encrypt (automatic)
# Render and Railway provide this automatically

# Manual certificate
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes
```

### Rate Limiting

Add rate limiting to prevent abuse:

```rust
// In your server code
use tower::limit::GlobalConcurrencyLimiter;
```

### Monitoring

Monitor for:
- Unusual traffic patterns
- Failed authentication attempts
- Large numbers of rooms being created

---

## Quick Reference

### Deploy Commands

```bash
# Render
render deploy

# Railway
railway up

# Fly.io
fly deploy
```

### Common URLs

```
# Production URL format
https://your-app-name.onrender.com
https://your-app-name.railway.app
https://your-app-name.fly.dev
```

### Health Check Endpoint

```
GET /health
Response: {"status":"ok","rooms":N}
```

---

## Support

- **Render Issues**: https://render.com/docs
- **Railway Issues**: https://docs.railway.app
- **Fly.io Issues**: https://fly.io/docs
- **OLManager Issues**: https://github.com/your-repo/issues

---

**Document Version**: 1.0  
**Last Updated**: 2026-04-30