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

// ── CONFIG ─────────────────────────────────────────────────────────────
let config = {};
if (fs.existsSync('./config.json')) {
  try { config = JSON.parse(fs.readFileSync('./config.json', 'utf8')); } catch {}
}
function saveConfig() { fs.writeFileSync('./config.json', JSON.stringify(config, null, 2)); }

// Categoria fixa das filas
config.filaCategory = '1499177304528523344';

// ── PERSISTÊNCIA ───────────────────────────────────────────────────────
let tickets = {};
let queues = {};

if (fs.existsSync('./tickets.json')) { try { tickets = JSON.parse(fs.readFileSync('./tickets.json', 'utf8')); } catch {} }
if (fs.existsSync('./queues.json'))  { try { queues  = JSON.parse(fs.readFileSync('./queues.json',  'utf8')); } catch {} }

function saveTickets() { fs.writeFileSync('./tickets.json', JSON.stringify(tickets, null, 2)); }
function saveQueues()  { fs.writeFileSync('./queues.json',  JSON.stringify(queues,  null, 2)); }

// ── CONSTANTS ──────────────────────────────────────────────────────────
const QUEUE_MODES = {
  '1x1': { label: '1x1', maxPlayers: 2, emoji: '⚔️' },
  '2x2': { label: '2x2', maxPlayers: 4, emoji: '🔥' },
  '3x3': { label: '3x3', maxPlayers: 6, emoji: '💥' },
  '4x4': { label: '4x4', maxPlayers: 8, emoji: '🏆' },
};

const PRICES = [300.00, 200.00, 100.00, 80.00, 75.00, 50.00, 30.00, 20.00, 10.00, 5.00, 2.00, 1.00, 0.75, 0.50, 0.30];
const PIX  = 'theustheusx86@gmail.com';
const TAXA = 0.10;

const TICKET_TYPES = {
  REEMBOLSO: { label: '💰 Reembolso',      emoji: '💰', color: 0xF4D03F },
  MEDIADOR:  { label: '🤝 Vagas Mediador', emoji: '🤝', color: 0x2ECC71 },
  SUPORTE:   { label: '🎧 Suporte',        emoji: '🎧', color: 0x3498DB },
  ANALISTA:  { label: '📊 Vagas Analistas',emoji: '📊', color: 0x9B59B6 },
  WO:        { label: '⚠️ W.O Sem Motivo', emoji: '⚠️', color: 0xE74C3C },
};

// ── HELPERS ────────────────────────────────────────────────────────────
function getQueueState(mode) {
  if (!queues[mode]) queues[mode] = { players: [], value: 2.00 };
  return queues[mode];
}

function formatVal(v) { return 'R$ ' + v.toFixed(2).replace('.', ','); }

function buildQueueEmbed(mode, value) {
  const state = getQueueState(mode);
  const cfg   = QUEUE_MODES[mode];
  const now   = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const playerList = state.players.length > 0
    ? state.players.map((p, i) => `\`${i+1}.\` <@${p.id}> — \`${p.nick} ${p.gel}${p.arma ? ' '+p.arma : ''}\``).join('\n')
    : 'Nenhum jogador na fila ainda.';
  return new EmbedBuilder()
    .setColor(0xFFAA00)
    .setTitle(`${cfg.emoji} ORG TIGRE — Fila ${mode}`)
    .setThumbnail('https://cdn.discordapp.com/attachments/1496595221658734803/1496635858147610794/9c07dbdcad30a218dfbe667afb87438d.jpg')
    .addFields(
      { name: '**MODO**',  value: `fila ${mode}`,  inline: true },
      { name: '**VALOR**', value: formatVal(value), inline: true },
      { name: `**JOGADORES (${state.players.length}/${cfg.maxPlayers})**`, value: playerList },
    )
    .setFooter({ text: `Use os botões abaixo para entrar ou sair da fila. | ${now}` })
    .setTimestamp();
}

function buildQueueButtons(mode) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`queue_normal_${mode}`).setLabel('Gel Normal').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`queue_infinito_${mode}`).setLabel('Gel Infinito').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`queue_sair_${mode}`).setLabel('Sair da Fila').setStyle(ButtonStyle.Danger),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`queue_arma_${mode}`).setLabel('FULL UMP XM8').setStyle(ButtonStyle.Primary),
    ),
  ];
}

// ── CRIAR CANAL DE FILA ────────────────────────────────────────────────
async function criarCanalFila(interaction, mode, state) {
  const players = [...state.players];
  queues[mode] = { players: [], value: state.value };
  saveQueues();

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
  saveTickets();

  const filaEmbed = new EmbedBuilder()
    .setColor(0xFFAA00)
    .setTitle(`⚔️ FILA ${mode} — ${formatVal(state.value)} | ORG TIGRE`)
    .setDescription(
      `> 🔇 Canal só leitura até ambos confirmarem!\n\n**Jogadores:**\n` +
      players.map((p, i) => `\`${i+1}.\` <@${p.id}> — \`${p.nick} ${p.gel}${p.arma ? ' '+p.arma : ''}\``).join('\n') +
      `\n\n**Valor:** ${formatVal(state.value)}\n**Taxa ADM:** R$ ${TAXA.toFixed(2).replace('.', ',')}\n\n` +
      `> Clique em ✅ **Confirmar** para liberar o canal!`
    )
    .setFooter({ text: 'ORG TIGRE • Free Fire' }).setTimestamp();

  await filaChannel.send({
    content: players.map(p => `<@${p.id}>`).join(' '),
    embeds: [filaEmbed],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`fila_confirmar_${filaChannel.id}`).setLabel('✅ Confirmar').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`fila_fechar_${filaChannel.id}`).setLabel('🔒 Fechar Fila').setStyle(ButtonStyle.Danger),
    )],
  });

  // ── Notificar adm para confirmar AP ────────────────────────────────
  try {
    const admCh = await client.channels.fetch('1499187056805412954');
    const pixPlayers = players.map(p => {
      const pix = config.pixUsers?.[p.id];
      return `<@${p.id}> — \`${p.nick}\` | PIX: ${pix ? `\`${pix}\`` : '❌ Não registrado'}`;
    }).join('\n');

    await admCh.send({
      embeds: [new EmbedBuilder()
        .setColor(0xFFAA00)
        .setTitle('⚔️ NOVA FILA CRIADA — Confirmar AP')
        .setDescription(
          `**Modo:** ${mode}\n**Valor:** ${formatVal(state.value)}\n**Canal:** <#${filaChannel.id}>\n\n` +
          `**Jogadores e PIX:**\n${pixPlayers}`
        )
        .setFooter({ text: 'ORG TIGRE • Confirmar AP' }).setTimestamp()],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`adm_confirmar_ap_${filaChannel.id}`).setLabel('✅ Confirmar AP').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`adm_recusar_ap_${filaChannel.id}`).setLabel('❌ Recusar').setStyle(ButtonStyle.Danger),
      )],
    });
  } catch (e) { console.error('Erro ao notificar adm:', e); }
}

// ── READY ──────────────────────────────────────────────────────────────
client.once('ready', () => {
  console.log(`✅ Bot online como ${client.user.tag}`);
  setInterval(async () => {
    if (!config.promoChannels?.length) return;
    const embed = new EmbedBuilder().setColor(0xFFAA00)
      .setTitle('⭐ MELHOR ORG DE TODAS ⭐')
      .setDescription('> 🏆 **ORG TIGRE** é a melhor organização de Free Fire!\n> 💰 Apostas seguras, mediadores confiáveis\n> ⚡ Entre na fila agora e mostre seu skill!')
      .setFooter({ text: 'ORG TIGRE • Free Fire' }).setTimestamp();
    for (const chId of config.promoChannels) {
      try { const ch = await client.channels.fetch(chId); if (ch) await ch.send({ embeds: [embed] }); } catch {}
    }
  }, 20 * 60 * 1000);
});

// ── COMMANDS ───────────────────────────────────────────────────────────
client.on('messageCreate', async (message) => {
  if (!message.guild || message.author.bot || !message.content.startsWith('!')) return;
  const args = message.content.slice(1).trim().split(/ +/);
  const cmd  = args.shift().toLowerCase();
  const isAdmin = message.member.permissions.has(PermissionFlagsBits.Administrator);
  if (!config.players) config.players = {};
  function getPlayer(id) {
    if (!config.players[id]) config.players[id] = { vitorias: 0, ganhas: 0, perdas: 0 };
    return config.players[id];
  }

  // !fila <modo> <valor>
  if (cmd === 'fila') {
    if (!isAdmin) return message.reply('❌ Sem permissão.');
    const mode = args[0];

    // ── FILA SUB ────────────────────────────────────────────────────────
    if (mode === 'sub') {
      if (!config.filaSubStatus) config.filaSubStatus = 'on';
      const embed = new EmbedBuilder()
        .setColor(0x9B59B6)
        .setTitle('🎁 AP GRÁTIS COM SUB — ORG TIGRE')
        .setDescription('> Clique no botão abaixo para entrar na fila de AP grátis com Sub!\n> Disponível apenas para assinantes.')
        .addFields({ name: '**JOGADORES (0/2)**', value: 'Nenhum jogador na fila ainda.' })
        .setFooter({ text: 'ORG TIGRE • Fila Sub' }).setTimestamp();
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('fila_sub_entrar').setLabel('AP GRÁTIS COM SUB DONO').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('fila_sub_sair').setLabel('Sair da Fila').setStyle(ButtonStyle.Danger),
      );
      await message.channel.send({ embeds: [embed], components: [row] });
      if (!config.filaSub) config.filaSub = { players: [] };
      config.filaSub.players = [];
      saveConfig();
      message.delete().catch(() => {});
      return;
    }

    // ── FILA DONO ───────────────────────────────────────────────────────
    if (mode === 'dono') {
      if (!config.filaDonoStatus) config.filaDonoStatus = 'on';
      const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('👑 AP GRÁTIS COM DONO — ORG TIGRE')
        .setDescription('> Clique no botão abaixo para entrar na fila de AP grátis com o Dono!\n> Aproveite essa oportunidade!')
        .addFields({ name: '**JOGADORES (0/2)**', value: 'Nenhum jogador na fila ainda.' })
        .setFooter({ text: 'ORG TIGRE • Fila Dono' }).setTimestamp();
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('fila_dono_entrar').setLabel('AP GRÁTIS COM DONO').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('fila_dono_sair').setLabel('Sair da Fila').setStyle(ButtonStyle.Danger),
      );
      await message.channel.send({ embeds: [embed], components: [row] });
      if (!config.filaDono) config.filaDono = { players: [] };
      config.filaDono.players = [];
      saveConfig();
      message.delete().catch(() => {});
      return;
    }

    // ── FILA SUB DONO (1x1 igual dono) ─────────────────────────────────
    if (mode === 'sub' && args[1] === 'dono') {
      // já tratado acima como dono
    }

    // ── OFF/ON SUB ──────────────────────────────────────────────────────
    if (mode === 'off' && args[1] === 'sub') {
      config.filaSubStatus = 'off'; saveConfig();
      return message.reply('✅ Fila Sub colocada **offline**! Membros verão a mensagem de fila off-line.');
    }
    if (mode === 'on' && args[1] === 'sub') {
      config.filaSubStatus = 'on'; saveConfig();
      return message.reply('✅ Fila Sub **ativada**!');
    }

    // ── OFF/ON DONO ─────────────────────────────────────────────────────
    if (mode === 'off' && args[1] === 'dono') {
      config.filaDonoStatus = 'off'; saveConfig();
      return message.reply('✅ Fila Dono colocada **offline**! Membros verão a mensagem de fila off-line.');
    }
    if (mode === 'on' && args[1] === 'dono') {
      config.filaDonoStatus = 'on'; saveConfig();
      return message.reply('✅ Fila Dono **ativada**!');
    }

    // ── FILA NORMAL ─────────────────────────────────────────────────────
    if (!QUEUE_MODES[mode]) return message.reply(`❌ Modo inválido. Use: ${Object.keys(QUEUE_MODES).join(', ')}, sub, dono`);
    const value = parseFloat(args[1]) || getQueueState(mode).value;
    getQueueState(mode).value = value;
    saveQueues();
    await message.channel.send({ embeds: [buildQueueEmbed(mode, value)], components: buildQueueButtons(mode) });
    message.delete().catch(() => {});
  }

  // !allfilas <modo>
  if (cmd === 'allfilas') {
    if (!isAdmin) return message.reply('❌ Sem permissão.');
    const mode = args[0];
    if (!mode || !QUEUE_MODES[mode]) return message.reply(`❌ Informe o modo. Ex: \`!allfilas 1x1\`\nModos: ${Object.keys(QUEUE_MODES).join(', ')}`);
    for (const price of PRICES) {
      getQueueState(mode).value = price;
      saveQueues();
      await message.channel.send({ embeds: [buildQueueEmbed(mode, price)], components: buildQueueButtons(mode) });
      await new Promise(r => setTimeout(r, 400));
    }
    message.delete().catch(() => {});
  }

  // !ticket
  if (cmd === 'ticket') {
    if (!isAdmin) return message.reply('❌ Sem permissão.');
    const embed = new EmbedBuilder().setColor(0xFFAA00)
      .setTitle('🎫 CENTRAL DE TICKETS — ORG TIGRE')
      .setDescription('Selecione o tipo de atendimento que deseja abrir.\nNossa equipe irá te atender em breve!')
      .addFields(
        { name: '💰 Reembolso',      value: 'Solicitar devolução',    inline: true },
        { name: '🤝 Vagas Mediador', value: 'Candidatura',            inline: true },
        { name: '🎧 Suporte',        value: 'Ajuda geral',            inline: true },
        { name: '📊 Vagas Analistas',value: 'Candidatura',            inline: true },
        { name: '⚠️ W.O Sem Motivo', value: 'Reportar abandono',      inline: true },
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
    saveConfig(); message.reply(`✅ Canal ${ch} adicionado para promoção.`);
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

  // !registrar pix <chave> — qualquer membro registra seu PIX
  if (cmd === 'registrar') {
    if (args[0]?.toLowerCase() !== 'pix') return;
    const chave = args[1];
    if (!chave) return message.reply('❌ Use: `!registrar pix suachave@email.com`');
    if (!config.pixUsers) config.pixUsers = {};
    config.pixUsers[message.author.id] = chave;
    saveConfig();
    message.reply({ embeds: [new EmbedBuilder().setColor(0x00C896)
      .setTitle('✅ PIX Registrado — ORG TIGRE')
      .setDescription(`Sua chave PIX foi registrada:\n\`\`\`${chave}\`\`\``)
      .setFooter({ text: 'ORG TIGRE' }).setTimestamp()] });
  }
  if (cmd === 'coin') {
    if (!isAdmin) return message.reply('❌ Sem permissão.');
    const target = message.mentions.members.first();
    const amount = parseInt(args[1]);
    if (!target) return message.reply('❌ Ex: `!coin @player 10`');
    if (isNaN(amount) || amount < 1 || amount > 100) return message.reply('❌ Valor de 1 a 100.');
    const p = getPlayer(target.id); p.vitorias += amount; p.ganhas += amount; saveConfig();
    message.reply({ embeds: [new EmbedBuilder().setColor(0xFFAA00).setTitle('🏆 ORG TIGRE')
      .setDescription(`✅ **${amount}** vitória(s) para <@${target.id}>!`)
      .addFields(
        { name: '🏆 Vitórias', value: `${p.vitorias}`, inline: true },
        { name: '✅ Ganhas',   value: `${p.ganhas}`,   inline: true },
        { name: '❌ Perdidas', value: `${p.perdas}`,   inline: true },
      ).setFooter({ text: 'ORG TIGRE' }).setTimestamp()] });
  }

  // !perdeu @player 50
  if (cmd === 'perdeu') {
    if (!isAdmin) return message.reply('❌ Sem permissão.');
    const target = message.mentions.members.first();
    const amount = parseInt(args[1]);
    if (!target) return message.reply('❌ Ex: `!perdeu @player 50`');
    if (isNaN(amount) || amount < 1 || amount > 2000) return message.reply('❌ Valor de 1 a 2000.');
    const p = getPlayer(target.id); p.perdas += amount; saveConfig();
    message.reply({ embeds: [new EmbedBuilder().setColor(0xE74C3C).setTitle('📊 ORG TIGRE')
      .setDescription(`📝 **${amount}** derrota(s) para <@${target.id}>!`)
      .addFields(
        { name: '🏆 Vitórias', value: `${p.vitorias}`, inline: true },
        { name: '✅ Ganhas',   value: `${p.ganhas}`,   inline: true },
        { name: '❌ Perdidas', value: `${p.perdas}`,   inline: true },
      ).setFooter({ text: 'ORG TIGRE' }).setTimestamp()] });
  }

  // !stats [@player]
  if (cmd === 'stats') {
    const target = message.mentions.members.first() || message.member;
    const p = getPlayer(target.id);
    message.reply({ embeds: [new EmbedBuilder().setColor(0xFFAA00).setTitle('🐯 ORG TIGRE')
      .setThumbnail(target.user.displayAvatarURL())
      .addFields(
        { name: '🏆 Vitórias',           value: `${p.vitorias}`, inline: true },
        { name: '✅ Ganhas',              value: `${p.ganhas}`,   inline: true },
        { name: '❌ Quantas você perdeu', value: `${p.perdas}`,   inline: true },
      ).setFooter({ text: `ORG TIGRE • ${target.displayName}` }).setTimestamp()] });
  }
});

// ── INTERACTIONS ───────────────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {

  // ── BUTTONS ────────────────────────────────────────────────────────────
  if (interaction.isButton()) {
    const id = interaction.customId;

    // ── ADM CONFIRMAR AP ───────────────────────────────────────────────
    if (id.startsWith('adm_confirmar_ap_')) {
      const isAdm  = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
      const isStaff = config.staffRole && interaction.member.roles.cache.has(config.staffRole);
      if (!isAdm && !isStaff) return interaction.reply({ content: '❌ Sem permissão.', ephemeral: true });

      const filaChId = id.replace('adm_confirmar_ap_', '');
      const filaInfo = tickets[filaChId];
      if (!filaInfo) return interaction.reply({ content: '❌ Fila não encontrada.', ephemeral: true });

      // Pegar PIX dos jogadores
      const pixList = filaInfo.players.map(p => {
        const pix = config.pixUsers?.[p.id];
        return `<@${p.id}> — \`${p.nick}\`\nPIX: ${pix ? `\`${pix}\`` : '❌ Não registrado'}`;
      }).join('\n\n');

      // PIX do adm que confirmou
      const admPix = config.pixUsers?.[interaction.user.id];

      await interaction.update({
        embeds: [new EmbedBuilder().setColor(0x00C896)
          .setTitle('✅ AP CONFIRMADO — ORG TIGRE')
          .setDescription(`Confirmado por ${interaction.user}`)
          .setFooter({ text: 'ORG TIGRE' }).setTimestamp()],
        components: []
      });

      // Mandar PIX dos jogadores no canal do adm
      try {
        const admCh = await client.channels.fetch('1499187056805412954');
        await admCh.send({ embeds: [new EmbedBuilder().setColor(0x00C896)
          .setTitle('💳 PIX dos Jogadores')
          .setDescription(`**Fila:** <#${filaChId}>\n\n${pixList}`)
          .setFooter({ text: 'ORG TIGRE • AP Confirmado' }).setTimestamp()] });
      } catch {}

      // Mandar no canal da fila avisando e mostrando PIX do adm
      try {
        const filaCh = await client.channels.fetch(filaChId);
        await filaCh.send({ embeds: [new EmbedBuilder().setColor(0x00C896)
          .setTitle('✅ AP CONFIRMADO PELO ADM!')
          .setDescription(
            `> O ADM confirmou o AP! \n\n` +
            `**📲 PIX do ADM (${interaction.user.username}):**\n` +
            `\`\`\`${admPix || 'ADM não registrou PIX ainda!'}\`\`\``
          )
          .setFooter({ text: 'ORG TIGRE • Free Fire' }).setTimestamp()] });
      } catch {}

      return;
    }

    if (id.startsWith('adm_recusar_ap_')) {
      const isAdm  = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
      const isStaff = config.staffRole && interaction.member.roles.cache.has(config.staffRole);
      if (!isAdm && !isStaff) return interaction.reply({ content: '❌ Sem permissão.', ephemeral: true });

      const filaChId = id.replace('adm_recusar_ap_', '');
      await interaction.update({
        embeds: [new EmbedBuilder().setColor(0xE74C3C)
          .setTitle('❌ AP Recusado')
          .setDescription(`Recusado por ${interaction.user}`)
          .setFooter({ text: 'ORG TIGRE' }).setTimestamp()],
        components: []
      });

      try {
        const filaCh = await client.channels.fetch(filaChId);
        await filaCh.send({ embeds: [new EmbedBuilder().setColor(0xE74C3C)
          .setTitle('❌ AP RECUSADO')
          .setDescription(`> O ADM recusou o AP. Entre em contato com a equipe!`)
          .setFooter({ text: 'ORG TIGRE' }).setTimestamp()] });
      } catch {}
      return;
    }

    // ── FILA SUB ENTRAR ────────────────────────────────────────────────
    if (id === 'fila_sub_entrar') {
      if (config.filaSubStatus === 'off') {
        return interaction.reply({ content: '⛔ **Fila off-line!** Espere ela ser aberta.', ephemeral: true });
      }
      if (!config.filaSub) config.filaSub = { players: [] };
      const fila = config.filaSub;
      if (fila.players.find(p => p.id === interaction.user.id))
        return interaction.reply({ content: '⚠️ Você já está na fila!', ephemeral: true });
      if (fila.players.length >= 2)
        return interaction.reply({ content: '❌ Fila cheia!', ephemeral: true });

      fila.players.push({ id: interaction.user.id, nick: interaction.member.displayName, name: interaction.user.username });
      saveConfig();

      const embed = new EmbedBuilder()
        .setColor(0x9B59B6)
        .setTitle('🎁 AP GRÁTIS COM SUB — ORG TIGRE')
        .setDescription('> Clique no botão abaixo para entrar na fila de AP grátis com Sub!')
        .addFields({ name: `**JOGADORES (${fila.players.length}/2)**`, value: fila.players.map((p,i) => `\`${i+1}.\` <@${p.id}> — \`${p.nick}\``).join('\n') })
        .setFooter({ text: 'ORG TIGRE • Fila Sub' }).setTimestamp();

      try { await interaction.message.edit({ embeds: [embed], components: interaction.message.components }); } catch {}
      await interaction.reply({ content: `✅ Você entrou na fila Sub!`, ephemeral: true });

      if (fila.players.length >= 2) {
        const players = [...fila.players];
        config.filaSub.players = [];
        saveConfig();
        try { await interaction.message.delete(); } catch {}
        const nomes = players.map(p => p.name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10)).join('-');
        let filaChannel;
        try {
          filaChannel = await interaction.guild.channels.create({
            name: `fila-sub-${nomes}`,
            type: ChannelType.GuildText,
            parent: config.filaCategory || null,
            permissionOverwrites: [
              { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
              { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageRoles] },
              ...players.map(p => ({ id: p.id, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages] })),
              ...(config.staffRole ? [{ id: config.staffRole, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }] : []),
            ],
          });
        } catch (e) { console.error('Erro canal fila sub:', e); return; }

        tickets[filaChannel.id] = { type: 'fila', mode: 'sub', value: 0, players, confirmed: [] };
        saveTickets();

        await filaChannel.send({
          content: players.map(p => `<@${p.id}>`).join(' '),
          embeds: [new EmbedBuilder().setColor(0x9B59B6)
            .setTitle('🎁 FILA SUB — AP GRÁTIS | ORG TIGRE')
            .setDescription(
              `> 🔇 Canal só leitura até ambos confirmarem!\n\n**Jogadores:**\n` +
              players.map((p,i) => `\`${i+1}.\` <@${p.id}> — \`${p.nick}\``).join('\n') +
              `\n\n> Clique em ✅ **Confirmar** para liberar o canal!`
            ).setFooter({ text: 'ORG TIGRE • Fila Sub' }).setTimestamp()],
          components: [new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`fila_confirmar_${filaChannel.id}`).setLabel('✅ Confirmar').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`fila_fechar_${filaChannel.id}`).setLabel('🔒 Fechar Fila').setStyle(ButtonStyle.Danger),
          )],
        });
      }
      return;
    }

    if (id === 'fila_sub_sair') {
      if (!config.filaSub) return interaction.reply({ content: '⚠️ Você não está na fila.', ephemeral: true });
      const idx = config.filaSub.players.findIndex(p => p.id === interaction.user.id);
      if (idx === -1) return interaction.reply({ content: '⚠️ Você não está na fila.', ephemeral: true });
      config.filaSub.players.splice(idx, 1);
      saveConfig();
      const embed = new EmbedBuilder().setColor(0x9B59B6).setTitle('🎁 AP GRÁTIS COM SUB — ORG TIGRE')
        .setDescription('> Clique no botão abaixo para entrar na fila de AP grátis com Sub!')
        .addFields({ name: `**JOGADORES (${config.filaSub.players.length}/2)**`, value: config.filaSub.players.length > 0 ? config.filaSub.players.map((p,i) => `\`${i+1}.\` <@${p.id}>`).join('\n') : 'Nenhum jogador na fila ainda.' })
        .setFooter({ text: 'ORG TIGRE • Fila Sub' }).setTimestamp();
      try { await interaction.message.edit({ embeds: [embed], components: interaction.message.components }); } catch {}
      return interaction.reply({ content: '✅ Você saiu da fila Sub.', ephemeral: true });
    }

    // ── FILA DONO ENTRAR ───────────────────────────────────────────────
    if (id === 'fila_dono_entrar') {
      if (config.filaDonoStatus === 'off') {
        return interaction.reply({ content: '⛔ **Fila off-line!** Espere ela ser aberta.', ephemeral: true });
      }
      if (!config.filaDono) config.filaDono = { players: [] };
      const fila = config.filaDono;
      if (fila.players.find(p => p.id === interaction.user.id))
        return interaction.reply({ content: '⚠️ Você já está na fila!', ephemeral: true });
      if (fila.players.length >= 2)
        return interaction.reply({ content: '❌ Fila cheia!', ephemeral: true });

      fila.players.push({ id: interaction.user.id, nick: interaction.member.displayName, name: interaction.user.username });
      saveConfig();

      const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('👑 AP GRÁTIS COM DONO — ORG TIGRE')
        .setDescription('> Clique no botão abaixo para entrar na fila de AP grátis com o Dono!')
        .addFields({ name: `**JOGADORES (${fila.players.length}/2)**`, value: fila.players.map((p,i) => `\`${i+1}.\` <@${p.id}> — \`${p.nick}\``).join('\n') })
        .setFooter({ text: 'ORG TIGRE • Fila Dono' }).setTimestamp();

      try { await interaction.message.edit({ embeds: [embed], components: interaction.message.components }); } catch {}
      await interaction.reply({ content: `✅ Você entrou na fila Dono!`, ephemeral: true });

      if (fila.players.length >= 2) {
        const players = [...fila.players];
        config.filaDono.players = [];
        saveConfig();
        try { await interaction.message.delete(); } catch {}
        const nomes = players.map(p => p.name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10)).join('-');
        let filaChannel;
        try {
          filaChannel = await interaction.guild.channels.create({
            name: `fila-dono-${nomes}`,
            type: ChannelType.GuildText,
            parent: config.filaCategory || null,
            permissionOverwrites: [
              { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
              { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageRoles] },
              ...players.map(p => ({ id: p.id, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages] })),
              ...(config.staffRole ? [{ id: config.staffRole, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }] : []),
            ],
          });
        } catch (e) { console.error('Erro canal fila dono:', e); return; }

        tickets[filaChannel.id] = { type: 'fila', mode: 'dono', value: 0, players, confirmed: [] };
        saveTickets();

        await filaChannel.send({
          content: players.map(p => `<@${p.id}>`).join(' '),
          embeds: [new EmbedBuilder().setColor(0xFFD700)
            .setTitle('👑 FILA DONO — AP GRÁTIS | ORG TIGRE')
            .setDescription(
              `> 🔇 Canal só leitura até ambos confirmarem!\n\n**Jogadores:**\n` +
              players.map((p,i) => `\`${i+1}.\` <@${p.id}> — \`${p.nick}\``).join('\n') +
              `\n\n> Clique em ✅ **Confirmar** para liberar o canal!`
            ).setFooter({ text: 'ORG TIGRE • Fila Dono' }).setTimestamp()],
          components: [new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`fila_confirmar_${filaChannel.id}`).setLabel('✅ Confirmar').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`fila_fechar_${filaChannel.id}`).setLabel('🔒 Fechar Fila').setStyle(ButtonStyle.Danger),
          )],
        });
      }
      return;
    }

    if (id === 'fila_dono_sair') {
      if (!config.filaDono) return interaction.reply({ content: '⚠️ Você não está na fila.', ephemeral: true });
      const idx = config.filaDono.players.findIndex(p => p.id === interaction.user.id);
      if (idx === -1) return interaction.reply({ content: '⚠️ Você não está na fila.', ephemeral: true });
      config.filaDono.players.splice(idx, 1);
      saveConfig();
      const embed = new EmbedBuilder().setColor(0xFFD700).setTitle('👑 AP GRÁTIS COM DONO — ORG TIGRE')
        .setDescription('> Clique no botão abaixo para entrar na fila de AP grátis com o Dono!')
        .addFields({ name: `**JOGADORES (${config.filaDono.players.length}/2)**`, value: config.filaDono.players.length > 0 ? config.filaDono.players.map((p,i) => `\`${i+1}.\` <@${p.id}>`).join('\n') : 'Nenhum jogador na fila ainda.' })
        .setFooter({ text: 'ORG TIGRE • Fila Dono' }).setTimestamp();
      try { await interaction.message.edit({ embeds: [embed], components: interaction.message.components }); } catch {}
      return interaction.reply({ content: '✅ Você saiu da fila Dono.', ephemeral: true });
    }

    // Entrar na fila normal
    if (id.startsWith('queue_normal_') || id.startsWith('queue_infinito_')) {
      const gelType = id.startsWith('queue_normal_') ? 'Gel Normal' : 'Gel Infinito';
      const mode    = id.replace('queue_normal_', '').replace('queue_infinito_', '');
      const state   = getQueueState(mode);
      const cfg     = QUEUE_MODES[mode];
      if (!cfg) return interaction.reply({ content: '❌ Fila inválida.', ephemeral: true });
      if (state.players.find(p => p.id === interaction.user.id))
        return interaction.reply({ content: '⚠️ Você já está na fila!', ephemeral: true });
      if (state.players.length >= cfg.maxPlayers)
        return interaction.reply({ content: '❌ Fila cheia!', ephemeral: true });

      const nick = interaction.member.displayName;
      state.players.push({ id: interaction.user.id, name: interaction.user.username, nick, gel: gelType, arma: '' });
      saveQueues();
      try { await interaction.message.edit({ embeds: [buildQueueEmbed(mode, state.value)], components: buildQueueButtons(mode) }); } catch {}
      await interaction.reply({ content: `✅ Na fila **${mode}** — \`${nick} ${gelType}\`!`, ephemeral: true });
      if (state.players.length >= cfg.maxPlayers) {
        try { await interaction.message.delete(); } catch {}
        await criarCanalFila(interaction, mode, state);
      }
      return;
    }

    // Arma
    if (id.startsWith('queue_arma_')) {
      const mode   = id.replace('queue_arma_', '');
      const state  = getQueueState(mode);
      const player = state.players.find(p => p.id === interaction.user.id);
      if (!player) return interaction.reply({ content: '⚠️ Entre na fila primeiro!', ephemeral: true });
      if (player.arma === 'FULL UMP XM8') return interaction.reply({ content: '⚠️ Já escolheu!', ephemeral: true });
      player.arma = 'FULL UMP XM8';
      saveQueues();
      try { await interaction.message.edit({ embeds: [buildQueueEmbed(mode, state.value)], components: buildQueueButtons(mode) }); } catch {}
      return interaction.reply({ content: `✅ Arma: **FULL UMP XM8**`, ephemeral: true });
    }

    // Sair da fila
    if (id.startsWith('queue_sair_')) {
      const mode  = id.replace('queue_sair_', '');
      const state = getQueueState(mode);
      const idx   = state.players.findIndex(p => p.id === interaction.user.id);
      if (idx === -1) return interaction.reply({ content: '⚠️ Você não está na fila.', ephemeral: true });
      state.players.splice(idx, 1);
      saveQueues();
      try { await interaction.message.edit({ embeds: [buildQueueEmbed(mode, state.value)], components: buildQueueButtons(mode) }); } catch {}
      return interaction.reply({ content: `✅ Saiu da fila **${mode}**.`, ephemeral: true });
    }

    // Confirmar fila
    if (id.startsWith('fila_confirmar_')) {
      const filaInfo = tickets[interaction.channel.id];
      if (!filaInfo) return interaction.reply({ content: '❌ Dados não encontrados.', ephemeral: true });
      if (!filaInfo.players.find(p => p.id === interaction.user.id))
        return interaction.reply({ content: '❌ Você não faz parte desta fila.', ephemeral: true });
      if (filaInfo.confirmed.includes(interaction.user.id))
        return interaction.reply({ content: '⚠️ Você já confirmou!', ephemeral: true });
      filaInfo.confirmed.push(interaction.user.id);
      saveTickets();
      await interaction.channel.permissionOverwrites.edit(interaction.user.id, { ViewChannel: true, SendMessages: true });
      await interaction.reply({ content: `✅ <@${interaction.user.id}> confirmou! (${filaInfo.confirmed.length}/${filaInfo.players.length})` });
      if (filaInfo.confirmed.length >= filaInfo.players.length) {
        for (const p of filaInfo.players)
          await interaction.channel.permissionOverwrites.edit(p.id, { ViewChannel: true, SendMessages: true }).catch(() => {});
        const total = filaInfo.value + TAXA;
        await interaction.channel.send({ embeds: [new EmbedBuilder().setColor(0x00C896)
          .setTitle('✅ FILA CONFIRMADA — ORG TIGRE')
          .setDescription(
            `> Todos confirmaram! Canal liberado! 🎉\n\n` +
            `💰 **Valor:** ${formatVal(filaInfo.value)}\n` +
            `📊 **Taxa ADM:** R$ ${TAXA.toFixed(2).replace('.', ',')}\n` +
            `💸 **Total:** ${formatVal(total)}\n\n` +
            `**📲 Chave PIX:**\n\`\`\`${PIX}\`\`\`\n> Envie o comprovante após pagar!`
          ).setFooter({ text: 'ORG TIGRE • Free Fire' }).setTimestamp()] });
      }
      return;
    }

    // Fechar fila
    if (id.startsWith('fila_fechar_')) {
      const isAdm  = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
      const isStaff = config.staffRole && interaction.member.roles.cache.has(config.staffRole);
      if (!isAdm && !isStaff) return interaction.reply({ content: '❌ Sem permissão.', ephemeral: true });

      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xE74C3C).setTitle('🔒 Fila Encerrada')
        .setDescription(`Encerrado por ${interaction.user}. Canal deletado em 5s.`).setTimestamp()] });

      // Gerar transcript da fila
      try {
        const msgs = await interaction.channel.messages.fetch({ limit: 100 });
        const sorted = [...msgs.values()].reverse();
        const transcriptText = sorted.map(m =>
          `[${new Date(m.createdTimestamp).toLocaleString('pt-BR')}] ${m.author.tag}: ${m.content || '[embed/componente]'}`
        ).join('\n');
        const transcriptBuf = Buffer.from(`TRANSCRIPT — ${interaction.channel.name}\n${'='.repeat(50)}\n\n${transcriptText}`, 'utf8');
        const filaInfo = tickets[interaction.channel.id];

        // Enviar no canal de filas do servidor (privado, só adm vê)
        try {
          const logCh = await client.channels.fetch('1499173111361437696');
          await logCh.send({
            embeds: [new EmbedBuilder().setColor(0xFF8C00)
              .setTitle('📋 Transcript de Fila')
              .setDescription(`**Canal:** ${interaction.channel.name}\n**Encerrado por:** ${interaction.user}\n**Data:** <t:${Math.floor(Date.now()/1000)}:F>`)
              .setFooter({ text: 'ORG TIGRE • Transcript Fila' }).setTimestamp()],
            files: [{ attachment: transcriptBuf, name: `transcript-${interaction.channel.name}.txt` }]
          });
        } catch {}
      } catch {}

      delete tickets[interaction.channel.id]; saveTickets();
      setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
      return;
    }

    // Fechar ticket
    if (id.startsWith('ticket_close_')) {
      const isAdm  = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
      const isStaff = config.staffRole && interaction.member.roles.cache.has(config.staffRole);
      if (!isAdm && !isStaff) return interaction.reply({ content: '❌ Sem permissão.', ephemeral: true });

      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xE74C3C).setTitle('🔒 Ticket Encerrado')
        .setDescription(`Encerrado por ${interaction.user}. Canal deletado em 5s.`).setTimestamp()] });

      const t = tickets[interaction.channel.id];

      // Gerar transcript
      try {
        const msgs = await interaction.channel.messages.fetch({ limit: 100 });
        const sorted = [...msgs.values()].reverse();
        const transcriptText = sorted.map(m =>
          `[${new Date(m.createdTimestamp).toLocaleString('pt-BR')}] ${m.author.tag}: ${m.content || '[embed/componente]'}`
        ).join('\n');
        const transcriptBuf = Buffer.from(`TRANSCRIPT — ${interaction.channel.name}\n${'='.repeat(50)}\n\n${transcriptText}`, 'utf8');

        // 1. Enviar no canal de tickets do servidor
        try {
          const logCh = await client.channels.fetch('1499172911100068052');
          await logCh.send({
            embeds: [new EmbedBuilder().setColor(0x3498DB)
              .setTitle('📋 Transcript de Ticket')
              .setDescription(
                `**Canal:** ${interaction.channel.name}\n` +
                `**Aberto por:** ${t ? `<@${t.userId}>` : 'Desconhecido'}\n` +
                `**Encerrado por:** ${interaction.user}\n` +
                `**Data:** <t:${Math.floor(Date.now()/1000)}:F>`
              )
              .setFooter({ text: 'ORG TIGRE • Transcript Ticket' }).setTimestamp()],
            files: [{ attachment: transcriptBuf, name: `transcript-${interaction.channel.name}.txt` }]
          });
        } catch {}

        // 2. Enviar DM para o usuário que abriu o ticket
        if (t?.userId) {
          try {
            const user = await client.users.fetch(t.userId);
            await user.send({
              embeds: [new EmbedBuilder().setColor(0x3498DB)
                .setTitle('📋 Transcript do seu Ticket — ORG TIGRE')
                .setDescription(
                  `Seu ticket **${interaction.channel.name}** foi encerrado.\n\n` +
                  `Segue abaixo o transcript com todas as mensagens!\n` +
                  `> Você pode baixar o arquivo .txt anexado.`
                )
                .setFooter({ text: 'ORG TIGRE • Tickets' }).setTimestamp()],
              files: [{ attachment: transcriptBuf, name: `transcript-${interaction.channel.name}.txt` }]
            });
          } catch {}
        }
      } catch {}

      delete tickets[interaction.channel.id]; saveTickets();
      setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
      return;
    }

    // Notificar membro
    if (id.startsWith('ticket_notify_')) {
      const t = tickets[interaction.channel.id];
      if (!t) return interaction.reply({ content: '❌ Ticket não encontrado.', ephemeral: true });
      try {
        const user = await client.users.fetch(t.userId);
        await user.send({ embeds: [new EmbedBuilder().setColor(0x3498DB).setTitle('🔔 Notificação — ORG TIGRE')
          .setDescription(`Mensagem no seu ticket! <#${interaction.channel.id}>`).setTimestamp()] });
        await interaction.reply({ content: '✅ Notificado!', ephemeral: true });
      } catch { await interaction.reply({ content: '❌ DM fechada.', ephemeral: true }); }
      return;
    }

    // Banir
    if (id.startsWith('ticket_ban_')) {
      const t = tickets[interaction.channel.id];
      if (!t) return interaction.reply({ content: '❌ Ticket não encontrado.', ephemeral: true });
      const isAdm  = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
      const isStaff = config.staffRole && interaction.member.roles.cache.has(config.staffRole);
      if (!isAdm && !isStaff) return interaction.reply({ content: '❌ Sem permissão.', ephemeral: true });
      try {
        const member = await interaction.guild.members.fetch(t.userId);
        await member.ban({ reason: `Banido por ${interaction.user.tag}` });
        await interaction.reply({ content: `✅ <@${t.userId}> banido!` });
      } catch { await interaction.reply({ content: '❌ Erro ao banir.', ephemeral: true }); }
      return;
    }

    // Castigo
    if (id.startsWith('ticket_mute_')) {
      const t = tickets[interaction.channel.id];
      if (!t) return interaction.reply({ content: '❌ Ticket não encontrado.', ephemeral: true });
      const isAdm  = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
      const isStaff = config.staffRole && interaction.member.roles.cache.has(config.staffRole);
      if (!isAdm && !isStaff) return interaction.reply({ content: '❌ Sem permissão.', ephemeral: true });
      try {
        const member = await interaction.guild.members.fetch(t.userId);
        await member.timeout(10 * 60 * 1000, `Castigo por ${interaction.user.tag}`);
        await interaction.reply({ content: `✅ <@${t.userId}> 10 min de castigo!` });
      } catch { await interaction.reply({ content: '❌ Erro ao dar castigo.', ephemeral: true }); }
      return;
    }

    // Adicionar membro
    if (id.startsWith('ticket_add_')) {
      const t = tickets[interaction.channel.id];
      if (!t) return interaction.reply({ content: '❌ Ticket não encontrado.', ephemeral: true });
      await interaction.reply({ content: '👤 Mencione o membro (@membro) no chat:', ephemeral: true });
      const collector = interaction.channel.createMessageCollector({
        filter: m => m.author.id === interaction.user.id && m.mentions.members.size > 0,
        time: 30000, max: 1
      });
      collector.on('collect', async (msg) => {
        const target = msg.mentions.members.first();
        msg.delete().catch(() => {});
        await interaction.channel.permissionOverwrites.create(target, { ViewChannel: true, SendMessages: true });
        await interaction.channel.send({ content: `✅ <@${target.id}> adicionado por <@${interaction.user.id}>.` });
      });
      return;
    }
  }

  // ── TICKET SELECT ──────────────────────────────────────────────────────
  if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select') {
    const type = interaction.values[0];
    const ti   = TICKET_TYPES[type];
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
          { id: interaction.user.id,  allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
          { id: client.user.id,       allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] },
          ...(config.staffRole ? [{ id: config.staffRole, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }] : []),
        ],
      });
    } catch { return interaction.reply({ content: '❌ Erro ao criar ticket. Verifique permissões do bot.', ephemeral: true }); }

    tickets[channel.id] = { userId: interaction.user.id, type };
    saveTickets();

    await channel.send({
      content: `<@${interaction.user.id}>${config.staffRole ? ` <@&${config.staffRole}>` : ''}`,
      embeds: [new EmbedBuilder().setColor(ti.color)
        .setTitle(`${ti.emoji} Ticket — ${ti.label}`)
        .setDescription(`Olá <@${interaction.user.id}>!\n\n📋 **Tipo:** ${ti.label}\n🕐 **Aberto em:** <t:${Math.floor(Date.now()/1000)}:F>\n\n> Descreva seu problema!`)
        .setFooter({ text: 'ORG TIGRE • Tickets' }).setTimestamp()],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`ticket_add_${channel.id}`).setLabel('➕ Adicionar Membro').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId(`ticket_notify_${channel.id}`).setLabel('🔔 Notificar').setStyle(ButtonStyle.Secondary),
        ),
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`ticket_ban_${channel.id}`).setLabel('🔨 Banir').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId(`ticket_mute_${channel.id}`).setLabel('🔇 Castigo').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId(`ticket_close_${channel.id}`).setLabel('🔒 Fechar').setStyle(ButtonStyle.Secondary),
        ),
      ],
    });
    await interaction.reply({ content: `✅ Ticket aberto: ${channel}`, ephemeral: true });
  }
});

const TOKEN = process.env.DISCORD_TOKEN || config.token || 'SEU_TOKEN_AQUI';
client.login(TOKEN);
