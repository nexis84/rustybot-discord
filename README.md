# RustyBot - EVE Online Discord Market Bot

A Discord bot that provides real-time market data, manufacturing costs, and loyalty point analysis for EVE Online.

**🚀 Live Repository**: https://github.com/nexis84/rustybot-discord-bot

## Features

- **Market Data**: Get real-time prices from all major trade hubs (Jita, Amarr, Dodixie, Hek, Rens)
- **Manufacturing Costs**: Calculate build costs for craftable items
- **LP Store Analysis**: Analyze loyalty point store offers and profitability
- **Item Information**: Get detailed links and information for any EVE Online item
- **D-Scan Parser**: Parse and analyze directional scan results
- **Interactive Menus**: User-friendly dropdown menus and buttons

## Commands

### Slash Commands
- `/market <item> [quantity]` - Get market prices across all trade hubs
- `/build <item>` - Calculate manufacturing costs (Work in progress)
- `/lp <corporation> [item]` - Browse LP store offers or get specific item costs
- `/info <item>` - Get detailed information links
- `/dscan` - Open d-scan parser modal
- `/help` - Show all available commands

### Text Commands (Legacy)
- `!market <item>` - Alternative market command
- `!build <item>` - Alternative build command
- `!lp <corp> | <item>` - Alternative LP command
- `!info <item>` - Alternative info command

## Setup

### Prerequisites
- Node.js 16 or higher
- A Discord application and bot token

### Environment Variables
Create a `.env` file with the following variables:

```env
DISCORD_TOKEN=your_discord_bot_token
CLIENT_ID=your_discord_application_id
PORT=8080
USER_AGENT=YourBot/1.0.0 (your@email.com)
```

### Installation

1. Clone the repository:
```bash
git clone https://github.com/nexis84/rustybot-discord-bot.git
cd rustybot-discord-bot
```

2. Install dependencies:
```bash
npm install
```

3. Set up your environment variables in `.env`

4. Start the bot:
```bash
npm start
```

## Deployment

### Render Deployment
This bot is configured for easy deployment on Render:

1. Connect your GitHub repository to Render
2. Create a new Web Service
3. Set the following:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment**: Node
4. Add your environment variables in the Render dashboard
5. Deploy!

### Environment Variables for Production
- `DISCORD_TOKEN` - Your Discord bot token
- `CLIENT_ID` - Your Discord application ID
- `PORT` - Port number (automatically set by Render)
- `USER_AGENT` - Your bot's user agent string

## Bot Permissions

The bot requires the following Discord permissions:
- Send Messages
- Use Slash Commands
- Embed Links
- Read Message History

## API Data Sources

- **ESI (EVE Swagger Interface)** - Official EVE Online API for market data
- **Fuzzwork.co.uk** - Item type ID lookups
- **eve-files.com** - Comprehensive type ID database
- **everef.net** - Item information links

## Architecture

- **Express Server** - Web server for health checks and Render compatibility
- **Discord.js v14** - Discord bot framework
- **Axios** - HTTP client for API requests
- **Bottleneck** - Rate limiting for API calls
- **In-memory Caching** - Type ID and market data caching

## Development

### Local Development
```bash
npm run dev  # If you have nodemon installed
# or
npm start
```

### GUI Controller (Windows)
For local development on Windows, you can use the included Python GUI controller:
```bash
python bot_controller.py
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the ISC License.

## Disclaimer

This bot is not affiliated with CCP Games or EVE Online. All EVE Online related data is provided by CCP Games through their public APIs.

## Support

For issues and feature requests, please use the GitHub issues page.