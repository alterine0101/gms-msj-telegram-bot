import fs from "fs/promises";
import { Conversation } from "@grammyjs/conversations";
import { FileX } from "@grammyjs/files/out/files";
import { Context, InputFile } from "grammy";
import { InlineKeyboardButton } from "grammy/out/types.node";
import parsePhoneNumber, { PhoneNumber } from "libphonenumber-js";
import { COLUMN_PARTICIPANT_ID, COLUMN_PARTICIPANT_NAME, COLUMN_PARTICIPANT_PHONE, COLUMN_PARTICIPANT_REMEDIAL } from "../constants";
import { MyContext } from "..";

const sanitize = (text: any) => typeof text == "string" ? text.replace(/;/g, "\\\;") : text;

export const defaultWizardName = "sendMaterialsConversation";

/**
 * Utility function to generate WhatsApp Business API URL
 * @param route the API route
 * @returns the full URL object of WhatsApp Business route
 */

export default async function sendMaterialsConversation(conversation: Conversation<Context>, ctx: Context, data: Map<string, Array<string>>): Promise<Map<string, Array<string>>> {
  await ctx.reply("Sebelumnya, Anda ingin memasukkan absensi untuk sesi apa?", {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "MSJ 1",
            callback_data: "1",
          },
          {
            text: "MSJ 2",
            callback_data: "2",
          },
          {
            text: "MSJ 3",
            callback_data: "3",
          },
        ],
        [
          {
            text: "🚫 Batal",
            callback_data: "cancel",
          }
        ]
      ]
    }
  });

  let msjType: string|null = null;
  do {
    const resCtx = await conversation.waitFor("callback_query");
    if (resCtx.callbackQuery.data == "cancel") {
      await resCtx.reply("Operasi dibatalkan.");
      return data;
    } else if (resCtx.callbackQuery.data != "none") {
      msjType = resCtx.callbackQuery.data!;
    }
    if (!msjType) await ctx.reply("Pilih sesi MSJ yang sesuai.");
  } while (!msjType);

  await ctx.reply("Pilih bahasa yang hendak dikirim", {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "Indonesia",
            callback_data: "id",
          }
        ],
        [
          {
            text: "Inggris",
            callback_data: "en_US",
          }
        ],
        [
          {
            text: "🚫 Batal",
            callback_data: "cancel",
          }
        ],
      ]
    }
  });

  let language: string|null = null;
  do {
    const resCtx = await conversation.waitFor("callback_query");
    if (resCtx.callbackQuery.data == "cancel") {
      await resCtx.reply("Operasi dibatalkan.");
      return data;
    } else if (resCtx.callbackQuery.data != "none") {
      language = resCtx.callbackQuery.data!;
    }
    if (!language) await ctx.reply("Pilih bahasa yang sesuai.");
  } while (!language);

  await ctx.reply("Masukkan daftar nomor telepon yang ingin dikirim (per baris).", {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "🚫 Batal",
            callback_data: "cancel",
          }
        ]
      ]
    }
  });

  let fileNames: string[] = [];
  try {
    fileNames = (await fs.readdir(`materials/${language}/`)).filter((name) => {name.startsWith(`${msjType}-`) && name.endsWith(".pdf")});
    if (msjType == "1") fileNames.push("fk.pdf")
  } catch (e) {
    await ctx.reply("Materi tidak dapat ditemukan");
  }

  let rawNumbers: string|null = null;
  do {
    const resCtx = await conversation.wait();
    if (resCtx.callbackQuery?.data == "cancel") {
      await resCtx.reply("Operasi dibatalkan.");
      return data;
    } else if (resCtx.message?.text) {
      rawNumbers = resCtx.message.text;
    }
    if (!rawNumbers) await ctx.reply("Pilih sesi MSJ yang sesuai.");
  } while (!rawNumbers);

  let numbers = rawNumbers.split("\n");
  let errorNumbers: string[] = [];
  let sentNumbers: string[] = [];
  await Promise.all(numbers.map(async (number) => {
    const parsedNumber = parsePhoneNumber(number, "ID");
    if (!parsedNumber) {
      errorNumbers.push(number);
      return;
    }
    try {
      console.log(`Sending WhatsApp request to ${parsedNumber.formatInternational()}`);
      const res = await fetch(`https://graph.facebook.com/v18.0/${process.env.WA_PHONE_NUMBER_ID}/messages`, {
        method: "post",
        headers: {
          "Authorization": `Bearer ${process.env.WA_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          "messaging_product": "whatsapp",
          "recipient_type": "individual",
          "to": parsedNumber.formatInternational(),
          "type": "template",
          "template": {
            "name": "msj_materi_pdf",
            "language": { "code": language },
            "components": [
              {
                "type": "header",
                "parameters": [ { "type": "text", "text": msjType } ]
              },
              {
                "type": "body",
                "parameters": [ { "type": "text", "text": msjType } ]
              }
            ]
          }
        }),
      });
      if (res.status != 200) {
        errorNumbers.push(number);
        console.log();
        console.error(await res.text());
        return;
      }
    } catch (e) {
      errorNumbers.push(number);
      console.error(e);
      return;
    }
    data.set(parsedNumber.formatInternational().replace(/[^0-9]+/, ''), fileNames.map((file) => `${language}/${file}`));
    sentNumbers.push(number);
  }));

  // Report results
  await ctx.reply(`Berhasil mengirim kepada\n${sentNumbers.join("\n")}`);
  await ctx.reply(`Gagal mengirim kepada\n${errorNumbers.join("\n")}`);
  return data;
};
