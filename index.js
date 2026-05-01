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

config.filaCategory = '1499177304528523344';

// ── PERSISTÊNCIA ───────────────────────────────────────────────────────
let tickets = {};
let queues  = {};

if (fs.existsSync('./tickets.json')) { try { tickets = JSON.parse(fs.readFileSync('./tickets.json', 'utf8')); } catch {} }
if (fs.existsSync('./queues.json'))  { try { queues  = JSON.parse(fs.readFileSync('./queues.json',  'utf8')); } catch {} }

function saveTickets() { fs.writeFileSync('./tickets.json', JSON.stringify(tickets, null, 2)); }
function saveQueues()  { fs.writeFileSync('./queues.json',  JSON.stringify(queues,  null, 2)); }

// ── CONSTANTES ─────────────────────────────────────────────────────────
const QUEUE_MODES = {
  '1x1': { label: '1x1', maxPlayers: 2, emoji: '⚔️' },
  '2x2': { label: '2x2', maxPlayers: 4, emoji: '🔥' },
  '3x3': { label: '3x3', maxPlayers: 6, emoji: '💥' },
  '4x4': { label: '4x4', maxPlayers: 8, emoji: '🏆' },
};

const PRICES = [300.00,200.00,100.00,80.00,75.00,50.00,30.00,20.00,10.00,5.00,2.00,1.00,0.75,0.50,0.30];
const TAXA   = 0.10;

const TICKET_TYPES = {
  REEMBOLSO: { label: '💰 Reembolso',       emoji: '💰', color: 0xF4D03F },
  MEDIADOR:  { label: '🤝 Vagas Mediador',  emoji: '🤝', color: 0x2ECC71 },
  SUPORTE:   { label: '🎧 Suporte',         emoji: '🎧', color: 0x3498DB },
  ANALISTA:  { label: '📊 Vagas Analistas', emoji: '📊', color: 0x9B59B6 },
  WO:        { label: '⚠️ W.O Sem Motivo',  emoji: '⚠️', color: 0xE74C3C },
};

const CARGO_AP    = '1495603958780137683';
const CANAL_ADM   = '1499187056805412954';
const CANAL_TICKET_LOG = '1499172911100068052';
const CANAL_FILA_LOG   = '1499173111361437696';

// ── HELPERS ────────────────────────────────────────────────────────────
function formatVal(v) { return 'R$ ' + Number(v).toFixed(2).replace('.', ','); }

// Cada fila tem sua própria key = modo_valor
function getQueueKey(mode, value) { return `${mode}_${Number(value).toFixed(2)}`; }

function getQueueState(mode, value) {
  const key = getQueueKey(mode, value);
  if (!queues[key]) queues[key] = { players: [], value: Number(value) };
  return queues[key];
}

function buildQueueEmbed(mode, value) {
  const state = getQueueState(mode, value);
  const cfg   = QUEUE_MODES[mode];
  const now   = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const playerList = state.players.length > 0
    ? state.players.map((p,i) => `\`${i+1}.\` <@${p.id}> — \`${p.nick} ${p.gel}${p.arma ? ' '+p.arma : ''}\``).join('\n')
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

function buildQueueButtons(mode, value) {
  const v = Number(value).toFixed(2);
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`qn_${mode}_${v}`).setLabel('Gel Normal').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`qi_${mode}_${v}`).setLabel('Gel Infinito').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`qs_${mode}_${v}`).setLabel('Sair da Fila').setStyle(ButtonStyle.Danger),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`qa_${mode}_${v}`).setLabel('FULL UMP XM8').setStyle(ButtonStyle.Primary),
    ),
  ];
}

// ── CRIAR CANAL DE FILA ────────────────────────────────────────────────
async function criarCanalFila(interaction, mode, value, players) {
  // Resetar fila
  const key = getQueueKey(mode, value);
  queues[key] = { players: [], value: Number(value) };
  saveQueues();

  const nomes = players.map(p => p.name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0,10)).join('-');
  let ch;
  try {
    ch = await interaction.guild.channels.create({
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
  } catch(e) { console.error('Erro criar canal fila:', e); return; }

  tickets[ch.id] = { type: 'fila', mode, value: Number(value), players, confirmed: [] };
  saveTickets();

  await ch.send({
    content: players.map(p => `<@${p.id}>`).join(' '),
    embeds: [new EmbedBuilder().setColor(0xFFAA00)
      .setTitle(`⚔️ FILA ${mode} — ${formatVal(value)} | ORG TIGRE`)
      .setDescription(
        `> 🔇 Canal só leitura até ambos confirmarem!\n\n**Jogadores:**\n` +
        players.map((p,i) => `\`${i+1}.\` <@${p.id}> — \`${p.nick} ${p.gel}${p.arma ? ' '+p.arma : ''}\``).join('\n') +
        `\n\n**Valor:** ${formatVal(value)}\n**Taxa ADM:** R$ ${TAXA.toFixed(2).replace('.',',')}\n\n` +
        `> Clique em ✅ **Confirmar** para liberar o canal!`
      ).setFooter({ text: 'ORG TIGRE • Free Fire' }).setTimestamp()],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`fila_confirmar_${ch.id}`).setLabel('✅ Confirmar').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`fila_fechar_${ch.id}`).setLabel('🔒 Fechar Fila').setStyle(ButtonStyle.Danger),
    )],
  });

  // Notificar adm
  try {
    const admCh = await client.channels.fetch(CANAL_ADM);
    const pixList = players.map(p => {
      const pix = config.pixUsers?.[p.id];
      return `<@${p.id}> — \`${p.nick}\` | PIX: ${pix ? `\`${pix}\`` : '❌ Não registrado'}`;
    }).join('\n');
    await admCh.send({
      embeds: [new EmbedBuilder().setColor(0xFFAA00)
        .setTitle('⚔️ NOVA FILA — Confirmar AP')
        .setDescription(`**Modo:** ${mode}\n**Valor:** ${formatVal(value)}\n**Canal:** <#${ch.id}>\n\n**Jogadores:**\n${pixList}`)
        .setFooter({ text: 'ORG TIGRE • Confirmar AP' }).setTimestamp()],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`adm_confirmar_${ch.id}`).setLabel('✅ Confirmar AP').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`adm_recusar_${ch.id}`).setLabel('❌ Recusar').setStyle(ButtonStyle.Danger),
      )],
    });
  } catch(e) { console.error('Erro notif adm:', e); }
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
      try { const c = await client.channels.fetch(chId); if(c) await c.send({ embeds: [embed] }); } catch {}
    }
  }, 20*60*1000);
});

// ── COMMANDS ───────────────────────────────────────────────────────────
client.on('messageCreate', async (msg) => {
  if (!msg.guild || msg.author.bot || !msg.content.startsWith('!')) return;
  const args   = msg.content.slice(1).trim().split(/ +/);
  const cmd    = args.shift().toLowerCase();
  const isAdmin = msg.member.permissions.has(PermissionFlagsBits.Administrator);
  if (!config.players) config.players = {};
  function getPlayer(id) {
    if (!config.players[id]) config.players[id] = { vitorias:0, ganhas:0, perdas:0 };
    return config.players[id];
  }

  // !allfilas <modo>
  if (cmd === 'allfilas') {
    if (!isAdmin) return msg.reply('❌ Sem permissão.');
    const mode = args[0];
    if (!mode || !QUEUE_MODES[mode]) return msg.reply(`❌ Informe o modo. Ex: \`!allfilas 1x1\`\nModos: ${Object.keys(QUEUE_MODES).join(', ')}`);
    msg.delete().catch(()=>{});
    for (const price of PRICES) {
      const state = getQueueState(mode, price);
      state.value = price;
      await msg.channel.send({ embeds: [buildQueueEmbed(mode, price)], components: buildQueueButtons(mode, price) });
      await new Promise(r => setTimeout(r, 500));
    }
    saveQueues();
    return;
  }

  // !fila <modo/sub/dono/off/on> [valor]
  if (cmd === 'fila') {
    if (!isAdmin) return msg.reply('❌ Sem permissão.');
    const mode = args[0];

    if (mode === 'off' && args[1] === 'sub') { config.filaSubStatus = 'off'; saveConfig(); return msg.reply('✅ Fila Sub **offline**!'); }
    if (mode === 'on'  && args[1] === 'sub') { config.filaSubStatus = 'on';  saveConfig(); return msg.reply('✅ Fila Sub **ativada**!'); }
    if (mode === 'off' && args[1] === 'dono'){ config.filaDonoStatus= 'off'; saveConfig(); return msg.reply('✅ Fila Dono **offline**!'); }
    if (mode === 'on'  && args[1] === 'dono'){ config.filaDonoStatus= 'on';  saveConfig(); return msg.reply('✅ Fila Dono **ativada**!'); }

    if (mode === 'sub') {
      if (!config.filaSub) config.filaSub = { players: [] };
      config.filaSub.players = []; saveConfig();
      msg.delete().catch(()=>{});
      return msg.channel.send({
        embeds: [new EmbedBuilder().setColor(0x9B59B6).setTitle('🎁 AP GRÁTIS COM SUB — ORG TIGRE')
          .setDescription('> Clique no botão para entrar na fila de AP grátis com Sub!')
          .addFields({ name: '**JOGADORES (0/2)**', value: 'Nenhum jogador na fila ainda.' })
          .setFooter({ text: 'ORG TIGRE • Fila Sub' }).setTimestamp()],
        components: [new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('fila_sub_entrar').setLabel('AP GRÁTIS COM SUB DONO').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('fila_sub_sair').setLabel('Sair da Fila').setStyle(ButtonStyle.Danger),
        )],
      });
    }

    if (mode === 'dono') {
      if (!config.filaDono) config.filaDono = { players: [] };
      config.filaDono.players = []; saveConfig();
      msg.delete().catch(()=>{});
      return msg.channel.send({
        embeds: [new EmbedBuilder().setColor(0xFFD700).setTitle('👑 AP GRÁTIS COM DONO — ORG TIGRE')
          .setDescription('> Clique no botão para entrar na fila de AP grátis com o Dono!')
          .addFields({ name: '**JOGADORES (0/2)**', value: 'Nenhum jogador na fila ainda.' })
          .setFooter({ text: 'ORG TIGRE • Fila Dono' }).setTimestamp()],
        components: [new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('fila_dono_entrar').setLabel('AP GRÁTIS COM DONO').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('fila_dono_sair').setLabel('Sair da Fila').setStyle(ButtonStyle.Danger),
        )],
      });
    }

    if (!QUEUE_MODES[mode]) return msg.reply(`❌ Modo inválido. Use: ${Object.keys(QUEUE_MODES).join(', ')}, sub, dono`);
    const value = parseFloat(args[1]) || 2.00;
    msg.delete().catch(()=>{});
    await msg.channel.send({ embeds: [buildQueueEmbed(mode, value)], components: buildQueueButtons(mode, value) });
    return;
  }

  // !ticket
  if (cmd === 'ticket') {
    if (!isAdmin) return msg.reply('❌ Sem permissão.');
    msg.delete().catch(()=>{});
    return msg.channel.send({
      embeds: [new EmbedBuilder().setColor(0xFFAA00).setTitle('🎫 CENTRAL DE TICKETS — ORG TIGRE')
        .setDescription('Selecione o tipo de atendimento que deseja abrir.\nNossa equipe irá te atender em breve!')
        .addFields(
          { name: '💰 Reembolso',       value: 'Solicitar devolução',  inline: true },
          { name: '🤝 Vagas Mediador',  value: 'Candidatura',          inline: true },
          { name: '🎧 Suporte',         value: 'Ajuda geral',          inline: true },
          { name: '📊 Vagas Analistas', value: 'Candidatura',          inline: true },
          { name: '⚠️ W.O Sem Motivo',  value: 'Reportar abandono',    inline: true },
        ).setFooter({ text: 'ORG TIGRE • Tickets' }).setTimestamp()],
      components: [new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('ticket_select').setPlaceholder('📋 Escolha o tipo...')
          .addOptions(Object.entries(TICKET_TYPES).map(([k,v]) => ({ label: v.label, value: k, emoji: v.emoji })))
      )],
    });
  }

  if (cmd === 'setpromo') {
    if (!isAdmin) return msg.reply('❌ Sem permissão.');
    const ch = msg.mentions.channels.first();
    if (!ch) return msg.reply('❌ Mencione um canal.');
    if (!config.promoChannels) config.promoChannels = [];
    if (!config.promoChannels.includes(ch.id)) config.promoChannels.push(ch.id);
    saveConfig(); msg.reply(`✅ Canal ${ch} adicionado.`);
  }
  if (cmd === 'setticketcat') { if (!isAdmin) return; config.ticketCategory = args[0]; saveConfig(); msg.reply(`✅ Categoria tickets: \`${args[0]}\``); }
  if (cmd === 'setstaff') { if (!isAdmin) return; const r = msg.mentions.roles.first(); if (!r) return; config.staffRole = r.id; saveConfig(); msg.reply(`✅ Staff: ${r}`); }

  // !registrar pix <chave> — só o cargo AP
  if (cmd === 'registrar' && args[0]?.toLowerCase() === 'pix') {
    const temCargo = msg.member.roles.cache.has(CARGO_AP);
    if (!temCargo && !isAdmin) return msg.reply('❌ Só quem pode confirmar AP pode registrar PIX!');
    const chave = args[1];
    if (!chave) return msg.reply('❌ Use: `!registrar pix suachave`');
    if (!config.pixUsers) config.pixUsers = {};
    config.pixUsers[msg.author.id] = chave;
    saveConfig();
    msg.reply({ embeds: [new EmbedBuilder().setColor(0x00C896).setTitle('✅ PIX Registrado — ORG TIGRE')
      .setDescription(`\`\`\`${chave}\`\`\``).setFooter({ text: 'ORG TIGRE' }).setTimestamp()] });
  }

  // !coin @player <n>
  if (cmd === 'coin') {
    if (!isAdmin) return msg.reply('❌ Sem permissão.');
    const t = msg.mentions.members.first(); const n = parseInt(args[1]);
    if (!t || isNaN(n) || n<1 || n>100) return msg.reply('❌ Use: `!coin @player 10` (1-100)');
    const p = getPlayer(t.id); p.vitorias+=n; p.ganhas+=n; saveConfig();
    msg.reply({ embeds: [new EmbedBuilder().setColor(0xFFAA00).setTitle('🏆 ORG TIGRE')
      .setDescription(`✅ **${n}** vitória(s) para <@${t.id}>!`)
      .addFields({ name:'🏆 Vitórias',value:`${p.vitorias}`,inline:true },{ name:'✅ Ganhas',value:`${p.ganhas}`,inline:true },{ name:'❌ Perdidas',value:`${p.perdas}`,inline:true })
      .setTimestamp()] });
  }

  // !perdeu @player <n>
  if (cmd === 'perdeu') {
    if (!isAdmin) return msg.reply('❌ Sem permissão.');
    const t = msg.mentions.members.first(); const n = parseInt(args[1]);
    if (!t || isNaN(n) || n<1 || n>2000) return msg.reply('❌ Use: `!perdeu @player 50` (1-2000)');
    const p = getPlayer(t.id); p.perdas+=n; saveConfig();
    msg.reply({ embeds: [new EmbedBuilder().setColor(0xE74C3C).setTitle('📊 ORG TIGRE')
      .setDescription(`📝 **${n}** derrota(s) para <@${t.id}>!`)
      .addFields({ name:'🏆 Vitórias',value:`${p.vitorias}`,inline:true },{ name:'✅ Ganhas',value:`${p.ganhas}`,inline:true },{ name:'❌ Perdidas',value:`${p.perdas}`,inline:true })
      .setTimestamp()] });
  }

  // !stats [@player]
  if (cmd === 'stats') {
    const t = msg.mentions.members.first() || msg.member;
    const p = getPlayer(t.id);
    msg.reply({ embeds: [new EmbedBuilder().setColor(0xFFAA00).setTitle('🐯 ORG TIGRE')
      .setThumbnail(t.user.displayAvatarURL())
      .addFields({ name:'🏆 Vitórias',value:`${p.vitorias}`,inline:true },{ name:'✅ Ganhas',value:`${p.ganhas}`,inline:true },{ name:'❌ Quantas você perdeu',value:`${p.perdas}`,inline:true })
      .setFooter({ text:`ORG TIGRE • ${t.displayName}` }).setTimestamp()] });
  }
});

// ── INTERACTIONS ───────────────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {

  // ── TICKET SELECT ──────────────────────────────────────────────────────
  if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select') {
    const type = interaction.values[0];
    const ti   = TICKET_TYPES[type];
    const existing = Object.entries(tickets).find(([,t]) => t.userId===interaction.user.id && t.type===type);
    if (existing) return interaction.reply({ content:`⚠️ Ticket já aberto: <#${existing[0]}>`, ephemeral:true });
    let ch;
    try {
      ch = await interaction.guild.channels.create({
        name: `ticket-${type.toLowerCase()}-${interaction.user.username}`,
        type: ChannelType.GuildText,
        parent: config.ticketCategory || null,
        permissionOverwrites: [
          { id: interaction.guild.id, deny:[PermissionFlagsBits.ViewChannel] },
          { id: interaction.user.id,  allow:[PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
          { id: client.user.id,       allow:[PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] },
          ...(config.staffRole ? [{ id:config.staffRole, allow:[PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }] : []),
        ],
      });
    } catch { return interaction.reply({ content:'❌ Erro ao criar ticket.', ephemeral:true }); }
    tickets[ch.id] = { userId: interaction.user.id, type };
    saveTickets();
    await ch.send({
      content: `<@${interaction.user.id}>${config.staffRole ? ` <@&${config.staffRole}>` : ''}`,
      embeds: [new EmbedBuilder().setColor(ti.color).setTitle(`${ti.emoji} Ticket — ${ti.label}`)
        .setDescription(`Olá <@${interaction.user.id}>!\n\n📋 **Tipo:** ${ti.label}\n🕐 **Aberto:** <t:${Math.floor(Date.now()/1000)}:F>\n\n> Descreva seu problema!`)
        .setFooter({ text:'ORG TIGRE • Tickets' }).setTimestamp()],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`ticket_add_${ch.id}`).setLabel('➕ Adicionar Membro').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId(`ticket_notify_${ch.id}`).setLabel('🔔 Notificar').setStyle(ButtonStyle.Secondary),
        ),
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`ticket_ban_${ch.id}`).setLabel('🔨 Banir').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId(`ticket_mute_${ch.id}`).setLabel('🔇 Castigo').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId(`ticket_close_${ch.id}`).setLabel('🔒 Fechar').setStyle(ButtonStyle.Secondary),
        ),
      ],
    });
    return interaction.reply({ content:`✅ Ticket aberto: ${ch}`, ephemeral:true });
  }

  if (!interaction.isButton()) return;
  const id = interaction.customId;

  // ── FILA NORMAL — ENTRAR ───────────────────────────────────────────────
  if (id.startsWith('qn_') || id.startsWith('qi_')) {
    const parts   = id.split('_');
    const gelType = parts[0]==='qn' ? 'Gel Normal' : 'Gel Infinito';
    const mode    = parts[1];
    const value   = parseFloat(parts[2]);
    const cfg     = QUEUE_MODES[mode];
    if (!cfg) return interaction.reply({ content:'❌ Modo inválido.', ephemeral:true });

    const state = getQueueState(mode, value);
    if (state.players.find(p=>p.id===interaction.user.id))
      return interaction.reply({ content:'⚠️ Você já está na fila!', ephemeral:true });
    if (state.players.length >= cfg.maxPlayers)
      return interaction.reply({ content:'❌ Fila cheia!', ephemeral:true });

    const nick = interaction.member.displayName;
    state.players.push({ id:interaction.user.id, name:interaction.user.username, nick, gel:gelType, arma:'' });
    saveQueues();

    try { await interaction.message.edit({ embeds:[buildQueueEmbed(mode,value)], components:buildQueueButtons(mode,value) }); } catch {}
    await interaction.reply({ content:`✅ Na fila **${mode}** ${formatVal(value)} — \`${nick} ${gelType}\`!`, ephemeral:true });

    if (state.players.length >= cfg.maxPlayers) {
      const players = [...state.players];
      try { await interaction.message.delete(); } catch {}
      await criarCanalFila(interaction, mode, value, players);
    }
    return;
  }

  // ── FILA NORMAL — ARMA ────────────────────────────────────────────────
  if (id.startsWith('qa_')) {
    const parts = id.split('_');
    const mode  = parts[1];
    const value = parseFloat(parts[2]);
    const state = getQueueState(mode, value);
    const player = state.players.find(p=>p.id===interaction.user.id);
    if (!player) return interaction.reply({ content:'⚠️ Entre na fila primeiro!', ephemeral:true });
    if (player.arma === 'FULL UMP XM8') return interaction.reply({ content:'⚠️ Já escolheu!', ephemeral:true });
    player.arma = 'FULL UMP XM8';
    saveQueues();
    try { await interaction.message.edit({ embeds:[buildQueueEmbed(mode,value)], components:buildQueueButtons(mode,value) }); } catch {}
    return interaction.reply({ content:'✅ Arma: **FULL UMP XM8**', ephemeral:true });
  }

  // ── FILA NORMAL — SAIR ────────────────────────────────────────────────
  if (id.startsWith('qs_')) {
    const parts = id.split('_');
    const mode  = parts[1];
    const value = parseFloat(parts[2]);
    const state = getQueueState(mode, value);
    const idx   = state.players.findIndex(p=>p.id===interaction.user.id);
    if (idx===-1) return interaction.reply({ content:'⚠️ Você não está na fila.', ephemeral:true });
    state.players.splice(idx,1);
    saveQueues();
    try { await interaction.message.edit({ embeds:[buildQueueEmbed(mode,value)], components:buildQueueButtons(mode,value) }); } catch {}
    return interaction.reply({ content:`✅ Saiu da fila **${mode}** ${formatVal(value)}.`, ephemeral:true });
  }

  // ── FILA SUB ───────────────────────────────────────────────────────────
  if (id === 'fila_sub_entrar') {
    if (config.filaSubStatus === 'off')
      return interaction.reply({ content:'⛔ **Fila off-line!** Espere ela ser aberta.', ephemeral:true });
    if (!config.filaSub) config.filaSub = { players:[] };
    const fila = config.filaSub;
    if (fila.players.find(p=>p.id===interaction.user.id)) return interaction.reply({ content:'⚠️ Já está na fila!', ephemeral:true });
    if (fila.players.length>=2) return interaction.reply({ content:'❌ Fila cheia!', ephemeral:true });
    fila.players.push({ id:interaction.user.id, nick:interaction.member.displayName, name:interaction.user.username });
    saveConfig();
    const embed = new EmbedBuilder().setColor(0x9B59B6).setTitle('🎁 AP GRÁTIS COM SUB — ORG TIGRE')
      .setDescription('> Clique no botão para entrar na fila de AP grátis com Sub!')
      .addFields({ name:`**JOGADORES (${fila.players.length}/2)**`, value:fila.players.map((p,i)=>`\`${i+1}.\` <@${p.id}> — \`${p.nick}\``).join('\n') })
      .setFooter({ text:'ORG TIGRE • Fila Sub' }).setTimestamp();
    try { await interaction.message.edit({ embeds:[embed], components:interaction.message.components }); } catch {}
    await interaction.reply({ content:'✅ Entrou na fila Sub!', ephemeral:true });
    if (fila.players.length>=2) {
      const players = [...fila.players]; config.filaSub.players=[]; saveConfig();
      try { await interaction.message.delete(); } catch {}
      const nomes = players.map(p=>p.name.toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,10)).join('-');
      let ch;
      try {
        ch = await interaction.guild.channels.create({
          name:`fila-sub-${nomes}`, type:ChannelType.GuildText, parent:config.filaCategory||null,
          permissionOverwrites:[
            { id:interaction.guild.id, deny:[PermissionFlagsBits.ViewChannel] },
            { id:client.user.id, allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ManageChannels,PermissionFlagsBits.ManageRoles] },
            ...players.map(p=>({ id:p.id, allow:[PermissionFlagsBits.ViewChannel], deny:[PermissionFlagsBits.SendMessages] })),
            ...(config.staffRole?[{ id:config.staffRole, allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages] }]:[]),
          ],
        });
      } catch(e){ console.error(e); return; }
      tickets[ch.id]={ type:'fila', mode:'sub', value:0, players, confirmed:[] }; saveTickets();
      await ch.send({ content:players.map(p=>`<@${p.id}>`).join(' '),
        embeds:[new EmbedBuilder().setColor(0x9B59B6).setTitle('🎁 FILA SUB — AP GRÁTIS | ORG TIGRE')
          .setDescription(`> 🔇 Só leitura até confirmar!\n\n**Jogadores:**\n`+players.map((p,i)=>`\`${i+1}.\` <@${p.id}> — \`${p.nick}\``).join('\n')+`\n\n> Clique ✅ para liberar!`)
          .setFooter({ text:'ORG TIGRE • Fila Sub' }).setTimestamp()],
        components:[new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`fila_confirmar_${ch.id}`).setLabel('✅ Confirmar').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`fila_fechar_${ch.id}`).setLabel('🔒 Fechar Fila').setStyle(ButtonStyle.Danger),
        )],
      });
    }
    return;
  }

  if (id === 'fila_sub_sair') {
    if (!config.filaSub) return interaction.reply({ content:'⚠️ Não está na fila.', ephemeral:true });
    const idx = config.filaSub.players.findIndex(p=>p.id===interaction.user.id);
    if (idx===-1) return interaction.reply({ content:'⚠️ Não está na fila.', ephemeral:true });
    config.filaSub.players.splice(idx,1); saveConfig();
    const embed = new EmbedBuilder().setColor(0x9B59B6).setTitle('🎁 AP GRÁTIS COM SUB — ORG TIGRE')
      .setDescription('> Clique no botão para entrar na fila de AP grátis com Sub!')
      .addFields({ name:`**JOGADORES (${config.filaSub.players.length}/2)**`, value:config.filaSub.players.length>0?config.filaSub.players.map((p,i)=>`\`${i+1}.\` <@${p.id}>`).join('\n'):'Nenhum jogador na fila ainda.' })
      .setFooter({ text:'ORG TIGRE • Fila Sub' }).setTimestamp();
    try { await interaction.message.edit({ embeds:[embed], components:interaction.message.components }); } catch {}
    return interaction.reply({ content:'✅ Saiu da fila Sub.', ephemeral:true });
  }

  // ── FILA DONO ──────────────────────────────────────────────────────────
  if (id === 'fila_dono_entrar') {
    if (config.filaDonoStatus === 'off')
      return interaction.reply({ content:'⛔ **Fila off-line!** Espere ela ser aberta.', ephemeral:true });
    if (!config.filaDono) config.filaDono = { players:[] };
    const fila = config.filaDono;
    if (fila.players.find(p=>p.id===interaction.user.id)) return interaction.reply({ content:'⚠️ Já está na fila!', ephemeral:true });
    if (fila.players.length>=2) return interaction.reply({ content:'❌ Fila cheia!', ephemeral:true });
    fila.players.push({ id:interaction.user.id, nick:interaction.member.displayName, name:interaction.user.username });
    saveConfig();
    const embed = new EmbedBuilder().setColor(0xFFD700).setTitle('👑 AP GRÁTIS COM DONO — ORG TIGRE')
      .setDescription('> Clique no botão para entrar na fila de AP grátis com o Dono!')
      .addFields({ name:`**JOGADORES (${fila.players.length}/2)**`, value:fila.players.map((p,i)=>`\`${i+1}.\` <@${p.id}> — \`${p.nick}\``).join('\n') })
      .setFooter({ text:'ORG TIGRE • Fila Dono' }).setTimestamp();
    try { await interaction.message.edit({ embeds:[embed], components:interaction.message.components }); } catch {}
    await interaction.reply({ content:'✅ Entrou na fila Dono!', ephemeral:true });
    if (fila.players.length>=2) {
      const players=[...fila.players]; config.filaDono.players=[]; saveConfig();
      try { await interaction.message.delete(); } catch {}
      const nomes=players.map(p=>p.name.toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,10)).join('-');
      let ch;
      try {
        ch = await interaction.guild.channels.create({
          name:`fila-dono-${nomes}`, type:ChannelType.GuildText, parent:config.filaCategory||null,
          permissionOverwrites:[
            { id:interaction.guild.id, deny:[PermissionFlagsBits.ViewChannel] },
            { id:client.user.id, allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ManageChannels,PermissionFlagsBits.ManageRoles] },
            ...players.map(p=>({ id:p.id, allow:[PermissionFlagsBits.ViewChannel], deny:[PermissionFlagsBits.SendMessages] })),
            ...(config.staffRole?[{ id:config.staffRole, allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages] }]:[]),
          ],
        });
      } catch(e){ console.error(e); return; }
      tickets[ch.id]={ type:'fila', mode:'dono', value:0, players, confirmed:[] }; saveTickets();
      await ch.send({ content:players.map(p=>`<@${p.id}>`).join(' '),
        embeds:[new EmbedBuilder().setColor(0xFFD700).setTitle('👑 FILA DONO — AP GRÁTIS | ORG TIGRE')
          .setDescription(`> 🔇 Só leitura até confirmar!\n\n**Jogadores:**\n`+players.map((p,i)=>`\`${i+1}.\` <@${p.id}> — \`${p.nick}\``).join('\n')+`\n\n> Clique ✅ para liberar!`)
          .setFooter({ text:'ORG TIGRE • Fila Dono' }).setTimestamp()],
        components:[new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`fila_confirmar_${ch.id}`).setLabel('✅ Confirmar').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`fila_fechar_${ch.id}`).setLabel('🔒 Fechar Fila').setStyle(ButtonStyle.Danger),
        )],
      });
    }
    return;
  }

  if (id === 'fila_dono_sair') {
    if (!config.filaDono) return interaction.reply({ content:'⚠️ Não está na fila.', ephemeral:true });
    const idx=config.filaDono.players.findIndex(p=>p.id===interaction.user.id);
    if (idx===-1) return interaction.reply({ content:'⚠️ Não está na fila.', ephemeral:true });
    config.filaDono.players.splice(idx,1); saveConfig();
    const embed = new EmbedBuilder().setColor(0xFFD700).setTitle('👑 AP GRÁTIS COM DONO — ORG TIGRE')
      .setDescription('> Clique no botão para entrar na fila de AP grátis com o Dono!')
      .addFields({ name:`**JOGADORES (${config.filaDono.players.length}/2)**`, value:config.filaDono.players.length>0?config.filaDono.players.map((p,i)=>`\`${i+1}.\` <@${p.id}>`).join('\n'):'Nenhum jogador na fila ainda.' })
      .setFooter({ text:'ORG TIGRE • Fila Dono' }).setTimestamp();
    try { await interaction.message.edit({ embeds:[embed], components:interaction.message.components }); } catch {}
    return interaction.reply({ content:'✅ Saiu da fila Dono.', ephemeral:true });
  }

  // ── CONFIRMAR NA FILA (jogadores) ─────────────────────────────────────
  if (id.startsWith('fila_confirmar_')) {
    const filaInfo = tickets[interaction.channel.id];
    if (!filaInfo) return interaction.reply({ content:'❌ Dados não encontrados.', ephemeral:true });
    if (!filaInfo.players.find(p=>p.id===interaction.user.id))
      return interaction.reply({ content:'❌ Você não faz parte desta fila.', ephemeral:true });
    if (filaInfo.confirmed.includes(interaction.user.id))
      return interaction.reply({ content:'⚠️ Você já confirmou!', ephemeral:true });
    filaInfo.confirmed.push(interaction.user.id); saveTickets();
    await interaction.channel.permissionOverwrites.edit(interaction.user.id, { ViewChannel:true, SendMessages:true });
    await interaction.reply({ content:`✅ <@${interaction.user.id}> confirmou! (${filaInfo.confirmed.length}/${filaInfo.players.length})` });
    if (filaInfo.confirmed.length >= filaInfo.players.length) {
      for (const p of filaInfo.players)
        await interaction.channel.permissionOverwrites.edit(p.id,{ ViewChannel:true, SendMessages:true }).catch(()=>{});
      await interaction.channel.send({ embeds:[new EmbedBuilder().setColor(0x00C896)
        .setTitle('✅ TODOS CONFIRMARAM — ORG TIGRE')
        .setDescription(`> Canal liberado! 🎉\n\n💰 **Valor:** ${formatVal(filaInfo.value)}\n📊 **Taxa ADM:** R$ ${TAXA.toFixed(2).replace('.',',')}\n\n> Aguarde o ADM confirmar o AP!`)
        .setFooter({ text:'ORG TIGRE • Free Fire' }).setTimestamp()] });
    }
    return;
  }

  // ── FECHAR FILA ────────────────────────────────────────────────────────
  if (id.startsWith('fila_fechar_')) {
    const isAdm  = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    const isStaff= config.staffRole && interaction.member.roles.cache.has(config.staffRole);
    if (!isAdm && !isStaff) return interaction.reply({ content:'❌ Sem permissão.', ephemeral:true });
    await interaction.reply({ embeds:[new EmbedBuilder().setColor(0xE74C3C).setTitle('🔒 Fila Encerrada')
      .setDescription(`Encerrado por ${interaction.user}. Canal deletado em 5s.`).setTimestamp()] });
    try {
      const msgs = await interaction.channel.messages.fetch({ limit:100 });
      const txt  = [...msgs.values()].reverse().map(m=>`[${new Date(m.createdTimestamp).toLocaleString('pt-BR')}] ${m.author.tag}: ${m.content||'[embed]'}`).join('\n');
      const buf  = Buffer.from(`TRANSCRIPT — ${interaction.channel.name}\n${'='.repeat(50)}\n\n${txt}`,'utf8');
      const logCh = await client.channels.fetch(CANAL_FILA_LOG);
      await logCh.send({ embeds:[new EmbedBuilder().setColor(0xFF8C00).setTitle('📋 Transcript de Fila')
        .setDescription(`**Canal:** ${interaction.channel.name}\n**Encerrado por:** ${interaction.user}`)
        .setTimestamp()], files:[{ attachment:buf, name:`transcript-${interaction.channel.name}.txt` }] });
    } catch {}
    delete tickets[interaction.channel.id]; saveTickets();
    setTimeout(()=>interaction.channel.delete().catch(()=>{}), 5000);
    return;
  }

  // ── ADM CONFIRMAR AP ───────────────────────────────────────────────────
  if (id.startsWith('adm_confirmar_')) {
    const temCargo = interaction.member.roles.cache.has(CARGO_AP);
    const isAdm   = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    if (!temCargo && !isAdm) return interaction.reply({ content:'❌ Sem permissão.', ephemeral:true });
    const admPix = config.pixUsers?.[interaction.user.id];
    if (!admPix) return interaction.reply({ content:'❌ Registre seu PIX primeiro!\nUse: `!registrar pix suachave`', ephemeral:true });
    const filaChId = id.replace('adm_confirmar_','');
    const filaInfo = tickets[filaChId];
    if (!filaInfo) return interaction.reply({ content:'❌ Fila não encontrada.', ephemeral:true });
    const pixList = filaInfo.players.map(p=>{
      const pix = config.pixUsers?.[p.id];
      return `<@${p.id}> — \`${p.nick}\`\nPIX: ${pix?`\`${pix}\``:'❌ Não registrado'}`;
    }).join('\n\n');
    await interaction.update({
      embeds:[new EmbedBuilder().setColor(0xFFAA00).setTitle('⏳ AP EM ANDAMENTO — ORG TIGRE')
        .setDescription(`Confirmado por ${interaction.user} — faça o AP no jogo!\n\n**💳 PIX dos jogadores:**\n${pixList}\n\n> Quando terminar clique em **"AP Feito"**`)
        .setFooter({ text:'ORG TIGRE' }).setTimestamp()],
      components:[new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`adm_apfeito_${filaChId}_${interaction.user.id}`).setLabel('✅ AP Feito').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`adm_recusar_${filaChId}`).setLabel('❌ Cancelar').setStyle(ButtonStyle.Danger),
      )]
    });
    return;
  }

  // ── ADM AP FEITO ───────────────────────────────────────────────────────
  if (id.startsWith('adm_apfeito_')) {
    const temCargo = interaction.member.roles.cache.has(CARGO_AP);
    const isAdm   = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    if (!temCargo && !isAdm) return interaction.reply({ content:'❌ Sem permissão.', ephemeral:true });
    const parts     = id.replace('adm_apfeito_','').split('_');
    const admUserId = parts[parts.length-1];
    const filaChId  = parts.slice(0,-1).join('_');
    const admPix    = config.pixUsers?.[admUserId];
    await interaction.update({
      embeds:[new EmbedBuilder().setColor(0x00C896).setTitle('✅ AP FEITO — ORG TIGRE')
        .setDescription(`AP concluído por ${interaction.user}!`).setTimestamp()],
      components:[]
    });
    try {
      const filaCh = await client.channels.fetch(filaChId);
      await filaCh.send({ embeds:[new EmbedBuilder().setColor(0x00C896).setTitle('✅ AP FEITO! Pague agora! 💰')
        .setDescription(`> O AP foi feito! Pague o ADM agora!\n\n**📲 PIX do ADM (${interaction.user.username}):**\n\`\`\`${admPix||'ADM sem PIX registrado!'}\`\`\``)
        .setFooter({ text:'ORG TIGRE • Free Fire' }).setTimestamp()] });
    } catch {}
    return;
  }

  // ── ADM RECUSAR AP ─────────────────────────────────────────────────────
  if (id.startsWith('adm_recusar_')) {
    const temCargo = interaction.member.roles.cache.has(CARGO_AP);
    const isAdm   = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    if (!temCargo && !isAdm) return interaction.reply({ content:'❌ Sem permissão.', ephemeral:true });
    const filaChId = id.replace('adm_recusar_','');
    await interaction.update({
      embeds:[new EmbedBuilder().setColor(0xE74C3C).setTitle('❌ AP Recusado').setDescription(`Recusado por ${interaction.user}`).setTimestamp()],
      components:[]
    });
    try {
      const filaCh = await client.channels.fetch(filaChId);
      await filaCh.send({ embeds:[new EmbedBuilder().setColor(0xE74C3C).setTitle('❌ AP RECUSADO')
        .setDescription('> O ADM recusou o AP. Entre em contato com a equipe!')
        .setFooter({ text:'ORG TIGRE' }).setTimestamp()] });
    } catch {}
    return;
  }

  // ── TICKET — FECHAR ────────────────────────────────────────────────────
  if (id.startsWith('ticket_close_')) {
    const isAdm  = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    const isStaff= config.staffRole && interaction.member.roles.cache.has(config.staffRole);
    if (!isAdm && !isStaff) return interaction.reply({ content:'❌ Sem permissão.', ephemeral:true });
    await interaction.reply({ embeds:[new EmbedBuilder().setColor(0xE74C3C).setTitle('🔒 Ticket Encerrado')
      .setDescription(`Encerrado por ${interaction.user}. Canal deletado em 5s.`).setTimestamp()] });
    const t = tickets[interaction.channel.id];
    try {
      const msgs = await interaction.channel.messages.fetch({ limit:100 });
      const txt  = [...msgs.values()].reverse().map(m=>`[${new Date(m.createdTimestamp).toLocaleString('pt-BR')}] ${m.author.tag}: ${m.content||'[embed]'}`).join('\n');
      const buf  = Buffer.from(`TRANSCRIPT — ${interaction.channel.name}\n${'='.repeat(50)}\n\n${txt}`,'utf8');
      try {
        const logCh = await client.channels.fetch(CANAL_TICKET_LOG);
        await logCh.send({ embeds:[new EmbedBuilder().setColor(0x3498DB).setTitle('📋 Transcript de Ticket')
          .setDescription(`**Canal:** ${interaction.channel.name}\n**Aberto por:** ${t?`<@${t.userId}>`:'?'}\n**Encerrado por:** ${interaction.user}`)
          .setTimestamp()], files:[{ attachment:buf, name:`transcript-${interaction.channel.name}.txt` }] });
      } catch {}
      if (t?.userId) {
        try {
          const user = await client.users.fetch(t.userId);
          await user.send({ embeds:[new EmbedBuilder().setColor(0x3498DB).setTitle('📋 Transcript do seu Ticket — ORG TIGRE')
            .setDescription(`Seu ticket **${interaction.channel.name}** foi encerrado.\nBaixe o arquivo abaixo para ver as mensagens!`)
            .setTimestamp()], files:[{ attachment:buf, name:`transcript-${interaction.channel.name}.txt` }] });
        } catch {}
      }
    } catch {}
    delete tickets[interaction.channel.id]; saveTickets();
    setTimeout(()=>interaction.channel.delete().catch(()=>{}), 5000);
    return;
  }

  // ── TICKET — NOTIFICAR ─────────────────────────────────────────────────
  if (id.startsWith('ticket_notify_')) {
    const t = tickets[interaction.channel.id];
    if (!t) return interaction.reply({ content:'❌ Ticket não encontrado.', ephemeral:true });
    try {
      const user = await client.users.fetch(t.userId);
      await user.send({ embeds:[new EmbedBuilder().setColor(0x3498DB).setTitle('🔔 Notificação — ORG TIGRE')
        .setDescription(`Mensagem no seu ticket! <#${interaction.channel.id}>`).setTimestamp()] });
      await interaction.reply({ content:'✅ Notificado!', ephemeral:true });
    } catch { await interaction.reply({ content:'❌ DM fechada.', ephemeral:true }); }
    return;
  }

  // ── TICKET — BANIR ─────────────────────────────────────────────────────
  if (id.startsWith('ticket_ban_')) {
    const t = tickets[interaction.channel.id];
    if (!t) return interaction.reply({ content:'❌ Ticket não encontrado.', ephemeral:true });
    const isAdm  = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    const isStaff= config.staffRole && interaction.member.roles.cache.has(config.staffRole);
    if (!isAdm && !isStaff) return interaction.reply({ content:'❌ Sem permissão.', ephemeral:true });
    try {
      const member = await interaction.guild.members.fetch(t.userId);
      await member.ban({ reason:`Banido por ${interaction.user.tag}` });
      await interaction.reply({ content:`✅ <@${t.userId}> banido!` });
    } catch { await interaction.reply({ content:'❌ Erro ao banir.', ephemeral:true }); }
    return;
  }

  // ── TICKET — CASTIGO ───────────────────────────────────────────────────
  if (id.startsWith('ticket_mute_')) {
    const t = tickets[interaction.channel.id];
    if (!t) return interaction.reply({ content:'❌ Ticket não encontrado.', ephemeral:true });
    const isAdm  = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    const isStaff= config.staffRole && interaction.member.roles.cache.has(config.staffRole);
    if (!isAdm && !isStaff) return interaction.reply({ content:'❌ Sem permissão.', ephemeral:true });
    try {
      const member = await interaction.guild.members.fetch(t.userId);
      await member.timeout(10*60*1000, `Castigo por ${interaction.user.tag}`);
      await interaction.reply({ content:`✅ <@${t.userId}> 10 min de castigo!` });
    } catch { await interaction.reply({ content:'❌ Erro.', ephemeral:true }); }
    return;
  }

  // ── TICKET — ADICIONAR MEMBRO ──────────────────────────────────────────
  if (id.startsWith('ticket_add_')) {
    const t = tickets[interaction.channel.id];
    if (!t) return interaction.reply({ content:'❌ Ticket não encontrado.', ephemeral:true });
    await interaction.reply({ content:'👤 Mencione o membro (@membro) no chat:', ephemeral:true });
    const collector = interaction.channel.createMessageCollector({
      filter: m => m.author.id===interaction.user.id && m.mentions.members.size>0,
      time:30000, max:1
    });
    collector.on('collect', async m => {
      const target = m.mentions.members.first();
      m.delete().catch(()=>{});
      await interaction.channel.permissionOverwrites.create(target,{ ViewChannel:true, SendMessages:true });
      await interaction.channel.send({ content:`✅ <@${target.id}> adicionado por <@${interaction.user.id}>.` });
    });
    return;
  }
});

const TOKEN = process.env.DISCORD_TOKEN || config.token || 'SEU_TOKEN_AQUI';
client.login(TOKEN);
