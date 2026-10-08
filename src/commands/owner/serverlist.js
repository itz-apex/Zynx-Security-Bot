const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
} = require("discord.js");

const PAGE_SIZE = 5;

const clean = (value, fallback = "Unknown") =>
    String(value || fallback).replace(/[`]/g, "'").replace(/\r?\n/g, " ");

module.exports = {
    name: "serverlist",
    aliases: ["guildlist", "servers"],
    description: "View all servers where the bot is installed",
    category: "owner",
    cooldown: 5,

    async run(client, message) {
        const ownerIds = new Set([
            ...(client.config.owner || []),
            ...(client.config.extraowners || []),
        ].filter(Boolean).map(String));

        if (!ownerIds.has(String(message.author.id))) {
            return message.reply("You do not have permission to use this command.");
        }

        const guilds = [...client.guilds.cache.values()]
            .sort((a, b) => a.name.localeCompare(b.name));

        if (!guilds.length) {
            return message.reply("The bot is not connected to any servers.");
        }

        const totalPages = Math.ceil(guilds.length / PAGE_SIZE);
        let currentPage = 0;
        const sep = () => new SeparatorBuilder()
            .setDivider(true)
            .setSpacing(SeparatorSpacingSize.Small);

        const formatGuild = (guild, index) => {
            const channels = guild.channels.cache;
            const textChannels = channels.filter(channel =>
                channel.isTextBased?.() && !channel.isThread?.()
            ).size;
            const voiceChannels = channels.filter(channel =>
                channel.isVoiceBased?.() && !channel.isThread?.()
            ).size;
            const roles = Math.max(0, guild.roles.cache.size - 1);
            const antinukeEnabled =
                client._antinukeCache?.get(guild.id) ??
                client.isAntinukeEnabled?.(guild.id) ??
                false;

            return [
                `**${index + 1}. ${clean(guild.name)}**`,
                `\`${guild.id}\` | Owner: ${guild.ownerId ? `<@${guild.ownerId}>` : "Unknown"}`,
                `Members: **${guild.memberCount ?? guild.members.cache.size}** | Channels: **${textChannels + voiceChannels}** (${textChannels} text, ${voiceChannels} voice)`,
                `Roles: **${roles}** | Boosts: **${guild.premiumSubscriptionCount || 0}** | Antinuke: **${antinukeEnabled ? "Enabled" : "Disabled"}**`,
                `Created: **${guild.createdAt.toLocaleDateString()}** | Shard: **${guild.shardId}**`,
            ].join("\n");
        };

        const buildView = (disabled = false) => {
            const pageGuilds = guilds.slice(
                currentPage * PAGE_SIZE,
                (currentPage + 1) * PAGE_SIZE,
            );
            const startIndex = currentPage * PAGE_SIZE;

            return new ContainerBuilder()
                .setAccentColor(0x5865F2)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `## Bot Server List — ${guilds.length} Servers`
                    ),
                )
                .addSeparatorComponents(sep())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        pageGuilds.map((guild, index) =>
                            formatGuild(guild, startIndex + index)
                        ).join("\n\n"),
                    ),
                )
                .addSeparatorComponents(sep())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `-# Page ${currentPage + 1} of ${totalPages} | Total servers: ${guilds.length}`,
                    ),
                )
                .addActionRowComponents(row =>
                    row.addComponents(
                        new ButtonBuilder()
                            .setCustomId("serverlist_first")
                            .setLabel("≪")
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(disabled || currentPage === 0),
                        new ButtonBuilder()
                            .setCustomId("serverlist_previous")
                            .setLabel("Previous")
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(disabled || currentPage === 0),
                        new ButtonBuilder()
                            .setCustomId("serverlist_close")
                            .setLabel("Delete")
                            .setStyle(ButtonStyle.Danger)
                            .setDisabled(disabled),
                        new ButtonBuilder()
                            .setCustomId("serverlist_next")
                            .setLabel("Next")
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(disabled || currentPage === totalPages - 1),
                        new ButtonBuilder()
                            .setCustomId("serverlist_last")
                            .setLabel("≫")
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(disabled || currentPage === totalPages - 1),
                    ),
                );
        };

        const sent = await message.reply({
            components: [buildView()],
            flags: MessageFlags.IsComponentsV2,
        });

        const collector = sent.createMessageComponentCollector({
            filter: interaction => interaction.user.id === message.author.id,
            time: 300000,
        });

        collector.on("collect", async interaction => {
            switch (interaction.customId) {
                case "serverlist_first":
                    currentPage = 0;
                    break;
                case "serverlist_previous":
                    currentPage = Math.max(0, currentPage - 1);
                    break;
                case "serverlist_next":
                    currentPage = Math.min(totalPages - 1, currentPage + 1);
                    break;
                case "serverlist_last":
                    currentPage = totalPages - 1;
                    break;
                case "serverlist_close":
                    await interaction.message.delete().catch(() => {});
                    return collector.stop("closed");
                default:
                    return;
            }

            await interaction.update({
                components: [buildView()],
                flags: MessageFlags.IsComponentsV2,
            }).catch(() => {});
        });

        collector.on("end", (_, reason) => {
            if (reason === "closed") return;
            sent.edit({
                components: [buildView(true)],
                flags: MessageFlags.IsComponentsV2,
            }).catch(() => {});
        });
    },
};