const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  PermissionsBitField,
  REST,
  Routes,
  Events,
  ActivityType,
  ButtonBuilder,    
  ActionRowBuilder,
  ButtonStyle,      
  ChannelType,
  ModalBuilder,     
  TextInputBuilder,  
  TextInputStyle,
  Partials
} = require('discord.js');

// --- ⚠️ CONFIGURATION ⚠️ ---
const GUILD_ID = '1371775026264670228'; // Your Single Server ID Only

// --- MULTIPLE SUPPORT ROLES FOR 3 PANELS ---
const ULTRA_SUPPORT_ROLE = '1529499021884919858';
const FARM_SUPPORT_ROLE = '1529499059596038285';
const CONCERN_SUPPORT_ROLE = '1529498802149392614';
// ---------------------------

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildPresences
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

const defaultPrefix = '!';

// --- DATA STORAGE ---
const guildSettings = new Map();
const snipes = new Map();
const skullboardCache = new Set();
const afkUsers = new Map();
const uwuTargets = new Set();
const stickyMessages = new Map();

// --- HELPER: TIME PARSER ---
function parseDuration(str) {
  if (!str) return null;
  const unit = str.slice(-1);
  const value = parseInt(str.slice(0, -1));
  if (isNaN(value)) return null;
  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return null;
  }
}

// --- HELPER: UWU TRANSLATOR ---
function uwuify(text) {
  const faces = ['(・`ω´・)', ';;w;;', 'owo', 'UwU', '>w<', '^w^'];
  text = text.replace(/(?:r|l)/g, 'w').replace(/(?:R|L)/g, 'W').replace(/n([aeiou])/g, 'ny$1').replace(/N([aeiou])/g, 'Ny$1').replace(/N([AEIOU])/g, 'Ny$1').replace(/ove/g, 'uv').replace(/!+/g, ' ' + faces[Math.floor(Math.random() * faces.length)] + ' ');
  return text;
}

// --- SLASH COMMAND DEFINITIONS ---
const commands = [
  { name: 'ping', description: 'Check bot latency' }, 
  {
    name: 'talk',
    description: 'Make the bot say something',
    options: [
      { name: 'message', description: 'What should I say?', type: 3, required: true },
      { name: 'channel', description: 'Where? (Optional)', type: 7, required: false }
    ],
    default_member_permissions: '8'
  },
  { name: 'me', description: 'Credits' },
  {
    name: 'embed',
    description: 'Create a custom embedded message',
    options: [
      { name: 'title', description: 'Title of the embed', type: 3, required: false },
      { name: 'description', description: 'Main text', type: 3, required: false },
      { name: 'color', description: 'Hex Color (e.g. #FF0000)', type: 3, required: false },
      { name: 'image', description: 'Image URL', type: 3, required: false },
      { name: 'thumbnail', description: 'Thumbnail URL', type: 3, required: false },
      { name: 'footer', description: 'Footer text', type: 3, required: false },
      { name: 'channel', description: 'Where to send it?', type: 7, required: false }
    ],
    default_member_permissions: '8'
  },
  { name: 'mute', description: 'Mute user', options: [{ name: 'user', description: 'User', type: 6, required: true }, { name: 'duration', description: 'e.g. 10s, 5m', type: 3, required: false }], default_member_permissions: '8' },
  { name: 'unmute', description: 'Unmute user', options: [{ name: 'user', description: 'User', type: 6, required: true }], default_member_permissions: '8' },
  { name: 'ban', description: 'Ban user', options: [{ name: 'user', description: 'User', type: 6, required: true }, { name: 'reason', description: 'Reason', type: 3, required: false }], default_member_permissions: '8' },
  { name: 'kick', description: 'Kick user', options: [{ name: 'user', description: 'User', type: 6, required: true }, { name: 'reason', description: 'Reason', type: 3, required: false }], default_member_permissions: '8' },
  { name: 'purge', description: 'Delete messages', options: [{ name: 'amount', description: 'Amount', type: 4, required: true }], default_member_permissions: '8' },
  { name: 'lock', description: 'Lock channel', default_member_permissions: '8' },
  { name: 'unlock', description: 'Unlock channel', default_member_permissions: '8' },
  { name: 'deafen', description: 'Deafen user', options: [{ name: 'user', description: 'User', type: 6, required: true }], default_member_permissions: '8' },
  { name: 'undeafen', description: 'Undeafen user', options: [{ name: 'user', description: 'User', type: 6, required: true }], default_member_permissions: '8' },
  { name: 'setprefix', description: 'Change prefix', options: [{ name: 'new_prefix', description: 'Symbol', type: 3, required: true }], default_member_permissions: '8' },
  { name: 'uwulock', description: 'Force a user to speak UwU', options: [{ name: 'user', description: 'User to lock', type: 6, required: true }], default_member_permissions: '8' },
  { name: 'uwuunlock', description: 'Free a user from UwU', options: [{ name: 'user', description: 'User to unlock', type: 6, required: true }], default_member_permissions: '8' },
  { name: 'stick', description: 'Create a reminder', options: [{ name: 'message', description: 'Text', type: 3, required: true }], default_member_permissions: '8' },
  { name: 'unstick', description: 'Remove reminder', default_member_permissions: '8' },
  { name: 'afk', description: 'Set status to AFK', options: [{ name: 'reason', description: 'Reason', type: 3, required: false }] },
  { name: 'snipe', description: 'Show last deleted msg' },
  { name: 'help', description: 'Show commands' },
  { name: 'userinfo', description: 'Get user info', options: [{ name: 'user', description: 'User', type: 6, required: false }] },
  { name: 'avatar', description: 'Get avatar', options: [{ name: 'user', description: 'User', type: 6, required: false }] },
  { name: 'welcome-setup', description: 'Setup welcome message', options: [{ name: 'channel', description: 'Channel', type: 7, required: true }, { name: 'message', description: 'Message', type: 3, required: false }, { name: 'type', description: 'Style', type: 3, required: false, choices: [{ name: 'Text', value: 'text' }, { name: 'Embed', value: 'embed' }] }, { name: 'image_url', description: 'Image Link (GIF/PNG) for Embed', type: 3, required: false }, { name: 'color', description: 'Hex Color (e.g. #FF0000)', type: 3, required: false }], default_member_permissions: '8' },
  { name: 'leave-setup', description: 'Setup leave message', options: [{ name: 'channel', description: 'Channel', type: 7, required: true }, { name: 'message', description: 'Message', type: 3, required: false }], default_member_permissions: '8' },
  { 
    name: 'ticketsetup', 
    description: 'Create a specific ticket panel', 
    options: [
      { name: 'type', description: 'Which ticket panel?', type: 3, required: true, choices: [
        { name: 'Ultra Help', value: 'ultra' },
        { name: 'Farm Help', value: 'farm' },
        { name: 'Concern', value: 'concern' }
      ]},
      { name: 'channel', description: 'Where to post the panel', type: 7, required: true }, 
      { name: 'category', description: 'Where to open tickets', type: 7, channel_types: [4], required: false }, 
      { name: 'title', description: 'Panel Title', type: 3, required: false }, 
      { name: 'description', description: 'Panel Description', type: 3, required: false }
    ], 
    default_member_permissions: '8' 
  },
  { name: 'autoreact-setup', description: 'Auto-react setup', options: [{ name: 'emoji', description: 'Which emoji?', type: 3, required: true }, { name: 'role', description: 'Optional: Filter by this Role', type: 8, required: false }], default_member_permissions: '8' },
  { name: 'autorole-setup', description: 'Set auto role', options: [{ name: 'role', description: 'Role to give new members', type: 8, required: true }], default_member_permissions: '8' },
  { name: 'skullboard-setup', description: 'Skullboard setup', options: [{ name: 'channel', description: 'Where to log skulls', type: 7, required: true }], default_member_permissions: '8' },
  { name: 'boost-setup', description: 'Set boost announcement', options: [{ name: 'channel', description: 'Where to announce boosts', type: 7, required: true }, { name: 'message', description: 'Custom msg (Use {user})', type: 3, required: false }], default_member_permissions: '8' },
  { name: 'reactionrole', description: 'Reaction Role', options: [{ name: 'role', description: 'Role to give', type: 8, required: true }, { name: 'description', description: 'Message text', type: 3, required: true }, { name: 'emoji', description: 'Emoji to click', type: 3, required: false }], default_member_permissions: '8' }
];

// --- STARTUP (SINGLE SERVER RESTRICTED) ---
client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}`);
  client.user.setActivity('Watching Nocte Server', { type: ActivityType.Listening });
  const rest = new REST().setToken(client.token);
  
  try {
    if (GUILD_ID === 'PASTE_YOUR_SERVER_ID_HERE') {
      console.log('⚠️ ERROR: YOU FORGOT TO PASTE YOUR SERVER ID AT THE TOP!');
    } else {
      console.log('Clearing global commands to prevent duplication...');
      await rest.put(Routes.applicationCommands(client.user.id), { body: [] });

      console.log('Registering commands exclusively to your target server...');
      await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), { body: commands });
      console.log('✅ Commands successfully locked to your single server!');
    }
  } catch (error) { console.error('Slash error:', error); }
});

// --- PREFIX HANDLER (!) ---
client.on('messageCreate', async message => {
  if (message.author.bot || !message.guild) return;
  if (message.guild.id !== GUILD_ID) return; // Strict single server safety lock

  if (uwuTargets.has(message.author.id)) {
    try {
      await message.delete();
      const uwuText = uwuify(message.content);
      const nickname = message.member ? message.member.displayName : message.author.username;
      await message.channel.send(`**${nickname}**: ${uwuText}`);
      return;
    } catch (e) {}
  }

  if (stickyMessages.has(message.channel.id)) {
    const stickyData = stickyMessages.get(message.channel.id);
    if (stickyData.lastMsgId) message.channel.messages.delete(stickyData.lastMsgId).catch(() => {});
    const sentSticky = await message.channel.send(`**reminder**\n${stickyData.content}`);
    stickyData.lastMsgId = sentSticky.id;
    stickyMessages.set(message.channel.id, stickyData);
  }

  if (message.mentions.users.size > 0) {
    message.mentions.users.forEach(user => {
      if (afkUsers.has(user.id)) {
        message.reply(`💤 **${user.username}** is AFK: ${afkUsers.get(user.id).reason}`);
      }
    });
  }
  if (afkUsers.has(message.author.id)) {
    afkUsers.delete(message.author.id);
    message.reply(`👋 Welcome back **${message.author.username}**! AFK removed.`);
  }

  const config = guildSettings.get(message.guild.id);
  const serverPrefix = config?.prefix || defaultPrefix;
  if (!message.content.startsWith(serverPrefix)) return;
  const args = message.content.slice(serverPrefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  try {
    if (command === 'ping') return message.reply(`🏓 Pong! ${Math.round(client.ws.ping)}ms`);
    if (command === 'help') {
        const embed = new EmbedBuilder().setTitle('📜 Bot Command Manual').setColor(0x00AAFF).setDescription(`**Prefix:** \`${serverPrefix}\``);
        message.reply({embeds:[embed]});
    }
  } catch (e) { console.error('Prefix Error:', e); }
});

// --- INTERACTION HANDLER ---
client.on('interactionCreate', async interaction => {
  if (!interaction.guild || interaction.guild.id !== GUILD_ID) return; // Strict single server lock

  // BUTTONS
  if (interaction.isButton()) {
    if (interaction.customId.startsWith('rr_')) {
        const roleId = interaction.customId.split('_')[1];
        const role = interaction.guild.roles.cache.get(roleId);
        if (!role) return interaction.reply({content:'Role deleted?', ephemeral:true});
        if(interaction.member.roles.cache.has(roleId)) {
            await interaction.member.roles.remove(roleId);
            return interaction.reply({content:`➖ Removed **${role.name}**`, ephemeral:true});
        } else {
            await interaction.member.roles.add(roleId);
            return interaction.reply({content:`➕ Added **${role.name}**`, ephemeral:true});
        }
    }

    // TICKET BUTTON CLICKS
    if (['ticket_ultra', 'ticket_farm', 'ticket_concern'].includes(interaction.customId)) {
        const type = interaction.customId.replace('ticket_', '');
        const chName = `${type}-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '');
        if (interaction.guild.channels.cache.find(c => c.name === chName)) {
            return interaction.reply({ content: `❌ You already have an active ${type} ticket!`, ephemeral: true });
        }
        const modal = new ModalBuilder().setCustomId(`modal_${type}`).setTitle(`Open ${type.toUpperCase()} Ticket`);
        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ticket_subject').setLabel('Subject').setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ticket_desc').setLabel('Description').setStyle(TextInputStyle.Paragraph).setRequired(true))
        );
        await interaction.showModal(modal);
    }

    if (interaction.customId === 'close_ticket') {
        await interaction.reply('🔒 Closing ticket...');
        setTimeout(() => interaction.channel.delete().catch(()=>{}), 3000);
    }
    return;
  }

  // MODAL SUBMISSIONS FOR THE 3 PANELS
  if (interaction.isModalSubmit() && interaction.customId.startsWith('modal_')) {
    await interaction.deferReply({ ephemeral: true });
    const type = interaction.customId.replace('modal_', '');
    const subject = interaction.fields.getTextInputValue('ticket_subject');
    const desc = interaction.fields.getTextInputValue('ticket_desc');
    const chName = `${type}-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '');
    const config = guildSettings.get(interaction.guild.id) || {};
    
    try {
        const ch = await interaction.guild.channels.create({
            name: chName, 
            type: ChannelType.GuildText, 
            parent: config[`${type}Category`] || config.ticketCategory,
            permissionOverwrites: [
              { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] }, 
              { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel] }
            ]
        });

        const embed = new EmbedBuilder().setTitle(`Ticket (${type.toUpperCase()}): ${subject}`).setDescription(`**User:** ${interaction.user}\n**Desc:** ${desc}`).setColor(0x0099FF);
        const btn = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('close_ticket').setLabel('Close').setStyle(ButtonStyle.Danger).setEmoji('🔒'));
        
        let mentions = `${interaction.user}`;
        if (type === 'ultra' && ULTRA_SUPPORT_ROLE) mentions += ` <@&${ULTRA_SUPPORT_ROLE}>`;
        if (type === 'farm' && FARM_SUPPORT_ROLE) mentions += ` <@&${FARM_SUPPORT_ROLE}>`;
        if (type === 'concern' && CONCERN_SUPPORT_ROLE) mentions += ` <@&${CONCERN_SUPPORT_ROLE}>`;

        await ch.send({content: `🔔 ${mentions}`, embeds:[embed], components:[btn]});
        interaction.editReply(`✅ Created your ticket: ${ch}`);
    } catch(e) { 
        interaction.editReply('❌ Error creating ticket channel.'); 
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  try {
    const { commandName, options } = interaction;
    await interaction.deferReply({ ephemeral: true });

    if (commandName === 'ping') interaction.editReply(`🏓 Pong! ${Math.round(client.ws.ping)}ms`);
    
    // --- TICKET SETUP FOR 3 INDEPENDENT PANELS ---
    else if (commandName === 'ticketsetup') {
        const panelType = options.getString('type'); // ultra, farm, concern
        const title = options.getString('title') || `${panelType.toUpperCase()} Support`;
        const desc = options.getString('description') || `Click below to open a ${panelType} ticket.`;
        const channel = options.getChannel('channel');
        const category = options.getChannel('category');

        const cfg = guildSettings.get(interaction.guildId) || {};
        if (category) cfg[`${panelType}Category`] = category.id;
        guildSettings.set(interaction.guildId, cfg);

        const embed = new EmbedBuilder().setTitle(title).setDescription(desc).setColor(0x2F3136);
        const btn = new ButtonBuilder()
          .setCustomId(`ticket_${panelType}`)
          .setLabel(`Open ${panelType.charAt(0).toUpperCase() + panelType.slice(1)} Ticket`)
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('📩');

        await channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(btn)] });
        interaction.editReply(`✅ Successfully created the **${panelType}** ticket panel in ${channel}!`);
    }
    else {
        interaction.editReply('⚠️ Command not fully matched.');
    }
  } catch (err) { interaction.editReply('❌ Error: ' + err.message).catch(()=>{}); }
});

// --- CRASH PREVENTION ---
process.on('unhandledRejection', (reason, p) => console.log('Anti-Crash: ', reason));
process.on('uncaughtException', (err, origin) => console.log('Anti-Crash: ', err));

// --- LOGIN ---
console.log('Starting bot, trying to login...');
client.login(process.env.DISCORD_TOKEN);
