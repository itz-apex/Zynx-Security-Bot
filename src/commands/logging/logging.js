const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    StringSelectMenuBuilder,
    ChannelSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    PermissionFlagsBits,
    MessageFlags,
} = require("discord.js");

const EVENT_GROUPS = [
    { value: "vc",       label: "Voice Channels" },
    { value: "messages", label: "Messages"        },
    { value: "roles",    label: "Roles"           },
    { value: "channels", label: "Channels"        },
    { value: "members",  label: "Members"         },
];

const AUTO_LOG_CATEGORY = "Lunexa Logs";
const AUTO_LOG_CHANNELS = [
    { value: "vc",       name: "voice-logs"   },
    { value: "messages", name: "message-logs" },
    { value: "roles",    name: "role-logs"    },
    { value: "channels", name: "channel-logs" },
    { value: "members",  name: "member-logs"  },
];

module.exports = {
    name: "logging",
    aliases: ["log"],
    description: "Enable, disable, or configure server event logging",
    category: "logging",
    cooldown: 3,

    run: async (client, message, args, prefix) => {
        const ENABLED_EMOJI  = client.emoji.enabled2;
        const DISABLED_EMOJI = client.emoji.disabled2;

        const owners = client.config?.owner || [];
        const extra1 = client.lmdbGet(`ownerPermit1_${message.guild.id}`);
        const extra2 = client.lmdbGet(`ownerPermit2_${message.guild.id}`);

        if (
            message.author.id !== message.guild.ownerId &&
            !owners.includes(message.author.id) &&
            extra1 !== message.author.id &&
            extra2 !== message.author.id
        ) {
            return message.channel.send({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0x26272F)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `${client.emoji.cross} Only the **Server Owner** can use this command.`
                            )
                        ),
                ],
                flags: MessageFlags.IsComponentsV2,
            });
        }

        const sub       = args[0]?.toLowerCase();
        const guildId   = message.guild.id;
        const key       = `logging_${guildId}`;
        const isEnabled = client.lmdbGet(key) === "enabled";
        const cfg       = client.lmdbGet(`logging_cfg_${guildId}`) || {};

        const sep = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);
        const statusCard = (content, color = 0x26272F) => ({
            components: [
                new ContainerBuilder()
                    .setAccentColor(color)
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(content)),
            ],
            flags: MessageFlags.IsComponentsV2,
        });
        const loadingCard = (content) =>
            statusCard(`${client.emoji.loading || "⏳"} ${content}`);

        if (!sub) {
            return message.reply({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0x26272F)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent("## Logging System")
                        )
                        .addSeparatorComponents(sep())
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `\`${prefix}logging enable\` — Enable logging\n` +
                                `\`${prefix}logging disable\` — Disable logging\n` +
                                `\`${prefix}logging status\` — View current configuration\n` +
                                `\`${prefix}logging setup\` — Auto-create the log category and channels\n` +
                                `\`${prefix}logging setup manual\` — Configure existing channels manually`
                            )
                        )
                        .addSeparatorComponents(sep())
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(`-# Requested by ${message.author.tag}`)
                        ),
                ],
                flags: MessageFlags.IsComponentsV2,
            });
        }

        
        if (sub === "status") {
            const lines = EVENT_GROUPS.map(g =>
                `**${g.label}:** ${cfg[g.value] ? `<#${cfg[g.value]}>` : "\`Not set\`"}`
            ).join("\n");

            return message.reply({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0x26272F)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `## ${message.guild.name} — Logging Status`
                            )
                        )
                        .addSeparatorComponents(sep())
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `**Status:** ${isEnabled ? `${ENABLED_EMOJI} Active` : `${DISABLED_EMOJI} Inactive`}\n` +
                                `**Category:** ${cfg.category ? `<#${cfg.category}>` : "\`Not set\`"}`
                            )
                        )
                        .addSeparatorComponents(sep())
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(lines)
                        )
                        .addSeparatorComponents(sep())
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(`-# Server ID: ${guildId}`)
                        ),
                ],
                flags: MessageFlags.IsComponentsV2,
            });
        }

        // ── AUTO SETUP ───────────────────────────────────────────────────
        if (sub === "setup" && args[1]?.toLowerCase() !== "manual") {
            const loadingMessage = await message.reply(
                loadingCard("Creating the logging category and channels...")
            );
            const me = message.guild.members.me;
            if (!me?.permissions.has(PermissionFlagsBits.ManageChannels)) {
                return loadingMessage.edit(statusCard(
                    `${client.emoji.cross} I need the **Manage Channels** permission to create the logging category and channels.`,
                    0xFF0000
                ));
            }

            let category = message.guild.channels.cache.get(cfg.category);
            if (!category || category.type !== ChannelType.GuildCategory) {
                category = message.guild.channels.cache.find(channel =>
                    channel.type === ChannelType.GuildCategory &&
                    channel.name === AUTO_LOG_CATEGORY
                );
            }

            if (!category) {
                category = await message.guild.channels.create({
                    name: AUTO_LOG_CATEGORY,
                    type: ChannelType.GuildCategory,
                    reason: "Logging setup",
                }).catch(() => null);
            }

            if (!category) {
                return loadingMessage.edit(statusCard(
                    `${client.emoji.cross} I could not create the logging category. Check my **Manage Channels** permission.`,
                    0xFF0000
                ));
            }

            const nextCfg = { ...cfg, category: category.id };
            for (const definition of AUTO_LOG_CHANNELS) {
                let channel = message.guild.channels.cache.find(item =>
                    item.parentId === category.id &&
                    item.type === ChannelType.GuildText &&
                    item.name === definition.name
                );

                if (!channel) {
                    channel = await message.guild.channels.create({
                        name: definition.name,
                        type: ChannelType.GuildText,
                        parent: category.id,
                        reason: "Logging setup",
                    }).catch(() => null);
                }

                if (!channel) {
                    return loadingMessage.edit(statusCard(
                        `${client.emoji.cross} I could not create \`#${definition.name}\`. Check my **Manage Channels** permission.`,
                        0xFF0000
                    ));
                }

                nextCfg[definition.value] = channel.id;
            }

            client.lmdbSet(`logging_cfg_${guildId}`, nextCfg);

            const channelMentions = AUTO_LOG_CHANNELS
                .map(definition => `<#${nextCfg[definition.value]}>`)
                .join("  ");

            return loadingMessage.edit(statusCard(
                `${client.emoji.tick} Logging category and channels are ready.\n` +
                `**Category:** <#${category.id}>\n` +
                `**Channels:** ${channelMentions}\n\n` +
                `-# Run \`${prefix}logging enable\` to start sending logs.`,
                0x57F287
            ));
        }

        // ── MANUAL SETUP ─────────────────────────────────────────────────
        if (sub === "setup" && args[1]?.toLowerCase() === "manual") {
            const channels = {
                vc:       cfg.vc       || null,
                messages: cfg.messages || null,
                roles:    cfg.roles    || null,
                channels: cfg.channels || null,
                members:  cfg.members  || null,
            };
            let currentGroup = null;

            const overview = (chans) =>
                EVENT_GROUPS.map(g =>
                    `**${g.label}:** ${chans[g.value] ? `<#${chans[g.value]}>` : "\`Not set\`"}`
                ).join("\n");

            const groupSelect = (selected) =>
                new StringSelectMenuBuilder()
                    .setCustomId("log_group_select")
                    .setPlaceholder("Select event group to configure")
                    .addOptions(EVENT_GROUPS.map(g => ({
                        label:   g.label,
                        value:   g.value,
                        default: g.value === selected,
                    })));

            const channelSelect = (group) => {
                const menu = new ChannelSelectMenuBuilder()
                    .setCustomId("log_channel_select")
                    .setChannelTypes(ChannelType.GuildText)
                    .setDisabled(!group);

                menu.setPlaceholder(
                    group
                        ? `Channel for ${EVENT_GROUPS.find(g => g.value === group).label}`
                        : "Select an event group first"
                );

                return menu;
            };

            const buildUI = (chans, group) =>
                new ContainerBuilder()
                    .setAccentColor(0x26272F)
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent("## Logging Setup")
                    )
                    .addSeparatorComponents(sep())
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(overview(chans))
                    )
                    .addSeparatorComponents(sep())
                    .addActionRowComponents((row) => row.addComponents(groupSelect(group)))
                    .addActionRowComponents((row) => row.addComponents(channelSelect(group)))
                    .addActionRowComponents((row) =>
                        row.addComponents(
                            new ButtonBuilder()
                                .setCustomId("log_setup_save")
                                .setLabel("Save")
                                .setStyle(ButtonStyle.Secondary)
                        )
                    );

            const sent = await message.reply({
                components: [buildUI(channels, currentGroup)],
                flags: MessageFlags.IsComponentsV2,
            });

            const collector = sent.createMessageComponentCollector({
                filter: (i) => {
                    if (i.user.id !== message.author.id) {
                        i.reply({ content: "Only the command author can use this menu.", ephemeral: true });
                        return false;
                    }
                    return true;
                },
                time: 120000,
            });

            collector.on("collect", async (i) => {
                if (i.customId === "log_group_select") {
                    currentGroup = i.values[0];
                    return i.update({
                        components: [buildUI(channels, currentGroup)],
                        flags: MessageFlags.IsComponentsV2,
                    });
                }

                if (i.customId === "log_channel_select" && currentGroup) {
                    channels[currentGroup] = i.values[0] || null;
                    return i.update({
                        components: [buildUI(channels, currentGroup)],
                        flags: MessageFlags.IsComponentsV2,
                    });
                }

                if (i.customId === "log_setup_save") {
                    collector.stop("saved");
                    client.lmdbSet(`logging_cfg_${guildId}`, { ...channels });

                    return i.update({
                        components: [
                            new ContainerBuilder()
                                .setAccentColor(0x26272F)
                                .addTextDisplayComponents(
                                    new TextDisplayBuilder().setContent("## Logging Setup")
                                )
                                .addSeparatorComponents(sep())
                                .addTextDisplayComponents(
                                    new TextDisplayBuilder().setContent(overview(channels))
                                )
                                .addSeparatorComponents(sep())
                                .addTextDisplayComponents(
                                    new TextDisplayBuilder().setContent(
                                        `${client.emoji.tick} Configuration saved.\n` +
                                        `-# Use \`${prefix}logging enable\` to start logging.`
                                    )
                                ),
                        ],
                        flags: MessageFlags.IsComponentsV2,
                    });
                }
            });

            collector.on("end", async (_, reason) => {
                if (reason === "saved") return;
                await sent.edit({
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0x26272F)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `## Logging Setup\n-# Timed out — run \`${prefix}logging setup\` again to continue.`
                                )
                            ),
                    ],
                    flags: MessageFlags.IsComponentsV2,
                }).catch(() => {});
            });

            return;
        }

        
        if (sub === "enable") {
            if (isEnabled) {
                return message.reply({
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0x26272F)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `${ENABLED_EMOJI} Logging is already **enabled**.`
                                )
                            ),
                    ],
                    flags: MessageFlags.IsComponentsV2,
                });
            }

            client.lmdbSet(key, "enabled");

            return message.reply({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0x26272F)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `${ENABLED_EMOJI} Logging has been **enabled**.\n` +
                                `-# Log channels: \`${prefix}logging setup\``
                            )
                        ),
                ],
                flags: MessageFlags.IsComponentsV2,
            });
        }

        
        if (sub === "disable") {
            const loadingMessage = await message.reply(
                loadingCard("Disabling logging and removing its channels...")
            );

            const me = message.guild.members.me;
            if (!me?.permissions.has(PermissionFlagsBits.ManageChannels)) {
                return loadingMessage.edit(statusCard(
                    `${client.emoji.cross} I need the **Manage Channels** permission to remove the logging category and channels.`,
                    0xFF0000
                ));
            }

            const configuredCategory = cfg.category
                ? message.guild.channels.cache.get(cfg.category)
                : null;
            const category = configuredCategory?.type === ChannelType.GuildCategory
                ? configuredCategory
                : message.guild.channels.cache.find(channel =>
                    channel.type === ChannelType.GuildCategory &&
                    channel.name === AUTO_LOG_CATEGORY
                );
            const autoChannelIds = new Set(
                AUTO_LOG_CHANNELS.map(definition => cfg[definition.value]).filter(Boolean)
            );
            const autoChannelNames = new Set(
                AUTO_LOG_CHANNELS.map(definition => definition.name)
            );

            if (!isEnabled && !category && !autoChannelIds.size) {
                return loadingMessage.edit(statusCard(
                    `${DISABLED_EMOJI} Logging is already **disabled**.`
                ));
            }

            client.lmdbDel(key);

            const channelsToDelete = [...message.guild.channels.cache.values()].filter(channel =>
                channel.type === ChannelType.GuildText &&
                (
                    autoChannelIds.has(channel.id) ||
                    (
                        category &&
                        channel.parentId === category.id &&
                        autoChannelNames.has(channel.name)
                    )
                )
            );
            const removed = [];
            const failed = [];

            for (const channel of channelsToDelete) {
                try {
                    await channel.delete("Logging disabled");
                    removed.push(`#${channel.name}`);
                } catch {
                    failed.push(`#${channel.name}`);
                }
            }

            if (category?.name === AUTO_LOG_CATEGORY) {
                try {
                    await category.delete("Logging disabled");
                    removed.push(`category ${AUTO_LOG_CATEGORY}`);
                } catch {
                    failed.push(`category ${AUTO_LOG_CATEGORY}`);
                }
            }

            if (!failed.length) {
                client.lmdbDel(`logging_cfg_${guildId}`);
                return loadingMessage.edit(statusCard(
                    `${DISABLED_EMOJI} Logging has been disabled and its auto-created channels were deleted.\n` +
                    `-# Removed: ${removed.length ? removed.join(", ") : "No log resources found."}`,
                    0x57F287
                ));
            }

            return loadingMessage.edit(statusCard(
                `${client.emoji.cross} Logging was disabled, but some log resources could not be deleted.\n` +
                `**Failed:** ${failed.join(", ")}\n` +
                `-# Check my **Manage Channels** permission and run \`${prefix}logging disable\` again.`,
                0xFF0000
            ));
        }

        return message.reply({
            components: [
                new ContainerBuilder()
                    .setAccentColor(0x26272F)
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `${client.emoji.cross} Invalid option. Use \`${prefix}logging <enable|disable|status|setup>\` or \`${prefix}logging setup manual\``
                        )
                    ),
            ],
            flags: MessageFlags.IsComponentsV2,
        });
    },
};
