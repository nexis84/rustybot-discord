# Quick Start Guide

## Local Development Setup

### 1. Prerequisites
- Node.js 16+ installed
- Git installed
- Discord account and server for testing

### 2. Clone and Setup
```bash
# Clone the repository
git clone https://github.com/yourusername/rustybot-discord-market.git
cd rustybot-discord-market

# Install dependencies
npm install

# Copy environment file
cp .env.example .env
```

### 3. Discord Bot Setup
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create new application → "RustyBot"
3. Go to Bot section → Add Bot
4. Copy Token and Application ID
5. Update `.env` file with your tokens

### 4. Run Locally
```bash
# Start the bot
npm start

# For development with auto-restart
npm run dev
```

### 5. Test Commands
In your Discord server:
- `/help` - Show all commands
- `/market PLEX` - Test market data
- `/info Tritanium` - Test item lookup

## Production Deployment

### Quick Deploy to Render
1. Push to GitHub
2. Connect to Render
3. Set environment variables
4. Deploy!

See `DEPLOYMENT.md` for detailed instructions.

## Features Overview

- **Real-time Market Data**: Live prices from all EVE trade hubs
- **Manufacturing Costs**: Calculate build costs and profits
- **LP Store Analysis**: Browse loyalty point offers
- **Interactive UI**: Dropdown menus and buttons
- **D-Scan Parser**: Analyze directional scan results

## Commands Quick Reference

| Command | Description | Example |
|---------|-------------|---------|
| `/market <item>` | Get market prices | `/market PLEX` |
| `/build <item>` | Manufacturing costs | `/build Retriever` |
| `/lp <corp>` | LP store browser | `/lp Sisters of EVE` |
| `/info <item>` | Item information | `/info Condor` |
| `/dscan` | D-scan parser | `/dscan` |

## Support

- **Issues**: GitHub Issues page
- **Discord**: [Your Discord Server]
- **Documentation**: README.md and wiki

## Contributing

1. Fork repository
2. Create feature branch
3. Make changes
4. Test thoroughly
5. Submit pull request

Happy capsuleering! 🚀