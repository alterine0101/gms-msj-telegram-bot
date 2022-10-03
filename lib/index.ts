import bent from "bent";
import * as dotenv from "dotenv";
import { Bot, Context, InputFile, Middleware, session, SessionFlavor } from "grammy";
import { FileFlavor, hydrateFiles } from "@grammyjs/files";
import FormData from "form-data";
import temp from "temp";
import * as XLSX from "xlsx";
import { ConversationFlavor, conversations, createConversation } from "@grammyjs/conversations";
import contactListGeneratorConversation from "./wizards/contactListGeneratorConversation";

dotenv.config();
temp.track();

/**
 * Utility function to record the service's presence to a rhstatus-proxy server
 * @returns Status whether presence is recorded inside the server
 */
async function updateStatus(): Promise<boolean> {
  if (!process.env.RHSTATUS_PROXY_ENDPOINT || process.env.RHSTATUS_PROXY_ENDPOINT.length == 0) {
    console.error("* ERROR: rhstatus-proxy endpoint is not defined");
    return false;
  }
  const formData = new FormData();
  formData.append("deviceId", process.env.RHSTATUS_PROXY_DEVICE_ID!);
  formData.append("reportingSource", process.env.RHSTATUS_PROXY_DEVICE_ID!);
  formData.append("secret", process.env.RHSTATUS_PROXY_DEVICE_TOKEN!);
  const res = await bent("POST")(process.env.RHSTATUS_PROXY_ENDPOINT, formData, formData.getHeaders()) as bent.BentResponse;
  return res.statusCode == 200;
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

/* VCF Generator */
bot.use(createConversation(contactListGeneratorConversation));
bot.command("buatvcf", (ctx: MyContext) => {
  console.log(typeof ctx);
  ctx.conversation.enter("contactListGeneratorConversation");
});

bot.start();

// Enable graceful stop
process.once('SIGINT', () => bot.stop());
process.once('SIGTERM', () => bot.stop());
