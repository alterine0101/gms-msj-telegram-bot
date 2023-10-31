import bent from "bent";
import {randomBytes} from "crypto";
import * as dotenv from "dotenv";
import express from "express";
import { Bot, Context, InputFile, Middleware, session, SessionFlavor } from "grammy";
import { FileFlavor, hydrateFiles } from "@grammyjs/files";
import FormData from "form-data";
import temp from "temp";
import totp from "totp-generator";
import * as XLSX from "xlsx";

import { ConversationFlavor, conversations, createConversation } from "@grammyjs/conversations";
import contactListGeneratorConversation from "./wizards/contactListGeneratorConversation";
import attendanceGeneratorConversation from "./wizards/attendanceGeneratorConversation";

// Important: Obtain current environment configuration
dotenv.config();
temp.track();

const app = express()
const port = process.env.WEBHOOK_LOCAL_PORT || 3000

let webhookVerificationToken: string = "";

/**
 * Utility function to perform TOTP verification
 * @param totpCheck The TOTP token to check
 * @returns The status whether TOTP is valid
 */
function checkTOTP(totpCheck: string): boolean {
  if (!process.env.ADMIN_OTP_SECRET || process.env.ADMIN_OTP_SECRET.length == 0) return false;
  return totpCheck == totp(process.env.ADMIN_OTP_SECRET);
}

/**
 * Refresh the server's webhook verification token
 */
function refreshWebhookVerificationToken() {
  webhookVerificationToken = randomBytes(256).toString('hex')
}

/**
 * Utility function to record the service's presence to a rhstatus-proxy server
 * @returns Status whether presence is recorded inside the server
 */
async function updateStatus(): Promise<boolean> {
  if (!process.env.UPTIME_REPORTER_ENDPOINT || process.env.UPTIME_REPORTER_ENDPOINT.length == 0) {
    console.error("* ERROR: Uptime reporter endpoint is not defined");
    return false;
  }
  const formData = new FormData();
  formData.append("deviceId", process.env.UPTIME_REPORTER_DEVICE_ID!);
  formData.append("reportingSource", process.env.UPTIME_REPORTER_DEVICE_ID!);
  formData.append("secret", process.env.UPTIME_REPORTER_DEVICE_TOKEN!);
  try {
    const res = await bent("POST")(process.env.UPTIME_REPORTER_ENDPOINT, formData, formData.getHeaders()) as bent.BentResponse;
    return res.statusCode == 200;
  } catch (e) {
    return false;
  }
}


async function generateParticipantListTemplate(ctx: Context, format: XLSX.BookType, clearCached: boolean = false): Promise<void> {
  const fileName = `docs/assets/templates/template-peserta.${format}`;
  if (clearCached) {
    const wb = XLSX.utils.book_new();
    let sampleData = [
      ["ID", "Nama Peserta", "Nomor Telepon", "Alamat Surel/Email", "Mengikuti Susulan?"],
      ["1 (Tidak harus berhubungan dengan NIJ)", "Peserta", "080989999", "test@example.com", true]
    ];
    wb.SheetNames.push("Data Peserta");
    wb.Sheets["Data Peserta"] = XLSX.utils.aoa_to_sheet(sampleData);
    XLSX.writeFile(wb, fileName, {
      bookType: format,
      type: "buffer",
    }) as Buffer;
  }
  await ctx.replyWithDocument(new InputFile(fileName));
  await ctx.reply("Informasi tentang penggunaan file ini dapat Anda lihat di https://gms-msj-telegram-bot.reinhart1010.id/tutorial.html#kompatibilitas-format-file")
}

export type MyContext = ConversationFlavor & FileFlavor<Context> & SessionFlavor<{}>;

const bot = new Bot<MyContext>(process.env.TG_TOKEN!);
bot.use(session({ initial: () => ({}) }));
bot.use(conversations());
bot.api.config.use(hydrateFiles(bot.token));

/* Start Command */
bot.command("start", (ctx) => {
  ctx.reply("Welcome Home!\nBerikut adalah fitur-fitur yang bisa Anda pakai\n\n+ /templatepeserta - Unduh template peserta\n+ /templateabsensi - Unduh template absensi\n+ /buatvcf - Buat file VCF peserta\n+ /convertnohp - Ubah format nomor HP peserta\n+ /absensi - Absensi")
});

/* Template Peserta */
bot.command("templatepeserta", (ctx) => {
  ctx.reply("Berikut ini adalah template data peserta. Sebelumnya, di manakah Anda akan menambahkan data peserta ini?", {
    reply_markup: {
      inline_keyboard: [
        [
          {text: "Microsoft Excel", callback_data: "templatepeserta-xlsx"}
        ],
        [
          {text: "Microsoft Excel versi lawas", callback_data: "templatepeserta-xls"}
        ],
        [
          {text: "Numbers untuk iOS/macOS", callback_data: "templatepeserta-xlsx"}
        ],
        [
          {text: "Calligra / LibreOffice / OpenOffice.org", callback_data: "templatepeserta-ods"}
        ],
        [
          {text: "Plaintext / CSV", callback_data: "templatepeserta-csv"}
        ],
      ]
    }
  })
});

bot.callbackQuery("templatepeserta-xlsx", (ctx) => generateParticipantListTemplate(ctx, 'xlsx'));
bot.callbackQuery("templatepeserta-xls", (ctx) => generateParticipantListTemplate(ctx, 'xls'));
bot.callbackQuery("templatepeserta-ods", (ctx) => generateParticipantListTemplate(ctx, 'ods'));
bot.callbackQuery("templatepeserta-csv", (ctx) => generateParticipantListTemplate(ctx, 'csv'));

/* Attendance Generator */
bot.use(createConversation(attendanceGeneratorConversation));
bot.command("absensi", (ctx: MyContext) => {
  ctx.conversation.enter("attendanceGeneratorConversation");
});

/* VCF Generator */
bot.use(createConversation(contactListGeneratorConversation));
bot.command("buatvcf", (ctx: MyContext) => {
  ctx.conversation.enter("contactListGeneratorConversation");
});

/* Check OTP */
bot.command("checkotp", async (ctx: MyContext) => {
  let params = ctx.message!.text!.split(/\s/);
  if (params.length < 2) {
    ctx.reply("Gunakan perintah ini dengan input seperti berikut\\.\n\n`/checkotp 123456` \\(tanpa spasi antar nomor\\)\\.", { parse_mode: "MarkdownV2" });
    return;
  }
  params.shift();
  await ctx.reply(checkTOTP(params[0]).toString());
});

/* Check Webhook */
bot.command("checkwebhook", async (ctx: MyContext) => {
  refreshWebhookVerificationToken();
  try {
    if (
      !process.env.WEBHOOK_LOCAL_HOST || process.env.WEBHOOK_LOCAL_HOST.length == 0 ||
      !process.env.WEBHOOK_LOCAL_PORT || process.env.WEBHOOK_LOCAL_PORT.length == 0
    ) throw Error();
    const res = await fetch(`http://${process.env.WEBHOOK_LOCAL_HOST}:${process.env.WEBHOOK_LOCAL_PORT}/verify_integrity`);
    const resJson = await res.json();
    if (resJson.status == "OK" && resJson.token == webhookVerificationToken) {
      await ctx.reply("Konfigurasi server internal benar.");
    } else {
      throw Error();
    }
  } catch (e) {
    await ctx.reply("Konfigurasi server internal salah.");
  }
  try {
    if (
      !process.env.WEBHOOK_REMOTE_HOST || process.env.WEBHOOK_REMOTE_HOST.length == 0 ||
      !process.env.WEBHOOK_REMOTE_PORT || process.env.WEBHOOK_REMOTE_PORT.length == 0
    ) throw Error();
    const res = await fetch(`https://${process.env.WEBHOOK_REMOTE_HOST}:${process.env.WEBHOOK_REMOTE_PORT}/verify_integrity`);
    const resJson = await res.json();
    if (resJson.status == "OK" && resJson.token == webhookVerificationToken) {
      await ctx.reply("Konfigurasi server eksternal benar.");
    } else {
      throw Error();
    }
  } catch (e) {
    await ctx.reply("Konfigurasi server eksternal salah.");
  }
});

/* Convert Phone Number */
bot.command("convertnohp", async (ctx: MyContext) => {
  if (ctx.message!.photo) {
    ctx.reply("Gunakan perintah ini dengan input seperti berikut\\.\n\n`/convertnohp 080989999 \\+62809\\-899\\-99` \\(tanpa spasi antar nomor\\)\\.\n\n*⚠️ PENTING:* Jika teks yang disalin dari Excel muncul seperti *628098E\\+09*, pastikan Anda _paste_ dengan menggunakan tombol *Ctrl\\-Shift\\-V* \\(macOS: *^ ⌘ V*\\)\\.", { parse_mode: "MarkdownV2" });
    return;
  }
  let numbers = ctx.message!.text!.split(/\s/);
  if (numbers.length < 2) {
    ctx.reply("Gunakan perintah ini dengan input seperti berikut\\.\n\n`/convertnohp 080989999 \\+62809\\-899\\-99` \\(tanpa spasi antar nomor\\)\\.\n\n*⚠️ PENTING:* Jika teks yang disalin dari Excel muncul seperti *628098E\\+09*, pastikan Anda _paste_ dengan menggunakan tombol *Ctrl\\-Shift\\-V* \\(macOS: *^ ⌘ V*\\)\\.", { parse_mode: "MarkdownV2" });
    return;
  }
  numbers.shift();
  numbers = numbers.map((value) => value.toString().length == 0 ? value : "+" + value.toString().replace(/^(\+){0,1}((62)|0){0,1}8/g, "628").replace(/\W+/g, ""));
  await ctx.reply(numbers.join("\n"));
  await ctx.reply("*⚠️ PENTING:* Pastikan Anda lakukan 2 hal berikut sebelum menyalin teks yang dibuat di atas:\n\n1\\. Mengubah format _cell_ dari *General/Number* menjadi *Text* sebelum menyalin teks\n\n2\\. Menempelkannya secara _plaintext_ melalui menu *Paste As* / *Paste Special* dengan menggunakan *Ctrl\\-Shift\\-V* \\(macOS: *^ ⌘ V*\\.\\)", { parse_mode: "MarkdownV2" });
});

bot.start();
console.log("Bot is now available");

// Enable graceful stop
process.once('SIGINT', () => {
  clearInterval(statusUpdater);
  bot.stop();
});
process.once('SIGTERM', () => {
  clearInterval(statusUpdater);
  bot.stop();
});

app.get('/', (req, res) => {
  res.send('Hello World!');
})

app.get('/verify_integrity', (req, res) => {
  res.send({
    "status": "OK",
    "token": webhookVerificationToken,
  });
})

/* Start Telegram and Express */

updateStatus();
const statusUpdater = setInterval(updateStatus, 1000 * 60 * 5);

app.listen(port, () => {
  refreshWebhookVerificationToken()
  console.log(`Example app listening on port ${port}`);
})
