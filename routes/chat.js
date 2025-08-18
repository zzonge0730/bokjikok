// routes/chat.js
const express = require("express");
const router = express.Router();
const { OpenAI } = require("openai");
const dotenv = require("dotenv");
const cache = require("../utils/cache");

// 정책 DB 불러오기
const policiesDB = require("../data/mockPolicies.json");

dotenv.config();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

router.post("/", async (req, res) => {
  console.log("✅ /chat hit! body:", req.body);
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: "message field is required" });
  }

  // 캐시 먼저 확인
  if (cache.has(message)) {
    return res.json({ source: "cache", policies: cache.get(message) });
  }

  try {
      const policyTitles = policiesDB.map(p => p.title).join(", ");
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `너는 청년 복지 정책을 소개하는 챗봇이야. 반드시 JSON 배열만 출력해.
      형식: [{"title": "정책명", "description": "간단한 설명"}]
      정확히 3개만.
      title은 반드시 다음 목록 중에서만 선택해야 해:
      ${policyTitles}`
          },
          { role: "user", content: message }
        ]
      });

    const reply = completion.choices[0].message.content;

    // JSON 파싱 시도
    let policies = [];
    try {
      policies = JSON.parse(reply);
    } catch (e) {
      // fallback: "1. 정책명: 설명" 형식 파싱
      const lines = reply.split("\n").filter((l) => l.trim());
      for (let line of lines) {
        const match = line.match(/^\d+\.\s*(.*?)[:\-]\s*(.*)$/);
        if (match) {
          policies.push({
            title: match[1].trim(),
            description: match[2].trim(),
          });
        }
      }
    }

    // ✅ DB 매칭해서 deadline 붙이기 (양방향 비교 + 공백 제거 + 소문자 변환)
    policies = policies.map((p) => {
      const cleanTitle = p.title.replace(/\s/g, "").toLowerCase();

      const match = policiesDB.find((db) => {
        const cleanDBTitle = db.title.replace(/\s/g, "").toLowerCase();
        return (
          cleanDBTitle.includes(cleanTitle) || cleanTitle.includes(cleanDBTitle)
        );
      });

      return match ? { ...p, deadline: match.deadline } : p;
    });

    // fallback 답변
    const replyText =
      policies.length > 0 ? "관련 정책을 정리했어요 📋" : reply;

    // 캐시에 저장
    cache.set(message, policies);
    console.log("🎯 최종 응답:", policies);
    return res.json({
      source: "openai",
      reply: replyText,
      policies,
    });
  } catch (err) {
    console.error("/chat error:", err.message);
    return res.status(500).json({ error: "GPT 처리 중 오류 발생" });
  }
  
});

module.exports = router;
