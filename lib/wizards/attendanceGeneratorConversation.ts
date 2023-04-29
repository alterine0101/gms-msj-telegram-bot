import fs from "fs/promises";
import { Conversation } from "@grammyjs/conversations";
import { FileX } from "@grammyjs/files/out/files";
import { Context, InputFile } from "grammy";
import { InlineKeyboardButton } from "grammy/out/types.node";
import parsePhoneNumber from "libphonenumber-js";
import temp from "temp";
import * as XLSX from "xlsx";
import { COLUMN_ATTENDANCE_EMAIL, COLUMN_ATTENDANCE_NAME, COLUMN_ATTENDANCE_PHONE, COLUMN_ATTENDANCE_TIMESTAMP, COLUMN_PARTICIPANT_EMAIL, COLUMN_PARTICIPANT_NAME, COLUMN_PARTICIPANT_PHONE } from "../constants";
import { MyContext } from "..";

const sanitize = (text: any) => typeof text == "string" ? text.replace(/;/g, "\\\;") : text;
let vcfFilePath: temp.OpenFile|null = null;

export const defaultWizardName = "attendanceGeneratorWizard";

export default async function attendanceGeneratorConversation(conversation: Conversation<Context>, ctx: Context) {
  await ctx.reply("Sebelumnya, Anda ingin memasukkan absensi untuk sesi apa?", {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "MSJ 1",
            callback_data: "none",
          }
        ],
        [
          {
            text: "1",
            callback_data: "1-1",
          },
          {
            text: "2",
            callback_data: "1-2",
          },
          {
            text: "3",
            callback_data: "1-3",
          },
          {
            text: "4",
            callback_data: "1-4",
          },
        ],
        [
          {
            text: "MSJ 2",
            callback_data: "none",
          }
        ],
        [
          {
            text: "1",
            callback_data: "2-1",
          },
          {
            text: "2",
            callback_data: "2-2",
          },
          {
            text: "3",
            callback_data: "2-3",
          },
          {
            text: "4",
            callback_data: "2-4",
          },
        ],
        [
          {
            text: "MSJ 3",
            callback_data: "none",
          }
        ],
        [
          {
            text: "1",
            callback_data: "3-1",
          },
          {
            text: "2",
            callback_data: "3-2",
          },
          {
            text: "3",
            callback_data: "3-3",
          },
          {
            text: "4",
            callback_data: "3-4",
          },
          {
            text: "5",
            callback_data: "3-5",
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
  
  let selected: String|null = null;
  do {
    const resCtx = await conversation.waitFor("callback_query");
    if (resCtx.callbackQuery.data == "cancel") {
      await resCtx.reply("Operasi dibatalkan.");
      return;
    } else if (resCtx.callbackQuery.data != "none") {
      selected = resCtx.callbackQuery.data!;
    }
    if (!selected) await ctx.reply("Pilih sesi MSJ yang sesuai.");
  } while (!selected);

  let [msjType, session] = selected.split("-");
  if (!msjType || !session) {
    await ctx.reply("Mohon maaf, kami sedang mengalami kendala.");
    return;
  }

  await ctx.reply("Baik, silakan upload file *Data Peserta* Anda dalam format *XLSX*, *XLS* *ODT*, *NUMBERS*, maupun *CSV*\\.", {
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
        const file: FileX = await resCtx.getFile();
        const path: string = await file.download();
        const buffer: Buffer = await (await fs.open(path)).readFile();
        wb = XLSX.read(buffer);
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
    resCtx.reply("Pilih Tab/Worksheet yang akan kami proses.", {
      reply_markup: {
        inline_keyboard: wb!.SheetNames.map((name: string, i: number) => [
          <InlineKeyboardButton>{
              callback_data: `sheet-${i}`,
              text: name,
            }
          ]
        ).concat([[{
          text: "🚫 Batal",
          callback_data: "cancel",
        }]])
      }
    });
    do {
      const resCtx2 = await conversation.waitFor("callback_query");
      if (resCtx2.update.callback_query.data == "cancel") {
        await resCtx.reply("Operasi dibatalkan.");
        return;
      } else if (resCtx2.update.callback_query.data!.startsWith("sheet-")) {
        selectedSheet == Number.parseInt(resCtx2.update.callback_query.data!.replace(/^sheet-/g, ""));
        if (selectedSheet == null || Number.isNaN(selectedSheet) || selectedSheet! < 0 || selectedSheet! > wb!.SheetNames.length) {
          await resCtx.reply("Jawaban Anda tidak valid");
        }
      }
    } while (selectedSheet == null || Number.isNaN(selectedSheet) || selectedSheet! < 0 || selectedSheet! > wb!.SheetNames.length);
  }

  const ws = wb!.Sheets[wb!.SheetNames[selectedSheet || 0]];
  // console.log(ws);
  if (!ws.A1 || !ws.B1 || !ws.B2 || !ws.B3 || !ws.B4) {
    resCtx.reply("Mohon maaf, format spreadsheet Anda tidak valid. Pastikan Anda menggunakan template /templatepeserta untuk hasil yang terbaik.");
    return;
  }

  const data: { [key: string]: unknown[][] } = {
    participants: XLSX.utils.sheet_to_json(ws, { header: 1 })
  };
  let done = false;
  let warnings: string[] = [];

  for (let i = 0; i < 3; i++) {
    let isDocumentReceived = false;
    let wb: XLSX.WorkBook;

    await resCtx.reply(`Baik, masukkan file rekaman *Absensi ${i+1}* Anda\\.`, {
      parse_mode: "MarkdownV2",
      reply_markup: {
        inline_keyboard: (i < 1 ? [] : [[
          {
            text: "➡️ Skip (Langsung Proses)",
            callback_data: "skip",
          }
        ]]).concat([[
          {
            text: "🚫 Batal",
            callback_data: "cancel",
          }
        ]])
      }
    });

    if (i == 0) await resCtx.reply("Pastikan masing-masing file memiliki urutan kolom sebagai berikut:\n\n1. Timestamp\n2.Nama Lengkap\n3. Tanggal Lahir\n4. Email\n5. Nomor HP\n6. NIJ (Khusus MSJ 2 dan 3)");
    const resCtx2 = await conversation.wait() as MyContext;
    console.log(resCtx2);
    if (resCtx2.update && resCtx2.update.callback_query) {
      switch (resCtx2.update.callback_query.data) {
        case "cancel":
          await resCtx2.reply("Operasi dibatalkan.");
          return;
        default:
          continue;
      }
    } else if (resCtx2.message != null && resCtx2.message.document == null) {
      await resCtx2.reply("Mohon maaf, pastikan Anda membalas pesan ini dengan file dokumen yang sudah disiapkan.");
    } else {
      try {
        const file: FileX = await resCtx2.getFile();
        const path: string = await file.download();
        const buffer: Buffer = await (await fs.open(path)).readFile();
        wb = XLSX.read(buffer, { cellDates: true });
        isDocumentReceived = true;
      } catch (e) {
        console.error(e);
        resCtx2.reply("Mohon maaf, kami sedang mengalami kendala dalam memproses file Anda.");
        return;
      };
    };

    let selectedSheet: number|null = null;
    if (wb!.SheetNames.length <= 0) {
      resCtx.reply("Mohon maaf, kami sedang mengalami kendala dalam memproses file Anda.");
      return;
    } else if (wb!.SheetNames.length > 1) {
      resCtx.reply("Pilih Tab/Worksheet yang akan kami proses.", {
        reply_markup: {
          inline_keyboard: wb!.SheetNames.map((name: string, i: number) => [
            <InlineKeyboardButton>{
                callback_data: `sheet-${i}`,
                text: name,
              }
            ]
          ).concat([[{
            text: "🚫 Batal",
            callback_data: "cancel",
          }]])
        }
      });
      do {
        const resCtx2 = await conversation.waitFor("callback_query");
        if (resCtx2.update.callback_query.data == "cancel") {
          await resCtx.reply("Operasi dibatalkan.");
          return;
        } else if (resCtx2.update.callback_query.data!.startsWith("sheet-")) {
          selectedSheet == Number.parseInt(resCtx2.update.callback_query.data!.replace(/^sheet-/g, ""));
          if (selectedSheet == null || Number.isNaN(selectedSheet) || selectedSheet! < 0 || selectedSheet! > wb!.SheetNames.length) {
            await resCtx.reply("Jawaban Anda tidak valid");
          }
        }
      } while (selectedSheet == null || Number.isNaN(selectedSheet) || selectedSheet! < 0 || selectedSheet! > wb!.SheetNames.length);
    }
    const ws = wb!.Sheets[wb!.SheetNames[selectedSheet || 0]];
    console.log(ws);
    if (!ws.A1 || !ws.B1 || !ws.C1 || !ws.D1 || !ws.E1 || (parseInt(msjType) > 1 && !ws.F1)) {
      resCtx.reply("Mohon maaf, format spreadsheet Anda tidak valid.");
      return;
    }

    data[i + 1] = XLSX.utils.sheet_to_json(ws, { header: 1 });
    // await resCtx.reply(data[i + 1].length.toString());
  }

  await resCtx.reply("Pilih format file yang akan dibuat", {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "XLSX",
            callback_data: "xlsx",
          },
          {
            text: "ODS",
            callback_data: "ods",
          },
          {
            text: "XLS",
            callback_data: "xls",
          },
          {
            text: "CSV",
            callback_data: "csv",
          }
        ]
      ]
    }
  });
  const resCtx2 = await conversation.waitFor("callback_query");
  const resFormat = resCtx2.callbackQuery.data!;

  let finalColumns = [
    "ID",
    "Nama Peserta",
    "Nomor Telepon",
    "Email",
    "Mengikuti Susulan?",
    "Waktu Absen 1",
    "Kecocokan Data Absen 1",
  ];

  if (data[2]) finalColumns = finalColumns.concat(["Waktu Absen 2", "Kecocokan Data Absen 2"]);
  if (data[3]) finalColumns = finalColumns.concat(["Waktu Absen 3", "Kecocokan Data Absen 3"]);
  data.final = [finalColumns];

  function searchTimestamp(participant: Array<string|number|boolean|Date|null>, no: number): [string|null, string|null] {
    if (!Array.isArray(data[no])) return [null, null];
    let current = data[no] as Array<Array<string|number|boolean|Date|null>>;
    for (let i = 1; i < current.length; i++) {
      let matches: string[] = [];
      if (current[i][COLUMN_ATTENDANCE_NAME] && participant[COLUMN_PARTICIPANT_NAME] && current[i][COLUMN_ATTENDANCE_NAME]!.toString().toLowerCase().replace(/\s+/, " ") == participant[COLUMN_PARTICIPANT_NAME]!.toString().toLowerCase().replace(/\s+/, " ")) matches.push("Nama");
      if (current[i][COLUMN_ATTENDANCE_EMAIL] && participant[COLUMN_PARTICIPANT_EMAIL] && current[i][COLUMN_ATTENDANCE_EMAIL]!.toString().toLowerCase() == participant[COLUMN_PARTICIPANT_EMAIL].toString().toLowerCase()) matches.push("Email");
      if (current[i][COLUMN_ATTENDANCE_PHONE] && participant[COLUMN_PARTICIPANT_PHONE] && parsePhoneNumber(current[i][COLUMN_ATTENDANCE_PHONE]!.toString().replace("O", "0").replace("o", "0"), "ID") == parsePhoneNumber(participant[COLUMN_PARTICIPANT_PHONE].toString().replace("O", "0").replace("o", "0"), "ID")) matches.push("Nomor Telepon");

      if (matches.length > 0) {
        try {
          return [(current[i][COLUMN_ATTENDANCE_TIMESTAMP] as Date).toISOString(), matches.join(", ")];
        } catch (e) {
          return [`${current[i][COLUMN_ATTENDANCE_TIMESTAMP]}`, matches.join(", ")];
        }
      }

      /* Check for similar names */
      if (participant[COLUMN_PARTICIPANT_NAME] && current[COLUMN_ATTENDANCE_NAME]) {
        let nameSplit1 = participant[COLUMN_PARTICIPANT_NAME]!.toString().toLowerCase().split(/\s+/).sort();
        let nameHash1: Map<string, number> = new Map();
        for (let j = 0; j < nameSplit1.length; j++) {
          const currentPartVal = nameHash1.get(nameSplit1[j]);
          if (!currentPartVal) nameHash1.set(nameSplit1[j], 1);
          else nameHash1.set(nameSplit1[j], currentPartVal + 1);
        }
        
        let nameSplit2 = current[COLUMN_ATTENDANCE_NAME].toString().toLowerCase().split(/\s+/).sort();
        let nameHash2: Map<string, number> = new Map();
        for (let j = 0; j < nameSplit2.length; j++) {
          const currentPartVal = nameHash2.get(nameSplit2[j]);
          if (!currentPartVal) nameHash2.set(nameSplit2[j], 1);
          else nameHash2.set(nameSplit2[j], currentPartVal + 1);
        }
  
        if (Array.from(nameHash1.keys()).filter((item) => nameHash2.has(item)).length / Array.from(nameHash1.keys()).length > 0.66) warnings.push(`Nama "${participant[COLUMN_PARTICIPANT_NAME]!.toString()}" mungkin mirip dengan "${current[COLUMN_ATTENDANCE_NAME].toString()}". Mohon untuk dicek secara manual.`);
      }
    }
    return [null, null];
  }

  for (let i = 1; i < data.participants.length; i++) {
    // console.log(data.participants[i]);
    // await resCtx.reply(data.participants[i].toString());
    let insert = (data.participants[i] as Array<string|number|boolean|null>).splice(0, 5);
    
    // await resCtx.reply(data[1].length.toString());
    insert = insert.concat(searchTimestamp(insert, 1));
    if (data[2]) insert = insert.concat(searchTimestamp(insert, 2));
    if (data[3]) insert = insert.concat(searchTimestamp(insert, 3));

    data.final.push(insert);
  }

  const now = new Date();
  let resSheetNames = ["Rekap Absensi"];
  if (resFormat != "csv" && warnings.length > 0) resSheetNames.push(`Warnings (${warnings.length})`);
  const resTitle = `Absensi MSJ ${msjType} Sesi ${session} ${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  let resWb = XLSX.utils.book_new();
  resWb.Props = {
    Application: "GMS MSJ Admin Bot",
    AppVersion: "1.2.0",
    CreatedDate: now,
    Title: resTitle,
  };
  XLSX.utils.book_append_sheet(resWb, XLSX.utils.aoa_to_sheet(data.final), resSheetNames[0]);
  if (warnings.length > 0) {
    if (resFormat != "csv"){
      XLSX.utils.book_append_sheet(resWb, XLSX.utils.aoa_to_sheet(([["No", "Catatan"]] as Array<string|number>[]).concat(warnings.map((value, index) => [index + 1, value]))), resSheetNames[1]);
    } else {
      await resCtx2.reply(["⚠️ Warning!"].concat(warnings).join("\n"));
    }
  }

  const u8 = XLSX.write(resWb, {
    bookType: resFormat as XLSX.BookType,
    type: "buffer",
  });
  resCtx2.replyWithDocument(new InputFile(u8, `${resTitle}.${resFormat}`));
}
