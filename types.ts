

export type Language = 'en' | 'hi' | 'pa';

export type TransactionType = 'income' | 'expense';
export type PaymentType = 'cash' | 'online' | 'bank';

export interface Transaction {
  id: number;
  type: TransactionType;
  category: string; // 'customer', 'partner', 'shop', 'labour', 'custom', 'oil', 'cash_conversion', etc.
  accountName?: string; // For income or linked expenses
  details?: string;
  amount: number;
  paymentType: PaymentType;
  date: string; // ISO Date String YYYY-MM-DD
  timestamp: number; // For sorting
}

export interface ManualAdjustment {
  id: number;
  date: string;
  amount: number;
  note: string;
}

// Simple structure for persisting account metadata
// Expanded to allow 'customer' or other types for the unified store
export type AccountType = 'labour' | 'partner' | 'customer' | 'supplier' | 'other';

export interface StoredAccount {
  name: string;
  type: AccountType;
  rate?: number; // Daily rate for labour accounts
  attendance?: Record<string, boolean>; // Date (YYYY-MM-DD) -> isPresent
  hisaabDays?: Record<string, boolean>; // Date (YYYY-MM-DD) -> isHisaabDay
  manualAdjustments?: ManualAdjustment[]; // Extra payables (Bonuses, Overtime)
}

export interface DateFilter {
  mode: 'single' | 'range';
  singleDate: string;
  fromDate: string;
  toDate: string;
}

// --- Stock Types ---

export interface StockMovement {
  id: number;
  date: string; // ISO YYYY-MM-DD
  type: 'in' | 'out' | 'adjust_add' | 'adjust_sub';
  quantityKg: number; // Always stored in KG
  remainingStockKg: number; // Snapshot at time of movement
  
  // Context
  accountName?: string; // For dispatch/supply
  vehicleNumber?: string;
  ratePerQuintal?: number; // Store rate used at time of dispatch
  totalAmount?: number;
  transactionId?: number; // Linked financial transaction
  note?: string;
}

// --- Account Page Types ---

// Used specifically for the Account View Tabs
export type AccountTab = 'labour' | 'partner' | 'customer' | 'supplier';

export interface PartnerSummary {
  name: string;
  totalIn: number;
  totalOut: number;
  netBalance: number;
  transactionsIn: Transaction[];
  transactionsOut: Transaction[];
}

export interface LabourTimelineRow {
  date: string;
  isPresent: boolean;
  isHisaabDay: boolean; // Visual Marker
  dailyWage: number; // 0 or rate
  adjustments: ManualAdjustment[]; // Extra payables on this day
  transactions: Transaction[];
  // Opening Balance Row Support
  isOpeningBalance?: boolean;
  balance?: number;
}

export interface LabourSummary {
  name: string;
  rate: number; 
  
  // Lifetime Stats (For Net Balance)
  lifetimeBalance: number; 
  
  // Monthly Stats (For the current view)
  viewMonthName: string; // e.g., "October 2023" or "Custom Range"
  monthAttendanceDays: number;
  monthPayable: number;
  monthPaid: number;
  
  timeline: LabourTimelineRow[]; // Rows for the specific month/range
}

export interface CustomerLedgerItem {
  id: string; 
  date: string;
  type: 'stock' | 'payment';
  description: string;
  vehicleNumber?: string;
  quantityKg?: number;
  rate?: number;
  billedAmount: number;   // Debit (Receivable increase)
  receivedAmount: number; // Credit (Receivable decrease)
  runningBalance: number; // Calculated chronologically
}

export interface CustomerSummary {
  name: string;
  totalStockKg: number;
  totalBilled: number;
  totalReceived: number;
  balance: number; // Receivable
  ledger: CustomerLedgerItem[];
}

export interface SupplierLedgerItem {
    id: string;
    date: string;
    description: string;
    debitAmount: number; // Payment Made (Expense)
    creditAmount: number; // Refund/Advance (Income)
    runningBalance: number;
    originalTransaction: Transaction;
}

export interface SupplierSummary {
    name: string;
    totalPaid: number; // Total Debits
    totalReceived: number; // Total Credits
    netBalance: number; // Paid - Received
    ledger: SupplierLedgerItem[];
}

export interface Translation {
  pageTitle: string;
  langLabel: string;
  prevBalTitle: string;
  cashBalLabel: string;
  onlineBalLabel: string;
  totalBalLabel: string;
  incomeTitle: string;
  addIncomeBtn: string;
  incomeTypeHeader: string;
  amountHeader: string;
  typeHeader: string;
  actionHeader: string;
  detailsHeader: string;
  incomeTotalLabel: string;
  expenseTitle: string;
  addExpenseBtn: string;
  expenseTypeHeader: string;
  expenseTotalLabel: string;
  finalBalanceTitle: string;
  addIncomeTitle: string;
  editIncomeTitle: string;
  addExpenseTitle: string;
  editExpenseTitle: string;
  incomeTypeLabel: string;
  selectAccountLabel: string;
  amountLabel: string;
  paymentLabel: string;
  customerOption: string;
  partnerOption: string;
  shopOption: string;
  labourOption: string;
  customOption: string;
  cashOption: string;
  onlineOption: string;
  bankOption: string;
  submitBtn: string;
  updateBtn: string;
  cancelBtn: string;
  deleteBtn: string;
  editBtn: string;
  accountBalance: string;
  dateSelectionTitle: string;
  singleDayLabel: string;
  dateRangeLabel: string;
  transactionDateLabel: string;
  fromDateLabel: string;
  toDateLabel: string;
  selectAccountPlaceholder: string;
  addNewAccount: string;
  detailsLabel: string;
  selectPersonLabel: string;
  enterAccountName: string;
  confirmDelete: string;
  noIncome: string;
  noExpense: string;
  // New keys for range logic
  enableDateRange: string;
  rangeEndDateLabel: string;
  rangeHelpText: string;
  // Account Page Keys
  tabTransactions: string;
  tabAccounts: string;
  tabLabour: string;
  tabPartner: string;
  searchPlaceholder: string;
  totalReceivable: string;
  totalPayable: string;
  netPosition: string;
  moneyIn: string;
  moneyOut: string;
  attendanceSection: string;
  paymentSection: string;
  totalDays: string;
  ratePerDay: string;
  totalPayableLabel: string;
  totalPaidLabel: string;
  balanceLabel: string;
  statusPayable: string;
  statusRecoverable: string;
  backToAccounts: string;
  // Add Account Keys
  addLabourAccount: string;
  addPartnerAccount: string;
  createAccountTitle: string;
  accountCreated: string;
  accountExists: string;
  enterRate: string;

  // Additional Account Localization
  partnerAccountLabel: string;
  noRecords: string;
  labourCardLabel: string;
  totalNetBalance: string;
  monthDays: string;
  monthPayable: string;
  monthPaid: string;
  prevMonth: string;
  nextMonth: string;
  dateHeader: string;
  statusHeader: string;
  workAmtHeader: string;
  paymentDetailsHeader: string;
  sundayLabel: string;
  paidPrefix: string;
  noDaysInView: string;
  noAccountsFound: string;
  creatingLabourAccount: string;
  creatingPartnerAccount: string;
  nameLabel: string;
  createBtn: string;
  payLabourBtn: string; 
  
  // Extra Payable / Internal Adjustment
  addBonusBtn: string; // Renamed concept in UI, but key kept for compatibility
  addAdjustmentBtn: string;
  adjustmentTitle: string;
  adjustmentAmount: string;
  adjustmentNote: string;
  adjustmentTypeLabel: string;
  moneyGivenLabel: string;
  moneyTakenLabel: string;

  // Stats Section
  statsTitle: string;
  statsDateLabel: string;
  tillNow: string;
  statsTotalExpense: string;
  statsLabourExpense: string;
  statsPartnerIncome: string;
  statsLabourPerQuintal: string;
  totalDispatchedLabel: string;
  statsOilExpense: string;
  oilOption: string;
  electricityOption: string; 
  statsElectricityExpense: string; 

  // Detailed Report Keys
  viewDetailedReport: string;
  hideDetailedReport: string;
  detailedTransactionReport: string;

  // Translation
  translateBtn: string;
  translating: string;

  // Stock Page
  tabStock: string;
  tabStockDashboard: string;
  tabCustomers: string;
  tabSuppliers: string;
  currentStockTitle: string;
  addStockBtn: string;
  subtractStockBtn: string;
  unitToggleLabel: string;
  dispatchTitle: string;
  vehicleNoLabel: string;
  quantityLabel: string;
  rateLabel: string;
  convertedWeightLabel: string;
  totalPriceLabel: string;
  dispatchBtn: string;
  stockHistoryTitle: string;
  colGadi: string;
  colQty: string;
  colRate: string;
  colRemaining: string;
  lowStockWarning: string;
  adjustStockTitle: string;
  stockAdded: string;
  stockSubtracted: string;
  stockDispatched: string;

  // Stock History Modal
  viewHistoryBtn: string;
  historyModalTitle: string;
  colPrevStock: string;
  colChange: string;
  colNewStock: string;

  // Opening Balance
  editOpeningBalanceTitle: string;
  initialCashLabel: string;
  initialOnlineLabel: string;
  saveBtn: string;
  
  // Customer View Keys
  tabCustomer: string;
  customerTotalStock: string;
  customerTotalBilled: string;
  customerTotalReceived: string;
  customerBalance: string;
  colBilled: string;
  colReceived: string;
  colVehicle: string;
  // New Customer Keys
  viewStatement: string;
  viewDetails: string;
  totalDebit: string;
  totalCredit: string;
  colDebit: string;
  colCredit: string;
  colBalance: string;
  dr: string;
  cr: string;

  // Reports
  tabReports: string;
  reportAllTransactionsTitle: string;
  filterTypeLabel: string;
  filterAll: string;
  filterIncome: string;
  filterExpense: string;
  reportTotalIncome: string;
  reportTotalExpense: string;
  reportNet: string;

  // Supplier Account
  tabSupplier: string;
  addSupplierAccount: string;
  creatingSupplierAccount: string;
  colPaymentMade: string; // Debit
  colRefundReceived: string; // Credit
  totalPaidToSupplier: string;
  totalReceivedFromSupplier: string;
  netPaidBalance: string;
  receiveRefundBtn: string;
  supplierCreditModalTitle: string;
  supplierCreditHelp: string;
  supplierOption: string;
  
  // Other Income
  otherIncomeOption: string;

  // --- NEW KEYS ---
  unitKg: string;
  unitQuintal: string;
  alertInvalidQty: string;
  alertEnterQtyAdd: string;
  alertEnterQtySub: string;
  alertInsufficientStock: string;
  alertAmountRequired: string;
  alertDateOrder: string;
  editStockEntryTitle: string;
  manualAddNote: string;
  manualSubNote: string;
  transactionHistory: string;
  addCustomerAccount: string;
  creatingCustomerAccount: string;
  dispatchTypeLabel: string;
  
  // Strictly Isolated Labels
  operationalExpenseLabel: string;
  supplierPaymentsLabel: string;
  sourceExpense: string;
  sourceManual: string;

  // Conversion
  cashConversionOption: string;

  // PDF
  downloadPdfBtn: string;
  
  // Labour Specific
  hisaabHelp: string;

  // Validation
  errRequired: string;
  errAccountRequired: string;
  errPositiveAmount: string;
}