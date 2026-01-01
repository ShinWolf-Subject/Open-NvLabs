import axios from 'axios';

export default {
  name: "NGL Anonymous Message Sender",
  description: "Send anonymous messages via NGL.LINK",
  category: "Social",
  methods: ["POST"],
  params: ["username", "message", "question"],
  paramsSchema: {
    username: { type: "string", required: true },
    message: { type: "string", required: true },
    question: { type: "string", required: false }
  },

  async run(req, res) {
    try {
      let { username, message, question } = req.body;
      
      // ⬇️ Clean and validate input
      username = (username || '').trim().toLowerCase();
      message = (message || '').trim();
      question = (question || message).trim(); // Default question is the message itself
      
      // ⬇️ Validate required parameters
      if (!username) {
        return res.status(400).json({
          success: false,
          error: 'Parameter "username" is required'
        });
      }
      
      if (!message) {
        return res.status(400).json({
          success: false,
          error: 'Parameter "message" is required'
        });
      }
      
      // ⬇️ Remove @ symbol if present
      username = username.replace('@', '');
      
      // ⬇️ NGL API endpoint (official API)
      const nglUrl = `https://ngl.link/api/submit`;
      
      // ⬇️ Prepare data according to NGL's expected format
      // Based on actual NGL API requests observed
      const postData = new URLSearchParams();
      postData.append('username', username);
      postData.append('question', question);
      postData.append('deviceId', '');
      postData.append('gameSlug', '');
      postData.append('referrer', '');
      
      // ⬇️ Headers that match what NGL expects
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Origin': 'https://ngl.link',
        'Referer': `https://ngl.link/${username}`,
        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'Dnt': '1',
        'Priority': 'u=1, i'
      };
      
      // ⬇️ First, verify the user exists by checking their profile
      try {
        const profileCheck = await axios.get(`https://ngl.link/${username}`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          timeout: 5000,
          validateStatus: () => true // Don't throw on 404
        });
        
        if (profileCheck.status === 404) {
          return res.status(400).json({
            success: false,
            error: `User "${username}" not found on NGL.LINK`,
            suggestion: 'Check the username and make sure it exists on ngl.link'
          });
        }
      } catch (profileError) {
        // Continue even if profile check fails
        console.log('Profile check failed:', profileError.message);
      }
      
      // ⬇️ Send message to NGL
      const submitResponse = await axios.post(nglUrl, postData.toString(), {
        headers: headers,
        timeout: 10000,
        validateStatus: () => true // Don't throw on error status codes
      });
      
      // ⬇️ Analyze response
      console.log('NGL Response Status:', submitResponse.status);
      console.log('NGL Response Data:', submitResponse.data);
      
      let success = false;
      let resultMessage = '';
      
      // ⬇️ Check response based on observed NGL behavior
      if (submitResponse.status === 200) {
        const responseText = String(submitResponse.data || '').toLowerCase();
        
        if (responseText.includes('sent') || 
            responseText.includes('success') || 
            responseText.includes('thank') ||
            responseText.includes('submitted') ||
            responseText.trim() === '') {
          success = true;
          resultMessage = 'Message sent successfully to NGL';
        } else if (responseText.includes('rate limit') || responseText.includes('too many')) {
          resultMessage = 'Rate limit exceeded. Please wait before sending more messages.';
        } else if (responseText.includes('invalid') || responseText.includes('not found')) {
          resultMessage = 'Invalid username or user not found';
        } else {
          // If we get 200 but unclear response, assume success
          success = true;
          resultMessage = 'Message submitted (response ambiguous)';
        }
      } else if (submitResponse.status === 429) {
        resultMessage = 'Rate limit exceeded. Too many requests.';
      } else if (submitResponse.status === 404) {
        resultMessage = 'User not found or NGL API endpoint changed';
      } else {
        resultMessage = `NGL returned status ${submitResponse.status}`;
      }
      
      // ⬇️ Prepare response
      if (success) {
        res.json({
          success: true,
          message: resultMessage,
          data: {
            username: username,
            question: question,
            message: message,
            response: submitResponse.data,
            timestamp: new Date().toISOString()
          },
          note: 'Messages on NGL may take a moment to appear'
        });
      } else {
        res.status(400).json({
          success: false,
          error: resultMessage,
          details: {
            username: username,
            status_code: submitResponse.status,
            response: submitResponse.data,
            timestamp: new Date().toISOString()
          },
          suggestion: [
            'Make sure the username exists on ngl.link',
            'Try without @ symbol in username',
            'Wait a few minutes if you hit rate limit',
            'Message might be too long (try shorter message)'
          ]
        });
      }

    } catch (error) {
      console.error("NGL Sender Error:", error.message);
      console.error("Error Stack:", error.stack);
      
      // ⬇️ Extract more details from error
      let errorMessage = error.message;
      let statusCode = 500;
      let details = {};
      
      if (error.response) {
        statusCode = error.response.status;
        errorMessage = `NGL API responded with ${statusCode}`;
        details = {
          status: error.response.status,
          headers: error.response.headers,
          data: error.response.data
        };
      } else if (error.code === 'ECONNREFUSED') {
        errorMessage = "Cannot connect to NGL servers";
        statusCode = 503;
      } else if (error.code === 'ETIMEDOUT') {
        errorMessage = "Connection to NGL timed out";
        statusCode = 504;
      } else if (error.code === 'ENOTFOUND') {
        errorMessage = "NGL servers not found";
        statusCode = 503;
      }
      
      res.status(statusCode).json({
        success: false,
        error: errorMessage,
        details: details,
        timestamp: new Date().toISOString(),
        troubleshooting: [
          'Check if ngl.link is accessible from your location',
          'Verify the username exists at https://ngl.link/username',
          'Try a different username for testing',
          'The NGL API might have changed'
        ]
      });
    }
  }
};
