export type ReceiptData = {
  orderId: number;
  orderNumber?: number | null;
  clientName?: string | null;
  clientPhone?: string | null;
  modelName?: string | null;
  colorName?: string | null;
  sizeName?: string | null;
  printName?: string | null;
  printImageUrl?: string | null;
  printSide?: string | null;
  issuedAt?: string;
};

const SIDE_LABELS: Record<string, string> = { front: "Спереди", back: "Сзади" };

function row(label: string, value?: string | null) {
  if (!value) return "";
  return `<tr><td class="lbl">${label}</td><td class="val">${value}</td></tr>`;
}

export function printOrderReceipt(data: ReceiptData): void {
  const displayNumber = data.orderNumber ?? data.orderId;
  const now = data.issuedAt ?? new Date().toLocaleString("ru-RU");
  const sideLabel = data.printSide ? (SIDE_LABELS[data.printSide] ?? data.printSide) : null;

  const printImgBlock = data.printImageUrl
    ? `<div style="text-align:center;margin:12px 0;">
         <img src="${data.printImageUrl}" alt="Принт" style="max-width:200px;max-height:200px;border:1px solid #ccc;border-radius:4px;" />
       </div>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <title>Чек #${displayNumber}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Courier New', Courier, monospace;
      width: 360px;
      margin: 0 auto;
      padding: 20px 16px;
      font-size: 14px;
      color: #111;
    }
    .center { text-align: center; }
    .dash { border: none; border-top: 2px dashed #555; margin: 10px 0; }
    .logo { font-size: 22px; font-weight: bold; letter-spacing: 4px; }
    .order-num { font-size: 52px; font-weight: bold; text-align: center; letter-spacing: 2px; margin: 10px 0; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 3px 0; vertical-align: top; }
    .lbl { color: #555; width: 44%; }
    .val { font-weight: bold; }
    .footer { text-align: center; font-size: 11px; color: #777; margin-top: 10px; }
    @media print {
      body { width: 100%; padding: 0; }
    }
  </style>
</head>
<body>
  <div class="center logo">FACTORY</div>
  <div class="center" style="font-size:11px;color:#777;margin-top:2px;">Производство принтов на текстиле</div>

  <hr class="dash">

  <div class="order-num">#${displayNumber}</div>

  <hr class="dash">

  <table>
    ${row("Клиент", data.clientName)}
    ${row("Телефон", data.clientPhone)}
  </table>

  ${data.clientName || data.clientPhone ? '<hr class="dash">' : ""}

  <table>
    ${row("Модель", data.modelName)}
    ${row("Цвет", data.colorName)}
    ${row("Размер", data.sizeName)}
    ${row("Принт", data.printName)}
    ${row("Сторона", sideLabel)}
  </table>

  ${printImgBlock}

  <hr class="dash">

  <div class="footer">
    Сохраните номер заказа для получения<br>
    ${now}
  </div>
</body>
</html>`;

  const win = window.open("", "_blank", "width=430,height=700,scrollbars=yes");
  if (!win) {
    alert("Разрешите всплывающие окна в браузере для печати чека");
    return;
  }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}
