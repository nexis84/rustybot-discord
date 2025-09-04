# Deployment Guide

## GitHub Setup

1. **Create a new GitHub repository**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: RustyBot Discord Market Bot"
   git branch -M main
   git remote add origin https://github.com/yourusername/rustybot-discord-market.git
   git push -u origin main
   ```

2. **Update the repository URLs** in `package.json` and `app.json` with your actual GitHub repository URL.

## Discord Bot Setup

1. **Create Discord Application**:
   - Go to [Discord Developer Portal](https://discord.com/developers/applications)
   - Click "New Application"
   - Name it "RustyBot" (or your preferred name)
   - Go to "Bot" section
   - Click "Add Bot"
   - Copy the **Token** (this is your `DISCORD_TOKEN`)
   - Copy the **Application ID** from the General Information tab (this is your `CLIENT_ID`)

2. **Bot Permissions**:
   - In the Bot section, enable the following permissions:
     - Send Messages
     - Use Slash Commands
     - Embed Links
     - Read Message History
   - Generate OAuth2 URL with these permissions and add the bot to your server

## Render Deployment

1. **Create Render Account**:
   - Go to [Render.com](https://render.com)
   - Sign up using GitHub

2. **Deploy the Bot**:
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Configure settings:
     - **Name**: `rustybot-discord-market`
     - **Environment**: Node
     - **Region**: Choose closest to your users
     - **Branch**: `main`
     - **Build Command**: `npm install`
     - **Start Command**: `npm start`

3. **Environment Variables**:
   Add these in the Render dashboard under Environment:
   ```
   DISCORD_TOKEN=your_discord_bot_token_here
   CLIENT_ID=your_discord_application_id_here
   USER_AGENT=RustyBot/1.0.0 (your@email.com)
   ```

4. **Deploy**:
   - Click "Create Web Service"
   - Wait for deployment to complete
   - Check logs for any errors

## Alternative Deployments

### Heroku
1. Install Heroku CLI
2. ```bash
   heroku create your-bot-name
   heroku config:set DISCORD_TOKEN=your_token
   heroku config:set CLIENT_ID=your_client_id
   heroku config:set USER_AGENT="RustyBot/1.0.0 (your@email.com)"
   git push heroku main
   ```

### Railway
1. Sign up at [Railway.app](https://railway.app)
2. Connect GitHub repository
3. Add environment variables in dashboard
4. Deploy automatically

### Google Cloud Run
1. Build Docker image
2. Push to Google Container Registry
3. Deploy to Cloud Run
4. Set environment variables

## Post-Deployment

1. **Test the Bot**:
   - Use `/help` command in your Discord server
   - Try `/market PLEX` to test market data
   - Verify all commands work properly

2. **Monitor Logs**:
   - Check Render logs for any errors
   - Monitor API rate limits
   - Watch for memory usage

3. **Updates**:
   - Push changes to GitHub
   - Render will auto-deploy from main branch
   - Use staging environment for testing major changes

## Troubleshooting

### Common Issues:
- **Bot not responding**: Check DISCORD_TOKEN is correct
- **Slash commands not showing**: Verify CLIENT_ID and bot permissions
- **API errors**: Check rate limiting and USER_AGENT
- **Memory issues**: Monitor usage, consider upgrading plan

### Logs:
```bash
# View Render logs in dashboard or CLI
render logs follow your-service-name
```

### Environment Variables:
Make sure all required variables are set:
- DISCORD_TOKEN (required)
- CLIENT_ID (required)
- USER_AGENT (recommended)
- PORT (automatically set by Render)

## Security Notes

- Never commit `.env` file to GitHub
- Use environment variables for all secrets
- Regularly rotate Discord tokens
- Monitor for unusual API usage
- Keep dependencies updated