import axios from 'axios';

export default {
  name: "Twitter (X)",
  description: "Download videos from Twitter/X with multiple quality options",
  category: "Downloader",
  methods: ["GET", "POST"],
  params: ["url"],
  paramsSchema: {
    url: { type: "string", required: true }
  },

  async run(req, res) {
    try {
      let twitterUrl = '';
      
      // ⬇️ Handle both GET and POST methods
      if (req.method === 'GET') {
        twitterUrl = req.query.url || '';
      } else if (req.method === 'POST') {
        if (req.headers['content-type']?.includes('application/json')) {
          twitterUrl = req.body.url || '';
        } else {
          twitterUrl = req.body?.url || '';
        }
      }
      
      // ⬇️ Clean and validate input
      twitterUrl = (twitterUrl || '').trim();
      
      if (!twitterUrl) {
        return res.status(400).json({
          success: false,
          error: 'Twitter/X URL is required',
          example: 'https://x.com/sciencegirl/status/2000581746505433241'
        });
      }
      
      // ⬇️ Validate Twitter/X URL
      const urlPatterns = [
        /https?:\/\/(?:twitter\.com|x\.com)\/\w+\/status\/\d+/i,
        /https?:\/\/(?:twitter\.com|x\.com)\/i\/events\/\d+/i,
        /https?:\/\/(?:twitter\.com|x\.com)\/\w+\/status\/\d+\/video\/\d+/i,
        /https?:\/\/(?:twitter\.com|x\.com)\/\w+\/status\/\d+\/photo\/\d+/i
      ];
      
      const isValidUrl = urlPatterns.some(pattern => pattern.test(twitterUrl));
      if (!isValidUrl) {
        return res.status(400).json({
          success: false,
          error: 'Invalid Twitter/X URL',
          provided_url: twitterUrl,
          accepted_formats: [
            'https://twitter.com/username/status/1234567890',
            'https://x.com/username/status/1234567890',
            'https://twitter.com/username/status/1234567890/video/1',
            'https://x.com/i/events/1234567890'
          ]
        });
      }
      
      // ⬇️ Normalize URL (convert twitter.com to x.com jika perlu)
      let normalizedUrl = twitterUrl
        .replace('twitter.com', 'x.com')
        .replace(/\/photo\/\d+$/, ''); // Remove photo suffix
      
      // ⬇️ Extract tweet ID from URL
      const tweetIdMatch = normalizedUrl.match(/\/status\/(\d+)/) || normalizedUrl.match(/\/i\/events\/(\d+)/);
      const tweetId = tweetIdMatch ? tweetIdMatch[1] : null;
      
      if (!tweetId) {
        return res.status(400).json({
          success: false,
          error: 'Could not extract tweet ID from URL',
          url: normalizedUrl
        });
      }
      
      // ⬇️ Prepare request to savetwitter.net
      const requestBody = new URLSearchParams({
        q: normalizedUrl,
        lang: 'id',
        cftoken: ''
      }).toString();
      
      // ⬇️ Headers for savetwitter.net API
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Origin': 'https://savetwitter.net',
        'Referer': 'https://savetwitter.net/id',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'Priority': 'u=1, i',
        'Dnt': '1'
      };
      
      // ⬇️ Make request to savetwitter.net API
      console.log('Requesting video info for:', normalizedUrl);
      
      const response = await axios.post(
        'https://savetwitter.net/api/ajaxSearch',
        requestBody,
        {
          headers: headers,
          timeout: 30000,
          validateStatus: () => true // Don't throw on error status
        }
      );
      
      console.log('Response status:', response.status);
      
      // ⬇️ Check if response exists
      if (!response.data) {
        throw new Error('No response from Twitter download service');
      }
      
      const apiData = response.data;
      
      // ⬇️ Check API response structure
      if (apiData.error || apiData.message) {
        return res.status(200).json({
          success: false,
          error: apiData.message || apiData.error || 'API returned an error',
          url: normalizedUrl
        });
      }
      
      if (!apiData.data) {
        throw new Error('No video data found in response');
      }
      
      const htmlData = apiData.data;
      
      // ⬇️ Extract video information from HTML
      
      // Extract title
      const titleMatch = htmlData.match(/<h3[^>]*>(.*?)<\/h3>/i);
      const title = titleMatch ? this.cleanHtml(titleMatch[1]) : null;
      
      // Extract duration
      const durationMatch = htmlData.match(/<p[^>]*>(\d+:\d+)<\/p>/i) || 
                           htmlData.match(/<span[^>]*>(\d+:\d+)<\/span>/i);
      const duration = durationMatch ? durationMatch[1] : null;
      
      // Extract thumbnail
      const thumbnailMatch = htmlData.match(/<img[^>]*src="([^"]+)"[^>]*>/i);
      const thumbnail = thumbnailMatch ? thumbnailMatch[1] : null;
      
      // Extract MP4 video URLs with quality
      const mp4Matches = [];
      const mp4Regex = /href="(https:\/\/dl\.snapcdn\.app\/get\?token=[^"]+)".*?MP4\s*\(([^)]+)\)/gi;
      
      let match;
      while ((match = mp4Regex.exec(htmlData)) !== null) {
        mp4Matches.push({
          quality: match[2].trim(),
          url: match[1],
          size: this.extractFileSize(htmlData, match[2])
        });
      }
      
      // Extract other video formats
      const m3u8Matches = [];
      const m3u8Regex = /href="(https:\/\/dl\.snapcdn\.app\/get\?token=[^"]+)".*?M3U8/gi;
      
      while ((match = m3u8Regex.exec(htmlData)) !== null) {
        m3u8Matches.push({
          quality: 'm3u8',
          url: match[1],
          format: 'm3u8'
        });
      }
      
      // Extract GIF format
      const gifMatches = [];
      const gifRegex = /href="(https:\/\/dl\.snapcdn\.app\/get\?token=[^"]+)".*?GIF/gi;
      
      while ((match = gifRegex.exec(htmlData)) !== null) {
        gifMatches.push({
          quality: 'gif',
          url: match[1],
          format: 'gif'
        });
      }
      
      // Extract audio only
      const audioMatches = [];
      const audioRegex = /href="(https:\/\/dl\.snapcdn\.app\/get\?token=[^"]+)".*?Audio/gi;
      
      while ((match = audioRegex.exec(htmlData)) !== null) {
        audioMatches.push({
          quality: 'audio',
          url: match[1],
          format: 'mp3'
        });
      }
      
      // Extract all media
      const allMedia = [
        ...mp4Matches,
        ...m3u8Matches,
        ...gifMatches,
        ...audioMatches
      ];
      
      if (allMedia.length === 0) {
        // Check if it's an image tweet
        const imageMatches = htmlData.match(/<img[^>]*src="(https:\/\/pbs\.twimg\.com\/media\/[^"]+)"[^>]*>/gi);
        const images = imageMatches ? 
          imageMatches.map(img => {
            const srcMatch = img.match(/src="([^"]+)"/);
            return srcMatch ? srcMatch[1] : null;
          }).filter(Boolean) : [];
        
        if (images.length > 0) {
          return res.json({
            success: true,
            type: 'image',
            tweet_id: tweetId,
            url: normalizedUrl,
            title: title || 'Twitter Image',
            images: images,
            metadata: {
              source: 'savetwitter.net',
              timestamp: new Date().toISOString(),
              note: 'This tweet contains images, not video'
            }
          });
        }
        
        return res.status(404).json({
          success: false,
          error: 'No downloadable media found in this tweet',
          url: normalizedUrl,
          tweet_id: tweetId,
          suggestion: [
            'Make sure the tweet contains a video',
            'The tweet might be private or deleted',
            'Try a different Twitter download service'
          ]
        });
      }
      
      // Sort MP4 videos by quality (highest first)
      const sortedMp4 = mp4Matches.sort((a, b) => {
        const getQualityNum = (quality) => {
          const match = quality.match(/(\d+)/);
          return match ? parseInt(match[1]) : 0;
        };
        return getQualityNum(b.quality) - getQualityNum(a.quality);
      });
      
      // Get best quality video
      const bestQuality = sortedMp4.length > 0 ? sortedMp4[0] : null;
      
      // ✅ Success Response
      res.json({
        success: true,
        type: 'video',
        tweet_id: tweetId,
        url: normalizedUrl,
        info: {
          title: title,
          duration: duration,
          thumbnail: thumbnail,
          tweet_url: `https://x.com/i/status/${tweetId}`
        },
        downloads: {
          // Best quality for immediate use
          best_quality: bestQuality ? {
            url: bestQuality.url,
            quality: bestQuality.quality,
            size: bestQuality.size
          } : null,
          
          // All MP4 qualities
          mp4: sortedMp4,
          
          // Other formats
          other_formats: {
            m3u8: m3u8Matches,
            gif: gifMatches,
            audio: audioMatches
          },
          
          // All media combined
          all: allMedia
        },
        metadata: {
          source: 'savetwitter.net',
          fetched_at: new Date().toISOString(),
          formats_available: {
            mp4: sortedMp4.length,
            m3u8: m3u8Matches.length,
            gif: gifMatches.length,
            audio: audioMatches.length
          },
          note: [
            'Download links expire after some time',
            'For MP4 videos, choose the highest quality available',
            'Some tweets may have multiple videos (threads)'
          ]
        },
        quick_download: bestQuality ? bestQuality.url : null
      });

    } catch (error) {
      console.error("Twitter Downloader Error:", error.message);
      
      // ⬇️ Handle specific error cases
      let errorMessage = error.message;
      let statusCode = 500;
      
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        errorMessage = "Cannot connect to Twitter download service";
        statusCode = 503;
      } else if (error.code === 'ETIMEDOUT') {
        errorMessage = "Connection to download service timed out";
        statusCode = 504;
      } else if (error.response) {
        statusCode = error.response.status;
        errorMessage = `Download service responded with status ${statusCode}`;
        
        if (statusCode === 429) {
          errorMessage = 'Rate limit exceeded. Too many requests.';
        } else if (statusCode === 403) {
          errorMessage = 'Access denied by download service';
        }
      }
      
      res.status(statusCode).json({
        success: false,
        error: errorMessage,
        url: req.method === 'GET' ? req.query.url : req.body?.url,
        timestamp: new Date().toISOString(),
        troubleshooting: [
          'Check if the tweet is still available',
          'Try a different Twitter/X URL',
          'The tweet might be private or age-restricted',
          'Try again in a few minutes'
        ],
        alternative_services: [
          'https://twdown.net/',
          'https://ssstwitter.com/',
          'https://twittervideodownloader.com/'
        ]
      });
    }
  },

  // ⬇️ Helper method to clean HTML
  cleanHtml(text) {
    if (!text) return '';
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/<[^>]*>/g, '')
      .trim();
  },

  // ⬇️ Helper method to extract file size from HTML
  extractFileSize(html, quality) {
    try {
      // Look for size information near the quality text
      const regex = new RegExp(`${quality}[^<]*\\((\\d+(?:\\.\\d+)?\\s*(?:MB|KB|GB))\\)`, 'i');
      const match = html.match(regex);
      return match ? match[1] : null;
    } catch (e) {
      return null;
    }
  }
};
