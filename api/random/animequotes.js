import axios from 'axios';

export default {
  name: "Anime Quotes",
  description: "Get random anime quotes",
  category: "Random",
  methods: ["GET"],
  params: [],
  paramsSchema: {},

  /**
   * Main handler for Anime Quotes endpoint
   * @param {Object} req - HTTP request object
   * @param {Object} res - HTTP response object
   */
  async run(req, res) {
    try {
      const quotes = await this._fetchRandomQuotes();
      return this._formatSuccessResponse(res, quotes);
      
    } catch (error) {
      return this._handleError(res, error);
    }
  },

  /**
   * Fetch random anime quotes from Katanime API
   * @private
   * @returns {Promise<Array>} - Array of anime quotes
   */
  async _fetchRandomQuotes() {
    const response = await axios.get(
      "https://katanime.vercel.app/api/getrandom",
      {
        timeout: 15000,
        headers: {
          'User-Agent': 'NvLabs/1.0',
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      }
    );

    if (!response.data || !response.data.sukses) {
      throw new Error('Invalid response from anime quotes API');
    }

    return response.data.result || [];
  },

  /**
   * Format successful response
   * @private
   * @param {Object} res - HTTP response object
   * @param {Array} quotes - Array of anime quotes
   */
  _formatSuccessResponse(res, quotes) {
    const responseData = {
      success: true,
      message: `Successfully retrieved ${quotes.length} random anime quotes`,
      data: {
        quotes: quotes.map((quote, index) => ({
          index: index + 1,
          id: quote.id,
          english: quote.english,
          indonesian: quote.indo,
          character: quote.character,
          anime: quote.anime,
          metadata: {
            has_english: Boolean(quote.english),
            has_indonesian: Boolean(quote.indo),
            character_length: quote.character?.length || 0,
            anime_length: quote.anime?.length || 0
          }
        })),
        summary: {
          total_quotes: quotes.length,
          total_characters: quotes.reduce((sum, q) => sum + (q.character ? 1 : 0), 0),
          total_animes: [...new Set(quotes.map(q => q.anime).filter(Boolean))].length,
          languages: {
            english: quotes.filter(q => q.english).length,
            indonesian: quotes.filter(q => q.indo).length
          }
        }
      },
    };

    res.json(responseData);
  },

  /**
   * Handle errors and format error response
   * @private
   * @param {Object} res - HTTP response object
   * @param {Error|Object} error - Error object
   */
  _handleError(res, error) {
    const { statusCode, userMessage, tips } = this._classifyError(error);
    
    const errorResponse = {
      success: false,
      message: userMessage,
      error: error.message || "Unknown error",
      timestamp: new Date().toISOString(),
      tips: tips.length > 0 ? tips : ["Try again later", "Check your connection"]
    };

    res.status(statusCode).json(errorResponse);
  },

  /**
   * Classify error type and provide appropriate messages
   * @private
   * @param {Error|Object} error - Error object
   * @returns {Object} - Error classification
   */
  _classifyError(error) {
    let statusCode = 500;
    let userMessage = "An error occurred while fetching anime quotes";
    let tips = [];

    if (error.code === 'ECONNABORTED') {
      statusCode = 408;
      userMessage = "Anime quotes service timeout";
      tips = ["Try again in a few seconds", "Service might be busy"];
    }
    else if (error.response) {
      statusCode = error.response.status;
      
      switch (statusCode) {
        case 404:
          userMessage = "Anime quotes API endpoint not found";
          tips = ["Service URL may have changed", "Check service status"];
          break;
        case 429:
          userMessage = "Too many requests to anime quotes API";
          tips = ["Wait a few minutes", "Reduce request frequency"];
          break;
        case 502:
        case 503:
          userMessage = "Anime quotes service temporarily unavailable";
          tips = ["Service might be down for maintenance", "Try again later"];
          break;
      }
    }
    else if (error.message.includes('Invalid response')) {
      statusCode = 502;
      userMessage = "Invalid response from anime quotes API";
      tips = ["API format may have changed", "Try again later"];
    }
    else if (error.request) {
      statusCode = 502;
      userMessage = "Cannot connect to anime quotes service";
      tips = ["Check internet connection", "Service might be down"];
    }

    return { statusCode, userMessage, tips };
  }
};
