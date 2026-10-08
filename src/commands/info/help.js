const fs = require("fs");
const path = require("path");
const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    ButtonBuilder,
    StringSelectMenuBuilder,
    SeparatorSpacingSize,
    ButtonStyle,
    MessageFlags,
} = require("discord.js");


module.exports = {
    name: "help",
    aliases: ["h", "commands", "cmds"],
    description: "View all available commands",
    category: "info",
    cooldown: 3,

    run: async (client, message) => {
        let prefix = client.config.prefix;
        const prefixData = await client.db.get(`prefix_${message.guild.id}`);
        if (prefixData) prefix = prefixData;

        const commandsPath = path.join(__dirname, "..");
        const categories = fs.readdirSync(commandsPath)
            .filter(d => fs.statSync(path.join(commandsPath, d)).isDirectory())
            .filter(c => !["owner", "subscription"].includes(c.toLowerCase()));

        const getCommands = (cat) => {
            const dir = path.join(commandsPath, cat);
            if (!fs.existsSync(dir)) return [];
            return fs.readdirSync(dir)
                .filter(f => f.endsWith(".js"))
                .map(f => require(path.join(dir, f)))
                .filter(c => c?.name);
        };

        const totalCommands = categories.reduce(
            (total, category) => total + getCommands(category).length,
            0
        );

        const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
        const categoryLabel = (s) =>
            s.toLowerCase() === "antiraid" ? "AntiRaid" : capitalize(s);
        const securityCategories = categories.filter(category =>
            ["antinuke", "antiraid"].includes(category.toLowerCase())
        );
        const displayCategories = [
            { value: "security", children: securityCategories },
            ...categories
                .filter(category => !securityCategories.includes(category))
                .map(category => ({ value: category, children: [category] })),
        ];
        const categoryList = displayCategories
            .map(category => `${client.emoji.helparrow} ${categoryLabel(category.value)}`)
            .join("\n");

        const sep  = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);
        const thin = () => new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small);

        const makeDropdown = (selected = null) =>
            new StringSelectMenuBuilder()
                .setCustomId("help-category")
                .setPlaceholder(selected ? categoryLabel(selected) : "Browse by category")
                .addOptions(
                    displayCategories.map((cat, i) => ({
                        label: `${i + 1}. ${categoryLabel(cat.value)}`,
                        value: cat.value,
                        default: cat.value === selected,
                    }))
                );

        const makeNavButtons = (homeDisabled) =>
            new ButtonBuilder()
                .setCustomId("home")
                .setLabel("Home")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(homeDisabled);

        const makeAllCommandsButton = (disabled = false) =>
            new ButtonBuilder()
                .setCustomId("all-commands")
                .setLabel("All Commands")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(disabled);

        const makeSecurityNavigation = (page) => [
            new ButtonBuilder()
                .setCustomId("security-previous")
                .setEmoji(client.emoji.arrowleft)
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page === 0),
            new ButtonBuilder()
                .setCustomId("security-next")
                .setEmoji(client.emoji.arrowright)
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page === securityCategories.length - 1),
        ];

        const buildHome = () =>
            new ContainerBuilder()
                .setAccentColor(0x26272F)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `## ${client.user.username}\n` +
                        `-# Prefix: \`${prefix}\` — ${displayCategories.length} categories`
                    )
                )
                .addSeparatorComponents(sep())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `A powerful Security & Moderation bot with Fastest Anti-Nuke.\n\n` +
                        `* **My Prefix is** \`${prefix}\`\n` +
                        `* **Total Commands:** \`${totalCommands}\`\n\n` +
                        `${categoryList}`
                    )
                )
                .addSeparatorComponents(sep())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `[Invite Me](${client.config.inviteURL})  |  [Support Server](${client.config.support_server_link})`
                    )
                )
                .addSeparatorComponents(sep())
                .addActionRowComponents((row) =>
                    row.addComponents(makeNavButtons(true), makeAllCommandsButton())
                )
                .addActionRowComponents((row) => row.addComponents(makeDropdown()));

        const buildSecurityCategory = (page = 0) => {
            const category = securityCategories[page] || securityCategories[0];
            const commands = getCommands(category);
            const commandLines = commands
                .map(command =>
                    `${client.emoji.arrow} \`${prefix}${command.name}\``
                )
                .join("\n") || "None";

            return new ContainerBuilder()
                .setAccentColor(0x26272F)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `## Security\n-# ${categoryLabel(category)} — ${page + 1}/${securityCategories.length}`
                    )
                )
                .addSeparatorComponents(sep())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `**${categoryLabel(category)} Commands**\n${commandLines}`
                    )
                )
                .addSeparatorComponents(sep())
                .addActionRowComponents((row) =>
                    row.addComponents(
                        makeNavButtons(false),
                        ...makeSecurityNavigation(page)
                    )
                )
                .addActionRowComponents((row) => row.addComponents(makeDropdown("security")));
        };

        const buildAntinukeCategory = () =>
            new ContainerBuilder()
                .setAccentColor(0x26272F)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent("**Antinuke**")
                )
                .addSeparatorComponents(thin())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `${client.emoji.arrow} \`${prefix}antinuke\`\n` +
                        `${client.emoji.arrow} \`${prefix}antinuke enable\`\n` +
                        `${client.emoji.arrow} \`${prefix}antinuke disable\`\n` +
                        `${client.emoji.arrow} \`${prefix}antinuke status\``
                    )
                )
                .addSeparatorComponents(sep())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent("**Whitelist**")
                )
                .addSeparatorComponents(thin())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `${client.emoji.arrow} \`${prefix}whitelist\`\n` +
                        `${client.emoji.arrow} \`${prefix}whitelist add <@user>\`\n` +
                        `${client.emoji.arrow} \`${prefix}whitelist remove <@user>\`\n` +
                        `${client.emoji.arrow} \`${prefix}whitelist show\`\n` +
                        `${client.emoji.arrow} \`${prefix}multiwhitelist add <@user1> <@user2> <@user3> ...\`\n` +
                        `${client.emoji.arrow} \`${prefix}multiwhitelist remove <@user1> <@user2> <@user3> ...\``
                    )
                )
                .addSeparatorComponents(sep())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent("**Extraowner**")
                )
                .addSeparatorComponents(thin())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `${client.emoji.arrow} \`${prefix}extraowner\`\n` +
                        `${client.emoji.arrow} \`${prefix}extraowner add\`\n` +
                        `${client.emoji.arrow} \`${prefix}extraowner remove\`\n` +
                        `${client.emoji.arrow} \`${prefix}extraowner show\``
                    )
                )
                .addSeparatorComponents(sep())
                .addActionRowComponents((row) =>
                    row.addComponents(makeNavButtons(false))
                )
                .addActionRowComponents((row) => row.addComponents(makeDropdown("antinuke")));

        const buildAutomodCategory = () =>
            new ContainerBuilder()
                .setAccentColor(0x26272F)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent("**Automod**")
                )
                .addSeparatorComponents(thin())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `${client.emoji.arrow} \`${prefix}automod\`\n` +
                        `${client.emoji.arrow} \`${prefix}automod enable\`\n` +
                        `${client.emoji.arrow} \`${prefix}automod disable\`\n` +
                        `${client.emoji.arrow} \`${prefix}automod status\`\n` +
                        `${client.emoji.arrow} \`${prefix}amsetup\` — Full setup`
                    )
                )
                .addSeparatorComponents(sep())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent("**User Whitelist**")
                )
                .addSeparatorComponents(thin())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `${client.emoji.arrow} \`${prefix}amwhitelist add <@user>\`\n` +
                        `${client.emoji.arrow} \`${prefix}amwhitelist remove <@user>\`\n` +
                        `${client.emoji.arrow} \`${prefix}amwhitelist show\`\n` +
                        `${client.emoji.arrow} \`${prefix}amwhitelist reset\`\n` +
                        `${client.emoji.arrow} \`${prefix}ammultiwhitelist add <@user1> <@user2> ...\`\n` +
                        `${client.emoji.arrow} \`${prefix}ammultiwhitelist remove <@user1> <@user2> ...\``
                    )
                )
                .addSeparatorComponents(sep())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent("**Channel & Role Whitelist**")
                )
                .addSeparatorComponents(thin())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `${client.emoji.arrow} \`${prefix}amchannelwl add #channel\`\n` +
                        `${client.emoji.arrow} \`${prefix}amchannelwl remove #channel\`\n` +
                        `${client.emoji.arrow} \`${prefix}amchannelwl show\`\n` +
                        `${client.emoji.arrow} \`${prefix}amrolewl add @role\`\n` +
                        `${client.emoji.arrow} \`${prefix}amrolewl remove @role\`\n` +
                        `${client.emoji.arrow} \`${prefix}amrolewl show\``
                    )
                )
                .addSeparatorComponents(sep())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent("**Custom Filter & History**")
                )
                .addSeparatorComponents(thin())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `${client.emoji.arrow} \`${prefix}amfilter add <word>\`\n` +
                        `${client.emoji.arrow} \`${prefix}amfilter remove <word>\`\n` +
                        `${client.emoji.arrow} \`${prefix}amfilter show\`\n` +
                        `${client.emoji.arrow} \`${prefix}amfilter reset\`\n` +
                        `${client.emoji.arrow} \`${prefix}amhistory <@user>\` — View strikes & violations`
                    )
                )
                .addSeparatorComponents(sep())
                .addActionRowComponents((row) =>
                    row.addComponents(makeNavButtons(false))
                )
                .addActionRowComponents((row) => row.addComponents(makeDropdown("automod")));

        const buildLoggingCategory = () =>
            new ContainerBuilder()
                .setAccentColor(0x26272F)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent("**Logging**")
                )
                .addSeparatorComponents(thin())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `${client.emoji.arrow} \`${prefix}logging\`\n` +
                        `${client.emoji.arrow} \`${prefix}logging enable\`\n` +
                        `${client.emoji.arrow} \`${prefix}logging disable\`\n` +
                        `${client.emoji.arrow} \`${prefix}logging status\`\n` +
                        `${client.emoji.arrow} \`${prefix}logging setup\` — Configure channels per event group`
                    )
                )
                .addSeparatorComponents(sep())
                .addActionRowComponents((row) =>
                    row.addComponents(makeNavButtons(false))
                )
                .addActionRowComponents((row) => row.addComponents(makeDropdown("logging")));

        const buildAntiraidCategory = () =>
            new ContainerBuilder()
                .setAccentColor(0x26272F)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent("**AntiRaid**")
                )
                .addSeparatorComponents(thin())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `${client.emoji.arrow} \`${prefix}antiraid\`\n` +
                        `${client.emoji.arrow} \`${prefix}antiraid enable\`\n` +
                        `${client.emoji.arrow} \`${prefix}antiraid disable\`\n` +
                        `${client.emoji.arrow} \`${prefix}antiraid status\`\n` +
                        `${client.emoji.arrow} \`${prefix}arsetup\` — Full module setup`
                    )
                )
                .addSeparatorComponents(sep())
                .addActionRowComponents((row) =>
                    row.addComponents(makeNavButtons(false))
                )
                .addActionRowComponents((row) => row.addComponents(makeDropdown("antiraid")));

        const buildVerificationCategory = () =>
            new ContainerBuilder()
                .setAccentColor(0x26272F)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent("**Verification**")
                )
                .addSeparatorComponents(thin())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `${client.emoji.arrow} \`${prefix}verification\`\n` +
                        `${client.emoji.arrow} \`${prefix}verification setup\` — Create role, channel & hide all others\n` +
                        `${client.emoji.arrow} \`${prefix}verification disable\` — Remove verification system\n` +
                        `${client.emoji.arrow} \`${prefix}verification status\` — View current configuration`
                    )
                )
                .addSeparatorComponents(sep())
                .addActionRowComponents((row) =>
                    row.addComponents(makeNavButtons(false))
                )
                .addActionRowComponents((row) => row.addComponents(makeDropdown("verification")));

        const buildAllCommands = () => {
            const container = new ContainerBuilder()
                .setAccentColor(0x26272F)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `## All Commands\n-# ${totalCommands} commands`
                    )
                )
                .addSeparatorComponents(sep());

            categories.forEach((category, index) => {
                const commands = getCommands(category);
                const commandLines = commands
                    .map(command => `${client.emoji.arrow} \`${prefix}${command.name}\``)
                    .join("\n") || "None";

                container
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `**${categoryLabel(category)}**\n${commandLines}`
                        )
                    );

                if (index < categories.length - 1) {
                    container.addSeparatorComponents(thin());
                }
            });

            return container
                .addSeparatorComponents(sep())
                .addActionRowComponents((row) =>
                    row.addComponents(makeNavButtons(false), makeAllCommandsButton(true))
                )
                .addActionRowComponents((row) => row.addComponents(makeDropdown()));
        };

        const buildCategory = (cat) => {
            if (cat.toLowerCase() === "security")      return buildSecurityCategory(0);
            if (cat.toLowerCase() === "antinuke")     return buildAntinukeCategory();
            if (cat.toLowerCase() === "automod")      return buildAutomodCategory();
            if (cat.toLowerCase() === "logging")      return buildLoggingCategory();
            if (cat.toLowerCase() === "antiraid")     return buildAntiraidCategory();
            if (cat.toLowerCase() === "verification") return buildVerificationCategory();

            const cmds = getCommands(cat)
                .map(c => `${client.emoji.arrow} \`${prefix}${c.name}\``)
                .join("\n") || "None";
            return new ContainerBuilder()
                .setAccentColor(0x26272F)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`## ${categoryLabel(cat)}`)
                )
                .addSeparatorComponents(sep())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(cmds)
                )
                .addSeparatorComponents(sep())
                .addActionRowComponents((row) =>
                    row.addComponents(makeNavButtons(false))
                )
                .addActionRowComponents((row) => row.addComponents(makeDropdown(cat)));
        };

        const msg = await message.reply({
            components: [buildHome()],
            flags: MessageFlags.IsComponentsV2,
        });
        let securityPage = 0;

        const collector = msg.createMessageComponentCollector({
            filter: (i) => {
                if (i.user.id !== message.author.id) {
                    i.reply({ content: "Only the command author can use this menu.", ephemeral: true });
                    return false;
                }
                return true;
            },
            time: 0,
        });

        collector.on("collect", async (i) => {
            if (i.customId === "home") {
                return i.update({ components: [buildHome()], flags: MessageFlags.IsComponentsV2 });
            }

            if (i.customId === "all-commands") {
                return i.update({
                    components: [buildAllCommands()],
                    flags: MessageFlags.IsComponentsV2,
                });
            }

            if (i.customId === "security-previous") {
                securityPage = Math.max(0, securityPage - 1);
                return i.update({
                    components: [buildSecurityCategory(securityPage)],
                    flags: MessageFlags.IsComponentsV2,
                });
            }

            if (i.customId === "security-next") {
                securityPage = Math.min(securityCategories.length - 1, securityPage + 1);
                return i.update({
                    components: [buildSecurityCategory(securityPage)],
                    flags: MessageFlags.IsComponentsV2,
                });
            }

            if (i.values?.[0]) {
                if (i.values[0] === "security") securityPage = 0;
                return i.update({ components: [buildCategory(i.values[0])], flags: MessageFlags.IsComponentsV2 });
            }
        });
    },
};