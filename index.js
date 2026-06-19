const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");

const qrcode = require("qrcode-terminal");
const fs = require("fs");

// ================= CONFIG =================
const GROUP_ID = "@g.us";   // WHATSAPP GROUP ID NUMBER TARGET      (group id@g.us)
const ADMIN = "@s.whatsapp.net";    // Whatsapp number allowed to do commands       "(number)@s.whatsapp.net"

const DATA_FILE = "data.json";

// ================= DATABASE =================

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(
        {
          balance: 0,
          history: []
        },
        null,
        2
      )
    );
  }

  return JSON.parse(fs.readFileSync(DATA_FILE));
}

function saveData(data) {
  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify(data, null, 2)
  );
}

function parseNumber(str) {
  return Number(str.replace(/\./g, ""));
}

// ================= BOT =================

async function startBot() {
  const { state, saveCreds } =
    await useMultiFileAuthState("auth");

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on(
    "connection.update",
    async ({ connection, qr, lastDisconnect }) => {

      if (qr) {
        qrcode.generate(qr, { small: true });
        console.log("Scan QR WhatsApp");
      }

      if (connection === "open") {
        console.log("✅ Bot Connected");
      }

      if (connection === "close") {

        const shouldReconnect =
          lastDisconnect?.error?.output?.statusCode !==
          DisconnectReason.loggedOut;

        if (shouldReconnect) {
          startBot();
        }
      }
    }
  );

  sock.ev.on("messages.upsert", async ({ messages }) => {

    const msg = messages[0];

    if (!msg.message) return;

    const jid = msg.key.remoteJid;

    const sender =
      msg.key.participant ||
      msg.key.remoteJid;

    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      "";


    // Hanya grup tertentu
    if (jid !== GROUP_ID) return;

    // Hanya admin
     if (sender !== ADMIN) return;

    const data = loadData();

    // ================= DONE =================

const doneQtyMatch =
  text.match(/^\.done\s+([\d.]+)\s*x\s*([\d.]+)$/i) ||
  text.match(/^\.done\s+([\d.]+)x([\d.]+)$/i);

if (doneQtyMatch) {

  const qty = parseNumber(doneQtyMatch[1]);
  const price = parseNumber(doneQtyMatch[2]);

  const amount = qty * price;

  data.balance += amount;

  data.history.push({
    type: "done",
    amount,
    time: Date.now()
  });

  saveData(data);

  await sock.sendMessage(jid, {
    text:
`Pesanan Sukses ✅

${qty.toLocaleString("id-ID")} x ${price.toLocaleString("id-ID")} = ${amount.toLocaleString("id-ID")}
===============

Total akhir = ${data.balance.toLocaleString("id-ID")}`
  });

  return;
}

const doneNominalMatch =
  text.match(/^\.done\s+([\d.]+)$/i);

if (doneNominalMatch) {

  const amount =
    parseNumber(doneNominalMatch[1]);

  data.balance += amount;

  data.history.push({
    type: "done",
    amount,
    time: Date.now()
  });

  saveData(data);

  await sock.sendMessage(jid, {
    text:
`Pesanan Sukses ✅
Nominal = ${amount.toLocaleString("id-ID")}
===============
Total akhir = ${data.balance.toLocaleString("id-ID")}`
  });

  return;
}

    // ================= DEPO =================

    const depoMatch =
  text.match(/^\.depo\s+([\d.]+)$/i);

    if (depoMatch) {

      const amount = parseNumber(depoMatch[1]);

      data.balance -= amount;

      data.history.push({
        type: "depo",
        amount,
        time: Date.now()
      });

      saveData(data);

      await sock.sendMessage(jid, {
  text:
`Deposit Berhasil ✅

${amount.toLocaleString("id-ID")}
===============

Total akhir = ${data.balance.toLocaleString("id-ID")}`
});

return;
}

    // ================= TOTAL =================

    if (text.toLowerCase() === ".total") {

      await sock.sendMessage(jid, {
  text:
`Total akhir = ${data.balance.toLocaleString("id-ID")}`
});

      return;
    }

    // ================= HISTORY =================

    if (text.toLowerCase() === ".history") {

      if (data.history.length === 0) {

        await sock.sendMessage(jid, {
          text: "Belum ada transaksi."
        });

        return;
      }

      let result = "📋 Riwayat\n\n";

      const last20 =
        data.history.slice(-20);

      last20.forEach((item, index) => {

        const sign =
          item.type === "done"
            ? "+"
            : "-";

        result +=
`${index + 1}. ${sign}Rp${item.amount.toLocaleString("id-ID")}\n`;
      });

      result +=
`\n===============\nTotal akhir = ${data.balance.toLocaleString("id-ID")}`;

      await sock.sendMessage(jid, {
        text: result
      });

      return;
    }

    // ================= UNDO =================

    if (text.toLowerCase() === ".undo") {

      if (data.history.length === 0) {

        await sock.sendMessage(jid, {
          text: "Tidak ada transaksi."
        });

        return;
      }

      const last =
        data.history.pop();

      if (last.type === "done") {
        data.balance -= last.amount;
      } else {
        data.balance += last.amount;
      }

      saveData(data);

      await sock.sendMessage(jid, {
  text:
`Transaksi Terakhir Dibatalkan

${last.amount.toLocaleString("id-ID")}
===============

Total akhir = ${data.balance.toLocaleString("id-ID")}`
});

      return;
    }

    });
}

startBot();