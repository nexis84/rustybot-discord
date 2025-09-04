import dotenv from 'dotenv';
dotenv.config();

import pkg from 'web-streams-polyfill/dist/polyfill.js';
const { ReadableStream, WritableStream, TransformStream } = pkg;

if (!globalThis.ReadableStream) {

    globalThis.ReadableStream = ReadableStream;

}

if (!globalThis.WritableStream) {

    globalThis.WritableStream = WritableStream;

}

if (!globalThis.TransformStream) {

    globalThis.TransformStream = TransformStream;

}

import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';

import axios from 'axios';

import Bottleneck from 'bottleneck';

import express from 'express';



// Set up Express server for Cloud Run
const app = express();

// Basic middleware for production
app.use(express.json({ limit: '10mb' }));
app.disable('x-powered-by'); // Security: Hide Express server info



// Set up rate limiter with Bottleneck

const limiter = new Bottleneck({

    minTime: 500, // 500ms between requests (2 requests per second), Fuzzwork recommended min is 1000ms

    maxConcurrent: 4 // how many requests at a time
});

// Set up rate limiter for external APIs (ESI, Fuzzwork, EveRef)
const apiLimiter = new Bottleneck({
    minTime: 500, // 500ms between external API requests (2 request per second)
    maxConcurrent: 1 // Only one external API request at a time
});



// Set up Discord bot client

const client = new Client({

    intents: [

        GatewayIntentBits.Guilds,

        GatewayIntentBits.GuildMessages,

        GatewayIntentBits.MessageContent,

    ]

});



const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID; // Discord Application ID

if (!DISCORD_TOKEN) {
    console.error("Discord token is missing, exiting.");
    process.exit(1);
}

if (!CLIENT_ID) {
    console.error("CLIENT_ID is missing, exiting.");
    process.exit(1);
}

// Log in to Discord with your client's token
client.login(DISCORD_TOKEN);

// Define slash commands
const commands = [
    new SlashCommandBuilder()
        .setName('market')
        .setDescription('Get market data for an EVE Online item')
        .addStringOption(option =>
            option.setName('item')
                .setDescription('The name of the item to search for')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('quantity')
                .setDescription('Number of items to calculate total cost for (default: 1)')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(1000000)),
    
    new SlashCommandBuilder()
        .setName('build')
        .setDescription('Calculate manufacturing costs for an item')
        .addStringOption(option =>
            option.setName('item')
                .setDescription('The name of the item to calculate build costs for')
                .setRequired(true)),
    
    new SlashCommandBuilder()
        .setName('lp')
        .setDescription('Analyze LP store offers')
        .addStringOption(option =>
            option.setName('corporation')
                .setDescription('Select LP store corporation')
                .setRequired(true)
                .addChoices(
                    { name: 'Sisters of EVE', value: 'Sisters of EVE' },
                    { name: 'Federation Navy', value: 'Federation Navy' },
                    { name: 'Republic Fleet', value: 'Republic Fleet' },
                    { name: 'Imperial Navy', value: 'Imperial Navy' },
                    { name: 'Caldari Navy', value: 'Caldari Navy' },
                    { name: 'Concord', value: 'Concord' },
                    { name: 'Inner Zone Shipping', value: 'Inner Zone Shipping' },
                    { name: 'Ishukone Corporation', value: 'Ishukone Corporation' },
                    { name: 'Lai Dai Corporation', value: 'Lai Dai Corporation' },
                    { name: 'Hyasyoda Corporation', value: 'Hyasyoda Corporation' },
                    { name: 'ORE', value: 'ORE' },
                    { name: '24th Imperial Crusade', value: '24th Imperial Crusade' },
                    { name: 'Federal Defense Union', value: 'Federal Defense Union' },
                    { name: 'Tribal Liberation Force', value: 'Tribal Liberation Force' },
                    { name: 'State Protectorate', value: 'State Protectorate' }
                ))
        .addStringOption(option =>
            option.setName('item')
                .setDescription('The item name (optional: leave blank to list top offers)')
                .setRequired(false)),
    
    new SlashCommandBuilder()
        .setName('info')
        .setDescription('Get information link for an EVE Online item')
        .addStringOption(option =>
            option.setName('item')
                .setDescription('The name of the item to get info for')
                .setRequired(true)),

    new SlashCommandBuilder()
        .setName('dscan')
        .setDescription('Opens a form to parse a directional scan result.'),
    
    new SlashCommandBuilder()
        .setName('help')
        .setDescription('Show available commands and how to use RustyBot'),
    
    new SlashCommandBuilder()
        .setName('sync')
        .setDescription('FOR ADMINS: Manually re-syncs the slash commands with Discord.')
        .setDefaultMemberPermissions(0) // This restricts the command to server administrators
];

// Register slash commands
const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

async function deployCommands() {
    try {
        console.log('Started refreshing application (/) commands.');
        // If a GUILD_ID is provided in environment, register commands to that guild
        // (guild commands update instantly and are useful during development).
        const guildId = process.env.GUILD_ID;
        if (guildId) {
            await rest.put(
                Routes.applicationGuildCommands(CLIENT_ID, guildId),
                { body: commands.map(command => command.toJSON()) }
            );
            console.log(`Successfully reloaded guild (/) commands for guild ${guildId}.`);
        } else {
            await rest.put(
                Routes.applicationCommands(CLIENT_ID),
                { body: commands.map(command => command.toJSON()) }
            );
            console.log('Successfully reloaded global application (/) commands.');
        }
    } catch (error) {
        console.error('Error deploying commands:', error);
    }
}



client.on('ready', async () => {
    console.log(`🤖 Logged in as ${client.user.tag}!`);
    console.log(`📊 Serving ${client.guilds.cache.size} guilds`);
    console.log(`🔧 Deploying commands...`);
    await deployCommands();
    console.log(`✅ Bot is ready and operational!`);
});

// Set a default User Agent if one is not set in the environment variables.

const USER_AGENT = process.env.USER_AGENT || 'DiscordBot/1.0.0 (contact@example.com)';



// Cache for Type IDs

const typeIDCache = new Map();



// Function to fetch TypeID for an item name

async function getItemTypeID(itemName) {

    if (!itemName) {

        console.error(`Item name is invalid: "${itemName}"`);

        return null;

    }

    if (typeIDCache.has(itemName)) {

        return typeIDCache.get(itemName);

    }

    try {

        const response = await axios.get(`https://www.fuzzwork.co.uk/api/typeid.php?typename=${encodeURIComponent(itemName)}`);

        if (response.data.typeID) {

            typeIDCache.set(itemName, response.data.typeID);

            return response.data.typeID;

        } else {

            console.error(`TypeID not found for "${itemName}"`);

            return null;

        }

    } catch (error) {

        console.error(`Error fetching TypeID for "${itemName}":`, error);

        return null;

    }

}



// Region ID mappings for the four main trade hubs

const tradeHubRegions = {

    jita: 10000002,

    amarr: 10000043,

    dodixie: 10000032,

    hek: 10000042,

    rens: 10000030

};



// Function to fetch market data for an item with improved PLEX handling
async function fetchMarketDataImproved(itemName, typeID, channel, quantity = 1) {
    try {
        console.log(`[fetchMarketDataImproved] Start: Fetching market data for ${itemName} (TypeID: ${typeID}), Quantity: ${quantity}`);
        const isPlex = (typeID === PLEX_TYPE_ID);
        const targetRegionId = isPlex ? GLOBAL_PLEX_REGION_ID : JITA_REGION_ID;

        const sellOrdersURL = `https://esi.evetech.net/latest/markets/${targetRegionId}/orders/?datasource=tranquility&order_type=sell&type_id=${typeID}`;
        const buyOrdersURL = `https://esi.evetech.net/latest/markets/${targetRegionId}/orders/?datasource=tranquility&order_type=buy&type_id=${typeID}`;

        const [sellOrdersRes, buyOrdersRes] = await Promise.all([
            limiter.schedule(() => axios.get(sellOrdersURL, { headers: { 'User-Agent': USER_AGENT }, validateStatus: (s) => s >= 200 && s < 500, timeout: 7000 })),
            limiter.schedule(() => axios.get(buyOrdersURL, { headers: { 'User-Agent': USER_AGENT }, validateStatus: (s) => s >= 200 && s < 500, timeout: 7000 }))
        ]);

        if (sellOrdersRes.status !== 200) throw new Error(`ESI returned status ${sellOrdersRes.status} for sell orders.`);
        if (buyOrdersRes.status !== 200) throw new Error(`ESI returned status ${buyOrdersRes.status} for buy orders.`);

        const sellOrders = sellOrdersRes.data;
        const buyOrders = buyOrdersRes.data;

        let lowestSellOrder = null;
        let highestBuyOrder = null;

        if (isPlex) {
            // For PLEX, use global market data directly
            lowestSellOrder = sellOrders.length > 0 ? sellOrders.reduce((min, o) => (o.price < min.price ? o : min)) : null;
            highestBuyOrder = buyOrders.length > 0 ? buyOrders.reduce((max, o) => (o.price > max.price ? o : max)) : null;
        } else {
            // For other items, filter by Jita system
            const jitaSellOrders = sellOrders.filter(o => o.system_id === JITA_SYSTEM_ID);
            lowestSellOrder = jitaSellOrders.length > 0 ? jitaSellOrders.reduce((min, o) => (o.price < min.price ? o : min)) : null;
            const jitaBuyOrders = buyOrders.filter(o => o.system_id === JITA_SYSTEM_ID);
            highestBuyOrder = jitaBuyOrders.length > 0 ? jitaBuyOrders.reduce((max, o) => (o.price > max.price ? o : max)) : null;
        }

        let message = `${itemName}${quantity > 1 ? ` x${quantity}` : ''} - `;
        const formatIsk = (amount) => parseFloat(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        if (lowestSellOrder) message += `${isPlex ? 'Global Sell' : 'Jita Sell'}: ${formatIsk(lowestSellOrder.price * quantity)} ISK`;
        else message += `${isPlex ? 'Global Sell' : 'Jita Sell'}: (None)`;

        if (highestBuyOrder) message += `, ${isPlex ? 'Global Buy' : 'Jita Buy'}: ${formatIsk(highestBuyOrder.price * quantity)} ISK`;
        else message += `, ${isPlex ? 'Global Buy' : 'Jita Buy'}: (None)`;

        if (!lowestSellOrder && !highestBuyOrder) {
            channel.send(`❌ No market data found for "${itemName}" in ${isPlex ? 'the global market' : 'Jita'}. ❌`);
        } else {
            channel.send(message);
        }

    } catch (error) {
        console.error(`[fetchMarketDataImproved] Error for "${itemName}":`, error.message);
        channel.send(`❌ Error fetching market data for "${itemName}". Please try again later. ❌`);
    }
}

// Function to fetch market data for an item in trade hubs

async function fetchMarketDataTradeHubs(itemName, typeID, channel, quantity = 1) {

    const results = [];

    for (const [regionName, regionID] of Object.entries(tradeHubRegions)) {

        try {

            const sellOrdersURL = `https://esi.evetech.net/latest/markets/${regionID}/orders/?datasource=tranquility&order_type=sell&type_id=${typeID}`;

            const buyOrdersURL = `https://esi.evetech.net/latest/markets/${regionID}/orders/?datasource=tranquility&order_type=buy&type_id=${typeID}`;

            

            const [sellOrdersRes, buyOrdersRes] = await Promise.all([

                limiter.schedule(() => axios.get(sellOrdersURL, { headers: { 'User-Agent': USER_AGENT }, validateStatus: status => status >= 200 && status < 500 })),

                limiter.schedule(() => axios.get(buyOrdersURL, { headers: { 'User-Agent': USER_AGENT }, validateStatus: status => status >= 200 && status < 500 }))

            ]);



            if (sellOrdersRes.status !== 200 || buyOrdersRes.status !== 200) {

                console.error(`[fetchMarketDataTradeHubs] Error fetching data for "${itemName}" in region ${regionName}`);

                continue;

            }



            const sellOrders = sellOrdersRes.data;

            const buyOrders = buyOrdersRes.data;



            if (!sellOrders.length && !buyOrders.length) {

                results.push(`❌ No market data found for "${itemName}" in ${regionName}. ❌`);

                continue;

            }



            let sellPrice = 'N/A';

            let buyPrice = 'N/A';



            if (sellOrders.length > 0) {

                const lowestSellOrder = sellOrders.reduce((min, order) => (order.price < min.price ? order : min), sellOrders[0]);

                sellPrice = parseFloat(lowestSellOrder.price * quantity).toLocaleString(undefined, { minimumFractionDigits: 2 });

            }



            if (buyOrders.length > 0) {

                const highestBuyOrder = buyOrders.reduce((max, order) => (order.price > max.price ? order : max), buyOrders[0]);

                buyPrice = parseFloat(highestBuyOrder.price * quantity).toLocaleString(undefined, { minimumFractionDigits: 2 });

            }



            results.push(`**${regionName.toUpperCase()}:** Sell: ${sellPrice} ISK | Buy: ${buyPrice} ISK`);

        } catch (error) {

            console.error(`[fetchMarketDataTradeHubs] Error fetching market data for "${itemName}" in ${regionName}`);

        }

    }

    // Format the output with proper header and styling

    const quantityText = quantity > 1 ? ` x${quantity}` : '';

    const header = `📊 **Market Orders for "${itemName}"**${quantityText}`;

    const formattedResults = results.map(result => `  ${result}`);

    channel.send(`${header}\n${formattedResults.join('\n')}`);

}
// Handle interactions (buttons, select menus, and chat input commands)
client.on('interactionCreate', async interaction => {

    // --- Button Handler for D-Scan Copy ---
    if (interaction.isButton() && interaction.customId.startsWith('dscan_copy:')) {
        const sessionId = interaction.customId.split(':')[1];
        const rawText = activeDscanSessions.get(sessionId);

        if (rawText) {
            await interaction.reply({
                content: "Here is the raw text for you to copy and share:\n```\n" + rawText + "```",
                ephemeral: true
            });
        } else {
            await interaction.reply({
                content: "This d-scan session has expired. Please run the command again.",
                ephemeral: true
            });
        }
        return;
    }

    // --- Modal Submission Handler for D-Scan ---
    if (interaction.isModalSubmit() && interaction.customId === 'dscanModal') {
        const dscanPaste = interaction.fields.getTextInputValue('dscanInput');
        await interaction.deferReply({ ephemeral: false });
        try {
            const result = await processDscan(dscanPaste);

            if (typeof result === 'string') {
                await interaction.editReply({ content: result, embeds: [], components: [] });
            } else {
                const sessionId = interaction.id; // Use the unique interaction ID as our session key
                activeDscanSessions.set(sessionId, result.rawText);
                // Remove the data from the cache after 5 minutes
                setTimeout(() => activeDscanSessions.delete(sessionId), 5 * 60 * 1000);

                const copyButton = new ButtonBuilder()
                    .setCustomId(`dscan_copy:${sessionId}`)
                    .setLabel('📋 Copy Raw Text')
                    .setStyle(ButtonStyle.Secondary);

                const row = new ActionRowBuilder().addComponents(copyButton);

                await interaction.editReply({
                    content: '',
                    embeds: [result.embed],
                    components: [row]
                });
            }
        } catch (error) {
            console.error("Error processing d-scan modal:", error);
            await interaction.editReply({ content: "❌ An error occurred while processing the d-scan.", embeds: [], components: [] });
        }
        return;
    }

    // --- Interaction Handlers for LP Store Components ---
    if (interaction.isButton() && interaction.customId.startsWith('lp_')) {
        const [action, sessionId] = interaction.customId.split(':');
        const sessionData = activeLpSessions.get(sessionId);

        if (!sessionData) {
            return interaction.update({ content: 'This interactive session has expired. Please run the command again.', components: [] });
        }

        if (action === 'lp_prev') {
            sessionData.currentPage = Math.max(0, sessionData.currentPage - 1);
        } else if (action === 'lp_next') {
            sessionData.currentPage = Math.min(Math.ceil(sessionData.offers.length / 25) - 1, sessionData.currentPage + 1);
        }

        const pageComponents = generateLpPageComponent(sessionId, sessionData);
        return interaction.update(pageComponents);
    }

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('lp_select:')) {
        const [, sessionId] = interaction.customId.split(':');
        const sessionData = activeLpSessions.get(sessionId);

        if (!sessionData) {
            return interaction.update({ content: 'This interactive session has expired. Please run the command again.', components: [] });
        }
        
    await interaction.deferUpdate();
    const parts = interaction.values[0].split(':');
    const itemTypeID = parseInt(parts[0]);
    const offer = sessionData.offers.find(o => o.type_id === itemTypeID);

        if (offer) {
            const itemName = getTypeNameByID(offer.type_id);
            const mockChannel = {
                send: async (message) => {
                    await interaction.editReply({ content: message, components: [] });
                }
            };
            await calculateAndSendLpOfferCost(itemName, offer, mockChannel);
        } else {
             await interaction.editReply({ content: 'Error: Could not find the selected offer.', components: [] });
        }
        
        // Clean up the session
        activeLpSessions.delete(sessionId);
        return;
    }

    // --- Main Command Handler ---
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;
    
    try {
        if (commandName === 'market') {
            // ...existing market code
            let itemName = interaction.options.getString('item');
            let quantity = interaction.options.getInteger('quantity') || 1;
            const quantityMatch = itemName.match(/^(.+?)\s*(?:x|×|\s)(\d+)$/i);
            if (quantityMatch && !interaction.options.getInteger('quantity')) {
                itemName = quantityMatch[1].trim();
                quantity = parseInt(quantityMatch[2]);
            }
            await interaction.deferReply();
            const typeID = await getEnhancedItemTypeID(itemName);
            if (typeID) {
                const mockChannel = { send: async (message) => { await interaction.editReply(message); } };
                // Check if it's PLEX and use the appropriate function
                if (typeID === PLEX_TYPE_ID) {
                    await fetchMarketDataImproved(itemName, typeID, mockChannel, quantity);
                } else {
                    await fetchMarketDataTradeHubs(itemName, typeID, mockChannel, quantity);
                }
            } else {
                await interaction.editReply(`❌ No TypeID found for "${itemName}". ❌`);
            }
        } else if (commandName === 'build') {
            const itemName = interaction.options.getString('item');
            await interaction.deferReply();
            const mockChannel = { send: async (message) => { await interaction.editReply(message); } };
            await fetchBlueprintCost(itemName, mockChannel);
        } else if (commandName === 'lp') {
            const corpName = interaction.options.getString('corporation');
            const itemName = interaction.options.getString('item');
            
            await interaction.deferReply();

            if (itemName) {
                const mockChannel = { send: async (message) => { await interaction.editReply(message); } };
                await fetchLpOffer(corpName, itemName, mockChannel);
            } else {
                // PAGINATION FLOW: Create an interactive, paginated dropdown menu.
                const corpID = await getCorporationID(corpName);
                if (!corpID) {
                    return interaction.editReply(`❌ Could not find corporation "${corpName}".`);
                }

                await interaction.editReply(`🔍 Fetching all offers for **${corpName}**, please wait...`);

                const offersUrl = `https://esi.evetech.net/latest/loyalty/stores/${corpID}/offers/?datasource=tranquility`;
                const offersRes = await axios.get(offersUrl, { headers: { 'User-Agent': USER_AGENT } });
                const offers = offersRes.data;

                if (!offers || offers.length === 0) {
                    return interaction.editReply(`ℹ️ The LP store for **${corpName}** has no offers.`);
                }
                
                // Store the session data
                const sessionId = interaction.id;
                // Remove duplicate offers for the same type_id to avoid duplicate menu entries
                const uniqueOffers = offers.filter((offer, idx, arr) => arr.findIndex(o => o.type_id === offer.type_id) === idx);
                const sessionData = {
                    offers: uniqueOffers,
                    currentPage: 0,
                    corpId: corpID,
                    corpName: corpName
                };
                activeLpSessions.set(sessionId, sessionData);

                // Set a timeout to automatically clear the session
                setTimeout(() => activeLpSessions.delete(sessionId), 5 * 60 * 1000); // 5 minutes

                const pageComponents = generateLpPageComponent(sessionId, sessionData);
                await interaction.editReply(pageComponents);
            }
        } else if (commandName === 'info') {
            const itemName = interaction.options.getString('item');
            await interaction.deferReply();
            const typeID = await getEnhancedItemTypeID(itemName);
            if (typeID) {
                const eveRefUrl = `https://everef.net/type/${typeID}`;
                await interaction.editReply(`${itemName} info: ${eveRefUrl}`);
            } else {
                await interaction.editReply(`❌ Could not find an EVE Online item matching "${itemName}". Check spelling? ❌`);
            }
        } else if (commandName === 'dscan') {
            // Build and show a modal for the user to paste their d-scan
            const modal = new ModalBuilder()
                .setCustomId('dscanModal')
                .setTitle('Directional Scan Parser');

            const dscanInput = new TextInputBuilder()
                .setCustomId('dscanInput')
                .setLabel("Paste your d-scan results here")
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder("Copy and paste the entire content from your EVE Online scan window here (Ctrl+A, Ctrl+C).")
                .setRequired(true);

            const firstActionRow = new ActionRowBuilder().addComponents(dscanInput);
            modal.addComponents(firstActionRow);

            await interaction.showModal(modal);
            return;
        } else if (commandName === 'help') {
            await interaction.deferReply();
            const helpEmbed = {
                color: 0x0099ff,
                title: '🤖 RustyBot - EVE Online Market Assistant',
                description: 'Here are all the commands you can use with RustyBot:',
                fields: [
                    { name: '📊 `/market <item> [quantity]`', value: 'Get current market prices for any EVE Online item across all major trade hubs (Jita, Amarr, Dodixie, Hek, Rens)\n*Examples: `/market Tritanium`, `/market PLEX 200`, `/market plex x200`*', inline: false },
                    { name: '🔧 `/build <item>` (Work in progress)', value: 'Get manufacturing cost and materials for buildable items\n*Example: `/build Retriever`*', inline: false },
                    { name: '🏢 `/lp <corporation> <item>` (Work in progress)', value: 'Get Loyalty Point store offers from NPC corporations\n*Features easy corporation selection dropdown*', inline: false },
                    { name: 'ℹ️ `/info <item>`', value: 'Get detailed information and links for any item\n*Example: `/info Condor`*', inline: false },
                    { name: '❓ `/help`', value: 'Show this help message', inline: false }
                ],
                footer: { text: 'RustyBot uses live market data from EVE Online APIs • Made for capsuleers by capsuleers' },
                timestamp: new Date().toISOString()
            };
            await interaction.editReply({ embeds: [helpEmbed] });
        } else if (commandName === 'sync') {
            await interaction.deferReply({ ephemeral: true });
            try {
                await deployCommands();
                await interaction.editReply('✅ Commands have been successfully re-synced with Discord.');
            } catch (e) {
                console.error('Manual sync failed:', e);
                await interaction.editReply('❌ Failed to sync commands. Please check the bot\'s console for errors.');
            }
        }
    } catch (error) {
        console.error('Error handling slash command:', error);
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply('❌ An error occurred while processing your command. ❌');
        } else {
            await interaction.reply('❌ An error occurred while processing your command. ❌');
        }
    }
});

// Discord message event handler

client.on('messageCreate', async message => {

    if (message.author.bot) return; // Ignore messages from other bots

    const prefix = '!';

    if (!message.content.startsWith(prefix)) return;



    const args = message.content.slice(prefix.length).trim().split(/ +/);

    const command = args.shift().toLowerCase();



    if (command === 'market') {

        const itemName = args.join(' ').trim(); // Use full input as item name

        if (!itemName) {

            message.channel.send('❌ Please specify an item to search for. ❌');

            return;

        }



        message.channel.send(`🔍 I will get the market data for "${itemName}". This may take a little while (up to 30 seconds). Please stand by...`);



        getItemTypeID(itemName)

            .then(typeID => {

                if (typeID) {

                    // Check if it's PLEX and use the appropriate function
                    if (typeID === PLEX_TYPE_ID) {
                        fetchMarketDataImproved(itemName, typeID, message.channel);
                    } else {
                        fetchMarketDataTradeHubs(itemName, typeID, message.channel);
                    }

                } else {

                    message.channel.send(`❌ No TypeID found for "${itemName}". ❌`);                }

            })            .catch(error => {

                message.channel.send(`❌ Error fetching TypeID for "${itemName}": ${error.message} ❌`);
            });
    } else if (command === 'build') {
        const itemName = args.join(' ').trim();
        if (!itemName) {
            message.channel.send('❌ Please specify an item name. Usage: !build <item name> ❌');
            return;
        }
        fetchBlueprintCost(itemName, message.channel);
    } else if (command === 'lp') {
        const fullArgs = args.join(' ');
        if (!fullArgs.includes('|')) {
            message.channel.send('❌ Usage: !lp <corporation name> | <item name> ❌');
            return;
        }
        const parts = fullArgs.split('|').map(p => p.trim());
        const corpName = parts[0];
        const itemName = parts[1];

        if (!corpName || !itemName) {
            message.channel.send('❌ Usage: !lp <corporation name> | <item name> ❌');
            return;
        }
        fetchLpOffer(corpName, itemName, message.channel);
    } else if (command === 'info') {
        const itemName = args.join(' ').trim();
        if (!itemName) {
            message.channel.send('❌ Please specify an item name. Usage: !info <item name> ❌');
            return;
        }

        getEnhancedItemTypeID(itemName)
            .then(typeID => {
                if (typeID) {
                    const eveRefUrl = `https://everef.net/type/${typeID}`;
                    message.channel.send(`${itemName} info: ${eveRefUrl}`);
                } else {
                    message.channel.send(`❌ Could not find an EVE Online item matching "${itemName}". Check spelling? ❌`);
                }
            })
            .catch(error => {
                console.error(`[messageCreate] Error during !info lookup for "${itemName}":`, error);
                message.channel.send(`❌ Error looking up item "${itemName}". ❌`);
            });
    }
});

// Keep-alive ping removed to avoid noisy 410 responses from deprecated Glitch URL.



// Set up health check route for Cloud Run
app.get('/', (req, res) => {
    res.json({
        status: 'running',
        bot: client.user ? client.user.tag : 'connecting',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    const health = {
        status: client.readyAt ? 'healthy' : 'starting',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
    };
    res.json(health);
});

// === NEW FEATURES FROM TWITCH BOT ===

// Additional constants for new features
const corpIDCache = new Map(); // Cache for Corporation IDs
const manufacturingCache = new Map(); // Cache for product manufacturing data
// Active in-memory sessions for paginated LP browsing (keyed by interaction id)
const activeLpSessions = new Map();
const itemInfoCache = new Map(); // Cache for item info like groupID
const activeDscanSessions = new Map(); // Cache for raw d-scan text results

// ...existing code...

/**
 * Fetches detailed item information (like groupID) from ESI.
 * @param {number} typeID - The typeID of the item.
 * @returns {Promise<object|null>} The item details object or null.
 */
async function getItemInfo(typeID) {
    if (itemInfoCache.has(typeID)) {
        return itemInfoCache.get(typeID);
    }
    try {
        const esiUrl = `https://esi.evetech.net/latest/universe/types/${typeID}/?datasource=tranquility`;
        const response = await axios.get(esiUrl, {
            headers: { 'User-Agent': USER_AGENT },
            timeout: 5000
        });
        if (response.data) {
            itemInfoCache.set(typeID, response.data);
            return response.data;
        }
        return null;
    } catch (error) {
        console.error(`[getItemInfo] Error fetching info for typeID ${typeID}:`, error.message);
        return null;
    }
}

// Cache for Group info (groupID -> group details)
const groupInfoCache = new Map();

/**
 * Fetches group information (like name and category) from ESI.
 * @param {number} groupID - The groupID of the item.
 * @returns {Promise<object|null>} The group details object or null.
 */
async function getGroupInfo(groupID) {
    if (!groupID) return null;
    if (groupInfoCache.has(groupID)) return groupInfoCache.get(groupID);
    try {
        const esiUrl = `https://esi.evetech.net/latest/universe/groups/${groupID}/?datasource=tranquility`;
        const response = await axios.get(esiUrl, { headers: { 'User-Agent': USER_AGENT }, timeout: 5000 });
        if (response.data) {
            groupInfoCache.set(groupID, response.data);
            return response.data;
        }
        return null;
    } catch (error) {
        console.error(`[getGroupInfo] Error fetching info for groupID ${groupID}:`, error.message);
        return null;
    }
}

/**
 * Parses d-scan text and returns an EmbedBuilder object with the results.
 * @param {string} dscanText - The raw text from the d-scan window.
 * @returns {Promise<EmbedBuilder|string>} An EmbedBuilder on success, or a string on failure.
 */
async function processDscan(dscanText) {
    const lines = dscanText.trim().split('\n');
    const itemCounts = new Map();
    const itemTypeIDs = new Map();

    // 1. Parse lines and count items
    lines.forEach(line => {
        const parts = line.split('\t');
        if (parts.length >= 3) {
            const typeID = parseInt(parts[0].trim(), 10);
            const typeName = parts[2].trim();
            if (!typeName || isNaN(typeID)) return;
            itemCounts.set(typeName, (itemCounts.get(typeName) || 0) + 1);
            if (!itemTypeIDs.has(typeName)) {
                itemTypeIDs.set(typeName, typeID);
            }
        }
    });
    
    if (itemCounts.size === 0) {
        return "Could not parse any items from the input. Please ensure you are pasting directly from the EVE Online d-scan window.";
    }

    // 2. Dynamically categorize items using ESI
    const categorizedItems = new Map();
    const otherItems = new Map();

    const SHIP_CATEGORY_ID = 6;
    const DRONE_CATEGORY_ID = 18;
    const FIGHTER_CATEGORY_ID = 87;

    const processingPromises = Array.from(itemTypeIDs.entries()).map(async ([typeName, typeID]) => {
        const itemInfo = await getItemInfo(typeID);
        if (!itemInfo || !itemInfo.group_id) return; // Skip if we can't get basic info

        const groupInfo = await getGroupInfo(itemInfo.group_id);
        if (!groupInfo) return;

        const itemCount = itemCounts.get(typeName) || 0;

        if (groupInfo.category_id === SHIP_CATEGORY_ID) {
            const categoryName = groupInfo.name || 'Unknown Ship Group';
            if (!categorizedItems.has(categoryName)) categorizedItems.set(categoryName, []);
            categorizedItems.get(categoryName).push({ name: typeName, count: itemCount });
        } else if (groupInfo.category_id === DRONE_CATEGORY_ID || groupInfo.category_id === FIGHTER_CATEGORY_ID) {
            otherItems.set(typeName, itemCount);
        }
    });

    await Promise.all(processingPromises);

    // --- NEW STEP 3: BUILD THE EMBED ---
    const totalShips = Array.from(categorizedItems.values()).flat().reduce((sum, item) => sum + item.count, 0);

    if (totalShips === 0 && otherItems.size === 0) {
        return "No ships, drones, or fighters were found on d-scan.";
    }

    const embed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle('🛰️ D-Scan Analysis')
        .setDescription(`Found a total of **${totalShips}** ships on scan.`)
        .setTimestamp()
        .setFooter({ text: 'RustyBot D-Scan' });

    const sortedCategories = new Map([...categorizedItems.entries()].sort((a, b) => a[0].localeCompare(b[0])));

    // Add a field for each ship category
    sortedCategories.forEach((items, category) => {
        // Sort items within the category by name
        items.sort((a, b) => a.name.localeCompare(b.name));
        const shipList = items.map(item => `${item.count} x ${item.name}`).join('\n');
        embed.addFields({
            name: `🚀 ${category}`,
            value: `\`\`\`\n${shipList}\n\`\`\``,
            inline: true
        });
    });

    // Add a separate field for drones and fighters if any were found
    if (otherItems.size > 0) {
        const sortedOther = new Map([...otherItems.entries()].sort((a, b) => a[0].localeCompare(b[0])));
        const otherList = Array.from(sortedOther.entries()).map(([name, count]) => `${count} x ${name}`).join('\n');
        embed.addFields({
            name: '🐝 Drones & Fighters',
            value: `\`\`\`\n${otherList}\n\`\`\``,
            inline: true
        });
    }

    // --- BUILD RAW TEXT ---
    let rawText = "--- D-Scan Analysis ---\n\n";
    sortedCategories.forEach((items, category) => {
        rawText += `--- ${category} ---\n`;
        items.sort((a, b) => a.name.localeCompare(b.name));
        items.forEach(item => {
            rawText += `${item.count.toString().padStart(3, ' ')} x ${item.name}\n`;
        });
        rawText += '\n';
    });

    if (otherItems.size > 0) {
        rawText += '--- Drones & Fighters ---\n';
        const sortedOther = new Map([...otherItems.entries()].sort((a, b) => a[0].localeCompare(b[0])));
        sortedOther.forEach((count, name) => {
            rawText += `${count.toString().padStart(3, ' ')} x ${name}\n`;
        });
        rawText += '\n';
    }

    rawText += `--- Summary ---\nTotal Ships: ${totalShips}\n`;

    return { embed, rawText };
}

const JITA_SYSTEM_ID = 30000142; // Jita system ID
const JITA_REGION_ID = 10000002; // The Forge Region ID
const PLEX_TYPE_ID = 44992; // Correct Type ID for PLEX
const GLOBAL_PLEX_REGION_ID = 19000001; // New Global PLEX Market Region ID

/**
 * Corporation ID mapping for LP stores - verified working IDs
 * Updated with correct Sisters of EVE corporation
 */
const CORPORATION_IDS = {
    'Sisters of EVE': 1000130,        // REAL Sisters of EVE - confirmed with Fuzzwork
    'Federation Navy': 1000017,       // Federation Navy faction items
    'Republic Fleet': 1000048,        // Minmatar faction items
    'Imperial Navy': 1000051,         // Amarr faction items
    'Caldari Navy': 1000020,          // Caldari faction items
    'Concord': 1000147,               // Intaki Syndicate (offers CONCORD items)
    'Inner Zone Shipping': 1000080,   // Mining/hauling items
    'Ishukone Corporation': 1000045,  // Caldari corporate items
    'Lai Dai Corporation': 1000016,   // Research/tech items
    'Hyasyoda Corporation': 1000115,  // Industrial items
    'ORE': 1000109,                   // Duvolle Laboratories (mining items)
    '24th Imperial Crusade': 1000180, // Amarr faction warfare
    'Federal Defense Union': 1000181, // Gallente faction warfare
    'Tribal Liberation Force': 1000182, // Minmatar faction warfare
    'State Protectorate': 1000183     // Caldari faction warfare
};

// Maps for Type ID and Name lookups from eve-files.com
const eveFilesTypeIDMap = new Map(); // Maps lowercase name -> typeID
const eveFilesIDToNameMap = new Map(); // Maps typeID -> proper name
let isEveFilesTypeIDMapLoaded = false;

/**
 * Loads Type IDs and Names from eve-files.com into in-memory maps.
 * Creates both a name->ID map and an ID->name map for efficient lookups.
 */
async function loadEveFilesTypeIDs() {
    console.log('[loadEveFilesTypeIDs] Starting to load Type IDs from eve-files.com...');
    const typeIdFileUrl = 'https://eve-files.com/chribba/typeid.txt';
    try {
        const response = await axios.get(typeIdFileUrl, {
            headers: { 'User-Agent': USER_AGENT },
            timeout: 30000
        });

        const lines = response.data.split('\n');
        lines.forEach(line => {
            const parts = line.trim().split(' ');
            if (parts.length >= 2) {
                const typeID = parseInt(parts[0], 10);
                const itemName = parts.slice(1).join(' ').trim();
                if (!isNaN(typeID) && itemName) {
                    eveFilesTypeIDMap.set(itemName.toLowerCase(), typeID);
                    eveFilesIDToNameMap.set(typeID, itemName); // Populate the reverse map
                }
            }
        });
        isEveFilesTypeIDMapLoaded = true;
        console.log(`[loadEveFilesTypeIDs] Successfully loaded ${eveFilesTypeIDMap.size} Type IDs and ${eveFilesIDToNameMap.size} ID->Name pairs.`);
    } catch (error) {
        console.error(`[loadEveFilesTypeIDs] Error loading Type IDs from ${typeIdFileUrl}:`, error.message);
    }
}

function getTypeNameByID(typeID) {
    return eveFilesIDToNameMap.get(typeID) || `Item (ID: ${typeID})`;
}

// Enhanced getItemTypeID function with eve-files.com support
async function getEnhancedItemTypeID(itemName) {
    const lowerCaseItemName = itemName.toLowerCase();

    if (isEveFilesTypeIDMapLoaded && eveFilesTypeIDMap.has(lowerCaseItemName)) {
        console.log(`[getEnhancedItemTypeID] eve-files.com Cache HIT for "${itemName}"`);
        return eveFilesTypeIDMap.get(lowerCaseItemName);
    }
    if (typeIDCache.has(lowerCaseItemName)) {
        console.log(`[getEnhancedItemTypeID] Fuzzwork Cache HIT for "${itemName}"`);
        return typeIDCache.get(lowerCaseItemName);
    }

    console.log(`[getEnhancedItemTypeID] Cache MISS for "${itemName}". Fetching from Fuzzwork...`);
    try {
        let cleanItemName = itemName.replace(/[^a-zA-Z0-9\s'-]/g, '').trim();
        if (!cleanItemName) return null;

        const fuzzworkTypeIdUrl = `https://www.fuzzwork.co.uk/api/typeid.php?typename=${encodeURIComponent(cleanItemName)}`;
        const searchRes = await axios.get(fuzzworkTypeIdUrl, {
            headers: { 'User-Agent': USER_AGENT },
            timeout: 5000
        });

        const responseData = searchRes.data;
        let foundTypeID = null;

        if (Array.isArray(responseData)) {
            if (responseData.length > 0) {
                const exactMatch = responseData.find(item => item.typeName.toLowerCase() === lowerCaseItemName);
                foundTypeID = exactMatch ? exactMatch.typeID : responseData[0].typeID;
            }
        } else if (typeof responseData === 'object' && responseData !== null && responseData.typeID) {
            foundTypeID = Number(responseData.typeID);
        }

        if (foundTypeID) {
            console.log(`[getEnhancedItemTypeID] Fuzzwork Success: Found TypeID ${foundTypeID} for "${itemName}"`);
            typeIDCache.set(lowerCaseItemName, foundTypeID);
            return foundTypeID;
        } else {
            console.warn(`[getEnhancedItemTypeID] Fuzzwork Warning: No match found for "${itemName}". Response: ${JSON.stringify(responseData)}`);
            return null;
        }
    } catch (error) {
        console.error(`[getEnhancedItemTypeID] Error fetching TypeID from Fuzzwork for "${itemName}": ${error.message}`);
        return null;
    }
}

async function getLowestSellPrice(typeID) {
    const isPlex = (typeID === PLEX_TYPE_ID);
    const targetRegionId = isPlex ? GLOBAL_PLEX_REGION_ID : JITA_REGION_ID;
    const sellOrdersURL = `https://esi.evetech.net/latest/markets/${targetRegionId}/orders/?datasource=tranquility&order_type=sell&type_id=${typeID}`;

    try {
        const sellOrdersRes = await axios.get(sellOrdersURL, {
            headers: { 'User-Agent': USER_AGENT },
            validateStatus: (status) => status >= 200 && status < 500,
            timeout: 5000
        });

        if (sellOrdersRes.status !== 200) {
            console.error(`[getLowestSellPrice] Error fetching sell orders for typeID ${typeID}. Status: ${sellOrdersRes.status}`);
            return null;
        }

        const sellOrders = sellOrdersRes.data;
        if (sellOrders.length === 0) return null;

        let lowestSellOrder = null;
        if (isPlex) {
            lowestSellOrder = sellOrders.reduce((min, o) => (o.price < min.price ? o : min));
        } else {
            const jitaSellOrders = sellOrders.filter(o => o.system_id === JITA_SYSTEM_ID);
            lowestSellOrder = jitaSellOrders.length > 0 ? jitaSellOrders.reduce((min, o) => (o.price < min.price ? o : min)) : null;
        }

        return lowestSellOrder ? lowestSellOrder.price : null;

    } catch (error) {
        console.error(`[getLowestSellPrice] Error fetching lowest sell price for typeID ${typeID}: ${error.message}`);
        return null;
    }
}

// Helper to build a paginated LP store page (select + nav buttons)
function generateLpPageComponent(sessionId, sessionData) {
    const { offers, currentPage, corpName } = sessionData;
    const itemsPerPage = 25;
    const totalPages = Math.max(1, Math.ceil(offers.length / itemsPerPage));
    const start = currentPage * itemsPerPage;
    const end = start + itemsPerPage;
    const currentItems = offers.slice(start, end);

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`lp_select:${sessionId}`)
        .setPlaceholder(`Page ${currentPage + 1} of ${totalPages} - Select an item...`)
        .addOptions(currentItems.map((offer, idx) => {
            const itemName = getTypeNameByID(offer.type_id) || `Item ID ${offer.type_id}`;
            const truncatedName = itemName.length > 90 ? itemName.substring(0, 87) + '...' : itemName;
            // Make the value unique by appending the absolute index on the page
            const absoluteIdx = start + idx;
            return {
                label: truncatedName,
                description: `${offer.lp_cost.toLocaleString()} LP`.substring(0, 100),
                value: `${offer.type_id}:${absoluteIdx}`
            };
        }));

    const prevButton = new ButtonBuilder()
        .setCustomId(`lp_prev:${sessionId}`)
        .setLabel('Previous')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(currentPage === 0);

    const nextButton = new ButtonBuilder()
        .setCustomId(`lp_next:${sessionId}`)
        .setLabel('Next')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(currentPage >= totalPages - 1);

    const selectRow = new ActionRowBuilder().addComponents(selectMenu);
    const buttonRow = new ActionRowBuilder().addComponents(prevButton, nextButton);

    return {
        content: `**${corpName}** LP Store | **${offers.length}** items found. Page **${currentPage + 1}** of **${totalPages}**.`,
        components: [selectRow, buttonRow]
    };
}

/**
 * Fetches the Corporation ID for a given corporation name.
 * @param {string} corpName - The name of the corporation.
 * @returns {Promise<number|null>} The corporation ID or null if not found.
 */
async function getCorporationID(corpName) {
    console.log(`[getCorporationID] Looking up corporation: "${corpName}"`);
    
    // First, try direct match with our verified corporation IDs
    if (CORPORATION_IDS[corpName]) {
        const corpID = CORPORATION_IDS[corpName];
        console.log(`[getCorporationID] ✅ Direct match found: ${corpName} = ${corpID}`);
        return corpID;
    }
    
    // Try fuzzy matching - check if any corp name contains the search term
    const searchTerm = corpName.toLowerCase();
    for (const [name, id] of Object.entries(CORPORATION_IDS)) {
        if (name.toLowerCase().includes(searchTerm) || searchTerm.includes(name.toLowerCase())) {
            console.log(`[getCorporationID] ✅ Fuzzy match found: "${corpName}" matched "${name}" = ${id}`);
            return id;
        }
    }
    
    console.log(`[getCorporationID] ❌ No match found for "${corpName}"`);
    console.log(`[getCorporationID] Available corporations:`, Object.keys(CORPORATION_IDS).join(', '));
    return null;
}

async function fetchBlueprintCost(productName, channel) {
    await channel.send(`Checking recipe for "${productName}"...`);
    try {
        const productTypeID = await getEnhancedItemTypeID(productName);

        if (!productTypeID) {
            await channel.send(`❌ Could not find an EVE item named "${productName}". Please check the spelling. ❌`);
            return;
        }
        
        if (manufacturingCache.has(productTypeID)) {
             console.log(`[fetchBlueprintCost] Manufacturing cache HIT for ${productName} (ID: ${productTypeID})`);
             const manufacturingData = manufacturingCache.get(productTypeID);
             await calculateAndSendBlueprintCost(productName, manufacturingData, channel);
             return;
        }

        // Try multiple API sources for manufacturing data
        let manufacturingData = null;
        
        // First, try ESI for blueprint information
        try {
            const blueprintTypeId = productTypeID + 1; // Blueprint IDs are typically +1 from product
            const esiUrl = `https://esi.evetech.net/latest/universe/types/${blueprintTypeId}/`;
            console.log(`[fetchBlueprintCost] Trying ESI blueprint data: ${esiUrl}`);
            
            const esiRes = await axios.get(esiUrl, {
                headers: { 'User-Agent': USER_AGENT },
                timeout: 10000
            });
            
            if (esiRes.data && esiRes.data.name && esiRes.data.name.includes('Blueprint')) {
                console.log(`[fetchBlueprintCost] Found blueprint via ESI: ${esiRes.data.name}`);
            }
        } catch (esiError) {
            console.log(`[fetchBlueprintCost] ESI blueprint lookup failed: ${esiError.message}`);
        }
        
        // If we don't have manufacturing data, provide helpful alternative
        if (!manufacturingData) {
            const everefUrl = `https://everef.net/type/${productTypeID}`;
            const msg = `🔧 **Manufacturing data for "${productName}" is currently unavailable.**\n\n` +
                       `📊 **Alternative options:**\n` +
                       `• View detailed info: ${everefUrl}\n` +
                       `• Use market command: \`/market ${productName}\`\n` +
                       `• Check Adam4Eve: https://www.adam4eve.eu/material_influence.php?material=${productTypeID}\n\n` +
                       `⚠️ *Manufacturing data sources are being updated. Try again later or use the links above for detailed blueprint information.*`;
            
            await channel.send(msg);
            return;
        }
        
        manufacturingCache.set(productTypeID, manufacturingData);
        await calculateAndSendBlueprintCost(productName, manufacturingData, channel);

    } catch (error) {
        console.error(`[fetchBlueprintCost] Error for "${productName}": ${error.message}`);
        
        const everefUrl = `https://everef.net/type/${await getEnhancedItemTypeID(productName) || productName}`;
        const msg = `❌ **Unable to fetch manufacturing data for "${productName}"**\n\n` +
                   `🔗 **Try these alternatives:**\n` +
                   `• Detailed item info: ${everefUrl}\n` +
                   `• Market prices: \`/market ${productName}\`\n` +
                   `• Manual blueprint calculator: https://www.adam4eve.eu/\n\n` +
                   `*Manufacturing API is temporarily unavailable.*`;
        
        await channel.send(msg);
    }
}

async function calculateAndSendBlueprintCost(productName, manufacturingData, channel) {
    await channel.send(`Calculating material costs for "${productName}"... This may take a moment.`);

    const materials = manufacturingData.materials;
    const productInfo = manufacturingData.products[0];
    const productTypeID = productInfo.type_id;
    const productQuantity = productInfo.quantity;

    let totalMaterialCost = 0;
    let missingPrices = [];

    const pricePromises = materials.map(async (material) => {
        const price = await getLowestSellPrice(material.type_id);
        if (price !== null) {
            totalMaterialCost += price * material.quantity;
        } else {
            const materialName = getTypeNameByID(material.type_id);
            missingPrices.push(materialName);
            console.warn(`[calculateAndSendBlueprintCost] Missing price for material: ${materialName} (ID: ${material.type_id})`);
        }
    });

    const productSellPricePromise = getLowestSellPrice(productTypeID);
    const [productSellPrice] = await Promise.all([productSellPricePromise, ...pricePromises]);

    const formatIsk = (amount) => parseFloat(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    let message = `Build Cost for ${productName} x${productQuantity}`;
    message += ` — Materials: ${formatIsk(totalMaterialCost)} ISK`;

    if (productSellPrice !== null) {
        const totalSellValue = productSellPrice * productQuantity;
        const profit = totalSellValue - totalMaterialCost;
        const profitSign = profit >= 0 ? '+' : '';
        
        message += ` | Jita Sell: ${formatIsk(totalSellValue)} ISK`;
        message += ` | Profit: ${profitSign}${formatIsk(profit)} ISK`;
    } else {
        message += ` | Jita Sell: (N/A)`;
    }

    if (missingPrices.length > 0) {
        const displayedMissing = missingPrices.length > 3 ? missingPrices.slice(0, 3).join(', ') + '...' : missingPrices.join(', ');
        message += ` (Prices missing for: ${displayedMissing})`;
    }

    await channel.send(message);
}

/**
 * Fetches LP store data, calculates costs and profits, and sends the message.
 * @param {string} corpName - The corporation name for the LP store.
 * @param {string} itemName - The item to look up in the store.
 * @param {Object} channel - The Discord channel to send the message to.
 */
async function fetchLpOffer(corpName, itemName, channel) {
    await channel.send(`Looking up "${itemName}" in the "${corpName}" LP store...`);

    try {
        // Step 1: Get Corporation and Item IDs
        const [corpID, itemTypeID] = await Promise.all([
            getCorporationID(corpName),
            getEnhancedItemTypeID(itemName)
        ]);

        if (!corpID) {
            const commonCorps = [
                "Sisters of EVE", "Federation Navy", "Republic Fleet", 
                "Imperial Navy", "Caldari Navy", "Concord", "Inner Zone Shipping",
                "Ishukone Corporation", "Lai Dai Corporation", "Hyasyoda Corporation"
            ];
            const suggestions = commonCorps.filter(corp => 
                corp.toLowerCase().includes(corpName.toLowerCase()) || 
                corpName.toLowerCase().includes(corp.toLowerCase().split(' ')[0])
            ).slice(0, 3);
            
            let message = `❌ **Could not find corporation "${corpName}"**\n\n`;
            if (suggestions.length > 0) {
                message += `🔍 **Did you mean:**\n${suggestions.map(s => `• ${s}`).join('\n')}\n\n`;
            }
            message += `📋 **Popular LP Corps:** Sisters of EVE, Federation Navy, Republic Fleet, Imperial Navy, Caldari Navy\n`;
            message += `💡 **Tip:** Try using the full corporation name or check your spelling.`;
            
            await channel.send(message);
            return;
        }
        if (!itemTypeID) {
            await channel.send(`❌ Could not find an item named "${itemName}". Please check the spelling. ❌`);
            return;
        }

        // Step 2: Fetch LP Store Offers from ESI
        console.log(`[fetchLpOffer] Looking for item ${itemName} (TypeID: ${itemTypeID}) in corp ${corpName} (ID: ${corpID})`);
        const offersUrl = `https://esi.evetech.net/latest/loyalty/stores/${corpID}/offers/?datasource=tranquility`;
        const offersRes = await axios.get(offersUrl, {
            headers: { 'User-Agent': USER_AGENT },
            timeout: 10000
        });
        
        console.log(`[fetchLpOffer] Found ${offersRes.data.length} offers in ${corpName} LP store`);
        
        const offer = offersRes.data.find(o => o.type_id === itemTypeID);

        if (!offer) {
            console.log(`[fetchLpOffer] Item ${itemTypeID} not found in ${offersRes.data.length} offers for corp ${corpID}`);
            
            // Try to find similar items for suggestions
            const itemNameLower = itemName.toLowerCase();
            const suggestions = [];
            
            // Get names for a few offers to suggest alternatives
            for (let i = 0; i < Math.min(10, offersRes.data.length); i++) {
                const offerTypeId = offersRes.data[i].type_id;
                const offerName = getTypeNameByID(offerTypeId);
                if (offerName && offerName.toLowerCase().includes(itemNameLower.split(' ')[0])) {
                    suggestions.push(offerName);
                }
            }
            
            let message = `❌ **"${itemName}" not found in ${corpName} LP store**\n\n`;
            if (suggestions.length > 0) {
                message += `🔍 **Similar items available:**\n${suggestions.slice(0, 5).map(s => `• ${s}`).join('\n')}\n\n`;
            }
            
            // Add common items for specific corporations
            if (corpName.toLowerCase().includes('sisters')) {
                message += `🎯 **Sisters of EVE LP Store Items:**\n`;
                message += `• Cybernetic implants and augmentations\n`;
                message += `• Medical boosters (Antipharmakon series)\n`;
                message += `• Specialized equipment and modules\n\n`;
                message += `💡 **Try:** "Cybernetic Subprocessor" or "Antipharmakon Iokira"\n\n`;
                message += `📝 **Note:** Sisters faction ships/probes may be in different stores or obtained via other means\n\n`;
            }
            
            message += `📊 **Store has ${offersRes.data.length} total offers**\n`;
            message += `💡 **Try:** Browse LP stores in-game or use exact item names`;
            
            await channel.send(message);
            return;
        }

        // Step 3: Calculate costs and send the final message
        await calculateAndSendLpOfferCost(itemName, offer, channel);

    } catch (error) {
        console.error(`[fetchLpOffer] General error for "${corpName}" / "${itemName}": ${error.message}`);
        await channel.send(`❌ An internal error occurred while fetching LP store data. ❌`);
    }
}

/**
 * Performs the final calculation and formatting for the !lp command.
 * @param {string} itemName - The name of the final product.
 * @param {object} offer - The LP store offer object from ESI.
 * @param {Object} channel - The Discord channel.
 */
// (duplicate listTopLpOffers removed)
async function calculateAndSendLpOfferCost(itemName, offer, channel) {
    await channel.send(`Calculating costs for "${itemName}"... This may take a moment.`);

    let totalMaterialCost = offer.isk_cost;
    let missingPrices = [];

    // Fetch prices for all required items
    const pricePromises = offer.required_items.map(async (material) => {
        const price = await getLowestSellPrice(material.type_id);
        if (price !== null) {
            totalMaterialCost += price * material.quantity;
        } else {
            const materialName = getTypeNameByID(material.type_id);
            missingPrices.push(materialName);
            console.warn(`[calculateAndSendLpOfferCost] Missing price for material: ${materialName} (ID: ${material.type_id})`);
        }
    });

    const productSellPricePromise = getLowestSellPrice(offer.type_id);
    const [productSellPrice] = await Promise.all([productSellPricePromise, ...pricePromises]);
    
    const formatIsk = (amount) => parseFloat(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const formatLp = (amount) => amount.toLocaleString();

    if (productSellPrice === null) {
        await channel.send(`❌ Could not fetch the Jita sell price for "${itemName}", cannot calculate profit. ❌`);
        return;
    }

    const profit = productSellPrice - totalMaterialCost;
    const iskPerLp = profit / offer.lp_cost;

    let message = `${itemName} — Cost: ${formatLp(offer.lp_cost)} LP + ${formatIsk(totalMaterialCost)} ISK`;
    message += ` | Jita Sell: ${formatIsk(productSellPrice)} ISK`;
    message += ` | Profit: ${formatIsk(profit)} ISK`;
    message += ` | Ratio: ${formatIsk(iskPerLp)} ISK/LP`;

    if (missingPrices.length > 0) {
        const displayedMissing = missingPrices.length > 3 ? missingPrices.slice(0, 3).join(', ') + '...' : missingPrices.join(', ');
        message += ` (Prices missing for: ${displayedMissing})`;
    }

    await channel.send(message);
}

// listTopLpOffers removed - replaced by interactive select menu flow

// Load eve-files.com type IDs on startup
loadEveFilesTypeIDs().then(() => {
    console.log("✅ Eve files type ID database loaded successfully");
}).catch(error => {
    console.error("❌ Failed to load Eve files database:", error.message);
});

// Error handling for unhandled promises and exceptions
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('📴 SIGTERM received, shutting down gracefully...');
    client.destroy();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('📴 SIGINT received, shutting down gracefully...');
    client.destroy();
    process.exit(0);
});

// Set the server to listen on the appropriate port
const port = process.env.PORT || 8080;

app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Server is running on port ${port}`);
    console.log(`🤖 Bot: ${client.user ? client.user.tag : 'connecting...'}`);
    console.log(`📊 Health check: http://localhost:${port}/health`);
});