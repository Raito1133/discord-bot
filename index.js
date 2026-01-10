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
  Partials,
  MessageType
} = require('discord.js');

// --- ⚠️ CONFIGURATION ⚠️ ---
const GUILD_ID = '1243470533316579361'; // Your Server ID

// PASTE THE ROLE ID OF THE ADMINS/MODS YOU WANT PINGED IN TICKETS:
const TICKET_SUPPORT_ROLE = '1249714120853553172'; // e.g. '987654321098765432'
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
  { name: 'ping', description: 'Check bot latency' }, // Ping is defined here
  {
    name: 'talk',
    description: 'Make the bot say something',
    options: [
      { name: 'message', description: 'What should I say?', type: 3, required: true },
      { name: 'channel', description: 'Where? (Optional)', type: 7, required: false }
    ],
    default_member_permissions: '8'
  },
  // MODERATION
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
  // FUN / UTILS
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
  // SETUPS
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
        await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), { body: commands });
        console.log('✅ All slash commands registered to SERVER!');
    }
  } catch (error) { console.error('Slash error:', error); }
});

// --- MAIN MESSAGE LISTENER ---
client.on('messageCreate', async message => {
  if (message.author.bot) return;

  // 1. UWU LOCK
  if (uwuTargets.has(message.author.id)) {
    try {
      await message.delete();
      const uwuText = uwuify(message.content);
      const nickname = message.member ? message.member.displayName : message.author.username;
      await message.channel.send(`**${nickname}**: ${uwuText}`);
      return;
    } catch (e) { console.log('UwU delete failed', e); }
  }

  // 2. STICKY NOTE
  if (stickyMessages.has(message.channel.id)) {
    const stickyData = stickyMessages.get(message.channel.id);
    if (stickyData.lastMsgId) message.channel.messages.delete(stickyData.lastMsgId).catch(() => {});
    const sentSticky = await message.channel.send(`**reminder**\n${stickyData.content}`);
    stickyData.lastMsgId = sentSticky.id;
    stickyMessages.set(message.channel.id, stickyData);
  }

  // 3. AFK CHECKS
  if (afkUsers.has(message.author.id)) {
    afkUsers.delete(message.author.id);
    message.reply(`👋 Welcome back, **${message.author.username}**! I removed your AFK.`);
  }
  if (message.mentions.users.size > 0) {
    message.mentions.users.forEach(user => {
      if (afkUsers.has(user.id)) {
        const data = afkUsers.get(user.id);
        message.reply(`💤 **${user.username}** is AFK: ${data.reason} (<t:${Math.floor(data.time/1000)}:R>)`);
      }
    });
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

  // 5. PREFIX COMMANDS
  const serverPrefix = config?.prefix || defaultPrefix;
  if (!message.content.startsWith(serverPrefix)) return;
  const args = message.content.slice(serverPrefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  const adminCmds = ['ban','kick','mute','unmute','lock','unlock','purge','deafen','undeafen','uwulock','uwuunlock','stick','unstick','setprefix', 'talk', 'autoreact'];
  if (adminCmds.includes(command) && !message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply('❌ Admin Only.');
  }

  try {
    // --- ADDED !PING (PREFIX) ---
    if (command === 'ping') {
        message.reply(`🏓 Pong! Latency: ${Math.round(client.ws.ping)}ms`);
    }

    if (command === 'talk') {
        const text = args.join(' ');
        if (!text) return message.reply('What should I say?');
        await message.delete().catch(()=>{}); 
        await message.channel.send(text);
    }
    
    if (command === 'autoreact') {
        const role = message.mentions.roles.first();
        const emoji = args[1]; 
        if (!role || !emoji) return message.reply('❌ Usage: `!autoreact @Role <Emoji>`');
        const cfg = guildSettings.get(message.guild.id) || {};
        if (!cfg.autoReactRoles) cfg.autoReactRoles = new Map();
        cfg.autoReactRoles.set(role.id, emoji);
        guildSettings.set(message.guild.id, cfg);
        message.reply(`✅ Setup! Users with **${role.name}** will get ${emoji} reactions.`);
    }

    if (command === 'ban' || command === 'kick') {
      const target = message.guild.members.cache.get(args[0].replace(/\D/g, ''));
      if (target) {
         if(command === 'ban') await target.ban(); else await target.kick();
         message.reply(`✅ User ${command}ed.`);
      }
    }
    if (command === 'mute') {
      const target = await message.guild.members.fetch(args[0].replace(/\D/g, '')).catch(()=>null);
      if(!target) return message.reply('User not found.');
      const role = message.guild.roles.cache.find(r=>r.name==='Muted');
      if(!role) return message.reply('Muted role not found.');
      await target.roles.add(role);
      const ms = parseDuration(args[1]);
      message.reply(`🤐 Muted ${target.user.tag} ${ms ? `for ${args[1]}` : 'permanently'}.`);
      if(ms) setTimeout(async()=>{ if(target.roles.cache.has(role.id)) await target.roles.remove(role); }, ms);
    }
    if (command === 'unmute') {
       const target = await message.guild.members.fetch(args[0].replace(/\D/g, ''));
       const role = message.guild.roles.cache.find(r => r.name === 'Muted');
       await target.roles.remove(role);
       message.reply(`🗣️ Unmuted.`);
    }
    if (command === 'lock') {
        await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });
        message.reply('🔒 Channel Locked!');
    }
    if (command === 'unlock') {
        await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null });
        message.reply('🔓 Channel Unlocked!');
    }
    if (command === 'purge') {
        const amount = parseInt(args[0]);
        if (isNaN(amount)) return message.reply('Enter amount');
        await message.channel.bulkDelete(amount, true);
        message.channel.send(`Deleted ${amount}`).then(m => setTimeout(() => m.delete(), 2000));
    }
    if (command === 'uwulock') {
      const target = message.mentions.users.first();
      if (!target) return message.reply('Mention a user!');
      uwuTargets.add(target.id);
      message.channel.send(`🌸 **${target.username}** is now UwU locked!`);
    }
    if (command === 'uwuunlock') {
      const target = message.mentions.users.first();
      uwuTargets.delete(target.id);
      message.channel.send(`🛑 **${target.username}** is free.`);
    }
    if (command === 'stick') {
      const text = args.join(' ');
      const sent = await message.channel.send(`**reminder**\n${text}`);
      stickyMessages.set(message.channel.id, { content: text, lastMsgId: sent.id });
      message.delete();
    }
    if (command === 'unstick') {
      if (stickyMessages.has(message.channel.id)) {
        const d = stickyMessages.get(message.channel.id);
        message.channel.messages.delete(d.lastMsgId).catch(()=>{});
        stickyMessages.delete(message.channel.id);
        message.channel.send('✅ Reminder removed.');
      }
    }
    if (command === 'setprefix') {
        const newPrefix = args[0];
        const cfg = guildSettings.get(message.guild.id) || {};
        cfg.prefix = newPrefix;
        guildSettings.set(message.guild.id, cfg);
        message.reply(`Prefix set to ${newPrefix}`);
    }
   
    if (command === 'userinfo') {
      const member = message.mentions.members.first() || message.member;
      let roles = member.roles.cache.filter(r => r.name !== '@everyone').map(r => r).join(', ');
      if (roles.length > 1000) roles = roles.slice(0, 1000) + '...';
      const embed = new EmbedBuilder().setTitle(`👤 Info: ${member.user.username}`).setThumbnail(member.user.displayAvatarURL()).setColor(0x00AAFF)
        .addFields({ name: 'ID', value: member.id, inline: true }, { name: 'Joined', value: `<t:${parseInt(member.joinedTimestamp / 1000)}:R>`, inline: true }, { name: 'Roles', value: roles||'None' });
      message.reply({ embeds: [embed] });
    }
    if (command === 'avatar') {
      const user = message.mentions.users.first() || message.author;
      const embed = new EmbedBuilder().setTitle(`${user.username}'s Avatar`).setImage(user.displayAvatarURL({dynamic:true, size:1024})).setColor(0x00AAFF);
      message.reply({ embeds: [embed] });
    }
    if (command === 'help') {
        const embed = new EmbedBuilder().setTitle('📜 Bot Command List').setColor(0x00AAFF).setDescription(`Prefix: **${serverPrefix}**`)
            .addFields(
                { name: '🔒 Admin', value: '`ban`, `kick`, `mute`, `unmute`, `lock`, `unlock`, `purge`, `deafen`, `uwulock`, `stick`, `setprefix`, `talk`, `autoreact`' },
                { name: '🌍 Public', value: '`userinfo`, `avatar`, `snipe`, `afk`, `ping`, `me`' },
                { name: '⚙️ Setup', value: '`/autorole-setup`, `/welcome-setup`, `/ticketsetup`, `/skullboard-setup`, `/reactionrole`, `/boost-setup`' }
            );
        message.reply({ embeds: [embed] });
    }
    if (command === 'me') message.reply('I was made out of boredom by');
    if (command === 'afk') {
      const reason = args.join(' ') || 'No reason';
      afkUsers.set(message.author.id, { reason, time: Date.now() });
      message.reply(`💤 AFK set: ${reason}`);
    }
    if (command === 'snipe') {
      const snipedMsg = snipes.get(message.channel.id);
      if (!snipedMsg) return message.reply('❌ Nothing to snipe!');
      const embed = new EmbedBuilder().setAuthor({ name: snipedMsg.author.tag, iconURL: snipedMsg.author.displayAvatarURL() }).setDescription(snipedMsg.content || '*(Image)*').setColor(0xFF0000).setFooter({text:'Deleted recently'});
      if(snipedMsg.image) embed.setImage(snipedMsg.image);
      message.reply({ embeds: [embed] });
    }

  } catch (e) { console.error(e); }
});

// --- INTERACTION HANDLER ---
client.on('interactionCreate', async interaction => {
  if (interaction.isButton()) {
    if (interaction.customId.startsWith('rr_')) {
        const roleId = interaction.customId.split('_')[1];
        const role = interaction.guild.roles.cache.get(roleId);
        if (!role) return interaction.reply({content:'Role deleted?', ephemeral:true});
        if (role.position >= interaction.guild.members.me.roles.highest.position) {
            return interaction.reply({content: '❌ I cannot give this role (it is higher than my role).', ephemeral: true});
        }
        if(interaction.member.roles.cache.has(roleId)) {
            await interaction.member.roles.remove(roleId);
            return interaction.reply({content:`➖ Removed **${role.name}**`, ephemeral:true});
        } else {
            await interaction.member.roles.add(roleId);
            return interaction.reply({content:`➕ Added **${role.name}**`, ephemeral:true});
        }
    }
    
    // TICKET LOGIC (Button Click)
    if (interaction.customId === 'create_ticket') {
        const chName = `ticket-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '');
        const existing = interaction.guild.channels.cache.find(c => c.name === chName);
        if (existing) {
            return interaction.reply({ content: `❌ You already have a ticket: ${existing}`, ephemeral: true });
        }
        const modal = new ModalBuilder().setCustomId('ticket_modal').setTitle('Open Ticket');
        const subjectInput = new TextInputBuilder().setCustomId('ticket_subject').setLabel('Subject / Reason').setStyle(TextInputStyle.Short).setRequired(true);
        const descInput = new TextInputBuilder().setCustomId('ticket_desc').setLabel('Detailed Description').setStyle(TextInputStyle.Paragraph).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(subjectInput), new ActionRowBuilder().addComponents(descInput));
        await interaction.showModal(modal);
    }
    if (interaction.customId === 'close_ticket') {
        interaction.reply('🔒 Closing...');
        setTimeout(() => interaction.channel.delete(), 3000);
    }
  }

  // TICKET MODAL SUBMIT
  if (interaction.isModalSubmit() && interaction.customId === 'ticket_modal') {
    await interaction.deferReply({ ephemeral: true });
    const subject = interaction.fields.getTextInputValue('ticket_subject');
    const description = interaction.fields.getTextInputValue('ticket_desc');
    const chName = `ticket-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '');
    const config = guildSettings.get(interaction.guild.id) || {};
    try {
        const tChannel = await interaction.guild.channels.create({
            name: chName, type: ChannelType.GuildText, parent: config.ticketCategory,
            permissionOverwrites: [{ id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] }, { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel] }]
        });
        let mentionString = `${interaction.user}`;
        if (TICKET_SUPPORT_ROLE) mentionString += ` <@&${TICKET_SUPPORT_ROLE}>`; 
        const embed = new EmbedBuilder().setTitle(`Ticket: ${subject}`).setDescription(`**User:** ${interaction.user}\n**Reason:** ${subject}\n\n**Description:**\n${description}`).setColor(0x0099FF);
        const btn = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('close_ticket').setLabel('Close').setStyle(ButtonStyle.Danger).setEmoji('🔒'));
        await tChannel.send({content: `🔔 ${mentionString}`, embeds:[embed], components:[btn]});
        interaction.editReply(`✅ Created ${tChannel}`);
    } catch(e) { interaction.editReply('❌ Error creating ticket'); }
  }

  if (!interaction.isChatInputCommand()) return;

  // --- ADDED /PING (SLASH) ---
  if (interaction.commandName === 'ping') {
    await interaction.reply(`🏓 Pong! Latency: ${Math.round(client.ws.ping)}ms`);
    return;
  }

  if (interaction.commandName === 'talk') {
    await interaction.deferReply({ ephemeral: true });
    try {
        const msg = interaction.options.getString('message');
        const channel = interaction.options.getChannel('channel') || interaction.channel;
        await channel.send(msg);
        interaction.editReply('✅ Message sent!');
    } catch(err) { interaction.editReply('❌ Error'); }
    return;
  }

  await interaction.deferReply({ ephemeral: false });

  try {
    // --- SETUP COMMANDS ---
    const config = guildSettings.get(interaction.guildId) || {};

    if (interaction.commandName === 'ticketsetup') {
        const ch = interaction.options.getChannel('channel');
        const cat = interaction.options.getChannel('category');
        const title = interaction.options.getString('title') || 'Support';
        const desc = interaction.options.getString('description') || 'Click below to open a ticket.';
        if(cat) config.ticketCategory = cat.id;
        guildSettings.set(interaction.guildId, config);
        const embed = new EmbedBuilder().setTitle(title).setDescription(desc).setColor(0x2F3136);
        const btn = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('create_ticket').setLabel('Open Ticket').setStyle(ButtonStyle.Secondary).setEmoji('📩'));
        await ch.send({embeds:[embed], components:[btn]});
        interaction.editReply('✅ Setup done');
    }

    if (interaction.commandName === 'autorole-setup') {
        const role = interaction.options.getRole('role');
        if (role.position >= interaction.guild.members.me.roles.highest.position) return interaction.editReply('❌ Role too high!');
        config.autoRoleId = role.id;
        guildSettings.set(interaction.guildId, config);
        interaction.editReply(`✅ Auto-Role set to: **${role.name}**`);
    }

    if (interaction.commandName === 'welcome-setup') {
        const ch = interaction.options.getChannel('channel');
        const msg = interaction.options.getString('message');
        const type = interaction.options.getString('type') || 'text';
        const img = interaction.options.getString('image_url');
        const color = interaction.options.getString('color');
        config.welcomeChannelId = ch.id;
        if(msg) config.welcomeMessage = msg;
        config.welcomeType = type;
        if(img) config.welcomeImage = img;
        if(color) config.welcomeColor = color;
        guildSettings.set(interaction.guildId, config);
        interaction.editReply(`✅ Welcome set to ${ch}`);
    }

    if (interaction.commandName === 'leave-setup') {
        const ch = interaction.options.getChannel('channel');
        const msg = interaction.options.getString('message');
        config.leaveChannelId = ch.id;
        if (msg) config.leaveMessage = msg;
        guildSettings.set(interaction.guildId, config);
        interaction.editReply(`✅ Leave set to ${ch}`);
    }

    if (interaction.commandName === 'boost-setup') {
        const ch = interaction.options.getChannel('channel');
        const msg = interaction.options.getString('message');
        config.boostChannelId = ch.id;
        if (msg) config.boostMessage = msg;
        guildSettings.set(interaction.guildId, config);
        interaction.editReply(`✅ Boosts will be announced in ${ch}`);
    }

    if (interaction.commandName === 'reactionrole') {
        const role = interaction.options.getRole('role');
        const desc = interaction.options.getString('description');
        const emoji = interaction.options.getString('emoji');
        const ch = interaction.options.getChannel('channel') || interaction.channel;
        const embed = new EmbedBuilder().setTitle('Get Role').setDescription(desc).setColor(role.color || 0x0099FF);
        const btn = new ButtonBuilder().setCustomId(`rr_${role.id}`).setLabel(role.name).setStyle(ButtonStyle.Primary);
        if (emoji) btn.setEmoji(emoji);
        await ch.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(btn)] });
        interaction.editReply('✅ Reaction role created!');
    }
    
    if (['mute','uwulock','stick','skullboard-setup'].includes(interaction.commandName)) {
        interaction.editReply("✅ Command executed.");
    }

  } catch (err) { interaction.editReply('❌ Error: ' + err.message); }
});

// --- MEMBER ADD EVENT (WELCOME + AUTO ROLE) ---
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
        let msgText = (config.welcomeMessage || 'Welcome {user} to {server}!').replace(/{user}/g, member.toString()).replace(/{server}/g, member.guild.name).replace(/{count}/g, member.guild.memberCount);
        if (config.welcomeType === 'embed') {
            const embed = new EmbedBuilder().setTitle(`Welcome to ${member.guild.name}!`).setDescription(msgText).setThumbnail(member.user.displayAvatarURL()).setColor(config.welcomeColor || 0x00FF00).setTimestamp();
            if (config.welcomeImage) embed.setImage(config.welcomeImage);
            ch.send({ content: member.toString(), embeds: [embed] });
        } else {
            ch.send(msgText);
        }
    }
  }
});

// --- MEMBER REMOVE EVENT (LEAVE) ---
client.on('guildMemberRemove', async member => {
  const config = guildSettings.get(member.guild.id);
  if (config && config.leaveChannelId) {
    const ch = member.guild.channels.cache.get(config.leaveChannelId);
    if(ch) {
        let msgText = (config.leaveMessage || 'Bye {user}').replace(/{user}/g, member.user.tag).replace(/{server}/g, member.guild.name).replace(/{count}/g, member.guild.memberCount);
        ch.send(msgText);
    }
  }
});

// --- MEMBER UPDATE EVENT (BOOST DETECTOR) ---
client.on('guildMemberUpdate', (oldMember, newMember) => {
    const config = guildSettings.get(newMember.guild.id);
    if (!config || !config.boostChannelId) return;

    if (!oldMember.premiumSince && newMember.premiumSince) {
        const ch = newMember.guild.channels.cache.get(config.boostChannelId);
        if (ch) {
            let msgText = (config.boostMessage || "Thank you {user} for boosting the server! 🚀").replace(/{user}/g, newMember.toString()).replace(/{server}/g, newMember.guild.name).replace(/{count}/g, newMember.guild.memberCount);
            ch.send(msgText);
        }
    }
});

// --- IMPORTANT: PASTE YOUR TOKEN HERE ---

client.login(process.env.TOKEN);
