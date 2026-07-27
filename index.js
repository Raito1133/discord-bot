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
const GUILD_ID = '1371775026264670228'; // Your Single Server ID

// --- SUPPORT ROLES FOR EACH TICKET TYPE ---
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
  return text.replace(/(?:r|l)/g, 'w').replace(/(?:R|L)/g, 'W').replace(/n([aeiou])/g, 'ny$1').replace(/N([aeiou])/g, 'Ny$1').replace(/N([AEIOU])/g, 'Ny$1').replace(/ove/g, 'uv').replace(/!+/g, ' ' + faces[Math.floor(Math.random() * faces.length)] + ' ');
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
  { name: 'me', description: 'Credits & Info' },
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
  { name: 'avatar', description: 'Get avatar of a user', options: [{ name: 'user', description: 'Select user', type: 6, required: false }] },
  { name: 'welcome-setup', description: 'Setup welcome message', options: [{ name: 'channel', description: 'Channel', type: 7, required: true }, { name: 'message', description: 'Message', type: 3, required: false }, { name: 'type', description: 'Style', type: 3, required: false, choices: [{ name: 'Text', value: 'text' }, { name: 'Embed', value: 'embed' }] }, { name: 'image_url', description: 'Image Link (GIF/PNG) for Embed', type: 3, required: false }, { name: 'color', description: 'Hex Color (e.g. #FF0000)', type: 3, required: false }], default_member_permissions: '8' },
  { name: 'leave-setup', description: 'Setup leave message', options: [{ name: 'channel', description: 'Channel', type: 7, required: true }, { name: 'message', description: 'Message', type: 3, required: false }], default_member_permissions: '8' },
  { 
    name: 'ticketsetup', 
    description: 'Create the multi-button ticket panel', 
    options: [
      { name: 'channel', description: 'Where to post the panel', type: 7, required: true }, 
      { name: 'category', description: 'Where to open ticket channels', type: 7, channel_types: [4], required: false }, 
      { name: 'title', description: 'Panel Title', type: 3, required: false }, 
      { name: 'description', description: 'Panel Description', type: 3, required: false }
    ], 
    default_member_permissions: '8' 
  },
  { name: 'autoreact-setup', description: 'Auto-react setup', options: [{ name: 'emoji', description: 'Which emoji?', type: 3, required: true }, { name: 'role', description: 'Optional: Filter by this Role', type: 8, required: false }], default_member_permissions: '8' },
  { name: 'autorole-setup', description: 'Set auto role', options: [{ name: 'role', description: 'Role to give new members', type: 8, required: true }], default_member_permissions: '8' },
  { name: 'skullboard-setup', description: 'Skullboard setup', options: [{ name: 'channel', description: 'Where to log skulls', type: 7, required: true }], default_member_permissions: '8' },
  { name: 'boost-setup', description: 'Set boost announcement', options: [{ name: 'channel', description: 'Where to announce boosts', type: 7, required: true }, { name: 'message', description: 'Custom msg (Use {user})', type: 3, required: false }], default_member_permissions: '8' },
  { 
    name: 'reactionrole', 
    description: 'Create a panel with up to 5 role buttons', 
    options: [
      { name: 'title', description: 'Embed title', type: 3, required: true },
      { name: 'description', description: 'Embed main text', type: 3, required: true },
      { name: 'role1', description: 'First role', type: 8, required: true },
      { name: 'emoji1', description: 'Emoji for button 1', type: 3, required: false },
      { name: 'role2', description: 'Second role', type: 8, required: false },
      { name: 'emoji2', description: 'Emoji for button 2', type: 3, required: false },
      { name: 'role3', description: 'Third role', type: 8, required: false },
      { name: 'emoji3', description: 'Emoji for button 3', type: 3, required: false },
      { name: 'role4', description: 'Fourth role', type: 8, required: false },
      { name: 'emoji4', description: 'Emoji for button 4', type: 3, required: false },
      { name: 'role5', description: 'Fifth role', type: 8, required: false },
      { name: 'emoji5', description: 'Emoji for button 5', type: 3, required: false }
    ], 
    default_member_permissions: '8' 
  }
];

// --- STARTUP ---
client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}`);
  client.user.setActivity('hey you', { type: ActivityType.Listening });
  const rest = new REST().setToken(client.token);
  
  try {
    if (GUILD_ID === 'PASTE_YOUR_SERVER_ID_HERE') {
      console.log('⚠️ ERROR: YOU FORGOT TO PASTE YOUR SERVER ID AT THE TOP!');
    } else {
      console.log('Clearing global commands...');
      await rest.put(Routes.applicationCommands(client.user.id), { body: [] });

      console.log('Registering commands to target server...');
      await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), { body: commands });
      console.log('Commands successfully refreshed and registered.');
    }
  } catch (error) { console.error('Slash error:', error); }
});

// --- TRACK DELETED MESSAGES FOR SNIPE ---
client.on('messageDelete', message => {
  if (message.author?.bot) return;
  snipes.set(message.channel.id, {
    content: message.content,
    author: message.author,
    image: message.attachments.first() ? message.attachments.first().proxyURL : null
  });
});

// --- PREFIX HANDLER (!) ---
client.on('messageCreate', async message => {
  if (message.author.bot || !message.guild || message.guild.id !== GUILD_ID) return;

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

  // 2. STICKY MESSAGE RE-POST
  if (stickyMessages.has(message.channel.id)) {
    const stickyData = stickyMessages.get(message.channel.id);
    if (stickyData.lastMsgId) message.channel.messages.delete(stickyData.lastMsgId).catch(() => {});
    const sentSticky = await message.channel.send(`**reminder**\n${stickyData.content}`);
    stickyData.lastMsgId = sentSticky.id;
    stickyMessages.set(message.channel.id, stickyData);
  }

  // 3. AFK NOTIFICATIONS
  if (message.mentions.users.size > 0) {
    message.mentions.users.forEach(user => {
      if (afkUsers.has(user.id)) {
        message.reply(`**${user.username}** is AFK: ${afkUsers.get(user.id).reason}`);
      }
    });
  }
  if (afkUsers.has(message.author.id)) {
    afkUsers.delete(message.author.id);
    message.reply(`Welcome back **${message.author.username}**! AFK status removed.`);
  }

  // 4. AUTO REACT
  const config = guildSettings.get(message.guild.id);
  if (config && config.autoReactRoles && message.member) {
      message.member.roles.cache.forEach(role => {
          if (config.autoReactRoles.has(role.id)) {
              const emoji = config.autoReactRoles.get(role.id);
              const emojiId = emoji.match(/<a?:.+?:(\d+)>/) ? emoji.match(/<a?:.+?:(\d+)>/)[1] : emoji;
              message.react(emojiId).catch(() => {});
          }
      });
  }

  // 5. PREFIX COMMAND PROCESSING
  const serverPrefix = config?.prefix || defaultPrefix;
  if (!message.content.startsWith(serverPrefix)) return;

  const args = message.content.slice(serverPrefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  try {
    if (command === 'ping') return message.reply(`Pong! ${Math.round(client.ws.ping)}ms`);
    
    if (command === 'talk') {
        if(!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return message.reply("❌ You need Admin permissions.");
        message.delete().catch(()=>{});
        return message.channel.send(args.join(' ') || 'What should I say?');
    }
    
    if (command === 'ban') {
        if(!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) return message.reply("❌ You need Ban Members permission.");
        const target = message.mentions.members.first();
        if(!target) return message.reply('Mention someone to ban.');
        if(!target.bannable) return message.reply('❌ Cannot ban target.');
        await target.ban(); 
        message.reply(`Banned **${target.user.tag}**`);
    }
    
    if (command === 'kick') {
        if(!message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) return message.reply("❌ You need Kick Members permission.");
        const target = message.mentions.members.first();
        if(!target) return message.reply('Mention someone to kick.');
        if(!target.kickable) return message.reply('❌ Cannot kick target.');
        await target.kick(); 
        message.reply(`Kicked **${target.user.tag}**`);
    }

    if (command === 'help') {
        const embed = new EmbedBuilder().setTitle('Bot Command Manual').setColor(0x00AAFF).setDescription(`**Prefix:** \`${serverPrefix}\`\nUse \`/\` for Slash Commands or \`${serverPrefix}\` for text commands.`);
        message.reply({embeds:[embed]});
    }

    if (command === 'userinfo') {
        const member = message.mentions.members.first() || message.member;
        const embed = new EmbedBuilder().setTitle(`User: ${member.user.tag}`).addFields({name:'Joined', value: `<t:${Math.floor(member.joinedTimestamp/1000)}:R>`}).setColor(0x00AAFF);
        message.reply({embeds:[embed]});
    }

    if (command === 'afk') {
        const reason = args.join(' ') || 'No reason specified';
        afkUsers.set(message.author.id, { reason, time: Date.now() });
        message.reply(`Set your AFK status: ${reason}`);
    }

    if (command === 'snipe') {
        const snipedMsg = snipes.get(message.channel.id);
        if (!snipedMsg) return message.reply('❌ Nothing to snipe!');
        const embed = new EmbedBuilder().setAuthor({ name: snipedMsg.author.tag, iconURL: snipedMsg.author.displayAvatarURL() }).setDescription(snipedMsg.content || '*(Attachment)*').setColor(0xFF0000).setFooter({text:'Deleted recently'});
        if(snipedMsg.image) embed.setImage(snipedMsg.image);
        message.reply({ embeds: [embed] });
    }
  } catch (e) { console.error('Prefix Error:', e); }
});

// --- INTERACTION HANDLER ---
client.on('interactionCreate', async interaction => {
  if (!interaction.guild || interaction.guild.id !== GUILD_ID) return;

  // BUTTON CLICK HANDLER (TICKETS & REACTION ROLES)
  if (interaction.isButton()) {
    // 1. REACTION ROLE BUTTON HANDLER
    if (interaction.customId.startsWith('rr_')) {
        const roleId = interaction.customId.split('_')[1];
        const role = interaction.guild.roles.cache.get(roleId);
        
        if (!role) {
          return interaction.reply({ content: '❌ Target role no longer exists.', ephemeral: true });
        }

        try {
          if (interaction.member.roles.cache.has(roleId)) {
              await interaction.member.roles.remove(roleId);
              return interaction.reply({ content: `Removed role: **${role.name}**`, ephemeral: true });
          } else {
              await interaction.member.roles.add(roleId);
              return interaction.reply({ content: `Added role: **${role.name}**`, ephemeral: true });
          }
        } catch (err) {
          return interaction.reply({ content: '❌ Failed to update role. Check bot hierarchy/permissions.', ephemeral: true });
        }
    }

    // 2. TICKET OPEN BUTTON HANDLER
    if (['ticket_ultra', 'ticket_farm', 'ticket_concern'].includes(interaction.customId)) {
        const type = interaction.customId.replace('ticket_', '');
        const chName = `${type}-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '');
        
        if (interaction.guild.channels.cache.find(c => c.name === chName)) {
            return interaction.reply({ content: `❌ You already have an open ${type} ticket!`, ephemeral: true });
        }

        const modal = new ModalBuilder().setCustomId(`modal_${type}`).setTitle(`Open ${type.toUpperCase()} Ticket`);
        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ticket_subject').setLabel('Subject').setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ticket_desc').setLabel('Description').setStyle(TextInputStyle.Paragraph).setRequired(true))
        );
        await interaction.showModal(modal);
    }

    // 3. TICKET CLOSE BUTTON HANDLER
    if (interaction.customId === 'close_ticket') {
        await interaction.reply('🔒 Closing ticket...');
        setTimeout(() => interaction.channel.delete().catch(()=>{}), 3000);
    }
    return;
  }

  // MODAL SUBMISSIONS
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
            parent: config.ticketCategory,
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

        await ch.send({content: `${mentions}`, embeds:[embed], components:[btn]});
        interaction.editReply(`Created your ticket: ${ch}`);
    } catch(e) { 
        interaction.editReply('❌ Error creating ticket channel.'); 
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  // --- SLASH COMMAND HANDLERS ---
  try {
    const { commandName, options } = interaction;

    if (commandName === 'purge') {
        await interaction.deferReply({ ephemeral: true }); 
        const amt = options.getInteger('amount');
        if (amt > 100) return interaction.editReply('❌ Max 100.');
        await interaction.channel.bulkDelete(amt, true).catch(() => interaction.editReply("❌ Error deleting (messages too old?)."));
        return interaction.editReply(`Deleted ${amt} messages.`);
    }

    await interaction.deferReply({ ephemeral: false });

    if (commandName === 'ping') {
        interaction.editReply(`Pong! ${Math.round(client.ws.ping)}ms`);
    } 
    else if (commandName === 'talk') {
        await (options.getChannel('channel')||interaction.channel).send(options.getString('message'));
        interaction.editReply('Sent.');
    }
    else if (commandName === 'me') {
        interaction.editReply('This bot was made out of boredom by **Adlaw**.');
    }
    else if (commandName === 'setprefix') {
        const newPrefix = options.getString('new_prefix');
        const cfg = guildSettings.get(interaction.guildId) || {};
        cfg.prefix = newPrefix;
        guildSettings.set(interaction.guildId, cfg);
        interaction.editReply(`Prefix changed to: \`${newPrefix}\``);
    }
    else if (commandName === 'embed') {
        const title = options.getString('title');
        const description = options.getString('description');
        const color = options.getString('color') || '#0099FF';
        const image = options.getString('image');
        const thumbnail = options.getString('thumbnail');
        const footer = options.getString('footer');
        const targetChannel = options.getChannel('channel') || interaction.channel;

        const embed = new EmbedBuilder().setColor(color);
        if (title) embed.setTitle(title);
        if (description) embed.setDescription(description.replace(/\\n/g, '\n'));
        if (image) embed.setImage(image);
        if (thumbnail) embed.setThumbnail(thumbnail);
        if (footer) embed.setFooter({ text: footer });

        await targetChannel.send({ embeds: [embed] });
        interaction.editReply({ content: 'Embed sent!', ephemeral: true });
    }
    else if (commandName === 'ban') {
        const user = options.getMember('user');
        if(!user.bannable) return interaction.editReply('❌ Cannot ban.');
        await user.ban({ reason: options.getString('reason') });
        interaction.editReply(`Banned **${user.user.tag}**`);
    }
    else if (commandName === 'kick') {
        const user = options.getMember('user');
        if(!user.kickable) return interaction.editReply('❌ Cannot kick.');
        await user.kick(options.getString('reason'));
        interaction.editReply(`Kicked **${user.user.tag}**`);
    }
    else if (commandName === 'userinfo') {
        const user = options.getMember('user') || interaction.member;
        const embed = new EmbedBuilder().setTitle(`User: ${user.user.tag}`).addFields({name:'Joined', value:`<t:${Math.floor(user.joinedTimestamp/1000)}:R>`}).setColor(0x00AAFF);
        interaction.editReply({embeds:[embed]});
    }
    else if (commandName === 'avatar') {
        const targetUser = options.getUser('user') || interaction.user;
        const avatarUrl = targetUser.displayAvatarURL({ dynamic: true, size: 1024 });
        
        const embed = new EmbedBuilder()
            .setTitle(`Avatar for ${targetUser.username}`)
            .setImage(avatarUrl)
            .setColor(0x00AAFF);

        interaction.editReply({ embeds: [embed] });
    }
    else if (commandName === 'help') {
        const embed = new EmbedBuilder().setTitle('Bot Command Manual').setColor(0x00AAFF).setDescription(`**Prefix:** \`${defaultPrefix}\`\nUse \`/\` for Slash Commands or \`${defaultPrefix}\` for text commands.`)
            .addFields(
                { name: 'Admin / Mod', value: '`ban`, `kick`, `mute`, `unmute`, `lock`, `unlock`, `purge`\n`deafen`, `undeafen`, `stick`, `unstick`\n`setprefix`, `talk`, `embed`, `uwulock`' },
                { name: 'Public / Fun', value: '`ping`, `afk`, `snipe`, `userinfo`, `avatar`, `me`, `help`' },
                { name: 'Setup (Slash Only)', value: '`/ticketsetup`, `/welcome-setup`, `/leave-setup`\n`/autorole-setup`, `/autoreact-setup`\n`/skullboard-setup`, `/reactionrole`, `/boost-setup`' }
            );
        interaction.editReply({embeds:[embed]});
    }
    else if (commandName === 'ticketsetup') {
        const title = options.getString('title') || 'Support & Assistance Panel';
        const desc = options.getString('description') || 'Select a category below to open a ticket with support:';
        const channel = options.getChannel('channel');
        const category = options.getChannel('category');

        const cfg = guildSettings.get(interaction.guildId) || {};
        if (category) cfg.ticketCategory = category.id;
        guildSettings.set(interaction.guildId, cfg);

        const embed = new EmbedBuilder().setTitle(title).setDescription(desc).setColor(0x2F3136);

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('ticket_ultra').setLabel('Ultra Help').setStyle(ButtonStyle.Danger).setEmoji('⚔️'),
          new ButtonBuilder().setCustomId('ticket_farm').setLabel('Farm Help').setStyle(ButtonStyle.Success).setEmoji('👾'),
          new ButtonBuilder().setCustomId('ticket_concern').setLabel('Support').setStyle(ButtonStyle.Primary).setEmoji('🎟️')
        );

        await channel.send({ embeds: [embed], components: [row] });
        interaction.editReply(`Ticket panel successfully posted to ${channel}!`);
    }
    else if (commandName === 'autoreact-setup') {
        const emoji = options.getString('emoji');
        const role = options.getRole('role');
        const cfg = guildSettings.get(interaction.guildId) || {};
        if (!cfg.autoReactRoles) cfg.autoReactRoles = new Map();
        cfg.autoReactRoles.set(role.id, emoji);
        guildSettings.set(interaction.guildId, cfg);
        interaction.editReply(`Auto-react setup for **${role.name}**`);
    }
    else if (commandName === 'autorole-setup') {
        const role = options.getRole('role');
        const cfg = guildSettings.get(interaction.guildId) || {};
        cfg.autoRoleId = role.id;
        guildSettings.set(interaction.guildId, cfg);
        interaction.editReply(`Auto role set: **${role.name}**`);
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
        interaction.editReply('Welcome message configured.');
    }
    else if (commandName === 'leave-setup') {
        const ch = options.getChannel('channel');
        const cfg = guildSettings.get(interaction.guildId) || {};
        cfg.leaveChannelId = ch.id;
        cfg.leaveMessage = options.getString('message');
        guildSettings.set(interaction.guildId, cfg);
        interaction.editReply('Leave message configured.');
    }
    else if (commandName === 'boost-setup') {
        const ch = options.getChannel('channel');
        const cfg = guildSettings.get(interaction.guildId) || {};
        cfg.boostChannelId = ch.id;
        cfg.boostMessage = options.getString('message');
        guildSettings.set(interaction.guildId, cfg);
        interaction.editReply('Boost message configured.');
    }
    else if (commandName === 'skullboard-setup') {
        const ch = options.getChannel('channel');
        const cfg = guildSettings.get(interaction.guildId) || {};
        cfg.skullboardId = ch.id;
        guildSettings.set(interaction.guildId, cfg);
        interaction.editReply('Skullboard channel configured.');
    }
    // --- MULTI-BUTTON REACTION ROLE CREATION COMMAND HANDLER ---
    else if (commandName === 'reactionrole') {
        const title = options.getString('title');
        const desc = options.getString('description');

        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(desc)
            .setColor(0x0099FF);

        const row = new ActionRowBuilder();

        // Loop through all 5 potential role slots
        for (let i = 1; i <= 5; i++) {
            const role = options.getRole(`role${i}`);
            const rawEmoji = options.getString(`emoji${i}`);

            if (role) {
                const btn = new ButtonBuilder()
                    .setCustomId(`rr_${role.id}`)
                    .setLabel(role.name)
                    .setStyle(ButtonStyle.Primary);

                if (rawEmoji) {
                    try {
                        const match = rawEmoji.match(/<a?:.+?:(\d+)>/);
                        if (match) {
                            btn.setEmoji(match[1]);
                        } else {
                            btn.setEmoji(rawEmoji.trim());
                        }
                    } catch (e) {
                        console.log(`Emoji issue on button ${i}, continuing without it.`);
                    }
                }

                row.addComponents(btn);
            }
        }

        await interaction.channel.send({ embeds: [embed], components: [row] });
        interaction.editReply({ content: 'Reaction role panel posted!', ephemeral: true });
    }
    else if (commandName === 'mute') {
        const user = options.getMember('user');
        const dStr = options.getString('duration');
        const role = interaction.guild.roles.cache.find(r=>r.name==='Muted');
        if(!role) return interaction.editReply('❌ "Muted" role missing.');
        await user.roles.add(role);
        interaction.editReply(`Muted **${user.user.tag}**`);
        const ms = parseDuration(dStr);
        if(ms) setTimeout(()=> user.roles.remove(role).catch(()=>{}), ms);
    }
    else if (commandName === 'unmute') {
        const user = options.getMember('user');
        const role = interaction.guild.roles.cache.find(r=>r.name==='Muted');
        await user.roles.remove(role);
        interaction.editReply('Unmuted.');
    }
    else if (commandName === 'lock') {
        await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false });
        interaction.editReply('Locked.');
    }
    else if (commandName === 'unlock') {
        await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: null });
        interaction.editReply('Unlocked.');
    }
    else if (commandName === 'deafen') {
        const user = options.getMember('user');
        if(!user.voice.channel) return interaction.editReply('❌ User not in voice channel.');
        await user.voice.setDeaf(true);
        interaction.editReply(`Deafened ${user.user.tag}.`);
    }
    else if (commandName === 'undeafen') {
        const user = options.getMember('user');
        if(!user.voice.channel) return interaction.editReply('❌ User not in voice channel.');
        await user.voice.setDeaf(false);
        interaction.editReply(`Undeafened ${user.user.tag}.`);
    }
    else if (commandName === 'uwulock') {
        const target = options.getUser('user');
        uwuTargets.add(target.id);
        interaction.editReply(`**${target.username}** is now UwU locked.`);
    }
    else if (commandName === 'uwuunlock') {
        const target = options.getUser('user');
        uwuTargets.delete(target.id);
        interaction.editReply(`**${target.username}** is freed from UwU lock.`);
    }
    else if (commandName === 'stick') {
        const text = options.getString('message');
        const sent = await interaction.channel.send(`**reminder**\n${text}`);
        stickyMessages.set(interaction.channelId, { content: text, lastMsgId: sent.id });
        interaction.editReply({content: 'Message stuck!', ephemeral: true});
    }
    else if (commandName === 'unstick') {
        if (stickyMessages.has(interaction.channelId)) {
            const d = stickyMessages.get(interaction.channelId);
            interaction.channel.messages.delete(d.lastMsgId).catch(()=>{});
            stickyMessages.delete(interaction.channelId);
            interaction.editReply('Reminder removed.');
        } else {
            interaction.editReply('❌ No sticky message in this channel.');
        }
    }
    else if (commandName === 'afk') {
        const reason = options.getString('reason') || 'No reason';
        afkUsers.set(interaction.user.id, { reason, time: Date.now() });
        interaction.editReply(`AFK set: ${reason}`);
    }
    else if (commandName === 'snipe') {
        const snipedMsg = snipes.get(interaction.channelId);
        if (!snipedMsg) return interaction.editReply('❌ Nothing to snipe!');
        const embed = new EmbedBuilder().setAuthor({ name: snipedMsg.author.tag, iconURL: snipedMsg.author.displayAvatarURL() }).setDescription(snipedMsg.content || '*(Attachment)*').setColor(0xFF0000).setFooter({text:'Deleted recently'});
        if(snipedMsg.image) embed.setImage(snipedMsg.image);
        interaction.editReply({ embeds: [embed] });
    }
  } catch (err) { interaction.editReply('❌ Error: ' + err.message).catch(()=>{}); }
});

// --- CRASH PREVENTION ---
process.on('unhandledRejection', (reason, p) => console.log('Anti-Crash: ', reason));
process.on('uncaughtException', (err, origin) => console.log('Anti-Crash: ', err));

// --- LOGIN ---
console.log('Starting bot, trying to login...');
client.login(process.env.DISCORD_TOKEN);

const http = require('http');

// Simple HTTP server to keep Render happy
http.createServer((req, res) => {
  res.write("Bot is alive!");
  res.end();
}).listen(process.env.PORT || 3000);
