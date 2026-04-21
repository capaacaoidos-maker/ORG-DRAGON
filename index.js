const {
  Client, GatewayIntentBits, Partials, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, PermissionFlagsBits, ChannelType
} = require('discord.js');
const fs = require('fs');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel, Partials.Message],
});

let config = {};
if (fs.existsSync('./config.json')) {
  config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
}

function saveConfig() {
  fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
}

const queues = {};
const tickets = {};

const QUEUE_MODES = {
  '1x1': { label: '1x1', maxPlayers: 2, emoji: '⚔️' },
  '2x2': { label: '2x2', maxPlayers: 4, emoji: '🔥' },
  '3x3': { label: '3x3', maxPlayers: 6, emoji: '💥' },
  '4x4': { label: '4x4', maxPlayers: 8, emoji: '🏆' },
};

const PRICES = [300.00, 200.00, 100.00, 80.00, 75.00, 50.00, 30.00, 20.00, 10.00, 5.00, 2.00, 1.00, 0.75, 0.50, 0.30];

const PIX = 'theustheusx86@gmail.com';
const TAXA = 0.10;

const TICKET_TYPES = {
  REEMBOLSO: { label: '💰 Reembolso', emoji: '💰', color: 0xF4D03F },
  MEDIADOR: { label: '🤝 Vagas Mediador', emoji: '🤝', color: 0x2ECC71 },
  SUPORTE: { label: '🎧 Suporte', emoji: '🎧', color: 0x3498DB },
  ANALISTA: { label: '📊 Vagas Analistas', emoji: '📊', color: 0x9B59B6 },
  WO: { label: '⚠️ W.O Sem Motivo', emoji: '⚠️', color: 0xE74C3C },
};

function getQueueState(mode) {
  if (!queues[mode]) queues[mode] = { players: [], value: 2.00 };
  return queues[mode];
}

function formatVal(v) {
  return `R$ ${v.toFixed(2).replace('.', ',')}`;
}

function buildQueueEmbed(mode, value) {
  const state = getQueueState(mode);
  const cfg = QUEUE_MODES[mode];
  const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const playerList = state.players.length > 0
    ? state.players.map((p, i) => `\`${i + 1}.\` <@${p.id}> — \`${p.nick} ${p.gel} ${p.arma || ''}\``).join('\n')
    : 'Nenhum jogador na fila ainda.';
  return new EmbedBuilder()
    .setColor(0xFFAA00)
    .setTitle(`${cfg.emoji} ORG TIGRE — Fila ${mode}`)
    .addFields(
      { name: '**MODO**', value: `fila ${mode}`, inline: true },
      { name: '**VALOR**', value: formatVal(value), inline: true },
      { name: `**JOGADORES (${state.players.length}/${cfg.maxPlayers})**`, value: playerList },
    )
    .setFooter({ text: `Use os botões abaixo para entrar ou sair da fila. | ${now}` })
    .setTimestamp();
}

function buildQueueButtons(mode) {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`queue_normal_ump_${mode}`).setLabel('Gel Normal FULL UMP').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`queue_normal_xm8_${mode}`).setLabel('Gel Normal FULL XM8').setStyle(ButtonStyle.Secondary),
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`queue_infinito_ump_${mode}`).setLabel('Gel Infinito FULL UMP').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`queue_infinito_xm8_${mode}`).setLabel('Gel Infinito FULL XM8').setStyle(ButtonStyle.Primary),
  );
  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`queue_sair_${mode}`).setLabel('Sair da Fila').setStyle(ButtonStyle.Danger),
  );
  return [row1, row2, row3];
}

client.once('ready', () => {
  console.log(`✅ Bot online como ${client.user.tag}`);
  setInterval(async () => {
    if (!config.promoChannels || config.promoChannels.length === 0) return;
    const embed = new EmbedBuilder()
      .setColor(0xFFAA00)
      .setTitle('⭐ MELHOR ORG DE TODAS ⭐')
      .setDescription('> 🏆 **ORG TIGRE** é a melhor organização de Free Fire!\n> 💰 Apostas seguras, mediadores confiáveis\n> ⚡ Entre na fila agora e mostre seu skill!')
      .setFooter({ text: 'ORG TIGRE • Free Fire' })
      .setTimestamp();
    for (const chId of config.promoChannels) {
      try { const ch = await client.channels.fetch(chId); if (ch) await ch.send({ embeds: [embed] }); } catch {}
    }
  }, 20 * 60 * 1000);
});

client.on('messageCreate', async (message) => {
  if (!message.guild || message.author.bot) return;
  if (!message.content.startsWith('!')) return;
  const args = message.content.slice(1).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();
  const isAdmin = message.member.permissions.has(PermissionFlagsBits.Administrator);

  if (cmd === 'fila') {
    if (!isAdmin) return message.reply('❌ Sem permissão.');
    const mode = args[0];
    if (!QUEUE_MODES[mode]) return message.reply(`❌ Modo inválido. Use: ${Object.keys(QUEUE_MODES).join(', ')}`);
    const value = parseFloat(args[1]) || getQueueState(mode).value;
    getQueueState(mode).value = value;
    await message.channel.send({ embeds: [buildQueueEmbed(mode, value)], components: buildQueueButtons(mode) });
    message.delete().catch(() => {});
  }

  if (cmd === 'allfilas') {
    if (!isAdmin) return message.reply('❌ Sem permissão.');
    for (const mode of Object.keys(QUEUE_MODES)) {
      for (const price of PRICES) {
        const state = getQueueState(mode);
        state.value = price;
        await message.channel.send({ embeds: [buildQueueEmbed(mode, price)], components: buildQueueButtons(mode) });
        await new Promise(r => setTimeout(r, 400));
      }
    }
    message.delete().catch(() => {});
  }

  if (cmd === 'ticket') {
    if (!isAdmin) return message.reply('❌ Sem permissão.');
    const embed = new EmbedBuilder()
      .setColor(0xFFAA00).setTitle('🎫 CENTRAL DE TICKETS — ORG TIGRE')
      .setDescription('Selecione o tipo de atendimento que deseja abrir.\nNossa equipe irá te atender em breve!')
      .addFields(
        { name: '💰 Reembolso', value: 'Solicitar devolução', inline: true },
        { name: '🤝 Vagas Mediador', value: 'Candidatura', inline: true },
        { name: '🎧 Suporte', value: 'Ajuda geral', inline: true },
        { name: '📊 Vagas Analistas', value: 'Candidatura', inline: true },
        { name: '⚠️ W.O Sem Motivo', value: 'Reportar abandono', inline: true },
      ).setFooter({ text: 'ORG TIGRE • Tickets' }).setTimestamp();
    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder().setCustomId('ticket_select').setPlaceholder('📋 Escolha o tipo...')
        .addOptions(Object.entries(TICKET_TYPES).map(([key, val]) => ({ label: val.label, value: key, emoji: val.emoji })))
    );
    await message.channel.send({ embeds: [embed], components: [row] });
    message.delete().catch(() => {});
  }

  if (cmd === 'setpromo') {
    if (!isAdmin) return message.reply('❌ Sem permissão.');
    const ch = message.mentions.channels.first();
    if (!ch) return message.reply('❌ Mencione um canal.');
    if (!config.promoChannels) config.promoChannels = [];
    if (!config.promoChannels.includes(ch.id)) config.promoChannels.push(ch.id);
    saveConfig();
    message.reply(`✅ Canal ${ch} adicionado para promoção.`);
  }

  if (cmd === 'setticketcat') {
    if (!isAdmin) return message.reply('❌ Sem permissão.');
    config.ticketCategory = args[0]; saveConfig();
    message.reply(`✅ Categoria de tickets: \`${args[0]}\``);
  }

  if (cmd === 'setstaff') {
    if (!isAdmin) return message.reply('❌ Sem permissão.');
    const role = message.mentions.roles.first();
    if (!role) return message.reply('❌ Mencione um cargo.');
    config.staffRole = role.id; saveConfig();
    message.reply(`✅ Cargo staff: ${role}`);
  }

  if (cmd === 'setfilacat') {
    if (!isAdmin) return message.reply('❌ Sem permissão.');
    config.filaCategory = args[0]; saveConfig();
    message.reply(`✅ Categoria de filas: \`${args[0]}\``);
  }
});

client.on('interactionCreate', async (interaction) => {

  if (interaction.isButton()) {
    const id = interaction.customId;

    if (id.startsWith('queue_normal_ump_') || id.startsWith('queue_normal_xm8_') ||
        id.startsWith('queue_infinito_ump_') || id.startsWith('queue_infinito_xm8_')) {

      let gelType, arma, mode;
      if (id.startsWith('queue_normal_ump_'))      { gelType = 'Gel Normal';   arma = 'FULL UMP'; mode = id.replace('queue_normal_ump_', ''); }
      else if (id.startsWith('queue_normal_xm8_')) { gelType = 'Gel Normal';   arma = 'FULL XM8'; mode = id.replace('queue_normal_xm8_', ''); }
      else if (id.startsWith('queue_infinito_ump_')){ gelType = 'Gel Infinito'; arma = 'FULL UMP'; mode = id.replace('queue_infinito_ump_', ''); }
      else                                          { gelType = 'Gel Infinito'; arma = 'FULL XM8'; mode = id.replace('queue_infinito_xm8_', ''); }

      const state = getQueueState(mode);
      const cfg = QUEUE_MODES[mode];

      if (state.players.find(p => p.id === interaction.user.id))
        return interaction.reply({ content: '⚠️ Você já está na fila!', ephemeral: true });
      if (state.players.length >= cfg.maxPlayers)
        return interaction.reply({ content: '❌ Fila cheia!', ephemeral: true });

      const nick = interaction.member.displayName;
      state.players.push({ id: interaction.user.id, name: interaction.user.username, nick, gel: gelType, arma });

      try { await interaction.message.edit({ embeds: [buildQueueEmbed(mode, state.value)], components: buildQueueButtons(mode) }); } catch {}
      await interaction.reply({ content: `✅ Na fila **${mode}** — \`${nick} ${gelType} ${arma}\`!`, ephemeral: true });

      if (state.players.length >= cfg.maxPlayers) {
        const players = [...state.players];
        queues[mode] = { players: [], value: state.value };
        try { await interaction.message.edit({ embeds: [buildQueueEmbed(mode, state.value)], components: buildQueueButtons(mode) }); } catch {}

        const nomes = players.map(p => p.name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10)).join('-');
        let filaChannel;
        try {
          filaChannel = await interaction.guild.channels.create({
            name: `fila-${nomes}`,
            type: ChannelType.GuildText,
            parent: config.filaCategory || null,
            permissionOverwrites: [
              { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
              { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageRoles] },
              ...players.map(p => ({ id: p.id, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages] })),
              ...(config.staffRole ? [{ id: config.staffRole, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }] : []),
            ],
          });
        } catch (e) { console.error('Erro canal fila:', e); return; }

        tickets[filaChannel.id] = { type: 'fila', mode, value: state.value, players, confirmed: [] };

        const filaEmbed = new EmbedBuilder()
          .setColor(0xFFAA00)
          .setTitle(`⚔️ FILA ${mode} — ${formatVal(state.value)} | ORG TIGRE`)
          .setDescription(
            `> 🔇 Canal só leitura até ambos confirmarem!\n\n` +
            `**Jogadores:**\n` +
            players.map((p, i) => `\`${i + 1}.\` <@${p.id}> — \`${p.nick} ${p.gel} ${p.arma}\``).join('\n') +
            `\n\n**Valor:** ${formatVal(state.value)}\n**Taxa ADM:** R$ ${TAXA.toFixed(2).replace('.', ',')}\n\n` +
            `> Clique em ✅ **Confirmar** para liberar o canal!`
          )
          .setFooter({ text: 'ORG TIGRE • Free Fire' }).setTimestamp();

        const confirmRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`fila_confirmar_${filaChannel.id}`).setLabel('✅ Confirmar').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`fila_fechar_${filaChannel.id}`).setLabel('🔒 Fechar Fila').setStyle(ButtonStyle.Danger),
        );

        await filaChannel.send({
          content: players.map(p => `<@${p.id}>`).join(' '),
          embeds: [filaEmbed],
          components: [confirmRow],
        });
      }
      return;
    }

    if (id.startsWith('queue_sair_')) {
      const mode = id.replace('queue_sair_', '');
      const state = getQueueState(mode);
      const idx = state.players.findIndex(p => p.id === interaction.user.id);
      if (idx === -1) return interaction.reply({ content: '⚠️ Você não está na fila.', ephemeral: true });
      state.players.splice(idx, 1);
      try { await interaction.message.edit({ embeds: [buildQueueEmbed(mode, state.value)], components: buildQueueButtons(mode) }); } catch {}
      return interaction.reply({ content: `✅ Saiu da fila **${mode}**.`, ephemeral: true });
    }

    if (id.startsWith('fila_confirmar_')) {
      const filaInfo = tickets[interaction.channel.id];
      if (!filaInfo) return interaction.reply({ content: '❌ Dados não encontrados.', ephemeral: true });
      const isPlayer = filaInfo.players.find(p => p.id === interaction.user.id);
      if (!isPlayer) return interaction.reply({ content: '❌ Você não faz parte desta fila.', ephemeral: true });
      if (filaInfo.confirmed.includes(interaction.user.id))
        return interaction.reply({ content: '⚠️ Você já confirmou!', ephemeral: true });

      filaInfo.confirmed.push(interaction.user.id);
      await interaction.channel.permissionOverwrites.edit(interaction.user.id, { ViewChannel: true, SendMessages: true });
      await interaction.reply({ content: `✅ <@${interaction.user.id}> confirmou! (${filaInfo.confirmed.length}/${filaInfo.players.length})` });

      if (filaInfo.confirmed.length >= filaInfo.players.length) {
        for (const p of filaInfo.players) {
          await interaction.channel.permissionOverwrites.edit(p.id, { ViewChannel: true, SendMessages: true }).catch(() => {});
        }
        const total = filaInfo.value + TAXA;
        await interaction.channel.send({
          embeds: [new EmbedBuilder()
            .setColor(0x00C896)
            .setTitle('✅ FILA CONFIRMADA — ORG TIGRE')
            .setDescription(
              `> Todos confirmaram! Canal liberado! 🎉\n\n` +
              `💰 **Valor da aposta:** ${formatVal(filaInfo.value)}\n` +
              `📊 **Taxa ADM:** R$ ${TAXA.toFixed(2).replace('.', ',')}\n` +
              `💸 **Total a pagar:** ${formatVal(total)}\n\n` +
              `**📲 Chave PIX:**\n\`\`\`${PIX}\`\`\`\n` +
              `> Envie o comprovante após pagar!`
            )
            .setFooter({ text: 'ORG TIGRE • Free Fire' }).setTimestamp()
          ]
        });
      }
      return;
    }

    if (id.startsWith('fila_fechar_')) {
      const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
      const isStaff = config.staffRole && interaction.member.roles.cache.has(config.staffRole);
      if (!isAdmin && !isStaff) return interaction.reply({ content: '❌ Sem permissão.', ephemeral: true });
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xE74C3C).setTitle('🔒 Fila Encerrada').setDescription(`Encerrado por ${interaction.user}. Canal deletado em 5s.`).setTimestamp()] });
      delete tickets[interaction.channel.id];
      setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
      return;
    }

    if (id.startsWith('ticket_close_')) {
      const isStaff = config.staffRole && interaction.member.roles.cache.has(config.staffRole);
      const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
      if (!isStaff && !isAdmin) return interaction.reply({ content: '❌ Sem permissão.', ephemeral: true });
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xE74C3C).setTitle('🔒 Ticket Encerrado').setDescription(`Encerrado por ${interaction.user}. Canal deletado em 5s.`).setTimestamp()] });
      setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
      return;
    }

    if (id.startsWith('ticket_notify_')) {
      const ticketInfo = tickets[interaction.channel.id];
      if (!ticketInfo) return interaction.reply({ content: '❌ Ticket não encontrado.', ephemeral: true });
      try {
        const user = await client.users.fetch(ticketInfo.userId);
        await user.send({ embeds: [new EmbedBuilder().setColor(0x3498DB).setTitle('🔔 Notificação — ORG TIGRE').setDescription(`Mensagem no seu ticket! <#${interaction.channel.id}>`).setTimestamp()] });
        await interaction.reply({ content: '✅ Notificado!', ephemeral: true });
      } catch { await interaction.reply({ content: '❌ DM fechada.', ephemeral: true }); }
      return;
    }

    if (id.startsWith('ticket_ban_')) {
      const ticketInfo = tickets[interaction.channel.id];
      if (!ticketInfo) return interaction.reply({ content: '❌ Ticket não encontrado.', ephemeral: true });
      const isStaff = config.staffRole && interaction.member.roles.cache.has(config.staffRole);
      const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
      if (!isStaff && !isAdmin) return interaction.reply({ content: '❌ Sem permissão.', ephemeral: true });
      try {
        const member = await interaction.guild.members.fetch(ticketInfo.userId);
        await member.ban({ reason: `Banido por ${interaction.user.tag}` });
        await interaction.reply({ content: `✅ <@${ticketInfo.userId}> banido!` });
      } catch { await interaction.reply({ content: '❌ Erro ao banir.', ephemeral: true }); }
      return;
    }

    if (id.startsWith('ticket_mute_')) {
      const ticketInfo = tickets[interaction.channel.id];
      if (!ticketInfo) return interaction.reply({ content: '❌ Ticket não encontrado.', ephemeral: true });
      const isStaff = config.staffRole && interaction.member.roles.cache.has(config.staffRole);
      const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
      if (!isStaff && !isAdmin) return interaction.reply({ content: '❌ Sem permissão.', ephemeral: true });
      try {
        const member = await interaction.guild.members.fetch(ticketInfo.userId);
        await member.timeout(10 * 60 * 1000, `Castigo por ${interaction.user.tag}`);
        await interaction.reply({ content: `✅ <@${ticketInfo.userId}> 10 min de castigo!` });
      } catch { await interaction.reply({ content: '❌ Erro ao dar castigo.', ephemeral: true }); }
      return;
    }

    if (id.startsWith('ticket_add_')) {
      const ticketInfo = tickets[interaction.channel.id];
      if (!ticketInfo) return interaction.reply({ content: '❌ Ticket não encontrado.', ephemeral: true });
      await interaction.reply({ content: '👤 Mencione o membro no chat (@membro):', ephemeral: true });
      const filter = m => m.author.id === interaction.user.id && m.mentions.members.size > 0;
      const collector = interaction.channel.createMessageCollector({ filter, time: 30000, max: 1 });
      collector.on('collect', async (msg) => {
        const target = msg.mentions.members.first();
        msg.delete().catch(() => {});
        await interaction.channel.permissionOverwrites.create(target, { ViewChannel: true, SendMessages: true });
        await interaction.channel.send({ content: `✅ <@${target.id}> adicionado por <@${interaction.user.id}>.` });
      });
      return;
    }
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select') {
    const type = interaction.values[0];
    const ticketInfo = TICKET_TYPES[type];
    const existing = Object.entries(tickets).find(([, t]) => t.userId === interaction.user.id && t.type === type);
    if (existing) return interaction.reply({ content: `⚠️ Ticket já aberto: <#${existing[0]}>`, ephemeral: true });

    let channel;
    try {
      channel = await interaction.guild.channels.create({
        name: `ticket-${type.toLowerCase()}-${interaction.user.username}`,
        type: ChannelType.GuildText,
        parent: config.ticketCategory || null,
        permissionOverwrites: [
          { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
          { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] },
          ...(config.staffRole ? [{ id: config.staffRole, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }] : []),
        ],
      });
    } catch { return interaction.reply({ content: '❌ Erro ao criar ticket.', ephemeral: true }); }

    tickets[channel.id] = { userId: interaction.user.id, type, membersAdded: [] };

    const memberPanel = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`ticket_add_${channel.id}`).setLabel('➕ Adicionar Membro').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`ticket_notify_${channel.id}`).setLabel('🔔 Notificar').setStyle(ButtonStyle.Secondary),
    );
    const staffPanel = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`ticket_ban_${channel.id}`).setLabel('🔨 Banir').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`ticket_mute_${channel.id}`).setLabel('🔇 Castigo').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`ticket_close_${channel.id}`).setLabel('🔒 Fechar').setStyle(ButtonStyle.Secondary),
    );

    await channel.send({
      content: `<@${interaction.user.id}>${config.staffRole ? ` <@&${config.staffRole}>` : ''}`,
      embeds: [new EmbedBuilder()
        .setColor(ticketInfo.color)
        .setTitle(`${ticketInfo.emoji} Ticket — ${ticketInfo.label}`)
        .setDescription(`Olá <@${interaction.user.id}>!\n\n📋 **Tipo:** ${ticketInfo.label}\n🕐 **Aberto em:** <t:${Math.floor(Date.now() / 1000)}:F>\n\n> Descreva seu problema!`)
        .setFooter({ text: 'ORG TIGRE • Tickets' }).setTimestamp()
      ],
      components: [memberPanel, staffPanel],
    });

    await interaction.reply({ content: `✅ Ticket aberto: ${channel}`, ephemeral: true });
  }
});

const TOKEN = process.env.DISCORD_TOKEN || config.token || 'SEU_TOKEN_AQUI';
client.login(TOKEN);
