import fs from "fs/promises";
import { Conversation } from "@grammyjs/conversations";
import { FileX } from "@grammyjs/files/out/files";
import { Context, InputFile } from "grammy";
import { InlineKeyboardButton } from "grammy/out/types.node";
import parsePhoneNumber from "libphonenumber-js";
import temp from "temp";
import * as XLSX from "xlsx";
import { COLUMN_PARTICIPANT_ID, COLUMN_PARTICIPANT_NAME, COLUMN_PARTICIPANT_PHONE, COLUMN_PARTICIPANT_REMEDIAL } from "../constants";
import { MyContext } from "..";

const sanitize = (text: any) => typeof text == "string" ? text.replace(/;/g, "\\\;") : text;
let vcfFilePath: temp.OpenFile|null = null;

export const defaultWizardName = "contactListGeneratorWizard";

export default async function contactListGeneratorConversation(conversation: Conversation<Context>, ctx: Context) {
  let msjType: string|null|undefined = ctx.message?.text?.replace(/^\/buatvcf\s*/g, "");
  if (typeof msjType != "string" || msjType.length == 0) {
    msjType = "MSJ"
  }

  await ctx.reply('Baik, silakan upload file data peserta Anda dalam format *XLSX*, *XLS* *ODT*, *NUMBERS*, maupun *CSV*\\.\n\n_*Tip:* Jika Anda ingin memberi nama acara yang berbeda \\(misal: "MSJ 1 Kelapa Gading"\\), gunakan perintah `/buatvcf MSJ 1 Kelapa Gading`\\._', {
    parse_mode: "MarkdownV2",
    reply_markup: {
      inline_keyboard: [[{
        text: "🚫 Batal",
        callback_data: "cancel",
      }]]
    }
  });

  let resCtx: MyContext;
  let isDocumentReceived = false;
  let wb: XLSX.WorkBook;
  do {
    resCtx = await conversation.wait() as MyContext;
    if (resCtx.update && resCtx.update.callback_query && resCtx.update.callback_query.data == "cancel") {
      await resCtx.reply("Operasi dibatalkan.");
      return;
    } else if (resCtx.message != null && resCtx.message.document == null) {
      await resCtx.reply("Mohon maaf, pastikan Anda membalas pesan ini dengan file dokumen yang sudah disiapkan.");
    } else {
      try {
        await conversation.external(async () => {
          const file: FileX = await resCtx.getFile();
          const path: string = await file.download();
          const buffer: Buffer = await (await fs.open(path)).readFile();
          wb = XLSX.read(buffer);
        });
        isDocumentReceived = true;
      } catch (e) {
        console.error(e);
        resCtx.reply("Mohon maaf, kami sedang mengalami kendala dalam memproses file Anda.");
        return;
      }
    }
  } while (!isDocumentReceived);

  let selectedSheet: number|null = null;
  if (wb!.SheetNames.length <= 0) {
    resCtx.reply("Mohon maaf, kami sedang mengalami kendala dalam memproses file Anda.");
    return;
  } else if (wb!.SheetNames.length > 1) {
    await resCtx.reply("Pilih Tab/Worksheet yang akan kami proses.", {
      reply_markup: {
        inline_keyboard: wb!.SheetNames.map((name: string, i: number) => [
          <InlineKeyboardButton>{
              callback_data: `sheet_${i}`,
              text: name,
            }
          ]
        ).concat([[{
          text: "🚫 Batal",
          callback_data: "cancel",
        }]])
      }
    });

    const resCtx2 = await conversation.waitFrom(ctx.user);
    if (resCtx2.update?.callback_query?.data == "cancel") {
      await resCtx.reply("Operasi dibatalkan.");
      return;
    } else if (resCtx2.update?.callback_query?.data!.startsWith("sheet_")) {
      selectedSheet == Number.parseInt(resCtx2.update.callback_query.data!.replace(/^sheet-/g, ""));
      if (selectedSheet == null || Number.isNaN(selectedSheet) || selectedSheet! < 0 || selectedSheet! > wb!.SheetNames.length) {
        await resCtx.reply("Jawaban Anda tidak valid");
      }
    } else {
      await resCtx.reply(`Undefined callback ${resCtx2}`);
      return;
    }
    // if (selectedSheet == null || Number.isNaN(selectedSheet) || selectedSheet! < 0 || selectedSheet! > wb!.SheetNames.length) {
      
    // };
  }

  const ws = wb!.Sheets[wb!.SheetNames[selectedSheet || 0]];
  // console.log(ws);
  if (!ws.A1 || !ws.B1 || !ws.C1 || !ws.D1 || !ws.E1) {
    resCtx.reply("Mohon maaf, format spreadsheet Anda tidak valid. Pastikan Anda menggunakan template /templatepeserta untuk hasil yang terbaik.");
    return;
  }

  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
  let vcard = "";

  try {
    await conversation.external(async () => {
      let i: number;
      for (i = 1; i < data.length; i++) {
        const columns = data[i] as Array<string|number|boolean>;
        
        if (!columns[COLUMN_PARTICIPANT_PHONE] || ("" + columns[COLUMN_PARTICIPANT_PHONE]).length == 0) continue;

        const phone = parsePhoneNumber(("" + columns[COLUMN_PARTICIPANT_PHONE]).replace(/^8/g, "08").replace(/^62/g, "+62"), "ID");
        let additionalAttributes = [];
        if (columns[COLUMN_PARTICIPANT_ID] != null && columns[COLUMN_PARTICIPANT_ID].toString().length > 0) additionalAttributes.push(sanitize(columns[COLUMN_PARTICIPANT_ID].toString()));
        if (columns[COLUMN_PARTICIPANT_REMEDIAL] == true) additionalAttributes.push("Susulan");
        const additionalAttributeText = additionalAttributes.length > 0 ? ` (${additionalAttributes.join(", ")})` : "";

        vcard += [
          "BEGIN:VCARD",
          "VERSION:3.0",
          `N:${sanitize(columns[COLUMN_PARTICIPANT_NAME])};${sanitize(msjType!)}${additionalAttributeText};;;`,
          `FN:${sanitize(columns[COLUMN_PARTICIPANT_NAME])} ${sanitize(msjType!)}${additionalAttributeText}`,
          `TEL;TYPE=CELL;TYPE=PREF:${phone?.formatInternational()}`,
          "END:VCARD"
        ].join("\n") + "\n";
      }
    
      vcfFilePath = await temp.open({
        prefix: `Data Peserta ${msjType} - `,
        suffix: ".vcf"
      });
      await fs.writeFile(vcfFilePath.path, vcard);
    });
  } catch (e) {
    console.error(e);
    resCtx.reply("Mohon maaf, kami sedang mengalami kendala dalam memproses file Anda.");
    return;
  }
  
  if (vcfFilePath == null) return;
  await resCtx.reply("Berikut ini adalah daftar kontak yang berhasil dibuat.\n\nPenting: Jika Anda pengguna iOS/iPadOS, lakukan hal berikut ini untuk dapat mengimpor semua data peserta ke dalam kontak Anda.\n\nhttps://gms-msj-telegram-bot.reinhart1010.id/tutorial.html#mengimpor-file-vcf-di-dalam-perangkat-ios");
  await resCtx.replyWithDocument(new InputFile(vcfFilePath.path));
}
