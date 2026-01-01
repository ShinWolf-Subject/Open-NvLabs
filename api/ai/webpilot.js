import axios from 'axios';

export default {
  name: "Webpilot AI Real-time",
  description: "AI assistant with real-time internet search capabilities",
  category: "AI",
  methods: ["GET", "POST"],
  params: ["q"],
  paramsSchema: {
    q: { type: "string", required: true }
  },

  async run(req, res) {
    try {
      let query = '';
      
      // ⬇️ Handle both GET and POST methods
      if (req.method === 'GET') {
        query = req.query.q || '';
      } else if (req.method === 'POST') {
        if (req.headers['content-type']?.includes('application/json')) {
          query = req.body.q || '';
        } else {
          query = req.body?.q || '';
        }
      }
      
      // ⬇️ Clean and validate input
      const prompt = query.trim();
      
      if (!prompt || prompt === "") {
        return res.status(400).json({
          success: false,
          error: 'Parameter "q" (query) is required'
        });
      }
      
      if (prompt.length < 2) {
        return res.status(400).json({
          success: false,
          error: 'Query must be at least 2 characters long'
        });
      }
      
      if (prompt.length > 2000) {
        return res.status(400).json({
          success: false,
          error: 'Query too long (max 2000 characters)'
        });
      }
      
      // ⬇️ Prepare headers for Webpilot API
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        'Accept': 'application/json, text/plain, */*, text/event-stream',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Content-Type': 'application/json',
        'Authorization': 'Bearer null',
        'Origin': 'https://www.webpilot.ai',
        'Referer': 'https://www.webpilot.ai/',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'cross-site',
        'Priority': 'u=1, i',
        'Dnt': '1'
      };
      
      // ⬇️ Request to Webpilot AI API
      const response = await axios.post(
        'https://api.webpilotai.com/rupee/v1/search',
        { 
          q: prompt, 
          threadId: '',
          timestamp: Date.now()
        },
        {
          headers: headers,
          responseType: 'stream',
          timeout: 60000, // 60 seconds timeout for streaming
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        }
      );
      
      // ⬇️ Process streaming response
      let aiText = '';
      let sources = [];
      
      return await new Promise((resolve, reject) => {
        const stream = response.data;
        let buffer = '';
        
        stream.on('data', (chunk) => {
          buffer += chunk.toString();
          
          // Process complete lines
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer
          
          for (const line of lines) {
            if (line.startsWith('data:')) {
              try {
                const dataStr = line.slice(5).trim();
                if (!dataStr) continue;
                
                const jsonData = JSON.parse(dataStr);
                
                // Extract AI response text
                if (jsonData.type === 'data' && 
                    jsonData.data && 
                    jsonData.data.content && 
                    !jsonData.data.section_id) {
                  aiText += jsonData.data.content;
                }
                
                // Extract sources when internet is used
                if (jsonData.action === 'using_internet' && jsonData.data) {
                  if (Array.isArray(jsonData.data)) {
                    sources.push(...jsonData.data);
                  } else {
                    sources.push(jsonData.data);
                  }
                }
                
                // Extract sources from other possible fields
                if (jsonData.data?.sources && Array.isArray(jsonData.data.sources)) {
                  sources.push(...jsonData.data.sources);
                }
                
              } catch (parseError) {
                // Ignore parse errors for malformed JSON
                console.log('Parse error in SSE:', parseError.message);
              }
            }
          }
        });
        
        stream.on('end', () => {
          // Process any remaining buffer
          if (buffer.startsWith('data:')) {
            try {
              const dataStr = buffer.slice(5).trim();
              if (dataStr) {
                const jsonData = JSON.parse(dataStr);
                if (jsonData.type === 'data' && jsonData.data?.content) {
                  aiText += jsonData.data.content;
                }
              }
            } catch (e) {
              // Ignore
            }
          }
          
          // Clean up text
          aiText = aiText.trim();
          
          // Clean up sources (remove duplicates)
          const uniqueSources = [];
          const seenUrls = new Set();
          
          for (const source of sources) {
            const url = source.link || source.url;
            const title = source.title || 'No title';
            
            if (url && !seenUrls.has(url)) {
              seenUrls.add(url);
              uniqueSources.push({
                url: url,
                title: title,
                domain: new URL(url).hostname.replace('www.', '')
              });
            }
          }
          
          // Format response
          if (!aiText && uniqueSources.length === 0) {
            return resolve(res.status(500).json({
              success: false,
              error: 'No response received from Webpilot AI',
              timestamp: new Date().toISOString()
            }));
          }
          
          resolve(res.json({
            success: true,
            method: req.method,
            query: prompt,
            response: aiText || 'No AI response generated',
            sources: uniqueSources,
            metadata: {
              response_length: aiText.length,
              source_count: uniqueSources.length,
              has_sources: uniqueSources.length > 0,
              real_time_search: true,
              ai_model: 'Webpilot AI',
              timestamp: new Date().toISOString()
            },
            note: 'Responses are generated with real-time internet search. Sources may not always be available.'
          }));
        });
        
        stream.on('error', (error) => {
          console.error('Stream error:', error.message);
          reject(error);
        });
      });

    } catch (error) {
      console.error("Webpilot AI Error:", error.message);
      
      // ⬇️ Handle specific error cases
      let errorMessage = error.message;
      let statusCode = 500;
      let details = {};
      
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        errorMessage = "Cannot connect to Webpilot AI service";
        statusCode = 503;
      } else if (error.code === 'ETIMEDOUT') {
        errorMessage = "Connection to Webpilot AI timed out";
        statusCode = 504;
      } else if (error.response) {
        statusCode = error.response.status;
        errorMessage = `Webpilot AI responded with status ${statusCode}`;
        
        if (statusCode === 429) {
          errorMessage = 'Rate limit exceeded. Too many requests to Webpilot AI.';
        } else if (statusCode === 401) {
          errorMessage = 'Authentication error with Webpilot API';
        }
        
        details = {
          status: error.response.status,
          headers: error.response.headers,
          data: error.response.data ? String(error.response.data).substring(0, 200) : null
        };
      }
      
      res.status(statusCode).json({
        success: false,
        method: req.method,
        error: errorMessage,
        details: Object.keys(details).length > 0 ? details : undefined,
        query: req.method === 'GET' ? req.query.q : req.body?.q,
        timestamp: new Date().toISOString(),
        troubleshooting: [
          'Try again in a few minutes',
          'Check if webpilot.ai is accessible',
          'Your query might be too complex',
          'The API might be temporarily unavailable'
        ],
        alternative: 'Try simplifying your query or breaking it into smaller questions'
      });
    }
  }
};
