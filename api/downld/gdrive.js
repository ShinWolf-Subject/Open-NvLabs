import axios from 'axios';

export default {
  name: "Google Drive",
  description: "Convert Google Drive share links to direct download URLs",
  category: "Downloader",
  methods: ["GET"],
  params: ["url"],
  paramsSchema: {
    url: { type: "string", required: true }
  },

  async run(req, res) {
    try {
      const { url } = req.query;
      
      // ⬇️ Validate input
      if (!url || url.trim() === "") {
        return res.status(400).json({
          success: false,
          error: 'Parameter "url" is required',
          example: '/api/dlr/gdrive?url=https://drive.google.com/file/d/1ABC123xyz/view'
        });
      }
      
      const driveUrl = url.trim();
      
      // ⬇️ Extract file ID from various Google Drive URL formats
      let fileId = null;
      
      // Format 1: https://drive.google.com/file/d/FILE_ID/view
      const pattern1 = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/;
      const match1 = driveUrl.match(pattern1);
      if (match1) {
        fileId = match1[1];
      }
      
      // Format 2: https://drive.google.com/open?id=FILE_ID
      if (!fileId) {
        const pattern2 = /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/;
        const match2 = driveUrl.match(pattern2);
        if (match2) {
          fileId = match2[1];
        }
      }
      
      // Format 3: https://docs.google.com/document/d/FILE_ID/edit
      if (!fileId) {
        const pattern3 = /docs\.google\.com\/(?:document|spreadsheets|presentation)\/d\/([a-zA-Z0-9_-]+)/;
        const match3 = driveUrl.match(pattern3);
        if (match3) {
          fileId = match3[1];
        }
      }
      
      // Format 4: Just the file ID itself
      if (!fileId && /^[a-zA-Z0-9_-]{25,}$/.test(driveUrl)) {
        fileId = driveUrl;
      }
      
      // ⬇️ Validate file ID
      if (!fileId) {
        return res.status(400).json({
          success: false,
          error: 'Invalid Google Drive URL format',
          provided_url: driveUrl,
          accepted_formats: [
            'https://drive.google.com/file/d/FILE_ID/view',
            'https://drive.google.com/open?id=FILE_ID',
            'https://docs.google.com/document/d/FILE_ID/edit',
            'https://drive.google.com/uc?id=FILE_ID'
          ]
        });
      }
      
      if (!/^[a-zA-Z0-9_-]{25,}$/.test(fileId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid Google Drive file ID format',
          file_id: fileId,
          expected_format: '25+ characters alphanumeric with dash/underscore'
        });
      }
      
      // ⬇️ Generate direct download URLs
      const directUrls = {
        // Primary direct download URLs (skip preview)
        uc_download: `https://drive.google.com/uc?id=${fileId}&export=download`,
        uc_export: `https://drive.google.com/uc?export=download&id=${fileId}`,
        
        // Alternative formats
        usercontent: `https://drive.usercontent.google.com/uc?id=${fileId}&export=download`,
        docs_export: `https://docs.google.com/uc?id=${fileId}&export=download`,
        
        // API endpoints (for checking)
        drive_api: `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        
        // Preview URLs (for reference)
        preview: `https://drive.google.com/file/d/${fileId}/preview`,
        view: `https://drive.google.com/file/d/${fileId}/view`
      };
      
      // ⬇️ Try to detect file type and get filename
      let filename = `download_${fileId}`;
      let fileSize = null;
      let mimeType = null;
      let fileType = 'unknown';
      
      try {
        // Try to get file info from Google Drive (for public files)
        const infoResponse = await axios.get(
          `https://drive.google.com/file/d/${fileId}/view`,
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.5',
              'Accept-Encoding': 'gzip, deflate, br',
              'Referer': 'https://drive.google.com/',
              'Dnt': '1'
            },
            timeout: 10000,
            maxRedirects: 5,
            validateStatus: () => true
          }
        );
        
        if (infoResponse.status === 200) {
          // Try to extract filename from page title
          const titleMatch = infoResponse.data.match(/<title>([^<]+)<\/title>/);
          if (titleMatch && titleMatch[1]) {
            let title = titleMatch[1];
            // Clean up title (remove " - Google Drive" suffix)
            title = title.replace(/\s*-\s*Google\s+Drive\s*$/, '');
            title = title.replace(/\s*-\s*Drive\s*$/, '');
            if (title && title !== 'Google Drive') {
              filename = title.trim();
            }
          }
          
          // Try to extract file size from page
          const sizeMatch = infoResponse.data.match(/(\d+(?:\.\d+)?)\s*(MB|GB|KB|B)/i);
          if (sizeMatch) {
            fileSize = sizeMatch[0];
          }
          
          // Try to determine file type from URL patterns or content hints
          if (driveUrl.includes('/document/')) {
            fileType = 'document';
            mimeType = 'application/vnd.google-apps.document';
          } else if (driveUrl.includes('/spreadsheets/')) {
            fileType = 'spreadsheet';
            mimeType = 'application/vnd.google-apps.spreadsheet';
          } else if (driveUrl.includes('/presentation/')) {
            fileType = 'presentation';
            mimeType = 'application/vnd.google-apps.presentation';
          } else if (infoResponse.data.includes('image') || infoResponse.data.includes('jpg') || infoResponse.data.includes('png')) {
            fileType = 'image';
          } else if (infoResponse.data.includes('video') || infoResponse.data.includes('mp4') || infoResponse.data.includes('avi')) {
            fileType = 'video';
          } else if (infoResponse.data.includes('pdf')) {
            fileType = 'pdf';
            mimeType = 'application/pdf';
          } else if (infoResponse.data.includes('zip') || infoResponse.data.includes('rar')) {
            fileType = 'archive';
          }
        }
      } catch (infoError) {
        // Ignore info extraction errors
        console.log('Info extraction failed:', infoError.message);
      }
      
      // ⬇️ Check if download requires confirmation (large files)
      let requiresConfirmation = false;
      let confirmedUrl = directUrls.uc_download;
      
      try {
        const testDownload = await axios.get(directUrls.uc_download, {
          headers: {
            'User-Agent': 'Mozilla/5.0',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
          },
          maxRedirects: 0,
          timeout: 5000,
          validateStatus: () => true
        });
        
        // Check for virus scan warning page
        if (testDownload.status === 200 && 
            (testDownload.data.includes('Virus scan warning') || 
             testDownload.data.includes('Google Drive - Virus scan failed') ||
             testDownload.data.includes('confirm='))) {
          requiresConfirmation = true;
          
          // Try to extract confirmation token
          const tokenMatch = testDownload.data.match(/confirm=([a-zA-Z0-9_-]+)/);
          if (tokenMatch) {
            const confirmToken = tokenMatch[1];
            confirmedUrl = `${directUrls.uc_download}&confirm=${confirmToken}`;
          }
        }
      } catch (testError) {
        // Ignore test errors
      }
      
      // ⬇️ Generate download instructions based on file type
      let downloadNote = 'Use the direct_download URL for immediate download';
      
      if (fileType === 'document') {
        downloadNote = 'For Google Docs, consider using the export URL for PDF format';
        directUrls.export_pdf = `https://docs.google.com/document/d/${fileId}/export?format=pdf`;
      } else if (fileType === 'spreadsheet') {
        downloadNote = 'For Google Sheets, consider using the export URL for Excel format';
        directUrls.export_xlsx = `https://docs.google.com/spreadsheets/d/${fileId}/export?format=xlsx`;
      } else if (fileType === 'presentation') {
        downloadNote = 'For Google Slides, consider using the export URL for PDF/PPTX format';
        directUrls.export_pdf = `https://docs.google.com/presentation/d/${fileId}/export/pdf`;
        directUrls.export_pptx = `https://docs.google.com/presentation/d/${fileId}/export/pptx`;
      }
      
      // ⬇️ Clean filename for safe download
      const safeFilename = filename
        .replace(/[^\w\s.-]/g, '_')
        .replace(/\s+/g, '_')
        .substring(0, 100);
      
      // ✅ Success Response
      res.json({
        success: true,
        original_url: driveUrl,
        file_info: {
          id: fileId,
          filename: safeFilename,
          original_filename: filename,
          size: fileSize,
          type: fileType,
          mime_type: mimeType
        },
        download_urls: {
          // ⬇️ Primary direct download URL (gunakan ini untuk download)
          direct_download: confirmedUrl,
          
          // ⬇️ Alternative direct URLs
          alternatives: {
            usercontent: directUrls.usercontent,
            uc_export: directUrls.uc_export,
            docs_export: directUrls.docs_export
          },
          
          // ⬇️ Export URLs for Google Docs/Sheets/Slides
          exports: fileType === 'document' ? directUrls.export_pdf :
                   fileType === 'spreadsheet' ? directUrls.export_xlsx :
                   fileType === 'presentation' ? {
                     pdf: directUrls.export_pdf,
                     pptx: directUrls.export_pptx
                   } : null,
          
          // ⬇️ Reference URLs
          preview: directUrls.preview,
          drive_api: directUrls.drive_api
        },
        download_info: {
          requires_confirmation: requiresConfirmation,
          note: downloadNote,
          recommended_url: confirmedUrl,
          headers_suggestion: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': '*/*'
          }
        },
        metadata: {
          generated_at: new Date().toISOString(),
          url_type: this.detectUrlType(driveUrl),
          id_extracted: true
        }
      });

    } catch (error) {
      console.error("Google Drive Downloader Error:", error.message);
      
      let errorMessage = error.message;
      let statusCode = 500;
      
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        errorMessage = "Cannot connect to Google Drive";
        statusCode = 503;
      } else if (error.code === 'ETIMEDOUT') {
        errorMessage = "Connection to Google Drive timed out";
        statusCode = 504;
      }
      
      res.status(statusCode).json({
        success: false,
        error: errorMessage,
        original_url: req.query.url || '',
        timestamp: new Date().toISOString(),
        troubleshooting: [
          'Make sure the Google Drive file is set to "Anyone with the link can view"',
          'Check if the URL is correct and accessible',
          'Try opening the URL in browser first to confirm access',
          'Large files may require manual confirmation in browser'
        ]
      });
    }
  },

  // ⬇️ Helper method to detect URL type
  detectUrlType(url) {
    if (url.includes('/file/d/')) return 'file';
    if (url.includes('/document/d/')) return 'google_doc';
    if (url.includes('/spreadsheets/d/')) return 'google_sheet';
    if (url.includes('/presentation/d/')) return 'google_slide';
    if (url.includes('/open?id=')) return 'open_link';
    if (url.includes('/uc?id=')) return 'direct_link';
    return 'unknown';
  }
};
