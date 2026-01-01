import axios from 'axios';

export default {
  name: "URL Shortener",
  description: "Shorten URLs with custom metadata using NVSURL service",
  category: "Tools",
  methods: ["GET", "POST"],
  params: ["destUrl", "slug", "title", "desc"],
  paramsSchema: {
    destUrl: {
      type: "string",
      required: true,
      description: "Destination URL to shorten"
    },
    slug: {
      type: "string",
      required: false,
      description: "Custom slug for shortened URL (optional)"
    },
    title: {
      type: "string",
      required: false,
      description: "Title for the shortened link (optional)"
    },
    desc: {
      type: "string",
      required: false,
      description: "Description for the shortened link (optional)"
    }
  },

  /**
   * Main handler for URL shortening endpoint
   * @param {Object} req - HTTP request object
   * @param {Object} res - HTTP response object
   */
  async run(req, res) {
    try {
      const { destUrl, slug, title, desc } = this._extractRequestData(req);
      this._validateUrl(destUrl);
      this._validateOptionalFields({ slug, title, desc });
      
      const response = await this._shortenUrl(destUrl, slug, title, desc);
      return this._formatSuccessResponse(res, response.data, destUrl, slug, title, desc);
      
    } catch (error) {
      return this._handleError(res, error);
    }
  },

  /**
   * Extract request data based on HTTP method
   * @private
   * @param {Object} req - HTTP request object
   * @returns {Object} - Extracted parameters
   */
  _extractRequestData(req) {
    if (req.method === 'POST') {
      return {
        destUrl: req.body.destUrl || req.body.originalUrl || req.body.url,
        slug: req.body.slug || req.body.customSlug,
        title: req.body.title || req.body.descTitle,
        desc: req.body.desc || req.body.description || req.body.descText
      };
    } else {
      return {
        destUrl: req.query.destUrl || req.query.url,
        slug: req.query.slug,
        title: req.query.title,
        desc: req.query.desc
      };
    }
  },

  /**
   * Validate URL format
   * @private
   * @param {string} url - URL to validate
   */
  _validateUrl(url) {
    if (!url || typeof url !== 'string') {
      throw {
        status: 400,
        message: "URL is required",
        error: "Please provide a valid URL to shorten"
      };
    }

    try {
      const urlObj = new URL(url);
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        throw new Error('Invalid protocol');
      }
    } catch (error) {
      throw {
        status: 400,
        message: "Invalid URL format",
        error: "URL must start with http:// or https://",
        example: "https://example.com/path"
      };
    }

    if (url.length > 2048) {
      throw {
        status: 400,
        message: "URL too long",
        error: "Maximum URL length is 2048 characters",
        current_length: url.length
      };
    }
  },

  /**
   * Validate optional fields
   * @private
   * @param {Object} fields - Optional fields to validate
   */
  _validateOptionalFields(fields) {
    const { slug, title, desc } = fields;
    
    if (slug && (slug.length < 3 || slug.length > 50)) {
      throw {
        status: 400,
        message: "Invalid slug length",
        error: "Slug must be between 3 and 50 characters",
        min_length: 3,
        max_length: 50
      };
    }

    if (slug && !/^[a-zA-Z0-9_-]+$/.test(slug)) {
      throw {
        status: 400,
        message: "Invalid slug characters",
        error: "Slug can only contain letters, numbers, hyphens and underscores",
        allowed_chars: "a-z, A-Z, 0-9, -, _"
      };
    }

    if (title && title.length > 200) {
      throw {
        status: 400,
        message: "Title too long",
        error: "Maximum title length is 200 characters",
        current_length: title.length,
        max_length: 200
      };
    }

    if (desc && desc.length > 500) {
      throw {
        status: 400,
        message: "Description too long",
        error: "Maximum description length is 500 characters",
        current_length: desc.length,
        max_length: 500
      };
    }
  },

  /**
   * Shorten URL using NVSURL service with metadata
   * @private
   * @param {string} originalUrl - URL to shorten
   * @param {string} [customSlug] - Custom slug (optional)
   * @param {string} [title] - Link title (optional)
   * @param {string} [description] - Link description (optional)
   * @returns {Promise<Object>} - API response
   */
  async _shortenUrl(originalUrl, customSlug = null, title = null, description = null) {
    const payload = { originalUrl };
    
    if (customSlug) {
      payload.customSlug = customSlug;
    }
    
    if (title) {
      payload.title = title;
    }
    
    if (description) {
      payload.description = description;
    }

    const response = await axios.post('https://nvsu.vercel.app/shorten', payload, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'URL-Shortener-API/1.0'
      },
      timeout: 10000
    });

    return response;
  },

  /**
   * Format successful response
   * @private
   * @param {Object} res - HTTP response object
   * @param {Object} data - Response data from API
   * @param {string} originalUrl - Original URL
   * @param {string} [customSlug] - Custom slug used
   * @param {string} [title] - Title used
   * @param {string} [description] - Description used
   */
  _formatSuccessResponse(res, data, originalUrl, customSlug, title, description) {
    const result = {
      success: true,
      message: data.message || "URL shortened successfully",
      data: {
        original_url: originalUrl,
        shortened_url: data.data?.shortUrl,
        slug: data.data?.slug,
        metadata_provided: {
          custom_slug: Boolean(customSlug),
          custom_title: Boolean(title),
          custom_description: Boolean(description)
        },
        stats_url: `https://nvsu.vercel.app/stats/${data.data?.slug}`,
        delete_url: `https://nvsu.vercel.app/delete.html?slug=${data.data?.slug}`,
        qr_code_url: `https://ninetwelvers.my.id/nv/canvas/qrgen?text=${encodeURIComponent(data.data?.shortUrl)}&margin=1&size=400&format=png&color=%23000000&bgcolor=%23FFFFFF&ecl=H`
      },
      metadata: {
        title: data.data?.title,
        description: data.data?.description,
        clicks: data.data?.clicks || 0,
        is_active: data.data?.isActive || true,
        created_at: data.data?.createdAt,
        updated_at: data.data?.updatedAt
      },
      timestamp: new Date().toISOString()
    };

    // Add additional info if available
    if (data.data?.metadata) {
      result.metadata.creation_info = {
        ip: data.data.metadata.ip,
        user_agent: data.data.metadata.userAgent,
        created_via: data.data.metadata.createdVia
      };
    }

    // Add input parameters summary
    result.input_summary = {
      original_url_length: originalUrl.length,
      slug_provided: Boolean(customSlug),
      title_provided: Boolean(title),
      description_provided: Boolean(description),
      total_characters: originalUrl.length + (title?.length || 0) + (description?.length || 0)
    };

    res.json(result);
  },

  /**
   * Handle errors and format error response
   * @private
   * @param {Object} res - HTTP response object
   * @param {Error|Object} error - Error object
   */
  _handleError(res, error) {
    // Handle validation errors
    if (error.status === 400) {
      const errorResponse = {
        success: false,
        message: error.message,
        error: error.error,
        timestamp: new Date().toISOString()
      };

      // Add validation-specific details
      if (error.example) errorResponse.example = error.example;
      if (error.current_length) errorResponse.current_length = error.current_length;
      if (error.min_length) errorResponse.min_length = error.min_length;
      if (error.max_length) errorResponse.max_length = error.max_length;
      if (error.allowed_chars) errorResponse.allowed_chars = error.allowed_chars;

      return res.status(400).json(errorResponse);
    }

    const { statusCode, userMessage, tips } = this._classifyError(error);
    
    const errorResponse = {
      success: false,
      message: userMessage,
      error: error.message || "Unknown error",
      timestamp: new Date().toISOString(),
      tips: tips.length > 0 ? tips : ["Try again later", "Check your input"]
    };

    // Add API-specific error info if available
    if (error.response?.data) {
      errorResponse.api_error = error.response.data;
      
      // Include helpful info for common errors
      if (error.response.data.error?.includes('slug')) {
        errorResponse.suggestion = "Try a different slug or leave it empty for auto-generation";
      }
    }

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
    let userMessage = "An error occurred while shortening URL";
    let tips = [];

    if (error.code === 'ECONNABORTED') {
      statusCode = 408;
      userMessage = "URL shortening service timeout";
      tips = ["Try again in a few seconds", "Service might be busy"];
    }
    else if (error.response) {
      statusCode = error.response.status;
      
      switch (statusCode) {
        case 400:
          userMessage = "Invalid request to shortening service";
          tips = ["Check URL format", "Verify metadata fields"];
          break;
        case 403:
          userMessage = "Access denied to shortening service";
          tips = ["Service may be blocking requests", "Try using a VPN"];
          break;
        case 409:
          userMessage = "Custom slug already exists";
          tips = ["Choose a different slug", "Leave slug empty for auto-generation"];
          break;
        case 413:
          userMessage = "Request payload too large";
          tips = ["Reduce title/description length", "URL might be too long"];
          break;
        case 429:
          userMessage = "Too many requests to shortening service";
          tips = ["Wait a few minutes", "Reduce request frequency"];
          break;
        case 404:
          userMessage = "Shortening service endpoint not found";
          tips = ["Service URL may have changed", "Check service status"];
          break;
      }
    }
    else if (error.request) {
      statusCode = 502;
      userMessage = "Cannot connect to URL shortening service";
      tips = ["Check internet connection", "Service might be down"];
    }

    return { statusCode, userMessage, tips };
  }
};
