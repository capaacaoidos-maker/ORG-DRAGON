const { Client, GatewayIntentBits, Partials, Collection, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const fs = require('fs');
const path = require('path');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel, Partials.Message],
});

// Load config
let config = {};
if (fs.existsSync('./config.json')) {
  config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
}

// Queue state per mode
const queues = {}; // { '1x1': { players: [], value: 2 }, ... }

// Tickets state
const tickets = {}; // { ticketChannelId: { userId, type, membersAdded: [] } }

// Queue modes config
const QUEUE_MODES = {
  '1x1': { label: '1x1', maxPlayers: 2, emoji: '⚔️' },
  '2x2': { label: '2x2', maxPlayers: 4, emoji: '🔥' },
  '3x3': { label: '3x3', maxPlayers: 6, emoji: '💥' },
  '4x4': { label: '4x4', maxPlayers: 8, emoji: '🏆' },
};

const PRICES = [2, 5, 10, 15, 20, 25, 30, 40, 50, 75, 100];

const TICKET_TYPES = {
  REEMBOLSO: { label: '💰 Reembolso', emoji: '💰', color: 0xF4D03F },
  MEDIADOR: { label: '🤝 Vagas Mediador', emoji: '🤝', color: 0x2ECC71 },
  SUPORTE: { label: '🎧 Suporte', emoji: '🎧', color: 0x3498DB },
  ANALISTA: { label: '📊 Vagas Analistas', emoji: '📊', color: 0x9B59B6 },
  WO: { label: '⚠️ W.O Sem Motivo', emoji: '⚠️', color: 0xE74C3C },
};

// ─── HELPERS ───────────────────────────────────────────────────────────────

function saveConfig() {
  fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
}

function getQueueState(mode) {
  if (!queues[mode]) queues[mode] = { players: [], value: PRICES[0] };
  return queues[mode];
}

function buildQueueEmbed(mode, value) {
  const state = getQueueState(mode);
  const cfg = QUEUE_MODES[mode];
  const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  const playerList = state.players.length > 0
    ? state.players.map((p, i) => `\`${i + 1}.\` <@${p.id}> — \`${p.nick || p.name}\``).join('\n')
    : 'Nenhum jogador na fila ainda.';

  return new EmbedBuilder()
    .setColor(0xFFAA00)
    .setTitle(`${cfg.emoji} ORG TIGRE — Fila ${mode}`)
    .addFields(
      { name: '**MODO**', value: `fila ${mode}`, inline: true },
      { name: '**VALOR**', value: `R$ ${value.toFixed(2).replace('.', ',')}`, inline: true },
      { name: `**JOGADORES (${state.players.length}/${cfg.maxPlayers})**`, value: playerList },
    )
    .setFooter({ text: `Use os botões abaixo para entrar ou sair da fila. | ${now}` })
    .setTimestamp();
}

function buildQueueButtons(mode) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`queue_normal_${mode}`).setLabel('Gel Normal').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`queue_infinito_${mode}`).setLabel('Gel Infinito').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`queue_sair_${mode}`).setLabel('Sair da Fila').setStyle(ButtonStyle.Danger),
  );
}

function buildTicketPanel() {
  const embed = new EmbedBuilder()
    .setColor(0xFFAA00)
    .setTitle('🎫 CENTRAL DE TICKETS — ORG TIGRE')
    .setDescription('Selecione o tipo de atendimento que deseja abrir.\nNossa equipe irá te atender em breve!')
    .addFields(
      { name: '💰 Reembolso', value: 'Solicitar devolução de valor', inline: true },
      { name: '🤝 Vagas Mediador', value: 'Candidatura para mediador', inline: true },
      { name: '🎧 Suporte', value: 'Ajuda geral / dúvidas', inline: true },
      { name: '📊 Vagas Analistas', value: 'Candidatura para analista', inline: true },
      { name: '⚠️ W.O Sem Motivo', value: 'Reportar abandono de partida', inline: true },
    )
    .setFooter({ text: 'ORG TIGRE • Sistema de Tickets' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('ticket_select')
      .setPlaceholder('📋 Escolha o tipo de ticket...')
      .addOptions(
        Object.entries(TICKET_TYPES).map(([key, val]) => ({
          label: val.label,
          value: key,
          emoji: val.emoji,
        }))
      )
  );

  return { embeds: [embed], components: [row] };
}

// ─── READY ──────────────────────────────────────────────────────────────────

client.once('ready', () => {
  console.log(`✅ Bot online como ${client.user.tag}`);

  // Auto-send promo every 20min
  setInterval(async () => {
    if (!config.promoChannels || config.promoChannels.length === 0) return;
    const embed = new EmbedBuilder()
      .setColor(0xFFAA00)
      .setTitle('⭐ MELHOR ORG DE TODAS ⭐')
      .setDescription('> 🏆 **ORG TIGRE** é a melhor organização de Free Fire!\n> 💰 Apostas seguras, mediadores confiáveis\n> ⚡ Entre na fila agora e mostre seu skill!')
      .setImage('https://i.imgur.com/your-banner.png')
      .setFooter({ text: 'ORG TIGRE • Free Fire' })
      .setTimestamp();

    for (const chId of config.promoChannels) {
      try {
        const ch = await client.channels.fetch(chId);
        if (ch) await ch.send({ embeds: [embed] });
      } catch {}
    }
  }, 20 * 60 * 1000);
});

// ─── COMMANDS ───────────────────────────────────────────────────────────────

client.on('messageCreate', async (message) => {
  if (!message.guild || message.author.bot) return;
  const prefix = '!';
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  const isOwner = message.member.permissions.has(PermissionFlagsBits.Administrator);

  // !fila <modo> [valor]
  if (cmd === 'fila') {
    if (!isOwner) return message.reply('❌ Sem permissão.');
    const mode = args[0];
    if (!QUEUE_MODES[mode]) return message.reply(`❌ Modo inválido. Use: ${Object.keys(QUEUE_MODES).join(', ')}`);
    const value = parseFloat(args[1]) || getQueueState(mode).value;
    if (!PRICES.includes(value)) return message.reply(`❌ Valor inválido. Opções: ${PRICES.join(', ')}`);
    getQueueState(mode).value = value;
    await message.channel.send({ embeds: [buildQueueEmbed(mode, value)], components: [buildQueueButtons(mode)] });
    message.delete().catch(() => {});
  }

  // !ticket
  if (cmd === 'ticket') {
    if (!isOwner) return message.reply('❌ Sem permissão.');
    await message.channel.send(buildTicketPanel());
    message.delete().catch(() => {});
  }

  // !setpromo #canal
  if (cmd === 'setpromo') {
    if (!isOwner) return message.reply('❌ Sem permissão.');
    const ch = message.mentions.channels.first();
    if (!ch) return message.reply('❌ Mencione um canal.');
    if (!config.promoChannels) config.promoChannels = [];
    if (!config.promoChannels.includes(ch.id)) config.promoChannels.push(ch.id);
    saveConfig();
    message.reply(`✅ Canal ${ch} adicionado para promoção a cada 20 minutos.`);
  }

  // !setticketcat <categoryId>
  if (cmd === 'setticketcat') {
    if (!isOwner) return message.reply('❌ Sem permissão.');
    config.ticketCategory = args[0];
    saveConfig();
    message.reply(`✅ Categoria de tickets definida: \`${args[0]}\``);
  }

  // !setstaff @role
  if (cmd === 'setstaff') {
    if (!isOwner) return message.reply('❌ Sem permissão.');
    const role = message.mentions.roles.first();
    if (!role) return message.reply('❌ Mencione um cargo.');
    config.staffRole = role.id;
    saveConfig();
    message.reply(`✅ Cargo de staff definido: ${role}`);
  }

  // !allfilas — envia todas as filas de uma vez
  if (cmd === 'allfilas') {
    if (!isOwner) return message.reply('❌ Sem permissão.');
    for (const mode of Object.keys(QUEUE_MODES)) {
      const state = getQueueState(mode);
      await message.channel.send({ embeds: [buildQueueEmbed(mode, state.value)], components: [buildQueueButtons(mode)] });
    }
    message.delete().catch(() => {});
  }
});

// ─── INTERACTIONS ────────────────────────────────────────────────────────────

client.on('interactionCreate', async (interaction) => {

  // ── QUEUE BUTTONS ──────────────────────────────────────────────────────────
  if (interaction.isButton()) {
    const id = interaction.customId;

    // Queue join (Normal / Infinito)
    if (id.startsWith('queue_normal_') || id.startsWith('queue_infinito_')) {
      const gelType = id.startsWith('queue_normal_') ? 'Normal' : 'Infinito';
      const mode = id.replace('queue_normal_', '').replace('queue_infinito_', '');
      const state = getQueueState(mode);
      const cfg = QUEUE_MODES[mode];

      if (state.players.find(p => p.id === interaction.user.id)) {
        return interaction.reply({ content: '⚠️ Você já está na fila!', ephemeral: true });
      }

      // Ask for confirmation number / nick
      const confirmEmbed = new EmbedBuilder()
        .setColor(0xFFAA00)
        .setTitle(`⚔️ Entrar na Fila ${mode} — Gel ${gelType}`)
        .setDescription(
          `**Valor:** R$ ${state.value.toFixed(2).replace('.', ',')}\n\n` +
          `Digite o **número do comprovante** ou **nome de usuário** no jogo:\n*(Envie uma mensagem aqui com seu nick/ID)*`
        )
        .setFooter({ text: 'Você tem 60 segundos para responder.' });

      const cancelBtn = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`queue_cancel_confirm`).setLabel('Cancelar').setStyle(ButtonStyle.Danger)
      );

      await interaction.reply({ embeds: [confirmEmbed], components: [cancelBtn], ephemeral: true });

      // Collect their nick response
      const filter = m => m.author.id === interaction.user.id && m.channel.id === interaction.channel.id;
      const collector = interaction.channel.createMessageCollector({ filter, time: 60000, max: 1 });

      collector.on('collect', async (msg) => {
        const nick = msg.content.trim();
        msg.delete().catch(() => {});

        if (state.players.find(p => p.id === interaction.user.id)) return;
        if (state.players.length >= cfg.maxPlayers) {
          return interaction.editReply({ content: '❌ Fila já está cheia!', embeds: [], components: [] });
        }

        state.players.push({ id: interaction.user.id, name: interaction.user.username, nick, gel: gelType });

        // Update original queue message
        try {
          await interaction.message.edit({
            embeds: [buildQueueEmbed(mode, state.value)],
            components: [buildQueueButtons(mode)],
          });
        } catch {}

        await interaction.editReply({
          content: `✅ Você entrou na fila **${mode}** (Gel ${gelType}) como \`${nick}\`!`,
          embeds: [], components: []
        });

        // Check if queue is full
        if (state.players.length >= cfg.maxPlayers) {
          const fullEmbed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle(`🏆 Fila ${mode} COMPLETA!`)
            .setDescription(
              `**Valor por jogador:** R$ ${state.value.toFixed(2).replace('.', ',')}\n\n` +
              `**Jogadores:**\n` +
              state.players.map((p, i) => `\`${i + 1}.\` <@${p.id}> — \`${p.nick}\` (Gel ${p.gel})`).join('\n') +
              `\n\n> ⚔️ Boa sorte a todos!`
            )
            .setTimestamp();

          await interaction.channel.send({
            content: state.players.map(p => `<@${p.id}>`).join(' '),
            embeds: [fullEmbed]
          });

          // Reset queue
          queues[mode] = { players: [], value: state.value };
          try {
            await interaction.message.edit({
              embeds: [buildQueueEmbed(mode, state.value)],
              components: [buildQueueButtons(mode)],
            });
          } catch {}
        }
      });

      collector.on('end', (collected) => {
        if (collected.size === 0) {
          interaction.editReply({ content: '⏰ Tempo esgotado. Você não entrou na fila.', embeds: [], components: [] }).catch(() => {});
        }
      });

      return;
    }

    // Queue leave
    if (id.startsWith('queue_sair_')) {
      const mode = id.replace('queue_sair_', '');
      const state = getQueueState(mode);
      const idx = state.players.findIndex(p => p.id === interaction.user.id);

      if (idx === -1) return interaction.reply({ content: '⚠️ Você não está na fila.', ephemeral: true });

      state.players.splice(idx, 1);
      try {
        await interaction.message.edit({
          embeds: [buildQueueEmbed(mode, state.value)],
          components: [buildQueueButtons(mode)],
        });
      } catch {}
      return interaction.reply({ content: `✅ Você saiu da fila **${mode}**.`, ephemeral: true });
    }

    // Cancel confirm button
    if (id === 'queue_cancel_confirm') {
      return interaction.update({ content: '❌ Cancelado.', embeds: [], components: [] });
    }

    // ── TICKET BUTTONS ─────────────────────────────────────────────────────
    if (id.startsWith('ticket_close_')) {
      const ticketInfo = tickets[interaction.channel.id];
      const isStaff = config.staffRole && interaction.member.roles.cache.has(config.staffRole);
      const isOwner = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
      if (!isStaff && !isOwner) return interaction.reply({ content: '❌ Sem permissão para fechar ticket.', ephemeral: true });

      const embed = new EmbedBuilder()
        .setColor(0xE74C3C)
        .setTitle('🔒 Ticket Encerrado')
        .setDescription(`Ticket encerrado por ${interaction.user}.\nCanal será deletado em 5 segundos.`)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
      return;
    }

    if (id.startsWith('ticket_notify_')) {
      // Notify the ticket creator
      const ticketInfo = tickets[interaction.channel.id];
      if (!ticketInfo) return interaction.reply({ content: '❌ Ticket não encontrado.', ephemeral: true });
      try {
        const user = await client.users.fetch(ticketInfo.userId);
        await user.send({
          embeds: [new EmbedBuilder()
            .setColor(0x3498DB)
            .setTitle('🔔 Notificação do seu Ticket — ORG TIGRE')
            .setDescription(`Uma mensagem foi enviada no seu ticket de **${TICKET_TYPES[ticketInfo.type]?.label || ticketInfo.type}**!\nClique aqui para ver: <#${interaction.channel.id}>`)
            .setTimestamp()
          ]
        });
        await interaction.reply({ content: '✅ Membro notificado por DM!', ephemeral: true });
      } catch {
        await interaction.reply({ content: '❌ Não foi possível notificar o membro (DM fechada).', ephemeral: true });
      }
      return;
    }

    if (id.startsWith('ticket_ban_')) {
      const ticketInfo = tickets[interaction.channel.id];
      if (!ticketInfo) return interaction.reply({ content: '❌ Ticket não encontrado.', ephemeral: true });
      const isStaff = config.staffRole && interaction.member.roles.cache.has(config.staffRole);
      const isOwner = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
      if (!isStaff && !isOwner) return interaction.reply({ content: '❌ Sem permissão.', ephemeral: true });

      try {
        const member = await interaction.guild.members.fetch(ticketInfo.userId);
        await member.ban({ reason: `Banido via ticket por ${interaction.user.tag}` });
        await interaction.reply({ content: `✅ Membro <@${ticketInfo.userId}> foi banido!` });
      } catch {
        await interaction.reply({ content: '❌ Não foi possível banir o membro.', ephemeral: true });
      }
      return;
    }

    if (id.startsWith('ticket_mute_')) {
      const ticketInfo = tickets[interaction.channel.id];
      if (!ticketInfo) return interaction.reply({ content: '❌ Ticket não encontrado.', ephemeral: true });
      const isStaff = config.staffRole && interaction.member.roles.cache.has(config.staffRole);
      const isOwner = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
      if (!isStaff && !isOwner) return interaction.reply({ content: '❌ Sem permissão.', ephemeral: true });

      try {
        const member = await interaction.guild.members.fetch(ticketInfo.userId);
        await member.timeout(10 * 60 * 1000, `Castigo via ticket por ${interaction.user.tag}`);
        await interaction.reply({ content: `✅ Membro <@${ticketInfo.userId}> recebeu castigo de 10 minutos!` });
      } catch {
        await interaction.reply({ content: '❌ Não foi possível dar castigo ao membro.', ephemeral: true });
      }
      return;
    }

    if (id.startsWith('ticket_add_')) {
      // Handled in select menu; here show modal or collector
      const ticketInfo = tickets[interaction.channel.id];
      if (!ticketInfo) return interaction.reply({ content: '❌ Ticket não encontrado.', ephemeral: true });

      await interaction.reply({ content: '👤 Mencione o membro que deseja adicionar neste ticket (envie @membro no chat):', ephemeral: true });

      const filter = m => m.author.id === interaction.user.id && m.channel.id === interaction.channel.id && m.mentions.members.size > 0;
      const collector = interaction.channel.createMessageCollector({ filter, time: 30000, max: 1 });

      collector.on('collect', async (msg) => {
        const target = msg.mentions.members.first();
        msg.delete().catch(() => {});
        await interaction.channel.permissionOverwrites.create(target, {
          ViewChannel: true,
          SendMessages: true,
        });
        await interaction.channel.send({ content: `✅ <@${target.id}> foi adicionado ao ticket por <@${interaction.user.id}>.` });
      });

      collector.on('end', (c) => {
        if (c.size === 0) interaction.editReply({ content: '⏰ Tempo esgotado.' }).catch(() => {});
      });
      return;
    }
  }

  // ── TICKET SELECT MENU ─────────────────────────────────────────────────────
  if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select') {
    const type = interaction.values[0];
    const ticketInfo = TICKET_TYPES[type];

    // Check if user already has open ticket
    const existing = Object.entries(tickets).find(([, t]) => t.userId === interaction.user.id && t.type === type);
    if (existing) {
      return interaction.reply({ content: `⚠️ Você já tem um ticket de **${ticketInfo.label}** aberto: <#${existing[0]}>`, ephemeral: true });
    }

    // Create ticket channel
    const category = config.ticketCategory || null;
    let channel;
    try {
      channel = await interaction.guild.channels.create({
        name: `ticket-${type.toLowerCase()}-${interaction.user.username}`,
        type: ChannelType.GuildText,
        parent: category,
        permissionOverwrites: [
          { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
          { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] },
          ...(config.staffRole ? [{ id: config.staffRole, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }] : []),
        ],
      });
    } catch (e) {
      return interaction.reply({ content: '❌ Erro ao criar canal de ticket. Verifique as permissões do bot.', ephemeral: true });
    }

    tickets[channel.id] = { userId: interaction.user.id, type, membersAdded: [] };

    // Member panel
    const memberPanel = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`ticket_add_${channel.id}`).setLabel('➕ Adicionar Membro').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`ticket_notify_${channel.id}`).setLabel('🔔 Notificar Membro').setStyle(ButtonStyle.Secondary),
    );

    // Staff panel
    const staffPanel = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`ticket_ban_${channel.id}`).setLabel('🔨 Banir Membro').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`ticket_mute_${channel.id}`).setLabel('🔇 Dar Castigo').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`ticket_close_${channel.id}`).setLabel('🔒 Fechar Ticket').setStyle(ButtonStyle.Secondary),
    );

    const embed = new EmbedBuilder()
      .setColor(ticketInfo.color)
      .setTitle(`${ticketInfo.emoji} Ticket — ${ticketInfo.label}`)
      .setDescription(
        `Olá <@${interaction.user.id}>! Bem-vindo ao seu ticket.\n\n` +
        `📋 **Tipo:** ${ticketInfo.label}\n` +
        `🕐 **Aberto em:** <t:${Math.floor(Date.now() / 1000)}:F>\n\n` +
        `> Descreva seu problema abaixo. Nossa equipe irá te atender em breve!`
      )
      .addFields(
        { name: '👤 Painel do Membro', value: 'Adicione membros ou notifique o atendente.', inline: true },
        { name: '🛡️ Painel Staff', value: 'Opções exclusivas para a equipe.', inline: true },
      )
      .setFooter({ text: 'ORG TIGRE • Sistema de Tickets' })
      .setTimestamp();

    await channel.send({
      content: `<@${interaction.user.id}>${config.staffRole ? ` | <@&${config.staffRole}>` : ''}`,
      embeds: [embed],
      components: [memberPanel, staffPanel],
    });

    await interaction.reply({ content: `✅ Seu ticket foi aberto: ${channel}`, ephemeral: true });
  }
});

// ─── LOGIN ───────────────────────────────────────────────────────────────────
const TOKEN = process.env.DISCORD_TOKEN || config.token || 'SEU_TOKEN_AQUI';
client.login(TOKEN);
