const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../utils/logger');

/**
 * AI Feature 3: NLP-based service auto-classification using Gemini (zero-shot).
 * When an admin creates a new service, this classifies the service type
 * and suggests capacity + prefix based on the name and description.
 */

const VALID_CATEGORIES = ['medical', 'banking', 'government', 'retail', 'education', 'telecom', 'hospitality', 'other'];

const CAPACITY_TIERS = {
  medical: { capacity: 15, reasoning: 'Medical services typically require longer consultation times' },
  banking: { capacity: 25, reasoning: 'Banking transactions are usually quick and standardized' },
  government: { capacity: 12, reasoning: 'Government services often involve detailed paperwork and verification' },
  retail: { capacity: 30, reasoning: 'Retail services are typically fast-paced with quick interactions' },
  education: { capacity: 20, reasoning: 'Education services have moderate processing times' },
  telecom: { capacity: 22, reasoning: 'Telecom services involve moderate troubleshooting and setup' },
  hospitality: { capacity: 18, reasoning: 'Hospitality services require personalized attention' },
  other: { capacity: 20, reasoning: 'Default capacity for general services' },
};

const PREFIX_SUGGESTIONS = {
  medical: ['MED', 'DR', 'OPD', 'CLN'],
  banking: ['BNK', 'FIN', 'CSH', 'ACC'],
  government: ['GOV', 'CIV', 'DOC', 'REG'],
  retail: ['RET', 'SHP', 'BIL', 'SVC'],
  education: ['EDU', 'STD', 'ADM', 'REG'],
  telecom: ['TEL', 'NET', 'SIM', 'SVC'],
  hospitality: ['HSP', 'GUE', 'CHK', 'RSV'],
  other: ['SVC', 'GEN', 'HLP', 'QUE'],
};

/**
 * Classify a service using Gemini zero-shot NLP.
 * @param {string} name - Service name
 * @param {string} description - Service description
 * @returns {{ category, suggestedCapacity, suggestedPrefix, reasoning, prefixOptions }}
 */
const classifyService = async (name, description = '') => {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    // Fallback: keyword-based classification if Gemini is unavailable
    return fallbackClassification(name, description);
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: `You are a service classification AI. Given a service name and description for a queue management system, classify it into exactly one category and suggest an appropriate 1-3 character prefix.

You MUST respond with valid JSON only, no markdown or explanation:
{
  "category": "one of: medical, banking, government, retail, education, telecom, hospitality, other",
  "suggestedPrefix": "1-3 uppercase letters",
  "reasoning": "brief explanation of classification"
}`,
    });

    const prompt = JSON.stringify({ name, description: description || 'No description provided' });
    const result = await model.generateContent(prompt);
    const text = typeof result?.response?.text === 'function'
      ? await result.response.text()
      : result?.response?.text;

    if (!text) return fallbackClassification(name, description);

    // Parse JSON response (handle markdown code blocks)
    let cleaned = text.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const parsed = JSON.parse(cleaned);
    const category = VALID_CATEGORIES.includes(parsed.category) ? parsed.category : 'other';
    const tier = CAPACITY_TIERS[category];

    return {
      category,
      suggestedCapacity: tier.capacity,
      suggestedPrefix: (parsed.suggestedPrefix || PREFIX_SUGGESTIONS[category][0]).toUpperCase().slice(0, 3),
      reasoning: parsed.reasoning || tier.reasoning,
      prefixOptions: PREFIX_SUGGESTIONS[category],
      capacityReasoning: tier.reasoning,
    };
  } catch (error) {
    logger.error(`Classification error: ${error.message}`);
    return fallbackClassification(name, description);
  }
};

/**
 * Keyword-based fallback when Gemini is unavailable.
 */
const fallbackClassification = (name, description = '') => {
  const text = `${name} ${description}`.toLowerCase();

  const keywords = {
    medical: ['medical', 'doctor', 'hospital', 'clinic', 'opd', 'health', 'patient', 'lab', 'pharmacy', 'dental'],
    banking: ['bank', 'finance', 'loan', 'account', 'deposit', 'withdrawal', 'atm', 'credit', 'mortgage'],
    government: ['government', 'passport', 'license', 'tax', 'civic', 'municipal', 'registration', 'visa', 'court'],
    retail: ['retail', 'shop', 'store', 'billing', 'purchase', 'returns', 'exchange', 'customer service'],
    education: ['education', 'school', 'university', 'admission', 'student', 'exam', 'enrollment', 'academic'],
    telecom: ['telecom', 'phone', 'internet', 'sim', 'network', 'broadband', 'mobile', 'cable'],
    hospitality: ['hotel', 'restaurant', 'resort', 'check-in', 'reservation', 'booking', 'guest'],
  };

  for (const [category, words] of Object.entries(keywords)) {
    if (words.some(w => text.includes(w))) {
      const tier = CAPACITY_TIERS[category];
      return {
        category,
        suggestedCapacity: tier.capacity,
        suggestedPrefix: PREFIX_SUGGESTIONS[category][0],
        reasoning: `Detected keywords matching ${category} category`,
        prefixOptions: PREFIX_SUGGESTIONS[category],
        capacityReasoning: tier.reasoning,
      };
    }
  }

  return {
    category: 'other',
    suggestedCapacity: 20,
    suggestedPrefix: 'SVC',
    reasoning: 'No specific category detected — classified as general service',
    prefixOptions: PREFIX_SUGGESTIONS.other,
    capacityReasoning: CAPACITY_TIERS.other.reasoning,
  };
};

module.exports = { classifyService };
