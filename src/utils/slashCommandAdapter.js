const { Collection, SlashCommandBuilder } = require("discord.js");

const tokenize = (value) =>
    value.match(/"[^"]*"|'[^']*'|\S+/g)?.map((item) =>
        item.replace(/^(['"])|(['"])$/g, "")
    ) || [];

const resolveMention = (guild, client, id, type) => {
    if (type === "user") {
        return guild?.members.cache.get(id)?.user || client.users.cache.get(id);
    }
    if (type === "member") return guild?.members.cache.get(id);
    if (type === "role") return guild?.roles.cache.get(id);
    if (type === "channel") return guild?.channels.cache.get(id);
    return null;
};

const buildMentions = (client, interaction, rawArgs) => {
    const users = new Collection();
    const members = new Collection();
    const roles = new Collection();
    const channels = new Collection();

    for (const match of rawArgs.matchAll(/<@!?(\d+)>/g)) {
        const user = resolveMention(interaction.guild, client, match[1], "user");
        const member = resolveMention(interaction.guild, client, match[1], "member");
        if (user) users.set(user.id, user);
        if (member) members.set(member.id, member);
    }

    for (const match of rawArgs.matchAll(/<@&(\d+)>/g)) {
        const role = resolveMention(interaction.guild, client, match[1], "role");
        if (role) roles.set(role.id, role);
    }

    for (const match of rawArgs.matchAll(/<#(\d+)>/g)) {
        const channel = resolveMention(interaction.guild, client, match[1], "channel");
        if (channel) channels.set(channel.id, channel);
    }

    return {
        users,
        members,
        roles,
        channels,
        everyone: /@everyone|@here/.test(rawArgs),
    };
};

const createSlashMessage = (client, interaction, rawArgs, prefix, commandName) => {
    const respond = async (payload) => {
        const normalized = typeof payload === "string" ? { content: payload } : payload;

        if (interaction.replied || interaction.deferred) {
            return interaction.followUp(normalized);
        }

        await interaction.reply(normalized);
        return interaction.fetchReply().catch(() => null);
    };

    const channel = interaction.channel
        ? new Proxy(interaction.channel, {
            get(target, property, receiver) {
                if (property === "send") return respond;
                return Reflect.get(target, property, receiver);
            },
        })
        : { send: respond };

    return {
        id: interaction.id,
        content: `${prefix}${commandName}${rawArgs ? ` ${rawArgs}` : ""}`,
        author: interaction.user,
        member: interaction.member,
        guild: interaction.guild,
        channel,
        client,
        mentions: buildMentions(client, interaction, rawArgs),
        attachments: new Collection(),
        reply: respond,
        delete: () => interaction.deleteReply().catch(() => {}),
        interaction: { user: interaction.user },
    };
};

const attachGenericSlashCommand = (command) => {
    if (!command?.name || (command.slashCommand && command.runSlash)) return;

    const description = String(command.description || `Run the ${command.name} command`)
        .replace(/\s+/g, " ")
        .slice(0, 100);

    command.slashCommand = new SlashCommandBuilder()
        .setName(command.name)
        .setDescription(description || "Run this command")
        .addStringOption((option) =>
            option
                .setName("args")
                .setDescription("Command arguments, in the same order as the prefix command")
                .setRequired(false)
        );

    command.runSlash = async (client, interaction) => {
        if (!interaction.guild) {
            return interaction.reply({
                content: "This command can only be used inside a server.",
                ephemeral: true,
            });
        }

        const rawArgs = interaction.options.getString("args") || "";
        const args = tokenize(rawArgs);
        const prefixData = await client.db.get(`prefix_${interaction.guild.id}`);
        const prefix = prefixData || client.config.prefix;
        const message = createSlashMessage(client, interaction, rawArgs, prefix, command.name);

        return command.run(client, message, args, prefix);
    };
};

module.exports = { attachGenericSlashCommand };