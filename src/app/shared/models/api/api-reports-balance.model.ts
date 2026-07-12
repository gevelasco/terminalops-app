export type ReportsBalanceSummary = {
  from: string;
  to: string;
  collectedInPeriod: number;
  receivableOpen: number;
  accruedRevenue: number;
  expenses: number;
  expensesCount: number;
  realExpenses: number;
  provisions: number;
  accountsPayable: number;
  cashMargin: number;
  accruedMargin: number;
  marginPercent: number | null;
  tollsSpendInPeriod: number;
  operatorSpendInPeriod: number;
};

export type ReportsBalanceCompositionSlice = {
  key: string;
  label: string;
  amount: number;
};

export type ReportsBalanceCreditByClient = {
  clientName: string;
  amount: number;
  nextDueDate: string | null;
};

export type ReportsBalanceIncomeByClient = {
  clientName: string;
  amount: number;
  tripCount: number;
};

export type ReportsBalanceMarginByClient = {
  clientName: string;
  revenue: number;
  cost: number;
  margin: number;
  marginPercent: number | null;
  tripCount: number;
};

export type ReportsBalanceProfitability = {
  revenue: number;
  directCost: number;
  tripExpenses: number;
  totalCost: number;
  margin: number;
  marginPercent: number | null;
};

export type ReportsBalanceExpenseRubro = {
  rubro: string;
  label: string;
  amount: number;
  count: number;
};

export type ReportsBalanceDailyActivityEvent = {
  kind: 'income' | 'expense';
  label: string;
  amount: number;
};

export type ReportsBalanceDailyActivityDay = {
  date: string;
  incomeCount: number;
  expenseCount: number;
  events: ReportsBalanceDailyActivityEvent[];
};

export type ReportsBalanceInsights = {
  composition: ReportsBalanceCompositionSlice[];
  creditByClient: ReportsBalanceCreditByClient[];
  incomeByClient: ReportsBalanceIncomeByClient[];
  marginByClient: ReportsBalanceMarginByClient[];
  profitability: ReportsBalanceProfitability;
  expensesByRubro: ReportsBalanceExpenseRubro[];
  dailyActivity: ReportsBalanceDailyActivityDay[];
};

export type ReportsBalanceData = {
  summary: ReportsBalanceSummary;
  insights: ReportsBalanceInsights;
};

function num(raw: unknown): number {
  return Number(raw ?? 0) || 0;
}

function mapSummary(raw: Record<string, unknown>): ReportsBalanceSummary {
  const marginPercent = raw['marginPercent'];
  return {
    from: String(raw['from'] ?? ''),
    to: String(raw['to'] ?? ''),
    collectedInPeriod: num(raw['collectedInPeriod']),
    receivableOpen: num(raw['receivableOpen']),
    accruedRevenue: num(raw['accruedRevenue']),
    expenses: num(raw['expenses']),
    expensesCount: num(raw['expensesCount']),
    realExpenses: num(raw['realExpenses']),
    provisions: num(raw['provisions']),
    accountsPayable: num(raw['accountsPayable']),
    cashMargin: num(raw['cashMargin']),
    accruedMargin: num(raw['accruedMargin']),
    marginPercent: marginPercent == null ? null : num(marginPercent),
    tollsSpendInPeriod: num(raw['tollsSpendInPeriod']),
    operatorSpendInPeriod: num(raw['operatorSpendInPeriod']),
  };
}

function mapProfitability(raw: Record<string, unknown>): ReportsBalanceProfitability {
  const marginPercent = raw['marginPercent'];
  return {
    revenue: num(raw['revenue']),
    directCost: num(raw['directCost']),
    tripExpenses: num(raw['tripExpenses']),
    totalCost: num(raw['totalCost']),
    margin: num(raw['margin']),
    marginPercent: marginPercent == null ? null : num(marginPercent),
  };
}

export function mapApiReportsBalance(raw: Record<string, unknown>): ReportsBalanceData {
  const insightsRaw = (raw['insights'] ?? {}) as Record<string, unknown>;

  const composition = ((insightsRaw['composition'] ?? []) as Record<string, unknown>[]).map(
    (row) => ({
      key: String(row['key'] ?? ''),
      label: String(row['label'] ?? ''),
      amount: num(row['amount']),
    }),
  );

  const creditByClient = ((insightsRaw['creditByClient'] ?? []) as Record<string, unknown>[]).map(
    (row) => ({
      clientName: String(row['clientName'] ?? 'Sin cliente'),
      amount: num(row['amount']),
      nextDueDate: row['nextDueDate'] ? String(row['nextDueDate']) : null,
    }),
  );

  const incomeByClient = ((insightsRaw['incomeByClient'] ?? []) as Record<string, unknown>[]).map(
    (row) => ({
      clientName: String(row['clientName'] ?? 'Sin cliente'),
      amount: num(row['amount']),
      tripCount: num(row['tripCount']),
    }),
  );

  const marginByClient = ((insightsRaw['marginByClient'] ?? []) as Record<string, unknown>[]).map(
    (row) => ({
      clientName: String(row['clientName'] ?? 'Sin cliente'),
      revenue: num(row['revenue']),
      cost: num(row['cost']),
      margin: num(row['margin']),
      marginPercent: row['marginPercent'] == null ? null : num(row['marginPercent']),
      tripCount: num(row['tripCount']),
    }),
  );

  const expensesByRubro = ((insightsRaw['expensesByRubro'] ?? []) as Record<string, unknown>[]).map(
    (row) => ({
      rubro: String(row['rubro'] ?? ''),
      label: String(row['label'] ?? ''),
      amount: num(row['amount']),
      count: num(row['count']),
    }),
  );

  const dailyActivity = ((insightsRaw['dailyActivity'] ?? []) as Record<string, unknown>[]).map(
    (row) => ({
      date: String(row['date'] ?? ''),
      incomeCount: num(row['incomeCount']),
      expenseCount: num(row['expenseCount']),
      events: ((row['events'] ?? []) as Record<string, unknown>[]).map((event) => ({
        kind: event['kind'] === 'expense' ? ('expense' as const) : ('income' as const),
        label: String(event['label'] ?? ''),
        amount: num(event['amount']),
      })),
    }),
  );

  return {
    summary: mapSummary((raw['summary'] ?? {}) as Record<string, unknown>),
    insights: {
      composition,
      creditByClient,
      incomeByClient,
      marginByClient,
      profitability: mapProfitability(
        (insightsRaw['profitability'] ?? {}) as Record<string, unknown>,
      ),
      expensesByRubro,
      dailyActivity,
    },
  };
}
