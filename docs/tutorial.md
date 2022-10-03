# Tutorial Penggunaan Bot
Berikut ini adalah tutorial penggunaan bot Telegram.

## Daftar Perintah
+ `/templatepeserta` - Mengirimkan template daftar peserta

## Template XLSX
Kami menyediakan dua jenis template, yakni template untuk menampung data peserta MSJ (`/templatepeserta`) serta template untuk menampung data absensi peserta yang kompatibel dengan Google Forms (`/templateabsensi`).

Anda masih dapat mengubah nama-nama kolom yang terdapat pada template yang disediakan, namun Anda harus tetap menggunakan urutan kolom yang sama.

## Kompatibilitas Format File
Bot Telegram ini memanfaatkan *library* [SheetJS](https://sheetjs.com) untuk memproses file-file yang Anda kirimkan. Karena itu, bot ini dapat mendukung format file sebagai berikut:

+ Microsoft Excel (.xlsx)
+ Microsoft Excel versi lawas (.xlsx)
+ [Numbers](https://www.apple.com/numbers/) untuk iOS dan macOS (.numbers)
+ [Calligra Sheets](https://calligra.org/sheets/index.html), [LibreOffice Calc](https://www.libreoffice.org/discover/calc/), dan [OpenOffice.org Calc](https://www.openoffice.org/product/calc.html) (.ods)
+ Plaintext / CSV
+ [dan lain-lain](https://docs.sheetjs.com/docs/miscellany/formats/)

Jika Anda menggunakan aplikasi pengolah *spreadsheet* selain di atas seperti [Gnumeric](https://gnumeric.org), [Google Sheets](https://www.google.com/sheets/about/), dan [Kingsoft/WPS Spreadsheet](https://www.wps.com/en-US/office/spreadsheet/), kami merekomendasikan Anda untuk mengekspor/menyimpan ulang file tersebut ke dalam format **XLSX**, **XLS**, **ODT**, atau **CSV**.

## Mengimpor File VCF Di Dalam Perangkat iOS

iOS dan iPadOS memiliki [keterbatasan teknis](https://stackoverflow.com/questions/73935114/batch-import-contact-to-ios-within-a-single-file-e-g-vcard) di mana hanya kontak peserta pertama saja yang dapat dilihat dan disimpan dari file vCard (`.vcf`) yang dibuat oleh bot ini.

Meskipun demikian Anda tetap dapat mengimpor kontak seluruh peserta tersebut dengan:

1. Mengirimkan ulang file tersebut melalui aplikasi WhatsApp, atau
2. Menyimpan kontak tersebut ke dalam aplikasi [Files](https://support.apple.com/id-id/HT206481), kemudian memasukkan ke dalam situs/layanan kontak online seperti [Google Contacts](https://support.google.com/contacts/answer/1069522?hl=id), [Yahoo!](https://id.bantuan.yahoo.com/kb/Impor-ekspor-atau-cetak-kontak-di-Yahoo-Mail-sln28070.html), dan [Outlook.com](https://support.microsoft.com/id-id/office/mengimpor-kontak-ke-outlook-com-285a3b55-8d93-4ac8-93df-43fffd13b2f1).

### 1. Melalui WhatsApp

> **Catatan:** Tampilan aplikasi Telegram Anda dapat berbeda dengan yang tertera di dalam screenshot berdasarkan versi iOS yang terpasang.

Di sini, Anda cukup perlu untuk mengklik file VCF tersebut, tekan tombol <i class="bi bi-arrow-down-circle" aria-hidden="true"></i> panah bawah yang terletak pada nama dokumen.

![Step 1](https://user-images.githubusercontent.com/17312341/193580926-41094498-767b-4ac1-be55-1be90e6ce117.png)

Kemudian, bagikan file tersebut dengan menekan tombol <i class="bi bi-box-arrow-up" aria-hidden="true"></i> **Bagikan** untuk membagikan file tersebut kepada aplikasi WhatsApp.

Setelah terkirim di WhatsApp, Anda dapat mengeklik file yang dikirim tersebut untuk melihat keseluruhan kontak peserta dan menyimpannya secara serentak.

### 2. Melalui impor ke Google, Yahoo!, dan/atau Outlook.com

> **Catatan:** Tampilan aplikasi Telegram Anda dapat berbeda dengan yang tertera di dalam screenshot berdasarkan versi iOS yang terpasang.

Untuk dapat mengimpor file tersebut, Anda perlu untuk menyimpanya ke dalam aplikasi [Files](https://support.apple.com/id-id/HT206481) terlebih dahulu.

Di sini, Anda cukup perlu untuk mengklik file VCF tersebut, tekan tombol <i class="bi bi-folder2" aria-hidden="true"></i> **Simpan ke File** (*Save to Files*) untuk menyimpannya ke dalam aplikasi Files. Telegram tetap akan menyimpan file tersebut secara utuh sehingga seluruh data kontak tersebut akan tetap dapat diimpor secara utuh.

![Step 1](https://user-images.githubusercontent.com/17312341/193580926-41094498-767b-4ac1-be55-1be90e6ce117.png)

> **Catatan:** Pastikan Anda mengingat lokasi/direktori di mana file tersebut disimpan, seperti "iCloud Drive/Documents" atau "This iPhone/Downloads" untuk memudahkan proses impor.

Kemudian, buka web browser Anda dan buka situs kontak online favorit Anda. Untuk informasi lebih lanjut untuk mengimpor file kepada situs tersebut, kunjungi:

+ Google: https://support.google.com/contacts/answer/1069522?hl=id
+ Microsoft 365 / Outlook.com: https://support.microsoft.com/id-id/office/mengimpor-kontak-ke-outlook-com-285a3b55-8d93-4ac8-93df-43fffd13b2f1
+ Yahoo!: https://id.bantuan.yahoo.com/kb/Impor-ekspor-atau-cetak-kontak-di-Yahoo-Mail-sln28070.html

Dan terakhir, pastikan Anda telah [menambahkan akun kalender tersebut ke dalam perangkat iOS Anda](https://support.apple.com/id-id/guide/iphone/ipha0d932e96/ios). Kontak Anda akan otomatis tersinkronisasi dalam 15 menit hingga 1 jam setelah proses impor tersebut selesai.
