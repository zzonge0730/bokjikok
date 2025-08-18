// routes/chat.js
const express = require("express");
const router = express.Router();
const { OpenAI } = require("openai");
const dotenv = require("dotenv");
const cache = require("../utils/cache");

dotenv.config();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

router.post("/", async (req, res) => {
  console.log("✅ /chat hit! body:", req.body);
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
          content: "너는 청년 복지 정책을 소개하는 챗봇이야. 반드시 JSON 배열만 출력해. 형식: [{\"title\": \"정책명\", \"description\": \"간단한 설명\"}, ...] 정확히 3개만."
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
    return res.json({
      source: "openai",
      reply,     // ✅ AI 원문 답변 그대로 내려줌
      policies,  // ✅ JSON 파싱된 정책 카드
    });
  } catch (err) {
    console.error("/chat error:", err.message);
    return res.status(500).json({ error: "GPT 처리 중 오류 발생" });
  }
});

module.exports = router;
