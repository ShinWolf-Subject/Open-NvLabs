import axios from "axios";
import { load } from "cheerio";
import qs from "qs";

export default class YTDL {
  constructor() {
    this.endpoint = "https://www.mediamister.com/get_youtube_video";
  }

  async download(url) {
    if (!url) throw new Error("URL is required");

    const postData = qs.stringify({ url });

    const { data: html } = await axios.post(this.endpoint, postData, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "Accept": "*/*",
        "X-Requested-With": "XMLHttpRequest",
        "User-Agent": "Mozilla/5.0",
      },
      timeout: 20000,
    });

    const $ = load(html);

    const title = $("h2").first().text().trim() || null;
    const thumbnail = $(".yt_thumb img").attr("src") || null;

    const videos = [];
    $(".yt_format")
      .first()
      .find("a.download-button")
      .each((_, el) => {
        const a = $(el);
        const href = a.attr("href");
        if (!href) return;

        videos.push({
          quality: a.text().replace(/\s+/g, " ").trim(),
          format: href.includes("mime=video/webm") ? "webm" : "mp4",
          downloadUrl: href,
        });
      });

    const audios = [];
    $(".yt_format")
      .last()
      .find("a.download-button.audio")
      .each((_, el) => {
        const a = $(el);
        const href = a.attr("href");
        if (!href) return;

        audios.push({
          quality: a.text().replace(/\s+/g, " ").trim(),
          format: href.includes("mime=audio/webm") ? "webm" : "m4a",
          downloadUrl: href,
        });
      });

    return {
      title,
      thumbnail,
      videos,
      audios,
    };
  }
}
