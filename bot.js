require('dotenv').config();


const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  SlashCommandBuilder,
  ActionRowBuilder,
  Events,
} = require("discord.js");

const { OpenAIApi, Configuration } = require('openai');

// const sharp = require('sharp');


const client = new Client({
  intents: [
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ],
  partials: [Partials.Channel],
});


const token = process.env.TOKEN_DISCORD;

const cron = require("node-cron");

const configuration = new Configuration({
  apiKey: process.env.TOKEN_OPENAI,
});

const openaiClient = new OpenAIApi(configuration);


let reminderMessage = `@everyone ¿A qué horas se juntarán para perder partidas de LoL?`;
let reminderCount = 0;

let loadingMessageId = null;
let loadingChannelId = '783098151933837314';

let isProcessing = false;



client.on("ready", () => {
  console.log(`Bot iniciado como ${client.user.tag}!`);
  reminder(
    "783098151313473577",
    "783098151933837314",
    `${reminderMessage} Se los recordaré todos los días a las ${time12H()}!`,
    "45 19 * * *"
  );

});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return; // Ignorar mensajes de otros bots

  if (isProcessing) {
    message.reply(`Tranquilo ${message.author}, espera tu turno...`);
    return;
  }

  if (message.mentions.has(client.user)) {
    const user = message.author;
    message.reply(`Hola ${user}, en que puedo ayudarte?`);
  }

  if (message.content.startsWith("!")) {
    const args = message.content.slice("!".length).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    if (command == 'lol') {
      message.react('👍').then(() => {
        if (reminderCount == 2) {
          message.channel.send(`Bueno pues @everyone, ¿se va a armar o no las partidas de LoL?`);
        }
        else {
          message.channel.send(`${reminderMessage}`);
          reminderCount++;
        }
      }, () => {
        message.reply('Lo siento, no entendí tu mensaje');
      })
    }
    if (command == 'gpt') {
      isProcessing = true;
      const loading = await message.channel.send('Cargando...');
      const prompt = message.content.slice('!gpt'.length).trim();
      const response = await gpt(prompt);
      loading.delete();
      message.channel.send(`${message.author}, ${response}`);
      isProcessing = false;
    }

    if (command == 'img') {
      const prompt = message.content.slice('!img'.length).trim();
      isProcessing = true;
      const loading = await message.channel.send('Cargando...');
      try {
        const response = await openaiClient.createImage({
          prompt: prompt,
          n: 1,
          response_format: 'url',
          size: '256x256'
        });
        loading.delete();
        message.channel.send(response.data.data[0].url);
        isProcessing = false;
      } catch (error) {
        const response = await gpt(`Traduce esto: ${error.response.data.error.code}`);
        loading.delete();
        message.channel.send(`Sean serios: ${response}`);
        isProcessing = false;
      }
    }
  }
});


async function gpt(prompt) {
  const response = await openaiClient.createChatCompletion({
    model: 'gpt-3.5-turbo',
    max_tokens: 100,
    n: 1,
    messages: [
      { role: 'user', content: prompt }
    ],
  });
  return response.data.choices[0].message.content;
}


function time12H() {
  const date = new Date();
  let hours = date.getHours();
  let minutes = date.getMinutes();
  let period = 'AM';

  // Verificar si es PM y ajustar la hora
  if (hours >= 12) {
    period = 'PM';
    hours = hours === 12 ? 12 : hours - 12;
  }

  // Ajustar horas y minutos a dos dígitos
  hours = String(hours).padStart(2, '0');
  minutes = String(minutes).padStart(2, '0');

  return `${hours}:${minutes} ${period}`;
}

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand()) {
    // command handling
  } else if (interaction.isAutocomplete()) {
    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
      console.error(
        `No command matching ${interaction.commandName} was found.`
      );
      return;
    }

    try {
      await autocomplete(interaction);
    } catch (error) {
      console.error(error);
    }
  }
});

async function autocomplete(interaction) {
  const focusedOption = interaction.options.getFocused(true);
  let choices;

  if (focusedOption.name === "query") {
    choices = [
      "Popular Topics: Threads",
      "Sharding: Getting started",
      "Library: Voice Connections",
      "Interactions: Replying to slash commands",
      "Popular Topics: Embed preview",
    ];
  }

  if (focusedOption.name === "version") {
    choices = ["v9", "v11", "v12", "v13", "v14"];
  }

  const filtered = choices.filter((choice) =>
    choice.startsWith(focusedOption.value)
  );
  await interaction.respond(
    filtered.map((choice) => ({ name: choice, value: choice }))
  );
}

async function dropdownList(message) {
  const select = new StringSelectMenuBuilder()
    .setCustomId("starter")
    .setPlaceholder("Make a selection!")
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel("Bulbasaur")
        .setDescription("The dual-type Grass/Poison Seed Pokémon.")
        .setValue("bulbasaur"),
      new StringSelectMenuOptionBuilder()
        .setLabel("Charmander")
        .setDescription("The Fire-type Lizard Pokémon.")
        .setValue("charmander"),
      new StringSelectMenuOptionBuilder()
        .setLabel("Squirtle")
        .setDescription("The Water-type Tiny Turtle Pokémon.")
        .setValue("squirtle")
    );
  const row = new ActionRowBuilder().addComponents(select);

  // await interaction.reply({
  //   content: "Choose your starter!",
  //   components: [row],
  // });

  message.channel.send({ components: [row] });
}

async function listCommands(message) {
  if (message.content.startsWith("!")) {
    const args = message.content.slice("!".length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === "aiuda") {
      const embed = new EmbedBuilder()
        .setColor("#0099ff")
        .setTitle("Lista de Comandos")
        .setDescription("¡Elige un comando de la lista desplegable!");

      const options = commands
        .map((cmd, index) => `${index + 1}. ${cmd.name}`)
        .join("\n");
      embed.addFields("Opciones:", options);

      const helpMessage = await message.channel.send({ embeds: [embed] });

      // Agregar reacciones a las opciones
      for (let i = 0; i < commands.length; i++) {
        await helpMessage.react(`${i + 1}\u20e3`); // Reacciona con emojis numéricos del 1 al 9
      }

      // Crear filtro para responder a las opciones seleccionadas por los usuarios
      const filter = (reaction, user) => {
        return (
          user.id === message.author.id &&
          reaction.emoji.name >= "1️⃣" &&
          reaction.emoji.name <= "9️⃣"
        );
      };

      // Esperar por la reacción del usuario
      helpMessage
        .awaitReactions({ filter, max: 1, time: 60000, errors: ["time"] })
        .then((collected) => {
          const reaction = collected.first();
          const selectedIndex = parseInt(reaction.emoji.name) - 1;
          const selectedCommand = commands[selectedIndex];

          // Responder con el comando seleccionado
          const responseEmbed = new EmbedBuilder()
            .setColor("#0099ff")
            .setTitle(`Comando: ${selectedCommand.name}`)
            .setDescription(selectedCommand.description);

          message.channel.send({ embeds: [responseEmbed] });
        })
        .catch(() => {
          helpMessage.delete(); // Eliminar el mensaje de aiuda si no se selecciona ninguna opción
        });
    }

    // Aquí puedes agregar más comandos y su lógica correspondiente
    if (command === "saludar") {
      message.channel.send(`¡Hola, ${message.author}!`);
    }
    // Agrega más comandos aquí
  }
}


function reminder(serverID, channelID, message, time) {
  cron.schedule(time, () => {
    const guild = client.guilds.cache.get(serverID); //Server ID
    const channel = guild.channels.cache.get(channelID); // ChannelID
    channel.send(message);
  });
}

client.login(token);
