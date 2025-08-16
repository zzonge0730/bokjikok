// routes/chat.js
const express = require("express");
const router = express.Router();
const { OpenAI } = require("openai");
const dotenv = require("dotenv");
const cache = require("../utils/cache");

dotenv.config();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

router.post("/", async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: "message field is required" });
  }

  // Check cache first
  if (cache.has(message)) {
    return res.json({ source: "cache", policies: cache.get(message) });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "너는 청년 복지 정책을 소개해주는 챗봇이야. JSON 형식으로 3개의 정책만 title과 description으로 요약해서 제공해줘.",
        },
        {
          role: "user",
          content: message,
        },
      ],
      temperature: 0.7,
    });

    const reply = completion.choices[0].message.content;

    // 시도: JSON 파싱 (GPT 응답이 JSON이면)
    let policies = [];
    try {
      policies = JSON.parse(reply);
    } catch (e) {
      // 아니면 수동 파싱 시도 (단순 패턴 기반)
      const lines = reply.split("\n").filter((l) => l.trim());
      for (let line of lines) {
        const match = line.match(/^\d+\.\s*(.*?)[:\-]\s*(.*)$/);
        if (match) {
          policies.push({ title: match[1].trim(), description: match[2].trim() });
        }
      }
    }

    // 캐시에 저장
    cache.set(message, policies);
    return res.json({ source: "openai", policies: Array.isArray(policies.policies) ? policies.policies : policies });
  } catch (err) {
    console.error("/chat error:", err.message);
    return res.status(500).json({ error: "GPT 처리 중 오류 발생" });
  }
});

module.exports = router;
