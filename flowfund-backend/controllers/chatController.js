const getGeminiClient = require('../config/gemini');
const { buildSnapshot } = require('../services/snapshotService');

const SYSTEM_INSTRUCTIONS = `
You are FlowFund AI's financial education assistant. You help users understand their spending patterns and improve their financial health.

IMPORTANT RULES:
- You are NOT a licensed financial advisor
- Never recommend specific stocks, funds, or securities
- Never promise returns or guarantee outcomes
- Never execute or suggest executing trades
- Base ALL statements on the financial data provided — do not invent numbers
- If no data is available, say so clearly and encourage the user to link a bank account
- Keep responses concise, educational, and encouraging
- Suggest 3–5 practical, specific next steps when relevant
- Use plain language suitable for young adults and college students
- Always frame advice as educational suggestions, not financial instructions

Your tone should be: clear, supportive, practical, and honest about limitations.
`.trim();

function buildContextPrompt(snapshot) {
  if (!snapshot.hasData) {
    return `The user has not yet linked a bank account. No financial data is available. Let them know they can connect a bank account on their dashboard to get personalized insights.`;
  }

  const s = snapshot.spendingSummary;
  const inc = snapshot.incomeSummary;

  return `
Here is the user's verified financial data (computed by the FlowFund AI backend — do not invent or modify these numbers):

ACCOUNTS: ${snapshot.accountsSummary.accountCount} linked account(s), total balance $${snapshot.accountsSummary.totalCurrentBalance.toFixed(2)}

SPENDING:
- Last 30 days: $${s.last30Days.toFixed(2)}
- Last 90 days: $${s.last90Days.toFixed(2)}
- Average monthly spend: $${s.averageMonthlySpend.toFixed(2)}

TOP SPENDING CATEGORIES (90d):
${s.topCategories.map(c => `  - ${c.category}: $${c.amount.toFixed(2)}`).join('\n')}

TOP MERCHANTS (90d):
${s.topMerchants.map(m => `  - ${m.merchant}: $${m.amount.toFixed(2)}`).join('\n')}

RECURRING CHARGES:
${s.recurringCharges.length > 0
    ? s.recurringCharges.map(r => `  - ${r.merchant}: ~$${r.amount}/month`).join('\n')
    : '  None detected'}

SPENDING SPIKES (vs prior 30d):
${s.spendingSpikes.length > 0
    ? s.spendingSpikes.map(sp => `  - ${sp.category}: +${sp.changePct}%`).join('\n')
    : '  No significant spikes detected'}

INCOME & SAVINGS:
- Estimated monthly income: ${inc.estimatedMonthlyIncome > 0 ? `$${inc.estimatedMonthlyIncome.toFixed(2)}` : 'Not enough income transactions detected'}
- Estimated savings rate: ${inc.estimatedSavingsRate !== null ? `${(inc.estimatedSavingsRate * 100).toFixed(0)}%` : 'N/A'}
- Cash buffer: ${inc.cashBufferMonths !== null ? `${inc.cashBufferMonths} months` : 'N/A'}

RISK FLAGS:
${snapshot.riskFlags.length > 0
    ? snapshot.riskFlags.map(f => `  - ${f}`).join('\n')
    : '  No major risk flags'}

RECOMMENDED FOCUS AREAS:
${snapshot.recommendedFocusAreas.map(a => `  - ${a}`).join('\n')}

Use only this data when answering. Do not add numbers or facts not listed above.
`.trim();
}

// POST /api/chat/message
exports.sendMessage = async (req, res) => {
  const { message } = req.body;
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'message is required' });
  }

  try {
    const snapshot = await buildSnapshot(req.user.user_id);
    const contextPrompt = buildContextPrompt(snapshot);

    const gemini = getGeminiClient();
    const model = gemini.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const fullPrompt = `${SYSTEM_INSTRUCTIONS}\n\n${contextPrompt}\n\nUser question: ${message.trim()}`;

    const result = await model.generateContent(fullPrompt);
    const responseText = result.response.text();

    res.json({
      reply: responseText,
      hasFinancialData: snapshot.hasData,
    });
  } catch (err) {
    console.error('chat error:', {
      message: err.message,
      status: err.status,
      errorDetails: err.errorDetails,
      stack: err.stack,
    });
    res.status(500).json({ error: 'Failed to generate response' });
  }
};
