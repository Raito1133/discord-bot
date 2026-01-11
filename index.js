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
const GUILD_ID = '1243470533316579361'; // Your Server ID

// PASTE THE ROLE ID OF THE ADMINS/MODS YOU WANT PINGED IN TICKETS:
const TICKET_SUPPORT_ROLE = '1249714120853553172'; 
// ---------------------------

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // CRITICAL FOR ! COMMANDS
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
  { name: 'me', description: 'Credits' },
  { name: 'userinfo', description: 'Get user info', options: [{ name: 'user', description: 'User', type: 6, required: false }] },
  { name: 'avatar', description: 'Get avatar', options: [{ name: 'user', description: 'User', type: 6, required: false }] },
  {
    name: 'welcome-setup',
    description: 'Setup welcome message',
    options: [
      { name: 'channel', description: 'Channel', type: 7, required: true },
      { name: 'message', description: 'Message', type: 3, required: false },
      { name: 'type', description: 'Style', type: 3, required: false, choices: [{ name: 'Text', value: 'text' }, { name: 'Embed', value: 'embed' }] },
      { name: 'image_url', description: 'Image Link (GIF/PNG) for Embed', type: 3, required: false },
      { name: 'color', description: 'Hex Color (e.g. #FF0000)', type: 3, required: false }
    ],
    default_member_permissions: '8'
  },
  { 
    name: 'leave-setup', 
    description: 'Setup leave message', 
    options: [
        { name: 'channel', description: 'Channel', type: 7, required: true }, 
        { name: 'message', description: 'Message', type: 3, required: false }
    ], 
    default_member_permissions: '8' 
  },
  { 
    name: 'ticketsetup', 
    description: 'Create ticket panel', 
    options: [
        { name: 'channel', description: 'Where to post the panel', type: 7, required: true }, 
        { name: 'category', description: 'Where to open tickets', type: 7, channel_types: [4], required: false }, 
        { name: 'title', description: 'Panel Title', type: 3, required: false },
        { name: 'description', description: 'Panel Description', type: 3, required: false }
    ], 
    default_member_permissions: '8' 
  },
  { 
    name: 'autoreact-setup', 
    description: 'Auto-react setup', 
    options: [
      { name: 'emoji', description: 'Which emoji?', type: 3, required: true },
      { name: 'role', description: 'Optional: Filter by this Role', type: 8, required: false } 
    ], 
    default_member_permissions: '8' 
  },
  { 
    name: 'autorole-setup', 
    description: 'Set auto role', 
    options: [
      { name: 'role', description: 'Role to give new members', type: 8, required: true }
    ], 
    default_member_permissions: '8' 
  },
  { 
    name: 'skullboard-setup', 
    description: 'Skullboard setup', 
    options: [
      { name: 'channel', description: 'Where to log skulls', type: 7, required: true }
    ], 
    default_member_permissions: '8' 
  },
  { 
    name: 'boost-setup', 
    description: 'Set boost announcement', 
    options: [
      { name: 'channel', description: 'Where to announce boosts', type: 7, required: true },
      { name: 'message', description: 'Custom msg (Use {user})', type: 3, required: false }
    ], 
    default_member_permissions: '8' 
  },
  { 
    name: 'reactionrole', 
    description: 'Reaction Role', 
    options: [
      { name: 'role', description: 'Role to give', type: 8, required: true }, 
      { name: 'description', description: 'Message text', type: 3, required: true }, 
      { name: 'emoji', description: 'Emoji to click', type: 3, required: false }
    ], 
    default_member_permissions: '8' 
  }
];

// --- STARTUP ---
client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}`);
  client.user.setActivity('Watching Nocte Server', { type: ActivityType.Listening });
  
  const rest = new REST().setToken(client.token);
  try {
    if (GUILD_ID === 'PASTE_YOUR_SERVER_ID_HERE') {
        console.log('⚠️⚠️ ERROR: YOU FORGOT TO PASTE YOUR SERVER ID AT THE TOP! ⚠️⚠️');
    } else {
        // FORCE REFRESH COMMANDS
        console.log('Refreshing commands...');
        await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), { body: commands });
        console.log('✅ Commands Registered!');
    }
  } catch (error) { console.error('Slash error:', error); }
});

// --- PREFIX HANDLER ---
client.on('messageCreate', async message => {
  if (message.author.bot) return;

  // DEBUG LOG - IF YOU DON'T SEE THIS IN CONSOLE, YOUR INTENTS ARE OFF
  console.log(`📩 Message seen from ${message.author.tag}: ${message.content}`);

  // 1. UWU LOCK
  if (uwuTargets.has(message.author.id)) {
    try {
      await message.delete();
      const uwuText = uwuify(message.content);
      const nickname = message.member ? message.member.displayName : message.author.username;
      await message.channel.send(`**${nickname}**: ${uwuText}`);
      return;
    } catch (e) {}
  }

  // 2. STICKY NOTE
  if (stickyMessages.has(message.channel.id)) {
    const stickyData = stickyMessages.get(message.channel.id);
    if (stickyData.lastMsgId) message.channel.messages.delete(stickyData.lastMsgId).catch(() => {});
    const sentSticky = await message.channel.send(`**reminder**\n${stickyData.content}`);
    stickyData.lastMsgId = sentSticky.id;
    stickyMessages.set(message.channel.id, stickyData);
  }

  // 3. AFK CHECK
  if (message.mentions.users.size > 0) {
    message.mentions.users.forEach(user => {
      if (afkUsers.has(user.id)) {
        const data = afkUsers.get(user.id);
        message.reply(`💤 **${user.username}** is AFK: ${data.reason} (<t:${Math.floor(data.time/1000)}:R>)`);
      }
    });
  }
  if (afkUsers.has(message.author.id)) {
    afkUsers.delete(message.author.id);
    message.reply(`👋 Welcome back **${message.author.username}**! I removed your AFK.`);
  }

  // 4. AUTO REACT
  const config = guildSettings.get(message.guild.id);
  if (config && config.autoReactRoles) {
      message.member.roles.cache.forEach(role => {
          if (config.autoReactRoles.has(role.id)) {
              const emoji = config.autoReactRoles.get(role.id);
              const emojiId = emoji.match(/<a?:.+?:(\d+)>/) ? emoji.match(/<a?:.+?:(\d+)>/)[1] : emoji;
              message.react(emojiId).catch(() => {});
          }
      });
  }

  // 5. COMMAND PARSING
  const serverPrefix = config?.prefix || defaultPrefix;
  if (!message.content.startsWith(serverPrefix)) return;
  const args = message.content.slice(serverPrefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  try {
    if (command === 'ping') return message.reply(`🏓 Pong! ${Math.round(client.ws.ping)}ms`);
    if (command === 'talk') {
        message.delete().catch(()=>{});
        return message.channel.send(args.join(' ') || 'What?');
    }
    if (command === 'autoreact') {
        if(!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;
        const role = message.mentions.roles.first();
        const emoji = args[1];
        if (!role || !emoji) return message.reply('Usage: !autoreact @Role <Emoji>');
        
        const cfg = guildSettings.get(message.guild.id) || {};
        if (!cfg.autoReactRoles) cfg.autoReactRoles = new Map();
        cfg.autoReactRoles.set(role.id, emoji);
        guildSettings.set(message.guild.id, cfg);
        return message.reply(`✅ Auto-react set! Users with **${role.name}** will get ${emoji} reactions.`);
    }
    if (command === 'ban') {
        if(!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;
        const target = message.mentions.members.first();
        if(target) { await target.ban(); message.reply('Banned.'); }
    }
    if (command === 'kick') {
        if(!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;
        const target = message.mentions.members.first();
        if(target) { await target.kick(); message.reply('Kicked.'); }
    }
    if (command === 'help') {
        const embed = new EmbedBuilder().setTitle('Help').setDescription('Use `/` commands for full list.').setColor(0x00AAFF);
        message.reply({embeds:[embed]});
    }
    if (command === 'userinfo') {
        const member = message.mentions.members.first() || message.member;
        const embed = new EmbedBuilder().setTitle(`User: ${member.user.tag}`).addFields({name:'Joined', value: `<t:${Math.floor(member.joinedTimestamp/1000)}:R>`}).setColor(0x00AAFF);
        message.reply({embeds:[embed]});
    }
  } catch (e) { console.error('Prefix Error:', e); }
});

// --- SLASH COMMAND HANDLER ---
client.on('interactionCreate', async interaction => {
  // BUTTONS & MODALS FIRST
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
    if (interaction.customId === 'create_ticket') {
        const chName = `ticket-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '');
        if (interaction.guild.channels.cache.find(c => c.name === chName)) {
            return interaction.reply({ content: `❌ You already have a ticket!`, ephemeral: true });
        }
        const modal = new ModalBuilder().setCustomId('ticket_modal').setTitle('Open Ticket');
        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ticket_subject').setLabel('Subject').setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ticket_desc').setLabel('Description').setStyle(TextInputStyle.Paragraph).setRequired(true))
        );
        await interaction.showModal(modal);
    }
    if (interaction.customId === 'close_ticket') {
        interaction.reply('🔒 Closing...');
        setTimeout(() => interaction.channel.delete(), 3000);
    }
    return;
  }

  if (interaction.isModalSubmit() && interaction.customId === 'ticket_modal') {
    await interaction.deferReply({ ephemeral: true });
    const subject = interaction.fields.getTextInputValue('ticket_subject');
    const desc = interaction.fields.getTextInputValue('ticket_desc');
    const chName = `ticket-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '');
    const config = guildSettings.get(interaction.guild.id) || {};
    
    try {
        const ch = await interaction.guild.channels.create({
            name: chName, type: ChannelType.GuildText, parent: config.ticketCategory,
            permissionOverwrites: [{id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel]}, {id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel]}]
        });
        const embed = new EmbedBuilder().setTitle(`Ticket: ${subject}`).setDescription(`**User:** ${interaction.user}\n**Desc:** ${desc}`).setColor(0x0099FF);
        const btn = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('close_ticket').setLabel('Close').setStyle(ButtonStyle.Danger).setEmoji('🔒'));
        let mentions = `${interaction.user}`;
        if(TICKET_SUPPORT_ROLE) mentions += ` <@&${TICKET_SUPPORT_ROLE}>`;
        await ch.send({content: `🔔 ${mentions}`, embeds:[embed], components:[btn]});
        interaction.editReply(`✅ Created ${ch}`);
    } catch(e) { interaction.editReply('❌ Error creating ticket.'); }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  // --- SLASH COMMAND LOGIC START ---
  
  try {
    const { commandName, options } = interaction;

    // === CRITICAL FIX: PURGE MUST BE EPHEMERAL TO PREVENT CRASH ===
    if (commandName === 'purge') {
        await interaction.deferReply({ ephemeral: true }); 
        const amt = options.getInteger('amount');
        if (amt > 100) return interaction.editReply('❌ Max 100 messages.');
        
        await interaction.channel.bulkDelete(amt, true).catch(err => {
             console.error("Purge error", err);
             return interaction.editReply("❌ Could not delete messages (too old?).");
        });
        
        return interaction.editReply(`🗑️ Deleted ${amt} messages.`);
    }

    // --- FOR ALL OTHER COMMANDS, STANDARD DEFER ---
    await interaction.deferReply({ ephemeral: false });

    if (commandName === 'ping') {
        interaction.editReply(`🏓 Pong! ${Math.round(client.ws.ping)}ms`);
    }
    else if (commandName === 'talk') {
        const msg = options.getString('message');
        const ch = options.getChannel('channel') || interaction.channel;
        await ch.send(msg);
        interaction.editReply('✅ Sent.');
    }
    else if (commandName === 'ban') {
        const user = options.getMember('user');
        const reason = options.getString('reason') || 'None';
        if (!user.bannable) return interaction.editReply('❌ I cannot ban them.');
        await user.ban({ reason });
        interaction.editReply(`✅ Banned **${user.user.tag}**`);
    }
    else if (commandName === 'kick') {
        const user = options.getMember('user');
        const reason = options.getString('reason') || 'None';
        if (!user.kickable) return interaction.editReply('❌ I cannot kick them.');
        await user.kick(reason);
        interaction.editReply(`✅ Kicked **${user.user.tag}**`);
    }
    else if (commandName === 'mute') {
        const user = options.getMember('user');
        const dStr = options.getString('duration');
        const role = interaction.guild.roles.cache.find(r=>r.name==='Muted');
        if(!role) return interaction.editReply('❌ "Muted" role missing.');
        await user.roles.add(role);
        interaction.editReply(`🤐 Muted **${user.user.tag}**`);
        const ms = parseDuration(dStr);
        if(ms) setTimeout(()=> user.roles.remove(role).catch(()=>{}), ms);
    }
    else if (commandName === 'unmute') {
        const user = options.getMember('user');
        const role = interaction.guild.roles.cache.find(r=>r.name==='Muted');
        await user.roles.remove(role);
        interaction.editReply(`🗣️ Unmuted.`);
    }
    else if (commandName === 'lock') {
        await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false });
        interaction.editReply('🔒 Locked.');
    }
    else if (commandName === 'unlock') {
        await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: null });
        interaction.editReply('🔓 Unlocked.');
    }
    else if (commandName === 'deafen') {
        const user = options.getMember('user');
        if(!user.voice.channel) return interaction.editReply('❌ User not in voice.');
        await user.voice.setDeaf(true);
        interaction.editReply(`🔇 Deafened ${user.user.tag}.`);
    }
    else if (commandName === 'undeafen') {
        const user = options.getMember('user');
        if(!user.voice.channel) return interaction.editReply('❌ User not in voice.');
        await user.voice.setDeaf(false);
        interaction.editReply(`🔊 Undeafened ${user.user.tag}.`);
    }
    else if (commandName === 'uwulock') {
        const target = interaction.options.getUser('user');
        uwuTargets.add(target.id);
        interaction.editReply(`🌸 **${target.username}** is now UwU locked!`);
    }
    else if (commandName === 'uwuunlock') {
        const target = interaction.options.getUser('user');
        uwuTargets.delete(target.id);
        interaction.editReply(`🛑 **${target.username}** is free.`);
    }
    else if (commandName === 'stick') {
        const text = interaction.options.getString('message');
        const sent = await interaction.channel.send(`**reminder**\n${text}`);
        stickyMessages.set(interaction.channelId, { content: text, lastMsgId: sent.id });
        interaction.editReply({content: '✅ Message stuck!', ephemeral: true});
    }
    else if (commandName === 'unstick') {
        if (stickyMessages.has(interaction.channelId)) {
            const d = stickyMessages.get(interaction.channelId);
            interaction.channel.messages.delete(d.lastMsgId).catch(()=>{});
            stickyMessages.delete(interaction.channelId);
            interaction.editReply('✅ Reminder removed.');
        } else {
            interaction.editReply('❌ No sticky message here.');
        }
    }
    else if (commandName === 'afk') {
        const reason = interaction.options.getString('reason') || 'No reason';
        afkUsers.set(interaction.user.id, { reason, time: Date.now() });
        interaction.editReply(`💤 AFK set: ${reason}`);
    }
    else if (commandName === 'snipe') {
        const snipedMsg = snipes.get(interaction.channelId);
        if (!snipedMsg) return interaction.editReply('❌ Nothing to snipe!');
        const embed = new EmbedBuilder().setAuthor({ name: snipedMsg.author.tag, iconURL: snipedMsg.author.displayAvatarURL() }).setDescription(snipedMsg.content || '*(Image)*').setColor(0xFF0000).setFooter({text:'Deleted recently'});
        if(snipedMsg.image) embed.setImage(snipedMsg.image);
        interaction.editReply({ embeds: [embed] });
    }
    else if (commandName === 'userinfo') {
        const user = options.getMember('user') || interaction.member;
        const embed = new EmbedBuilder().setTitle(`User: ${user.user.tag}`).addFields({name:'Joined', value:`<t:${Math.floor(user.joinedTimestamp/1000)}:R>`}).setColor(0x00AAFF);
        interaction.editReply({embeds:[embed]});
    }
    else if (commandName === 'avatar') {
        const user = options.getUser('user') || interaction.user;
        const embed = new EmbedBuilder().setImage(user.displayAvatarURL({dynamic:true, size:1024})).setColor(0x00AAFF);
        interaction.editReply({embeds:[embed]});
    }
    else if (commandName === 'help') {
        const embed = new EmbedBuilder().setTitle('Help').setDescription('Commands active.').setColor(0x00AAFF);
        interaction.editReply({embeds:[embed]});
    }
    // ... setups ...
    else if (commandName === 'ticketsetup') {
        const ch = options.getChannel('channel');
        const title = options.getString('title') || 'Support';
        const desc = options.getString('description') || 'Open a ticket';
        const cfg = guildSettings.get(interaction.guildId) || {};
        if(options.getChannel('category')) cfg.ticketCategory = options.getChannel('category').id;
        guildSettings.set(interaction.guildId, cfg);
        const embed = new EmbedBuilder().setTitle(title).setDescription(desc).setColor(0x2F3136);
        const btn = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('create_ticket').setLabel('Open Ticket').setStyle(ButtonStyle.Secondary).setEmoji('📩'));
        await ch.send({embeds:[embed], components:[btn]});
        interaction.editReply('✅ Setup done.');
    }
    else if (commandName === 'autoreact-setup') {
        const emoji = options.getString('emoji');
        const role = options.getRole('role');
        const cfg = guildSettings.get(interaction.guildId) || {};
        if (!cfg.autoReactRoles) cfg.autoReactRoles = new Map();
        cfg.autoReactRoles.set(role.id, emoji);
        guildSettings.set(interaction.guildId, cfg);
        interaction.editReply(`✅ React setup for **${role.name}**`);
    }
    else if (commandName === 'autorole-setup') {
        const role = options.getRole('role');
        const cfg = guildSettings.get(interaction.guildId) || {};
        cfg.autoRoleId = role.id;
        guildSettings.set(interaction.guildId, cfg);
        interaction.editReply(`✅ Auto role: **${role.name}**`);
    }
    else if (commandName === 'welcome-setup') {
        const ch = options.getChannel('channel');
        const cfg = guildSettings.get(interaction.guildId) || {};
        cfg.welcomeChannelId = ch.id;
        cfg.welcomeMessage = options.getString('message');
        cfg.welcomeType = options.getString('type');
        cfg.welcomeImage = options.getString('image_url');
        cfg.welcomeColor = options.getString('color');
        guildSettings.set(interaction.guildId, cfg);
        interaction.editReply('✅ Welcome set.');
    }
    else if (commandName === 'leave-setup') {
        const ch = options.getChannel('channel');
        const cfg = guildSettings.get(interaction.guildId) || {};
        cfg.leaveChannelId = ch.id;
        cfg.leaveMessage = options.getString('message');
        guildSettings.set(interaction.guildId, cfg);
        interaction.editReply('✅ Leave set.');
    }
    else if (commandName === 'boost-setup') {
        const ch = options.getChannel('channel');
        const cfg = guildSettings.get(interaction.guildId) || {};
        cfg.boostChannelId = ch.id;
        cfg.boostMessage = options.getString('message');
        guildSettings.set(interaction.guildId, cfg);
        interaction.editReply('✅ Boost set.');
    }
    else if (commandName === 'skullboard-setup') {
        const ch = options.getChannel('channel');
        const cfg = guildSettings.get(interaction.guildId) || {};
        cfg.skullboardId = ch.id;
        guildSettings.set(interaction.guildId, cfg);
        interaction.editReply('✅ Skullboard set.');
    }
    else if (commandName === 'reactionrole') {
        const role = options.getRole('role');
        const desc = options.getString('description');
        const emoji = options.getString('emoji');
        const embed = new EmbedBuilder().setTitle('Get Role').setDescription(desc).setColor(role.color || 0x0099FF);
        const btn = new ButtonBuilder().setCustomId(`rr_${role.id}`).setLabel(role.name).setStyle(ButtonStyle.Primary);
        if (emoji) btn.setEmoji(emoji);
        await interaction.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(btn)] });
        interaction.editReply('✅ Reaction role created!');
    }
    else {
        interaction.editReply('⚠️ Command not fully implemented yet.');
    }

  } catch (err) { 
      console.error(err); 
      interaction.editReply('❌ An error occurred: ' + err.message).catch(()=>{});
  }
});

// --- MEMBER EVENTS ---
client.on('guildMemberAdd', async member => {
  const config = guildSettings.get(member.guild.id);
  if (!config) return;
  if (config.autoRoleId) {
     const role = member.guild.roles.cache.get(config.autoRoleId);
     if (role) await member.roles.add(role).catch(console.error);
  }
  if (config.welcomeChannelId) {
    const ch = member.guild.channels.cache.get(config.welcomeChannelId);
    if (ch) {
        let msgText = (config.welcomeMessage || 'Welcome {user}!').replace(/{user}/g, member.toString()).replace(/{server}/g, member.guild.name).replace(/{count}/g, member.guild.memberCount);
        if (config.welcomeType === 'embed') {
            const embed = new EmbedBuilder().setTitle(`Welcome`).setDescription(msgText).setThumbnail(member.user.displayAvatarURL()).setColor(config.welcomeColor || 0x00FF00);
            if (config.welcomeImage) embed.setImage(config.welcomeImage);
            ch.send({ content: member.toString(), embeds: [embed] });
        } else { ch.send(msgText); }
    }
  }
});

client.on('guildMemberRemove', async member => {
  const config = guildSettings.get(member.guild.id);
  if (config && config.leaveChannelId) {
    const ch = member.guild.channels.cache.get(config.leaveChannelId);
    if(ch) ch.send((config.leaveMessage||'Bye {user}').replace(/{user}/g, member.user.tag).replace(/{count}/g, member.guild.memberCount));
  }
});

client.on('guildMemberUpdate', (oldMember, newMember) => {
    const config = guildSettings.get(newMember.guild.id);
    if (!config || !config.boostChannelId) return;
    if (!oldMember.premiumSince && newMember.premiumSince) {
        const ch = newMember.guild.channels.cache.get(config.boostChannelId);
        if (ch) ch.send((config.boostMessage || "{user} boosted!").replace(/{user}/g, newMember.toString()));
    }
});

// --- ANTI-CRASH SYSTEM (KEEPS BOT ALIVE) ---
process.on('unhandledRejection', (reason, p) => {
    console.log(' [Anti-Crash] :: Unhandled Rejection/Catch');
    console.log(reason, p);
});
process.on('uncaughtException', (err, origin) => {
    console.log(' [Anti-Crash] :: Uncaught Exception/Catch');
    console.log(err, origin);
});
process.on('uncaughtExceptionMonitor', (err, origin) => {
    console.log(' [Anti-Crash] :: Uncaught Exception/Catch (MONITOR)');
    console.log(err, origin);
});

console.log('Starting bot, trying to login...');
client.login(process.env.TOKEN);
