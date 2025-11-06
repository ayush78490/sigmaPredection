require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

// Use native fetch for Node.js 18+, otherwise use node-fetch
let fetch;
if (parseInt(process.versions.node.split('.')[0]) < 18) {
  fetch = require('node-fetch');
} else {
  fetch = globalThis.fetch;
}

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PPLX_API_KEY = process.env.PERPLEXITY_API_KEY;

// Enhanced validation with better error handling and fallbacks
async function validateWithPerplexity({ question, endTime, initialYes, initialNo }) {
  try {
    console.log('🤖 Starting AI validation for question:', question);
    
    // Enhanced prompt for better validation
    const systemPrompt = `You are a prediction market validator. Analyze if a question is suitable for a prediction market.

CRITERIA FOR VALID QUESTIONS:
✅ MUST be objectively verifiable with clear YES/NO outcome
✅ MUST have specific resolution criteria
✅ MUST be about future events
✅ MUST be based on publicly available information
✅ MUST be unambiguous and specific

CRITERIA FOR INVALID QUESTIONS:
❌ Subjective opinions ("Is this good?")
❌ Already resolved events
❌ Personal/private matters
❌ Impossible to verify
❌ Multiple questions combined
❌ Vague or ambiguous phrasing

Respond with JSON only: {valid: boolean, reason: string}`;

    const userPrompt = `Analyze this prediction market question: "${question}"

Resolution time: ${new Date(endTime * 1000).toISOString()}
Initial liquidity: YES ${initialYes} BNB, NO ${initialNo} BNB

Is this a valid prediction market question?`;

    console.log('📤 Calling Perplexity API...');
    
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PPLX_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3-sonar-large-32k-online',
        messages: [
          { 
            role: 'system', 
            content: systemPrompt 
          },
          { 
            role: 'user', 
            content: userPrompt 
          }
        ],
        max_tokens: 500,
        temperature: 0.1
      }),
      timeout: 30000 // 30 second timeout
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Perplexity API error:', response.status, errorText);
      throw new Error(`Perplexity API returned ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log('📥 Raw AI response:', JSON.stringify(data, null, 2));
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid response format from Perplexity API');
    }

    const aiText = data.choices[0].message.content;
    console.log('🤖 AI analysis text:', aiText);

    // Try to extract JSON from the response
    try {
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        console.log('✅ Parsed AI validation result:', result);
        return {
          valid: Boolean(result.valid),
          reason: result.reason || 'No reason provided by AI'
        };
      } else {
        // If no JSON found, analyze the text response
        console.log('⚠️ No JSON found in response, analyzing text...');
        return analyzeTextResponse(aiText, question);
      }
    } catch (parseError) {
      console.error('❌ JSON parse error:', parseError);
      return analyzeTextResponse(aiText, question);
    }

  } catch (error) {
    console.error('❌ Error in validateWithPerplexity:', error);
    // Fallback to basic validation
    return basicValidation(question, endTime, initialYes, initialNo);
  }
}

// Fallback text analysis when JSON parsing fails
function analyzeTextResponse(aiText, question) {
  const lowerText = aiText.toLowerCase();
  const lowerQuestion = question.toLowerCase();
  
  // Look for validation indicators in the text
  const positiveIndicators = [
    'valid', 'appropriate', 'suitable', 'good question', 'clear', 
    'well-defined', 'objective', 'verifiable'
  ];
  
  const negativeIndicators = [
    'invalid', 'not suitable', 'inappropriate', 'ambiguous', 
    'subjective', 'unclear', 'cannot be verified', 'vague'
  ];
  
  const positiveCount = positiveIndicators.filter(indicator => 
    lowerText.includes(indicator)
  ).length;
  
  const negativeCount = negativeIndicators.filter(indicator => 
    lowerText.includes(indicator)
  ).length;
  
  if (positiveCount > negativeCount) {
    return {
      valid: true,
      reason: 'AI analysis indicates this is a valid question'
    };
  } else if (negativeCount > positiveCount) {
    return {
      valid: false,
      reason: 'AI analysis indicates issues with this question'
    };
  } else {
    // If unclear, be conservative and reject
    return {
      valid: false,
      reason: 'Unable to determine validity from AI analysis'
    };
  }
}

// Basic validation as final fallback
function basicValidation(question, endTime, initialYes, initialNo) {
  console.log('🔄 Using basic validation fallback');
  
  const lowerQuestion = question.toLowerCase();
  
  // Basic checks
  if (!question.includes('?')) {
    return {
      valid: false,
      reason: 'Question must end with a question mark'
    };
  }
  
  if (question.length < 10) {
    return {
      valid: false,
      reason: 'Question must be at least 10 characters long'
    };
  }
  
  if (question.length > 280) {
    return {
      valid: false,
      reason: 'Question must be less than 280 characters'
    };
  }
  
  // Check for obvious invalid patterns
  const invalidPatterns = [
    /\b(opinion|think|believe|feel|probably|maybe)\b/i,
    /\b(subjective|arbitrary|pointless)\b/i,
    /\?.*\?/, // Multiple questions
    /\b(and|or)\b.*\?/ // Compound questions
  ];
  
  for (const pattern of invalidPatterns) {
    if (pattern.test(question)) {
      return {
        valid: false,
        reason: 'Question contains ambiguous or subjective language'
      };
    }
  }
  
  // If passes basic checks, be cautiously optimistic
  return {
    valid: true,
    reason: 'Passes basic validation checks'
  };
}

// Enhanced route handler with better parameter validation
app.post('/api/validate-market', async (req, res) => {
  try {
    console.log('📨 Validation request received:', req.body);
    
    const { question, endTime, initialYes, initialNo } = req.body;
    
    // Validate required parameters
    if (!question || typeof question !== 'string') {
      return res.status(400).json({ 
        valid: false, 
        reason: 'Valid question string is required' 
      });
    }
    
    if (!endTime || isNaN(parseInt(endTime))) {
      return res.status(400).json({
        valid: false,
        reason: 'Valid endTime timestamp is required'
      });
    }
    
    if (!initialYes || !initialNo) {
      return res.status(400).json({
        valid: false,
        reason: 'Both initialYes and initialNo amounts are required'
      });
    }
    
    // Convert and validate numeric parameters
    const endTimeNum = parseInt(endTime);
    const yesAmount = parseFloat(initialYes);
    const noAmount = parseFloat(initialNo);
    
    // Validate end time (must be at least 1 hour in future)
    const now = Math.floor(Date.now() / 1000);
    const oneHourFromNow = now + 3600;
    
    if (endTimeNum <= oneHourFromNow) {
      return res.status(400).json({
        valid: false,
        reason: 'End time must be at least 1 hour from now'
      });
    }
    
    // Validate liquidity amounts
    if (yesAmount <= 0 || noAmount <= 0) {
      return res.status(400).json({
        valid: false,
        reason: 'Both YES and NO liquidity must be greater than 0'
      });
    }
    
    const totalLiquidity = yesAmount + noAmount;
    if (totalLiquidity < 0.01) {
      return res.status(400).json({
        valid: false,
        reason: 'Total liquidity must be at least 0.01 BNB'
      });
    }
    
    console.log('✅ Parameter validation passed, calling AI...');
    
    // Call AI validation
    const validation = await validateWithPerplexity({
      question: question.trim(),
      endTime: endTimeNum,
      initialYes: initialYes.toString(),
      initialNo: initialNo.toString()
    });
    
    console.log('🎯 Final validation result:', validation);
    
    res.json(validation);

  } catch (error) {
    console.error('💥 Validation endpoint error:', error);
    res.status(500).json({ 
      valid: false, 
      reason: 'Internal server error during validation',
      error: error.message 
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    nodeVersion: process.version
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Perplexity market validation server running on port ${PORT}`);
  console.log(`📋 Health check available at http://localhost:${PORT}/health`);
  console.log(`🔍 Node.js version: ${process.version}`);
});