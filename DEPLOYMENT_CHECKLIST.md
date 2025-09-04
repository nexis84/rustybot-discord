# Deployment Checklist

## Pre-Deployment ✅

### Code Preparation
- [ ] Remove sensitive data from `.env` (tokens, secrets)
- [ ] Update repository URLs in `package.json` and `app.json`
- [ ] Test bot locally with `/help` command
- [ ] Verify all slash commands work
- [ ] Check console for errors/warnings

### Discord Setup
- [ ] Discord application created
- [ ] Bot token obtained (`DISCORD_TOKEN`)
- [ ] Application ID copied (`CLIENT_ID`)
- [ ] Bot added to test server with proper permissions:
  - [ ] Send Messages
  - [ ] Use Slash Commands  
  - [ ] Embed Links
  - [ ] Read Message History

### Repository Setup
- [ ] GitHub repository created
- [ ] All files committed and pushed
- [ ] `.gitignore` includes `.env` and `node_modules`
- [ ] README.md updated with your information

## Deployment Steps ✅

### Render Deployment
- [ ] Render account created/logged in
- [ ] Repository connected to Render
- [ ] Web Service created with settings:
  - [ ] Build Command: `npm install`
  - [ ] Start Command: `npm start`
  - [ ] Environment: Node
- [ ] Environment variables added:
  - [ ] `DISCORD_TOKEN`
  - [ ] `CLIENT_ID`
  - [ ] `USER_AGENT`
- [ ] Service deployed successfully

### Alternative Platforms
- [ ] **Heroku**: App created, environment vars set, deployed
- [ ] **Railway**: Repository connected, vars configured
- [ ] **Docker**: Image built and tested

## Post-Deployment Testing ✅

### Basic Functionality
- [ ] Service is running (check health endpoint)
- [ ] Bot shows as online in Discord
- [ ] Slash commands are registered and visible
- [ ] `/help` command works
- [ ] `/market PLEX` returns market data
- [ ] `/info Tritanium` returns item link

### Advanced Features
- [ ] `/lp Sisters of EVE` opens LP store menu
- [ ] `/dscan` modal opens and works
- [ ] Interactive menus respond correctly
- [ ] Error handling works (try invalid item names)

### Performance
- [ ] Response times acceptable (<5 seconds)
- [ ] No memory leaks in logs
- [ ] API rate limits not exceeded
- [ ] Health check endpoint responds

## Monitoring Setup ✅

### Logs
- [ ] Deployment logs show no errors
- [ ] Bot startup logs appear clean
- [ ] API calls completing successfully
- [ ] No unhandled promise rejections

### Alerts (Optional)
- [ ] Uptime monitoring configured
- [ ] Error rate monitoring
- [ ] Discord webhook for critical alerts
- [ ] Log aggregation (if using multiple instances)

## Security Review ✅

### Environment
- [ ] No secrets in code repository
- [ ] Environment variables properly secured
- [ ] Bot token not exposed in logs
- [ ] User-Agent string configured

### Permissions
- [ ] Bot has minimal required permissions
- [ ] No administrator privileges unless needed
- [ ] Rate limiting enabled for API calls
- [ ] Input validation in place

## Documentation ✅

### User Documentation
- [ ] README.md complete and accurate
- [ ] QUICKSTART.md updated
- [ ] Command examples tested
- [ ] Links to support channels

### Developer Documentation
- [ ] DEPLOYMENT.md reflects current process
- [ ] Environment variables documented
- [ ] API endpoints documented
- [ ] Architecture notes updated

## Final Checks ✅

### Repository
- [ ] All branches merged to main
- [ ] Tags created for releases
- [ ] Issues/bugs documented
- [ ] Contributing guidelines clear

### Support
- [ ] Support channels configured
- [ ] Issue templates created
- [ ] Community guidelines posted
- [ ] Feedback collection method set up

---

## Emergency Rollback Plan 🚨

If deployment fails:

1. **Check logs** in Render dashboard
2. **Verify environment variables** are set correctly
3. **Test locally** with same environment
4. **Rollback to previous version** if needed:
   ```bash
   git revert <commit-hash>
   git push origin main
   ```
5. **Contact support** if platform issues

---

## Success Criteria ✅

Deployment is successful when:
- ✅ Bot responds to `/help` in Discord
- ✅ Market data commands return valid results  
- ✅ No errors in deployment logs
- ✅ Health check endpoint returns 200
- ✅ Interactive features work properly

**🎉 Deployment Complete!** 

Your EVE Online Discord market bot is now live and ready to serve capsuleers!