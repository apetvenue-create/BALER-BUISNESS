import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatIndianCurrency, formatDisplayDate } from "../utils";
import { 
  Transaction, 
  CustomerSummary, 
  SupplierSummary, 
  LabourSummary, 
  PartnerSummary, 
  StockMovement,
  Language
} from "../types";
import { TRANSLATIONS } from "../constants";

// Define strict types for table columns
type TableRow = (string | number | { content: string; colSpan?: number; styles?: any })[];

const BUSINESS_NAME = "TRANSACTION MANAGER";

// Colors
const COLOR_PRIMARY: [number, number, number] = [41, 128, 185]; // Blue
const COLOR_SECONDARY: [number, number, number] = [52, 73, 94]; // Dark Grey
const COLOR_ACCENT: [number, number, number] = [245, 245, 245]; // Light Grey
const COLOR_DEBIT: [number, number, number] = [192, 57, 43]; // Red
const COLOR_CREDIT: [number, number, number] = [39, 174, 96]; // Green

// Font URLs (Using Google Fonts CDN for reliability)
const FONTS: Record<Language, { url: string, name: string }> = {
    en: {
        url: 'https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSans/NotoSans-Regular.ttf',
        name: 'NotoSans'
    },
    hi: {
        url: 'https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSansDevanagari/NotoSansDevanagari-Regular.ttf',
        name: 'NotoSansDevanagari'
    },
    pa: {
        url: 'https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSansGurmukhi/NotoSansGurmukhi-Regular.ttf',
        name: 'NotoSansGurmukhi'
    }
};

export class PDFGenerator {

  // --- 1. DATA SAFETY HELPERS ---

  private static _t(key: keyof typeof TRANSLATIONS['en'] | string, lang: Language): string {
      const k = key as keyof typeof TRANSLATIONS['en'];
      let text = "";
      if (TRANSLATIONS[lang] && TRANSLATIONS[lang][k]) {
          text = TRANSLATIONS[lang][k];
      } else if (TRANSLATIONS['en'] && TRANSLATIONS['en'][k]) {
          text = TRANSLATIONS['en'][k];
      } else {
          text = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim();
      }
      return text || String(key);
  }

  private static _c(amount: number | undefined | null): string {
      if (amount === undefined || amount === null || isNaN(amount)) return "Rs 0";
      return `Rs ${formatIndianCurrency(amount)}`;
  }

  private static _s(text: string | undefined | null): string {
      if (!text || String(text).trim() === "") return "—";
      return String(text);
  }

  // --- 2. FONT MANAGEMENT ---
  private static async addFontToDoc(doc: jsPDF, lang: Language): Promise<string> {
      const fontDef = FONTS[lang];
      const fontName = fontDef.name;

      // If already added, just return
      if (doc.getFontList().hasOwnProperty(fontName)) {
          return fontName;
      }

      try {
          const response = await fetch(fontDef.url);
          if (!response.ok) throw new Error(`Failed to fetch font: ${response.statusText}`);
          const buffer = await response.arrayBuffer();
          
          let binary = '';
          const bytes = new Uint8Array(buffer);
          const len = bytes.byteLength;
          for (let i = 0; i < len; i++) {
              binary += String.fromCharCode(bytes[i]);
          }
          const base64 = btoa(binary);

          doc.addFileToVFS(`${fontName}.ttf`, base64);
          doc.addFont(`${fontName}.ttf`, fontName, "normal");
          
          return fontName;
      } catch (e) {
          console.warn(`Font loading failed for ${lang}, falling back to Helvetica. Error:`, e);
          return "helvetica";
      }
  }

  // --- 3. DOCUMENT INITIALIZATION ---
  private static async createDoc(title: string, metadata: (string | null | undefined)[], lang: Language): Promise<{ doc: jsPDF, fontName: string }> {
    const doc = new jsPDF();
    const fontName = await this.addFontToDoc(doc, lang);
    
    // Set global font
    doc.setFont(fontName, "normal");

    // Business Header
    doc.setFontSize(22);
    doc.setTextColor(40, 40, 40);
    doc.text(BUSINESS_NAME, 14, 20);

    // Report Title
    doc.setFontSize(14);
    doc.setTextColor(100, 100, 100);
    doc.text(this._s(title).toUpperCase(), 196, 20, { align: "right" });

    // Divider
    doc.setDrawColor(200, 200, 200);
    doc.line(14, 25, 196, 25);

    // Metadata
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    
    let y = 35;
    const cleanMetadata = metadata.filter(m => m !== null && m !== undefined && m !== "");
    
    cleanMetadata.forEach(line => {
        // Ensure font is active before drawing text
        doc.setFont(fontName, "normal"); 
        doc.text(line!, 14, y);
        y += 6;
    });

    // Timestamp
    doc.setFontSize(8);
    doc.setTextColor(150);
    const genText = `${this._t('dateHeader', lang)}: ${formatDisplayDate(new Date().toISOString().split('T')[0])}`;
    doc.text(genText, 196, 35, { align: "right" });

    return { doc, fontName };
  }

  // --- 4. TABLE HELPERS ---
  
  // Shared styles for all tables to ensure fonts work
  private static getTableConfig(fontName: string) {
      return {
          styles: {
              font: fontName,
              fontStyle: 'normal' as 'normal', // CRITICAL: Forces body text to use Regular font
              overflow: 'linebreak' as 'linebreak', // Explicit cast
              cellPadding: 3,
              fontSize: 9
          },
          headStyles: {
              font: fontName,
              fontStyle: 'normal' as 'normal', // CRITICAL: Forces headers to use Regular font (prevents blank headers)
              fillColor: COLOR_SECONDARY,
              textColor: [255, 255, 255] as [number, number, number],
              halign: 'center' as 'center'
          },
          columnStyles: {
              // Default alignments
          },
          theme: 'striped' as 'striped'
      };
  }

  private static addSummarySection(doc: jsPDF, data: { label: string, value: string }[], startY: number, fontName: string) {
      if (!data || data.length === 0) return;

      const body = [data.map(d => this._s(d.value))];
      const head = [data.map(d => this._s(d.label))];

      autoTable(doc, {
          startY: startY,
          head: head,
          body: body,
          theme: 'grid',
          styles: {
              font: fontName,
              fontStyle: 'normal' as 'normal', 
              overflow: 'linebreak' as 'linebreak',
              halign: 'center' as 'center',
              cellPadding: 4,
              fontSize: 10
          },
          headStyles: { 
              font: fontName,
              fontStyle: 'normal' as 'normal', // CRITICAL
              fillColor: COLOR_ACCENT, 
              textColor: COLOR_SECONDARY, 
          },
          bodyStyles: { 
              fillColor: [255, 255, 255] as [number, number, number], 
              textColor: [0, 0, 0] as [number, number, number], 
              fontSize: 12,
          },
          margin: { left: 14, right: 14 }
      });
  }

  private static addFooter(doc: jsPDF, lang: Language, fontName: string) {
     const pageCount = doc.getNumberOfPages();
     for(let i = 1; i <= pageCount; i++) {
         doc.setPage(i);
         doc.setFont(fontName, "normal");
         doc.setFontSize(8);
         doc.setTextColor(150);
         const pageText = `${this._t('pageTitle', lang)} - Page ${i} of ${pageCount}`;
         doc.text(pageText, 196, 287, { align: 'right' });
         doc.text("Internal Use / Confidential", 14, 287);
     }
  }

  private static save(doc: jsPDF, filename: string, lang: Language, fontName: string) {
      this.addFooter(doc, lang, fontName);
      doc.save(`${filename}_${new Date().toISOString().split('T')[0]}.pdf`);
  }

  // --- REPORT GENERATORS ---

  // 1. Transaction Report
  static async generateTransactionReport(
      transactions: Transaction[], 
      startDate: string, 
      endDate: string, 
      filterType: string,
      lang: Language
  ) {
      const titleKey = filterType === 'income' ? 'incomeTitle' : (filterType === 'expense' ? 'expenseTitle' : 'reportAllTransactionsTitle');
      const { doc, fontName } = await this.createDoc(this._t(titleKey, lang), [
          `${this._t('fromDateLabel', lang)} ${formatDisplayDate(startDate)}`,
          `${this._t('toDateLabel', lang)} ${formatDisplayDate(endDate)}`
      ], lang);

      let totalIncome = 0;
      let totalExpense = 0;

      const body: TableRow[] = transactions.map(t => {
          if (t.type === 'income') totalIncome += t.amount;
          else totalExpense += t.amount;

          return [
              this._s(formatDisplayDate(t.date)),
              this._s(t.accountName),
              this._s(t.details),
              t.type === 'income' ? this._t('incomeTypeLabel', lang) : this._t('expenseTypeHeader', lang),
              this._s(t.category).toUpperCase(),
              t.type === 'income' ? this._c(t.amount) : "—",
              t.type === 'expense' ? this._c(t.amount) : "—"
          ];
      });

      if (body.length === 0) {
          body.push([{ content: this._t('noRecords', lang), colSpan: 7, styles: { halign: 'center', textColor: [150, 150, 150] as [number, number, number] } }]);
      }

      this.addSummarySection(doc, [
          { label: this._t('reportTotalIncome', lang), value: this._c(totalIncome) },
          { label: this._t('reportTotalExpense', lang), value: this._c(totalExpense) }
      ], 55, fontName);

      const tableConfig = this.getTableConfig(fontName);

      autoTable(doc, {
          ...tableConfig,
          startY: (doc as any).lastAutoTable.finalY + 10,
          head: [[
              this._t('dateHeader', lang), 
              this._t('nameLabel', lang), 
              this._t('detailsHeader', lang), 
              this._t('typeHeader', lang), 
              "Category", 
              `${this._t('colCredit', lang)} (+)`, 
              `${this._t('colDebit', lang)} (-)`
          ]],
          body: body,
          columnStyles: {
              5: { halign: 'center' as 'center', textColor: COLOR_CREDIT },
              6: { halign: 'center' as 'center', textColor: COLOR_DEBIT }
          }
      });

      this.save(doc, "Transaction_Report", lang, fontName);
  }

  // 2. Customer Ledger
  static async generateCustomerLedger(
      data: CustomerSummary, 
      dateRange: { start: string, end: string } | undefined,
      openingBalance: number = 0,
      lang: Language
  ) {
      if (!data) return;

      const metadata = [
          `${this._t('nameLabel', lang)}: ${this._s(data.name)}`,
          `${this._t('customerTotalStock', lang)}: ${(data.totalStockKg / 100).toFixed(2)} Q`
      ];

      if (dateRange) {
          metadata.push(`${this._t('fromDateLabel', lang)} ${formatDisplayDate(dateRange.start)}  ${this._t('toDateLabel', lang)} ${formatDisplayDate(dateRange.end)}`);
      }

      const { doc, fontName } = await this.createDoc(this._t('tabCustomer', lang), metadata, lang);

      this.addSummarySection(doc, [
          { label: this._t('totalDebit', lang), value: this._c(data.totalBilled) },
          { label: this._t('totalCredit', lang), value: this._c(data.totalReceived) }
      ], 60, fontName);

      const body: TableRow[] = [];

      if (dateRange) {
          body.push([
              this._s(formatDisplayDate(dateRange.start)),
              this._t('prevBalTitle', lang).toUpperCase(),
              "—", "—", "—", "—",
              this._c(Math.abs(openingBalance)) + (openingBalance >= 0 ? ' Dr' : ' Cr')
          ]);
      }

      data.ledger.forEach(row => {
          body.push([
              this._s(formatDisplayDate(row.date)),
              this._s(row.description),
              this._s(row.vehicleNumber || "—"),
              row.quantityKg ? `${(row.quantityKg/100).toFixed(2)} Q` : "—",
              row.billedAmount > 0 ? this._c(row.billedAmount) : "—",
              row.receivedAmount > 0 ? this._c(row.receivedAmount) : "—",
              this._c(Math.abs(row.runningBalance)) + (row.runningBalance >= 0 ? ' Dr' : ' Cr')
          ]);
      });

      if (body.length === 0) {
          body.push([{ content: this._t('noRecords', lang), colSpan: 7, styles: { halign: 'center', textColor: [150, 150, 150] as [number, number, number] } }]);
      }

      const tableConfig = this.getTableConfig(fontName);

      autoTable(doc, {
          ...tableConfig,
          startY: (doc as any).lastAutoTable.finalY + 10,
          head: [[
              this._t('dateHeader', lang), 
              this._t('detailsHeader', lang), 
              this._t('colVehicle', lang), 
              this._t('quantityLabel', lang), 
              this._t('colDebit', lang), 
              this._t('colCredit', lang), 
              this._t('colBalance', lang)
          ]],
          headStyles: { 
              ...tableConfig.headStyles, 
              fillColor: [142, 68, 173] as [number, number, number] 
          },
          body: body,
          columnStyles: {
              4: { halign: 'center' as 'center', textColor: COLOR_DEBIT },
              5: { halign: 'center' as 'center', textColor: COLOR_CREDIT },
              6: { halign: 'center' as 'center' }
          },
          didParseCell: (data) => {
              // Highlight Opening Balance Row
              if (dateRange && data.row.index === 0 && data.section === 'body') {
                  data.cell.styles.fillColor = [240, 240, 240] as [number, number, number];
                  // Do NOT use 'bold' here either
              }
          }
      });

      this.save(doc, `Customer_${data.name}`, lang, fontName);
  }

  // 3. Supplier Ledger
  static async generateSupplierLedger(
      data: SupplierSummary,
      dateRange: { start: string, end: string } | undefined,
      openingBalance: number = 0,
      lang: Language
  ) {
      if (!data) return;

      const metadata = [
          `${this._t('nameLabel', lang)}: ${this._s(data.name)}`
      ];
      if (dateRange) {
          metadata.push(`${this._t('fromDateLabel', lang)} ${formatDisplayDate(dateRange.start)}  ${this._t('toDateLabel', lang)} ${formatDisplayDate(dateRange.end)}`);
      }

      const { doc, fontName } = await this.createDoc(this._t('tabSupplier', lang), metadata, lang);

      this.addSummarySection(doc, [
          { label: this._t('totalPaidToSupplier', lang), value: this._c(data.totalPaid) },
          { label: this._t('totalReceivedFromSupplier', lang), value: this._c(data.totalReceived) }
      ], 50, fontName);

      const body: TableRow[] = [];

      if (dateRange) {
          body.push([
              this._s(formatDisplayDate(dateRange.start)),
              this._t('prevBalTitle', lang).toUpperCase(),
              "—", "—",
              this._c(openingBalance)
          ]);
      }

      data.ledger.forEach(row => {
          body.push([
              this._s(formatDisplayDate(row.date)),
              this._s(row.description),
              row.debitAmount > 0 ? this._c(row.debitAmount) : "—",
              row.creditAmount > 0 ? this._c(row.creditAmount) : "—",
              this._c(row.runningBalance)
          ]);
      });

      if (body.length === 0) {
          body.push([{ content: this._t('noRecords', lang), colSpan: 5, styles: { halign: 'center', textColor: [150, 150, 150] as [number, number, number] } }]);
      }

      const tableConfig = this.getTableConfig(fontName);

      autoTable(doc, {
          ...tableConfig,
          startY: (doc as any).lastAutoTable.finalY + 10,
          head: [[
              this._t('dateHeader', lang), 
              this._t('detailsHeader', lang), 
              this._t('colPaymentMade', lang), 
              this._t('colRefundReceived', lang), 
              this._t('netPaidBalance', lang)
          ]],
          headStyles: { 
              ...tableConfig.headStyles, 
              fillColor: COLOR_PRIMARY 
          },
          body: body,
          columnStyles: {
              2: { halign: 'center' as 'center', textColor: COLOR_DEBIT },
              3: { halign: 'center' as 'center', textColor: COLOR_CREDIT },
              4: { halign: 'center' as 'center' }
          },
          didParseCell: (data) => {
              if (dateRange && data.row.index === 0 && data.section === 'body') {
                  data.cell.styles.fillColor = [240, 240, 240] as [number, number, number];
              }
          }
      });

      this.save(doc, `Supplier_${data.name}`, lang, fontName);
  }

  // 4. Partner Ledger
  static async generatePartnerLedger(
      data: PartnerSummary,
      dateRange: { start: string, end: string } | undefined,
      openingBalance: number = 0,
      lang: Language
  ) {
      if (!data) return;

      const metadata = [`${this._t('nameLabel', lang)}: ${this._s(data.name)}`];
      if (dateRange) {
          metadata.push(`${this._t('fromDateLabel', lang)} ${formatDisplayDate(dateRange.start)}  ${this._t('toDateLabel', lang)} ${formatDisplayDate(dateRange.end)}`);
      }

      const { doc, fontName } = await this.createDoc(this._t('partnerAccountLabel', lang), metadata, lang);

      this.addSummarySection(doc, [
          { label: this._t('moneyIn', lang), value: this._c(data.totalIn) },
          { label: this._t('moneyOut', lang), value: this._c(data.totalOut) }
      ], 50, fontName);

      const prevTag = this._t('ownerPreviousPaymentTypeTag', lang);
      const merged = [
          ...data.transactionsIn.map(t => ({
              date: t.date,
              details: t.details || '',
              paymentType: t.paymentType,
              debit: 0,
              credit: t.amount,
              sortTime: t.timestamp
          })),
          ...data.transactionsOut.map(t => ({
              date: t.date,
              details: t.details || '',
              paymentType: t.paymentType,
              debit: t.amount,
              credit: 0,
              sortTime: t.timestamp
          })),
          ...data.previousReceived.map(e => ({
              date: e.date,
              details: e.note ? `${prevTag}: ${this._s(e.note)}` : prevTag,
              paymentType: '—',
              debit: 0,
              credit: e.amount,
              sortTime: e.id
          })),
          ...data.previousPaid.map(e => ({
              date: e.date,
              details: e.note ? `${prevTag}: ${this._s(e.note)}` : prevTag,
              paymentType: '—',
              debit: e.amount,
              credit: 0,
              sortTime: e.id
          }))
      ].sort((a, b) => {
          const c = a.date.localeCompare(b.date);
          if (c !== 0) return c;
          return a.sortTime - b.sortTime;
      });

      const allTrans = merged;

      const body: TableRow[] = [];
      let running = openingBalance;

      if (dateRange) {
          body.push([
              this._s(formatDisplayDate(dateRange.start)),
              this._t('prevBalTitle', lang).toUpperCase(),
              "—", "—", "—",
              this._c(openingBalance)
          ]);
      }

      allTrans.forEach(t => {
          running = running + t.credit - t.debit;
          body.push([
              this._s(formatDisplayDate(t.date)),
              this._s(t.details),
              String(t.paymentType).toUpperCase(),
              t.credit > 0 ? this._c(t.credit) : "—",
              t.debit > 0 ? this._c(t.debit) : "—",
              this._c(running)
          ]);
      });

      if (body.length === 0) {
          body.push([{ content: this._t('noRecords', lang), colSpan: 6, styles: { halign: 'center', textColor: [150, 150, 150] as [number, number, number] } }]);
      }

      const tableConfig = this.getTableConfig(fontName);

      autoTable(doc, {
          ...tableConfig,
          startY: (doc as any).lastAutoTable.finalY + 10,
          head: [[
              this._t('dateHeader', lang), 
              this._t('detailsHeader', lang), 
              this._t('typeHeader', lang), 
              this._t('moneyIn', lang), 
              this._t('moneyOut', lang), 
              this._t('balanceLabel', lang)
          ]],
          headStyles: { 
            ...tableConfig.headStyles,
            fillColor: COLOR_SECONDARY 
          },
          body: body,
          columnStyles: {
              3: { halign: 'center' as 'center', textColor: COLOR_CREDIT },
              4: { halign: 'center' as 'center', textColor: COLOR_DEBIT },
              5: { halign: 'center' as 'center' }
          },
          didParseCell: (data) => {
              if (dateRange && data.row.index === 0 && data.section === 'body') {
                  data.cell.styles.fillColor = [240, 240, 240] as [number, number, number];
              }
          }
      });

      this.save(doc, `Partner_${data.name}`, lang, fontName);
  }

  // 5. Labour Ledger
  static async generateLabourLedger(data: LabourSummary, lang: Language) {
      if (!data) return;

      const { doc, fontName } = await this.createDoc(this._t('labourCardLabel', lang), [
          `${this._t('nameLabel', lang)}: ${this._s(data.name)}`,
          `${this._t('dateHeader', lang)}: ${this._s(data.viewMonthName)}`
      ], lang);

      const rate = data.rate || 0;
      const days = data.monthAttendanceDays || 0;
      const payable = data.monthPayable || 0;
      const paid = data.monthPaid || 0;
      const net = data.lifetimeBalance || 0;

      this.addSummarySection(doc, [
          { label: this._t('ratePerDay', lang), value: this._c(rate) },
          { label: this._t('monthDays', lang), value: String(days) },
          { label: this._t('monthPayable', lang), value: this._c(payable) },
          { label: this._t('monthPaid', lang), value: this._c(paid) },
          { label: this._t('totalNetBalance', lang), value: this._c(net) }
      ], 60, fontName);

      const body: TableRow[] = data.timeline.map(row => {
          const payments = row.transactions.map(t => `Rs.${t.amount} (${t.paymentType})`).join(', ');
          
          // Calculate total earnings including extra bonuses
          let earnings = row.isPresent ? (row.dailyWage || 0) : 0;
          let notes = [];
          
          if(row.adjustments && row.adjustments.length > 0) {
              row.adjustments.forEach(adj => {
                  earnings += adj.amount;
                  notes.push(`+${adj.amount} (${adj.note})`);
              });
          }
          
          // Status Text
          let status = row.isPresent ? "Present" : "Absent";
          if (notes.length > 0) {
              status += ` ${notes.join(", ")}`;
          }

          return [
              this._s(formatDisplayDate(row.date)),
              status,
              this._c(earnings),
              this._s(payments) || "—"
          ];
      });

      if (body.length === 0) {
          body.push([{ content: this._t('noRecords', lang), colSpan: 5, styles: { halign: 'center', textColor: [150, 150, 150] as [number, number, number] } }]);
      }

      const tableConfig = this.getTableConfig(fontName);

      autoTable(doc, {
          ...tableConfig,
          startY: (doc as any).lastAutoTable.finalY + 10,
          head: [[
              this._t('dateHeader', lang), 
              this._t('attendanceSection', lang), 
              this._t('workAmtHeader', lang), 
              this._t('paymentDetailsHeader', lang)
          ]],
          headStyles: { 
             ...tableConfig.headStyles,
             fillColor: [211, 84, 0] as [number, number, number] 
          },
          body: body,
          columnStyles: {
              2: { halign: 'center' as 'center' },
              3: { halign: 'center' as 'center', textColor: COLOR_DEBIT }
          }
      });

      this.save(doc, `Labour_${data.name}_${data.viewMonthName}`, lang, fontName);
  }

  // 6. Stock Ledger
  static async generateStockLedger(movements: StockMovement[], lang: Language) {
      const { doc, fontName } = await this.createDoc(this._t('stockHistoryTitle', lang), [
         `Total Entries: ${movements ? movements.length : 0}`
      ], lang);

      const currentStock = movements && movements.length > 0 ? movements[movements.length - 1].remainingStockKg : 0;

      this.addSummarySection(doc, [
          { label: this._t('currentStockTitle', lang), value: `${(currentStock/100).toFixed(2)} Q` },
          { label: "KG", value: `${currentStock} KG` }
      ], 50, fontName);

      const sorted = movements ? [...movements].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()) : [];

      const body: TableRow[] = sorted.map(m => {
          let changeStr = '';
          if(m.type === 'in' || m.type === 'adjust_add') changeStr = `+ ${(m.quantityKg/100).toFixed(2)} Q`;
          else changeStr = `- ${(m.quantityKg/100).toFixed(2)} Q`;

          return [
              this._s(formatDisplayDate(m.date)),
              m.type === 'out' ? this._t('dispatchTypeLabel', lang) : (m.type === 'adjust_add' ? this._t('stockAdded', lang) : this._t('stockSubtracted', lang)),
              this._s(m.accountName || m.note || "—"),
              this._s(m.vehicleNumber || "—"),
              changeStr,
              (m.remainingStockKg / 100).toFixed(2) + ' Q'
          ];
      });

      if (body.length === 0) {
          body.push([{ content: this._t('noRecords', lang), colSpan: 6, styles: { halign: 'center', textColor: [150, 150, 150] as [number, number, number] } }]);
      }

      const tableConfig = this.getTableConfig(fontName);

      autoTable(doc, {
          ...tableConfig,
          startY: (doc as any).lastAutoTable.finalY + 10,
          head: [[
              this._t('dateHeader', lang), 
              this._t('typeHeader', lang), 
              this._t('detailsHeader', lang), 
              this._t('vehicleNoLabel', lang), 
              this._t('colChange', lang), 
              this._t('colNewStock', lang)
          ]],
          headStyles: {
            ...tableConfig.headStyles,
            fillColor: [44, 62, 80] as [number, number, number]
          },
          body: body,
          columnStyles: {
              4: { halign: 'center' as 'center' },
              5: { halign: 'center' as 'center' }
          }
      });

      this.save(doc, "Stock_Ledger", lang, fontName);
  }
}