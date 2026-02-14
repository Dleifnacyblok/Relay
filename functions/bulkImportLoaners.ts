const BATCH_SIZE = 50;
const INITIAL_RETRY_DELAY = 1000;
const MAX_RETRIES = 5;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const retryWithBackoff = async (fn, retries = MAX_RETRIES) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw error;
      
      const isRateLimit = error.message?.includes('rate') || error.message?.includes('quota');
      if (!isRateLimit) throw error;
      
      const delayMs = INITIAL_RETRY_DELAY * Math.pow(2, i);
      console.log(`Retry ${i + 1}/${retries} after ${delayMs}ms due to rate limit`);
      await delay(delayMs);
    }
  }
};

export default async function bulkImportLoaners(req, res) {
  const { data } = req.body;
  
  if (!Array.isArray(data) || data.length === 0) {
    return res.status(400).json({ error: 'No data provided' });
  }

  try {
    // Direct bulk insert - no preprocessing, no transformation
    for (let i = 0; i < data.length; i += BATCH_SIZE) {
      const batch = data.slice(i, i + BATCH_SIZE);
      await retryWithBackoff(() =>
        base44.asServiceRole.entities.Loaners.bulkCreate(batch)
      );
      // Add delay between batches
      if (i + BATCH_SIZE < data.length) {
        await delay(500);
      }
    }

    return res.json({
      success: true,
      recordCount: data.length,
      created: data.length
    });
  } catch (error) {
    console.error('Bulk import error:', error);
    const isRateLimit = error.message?.includes('rate') || error.message?.includes('quota');
    return res.status(isRateLimit ? 429 : 500).json({ 
      error: error.message,
      retryAfter: isRateLimit ? 30 : undefined
    });
  }
}