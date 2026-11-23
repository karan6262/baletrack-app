module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GEMINI_API_KEY is not set in Vercel Environment Variables." });
  }

  try {
    const { images } = req.body;
    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ error: "No invoice images provided." });
    }

    const prompt = `Extract invoice details from these multi-column invoice images.
Return ONLY valid JSON with this exact structure:
{
  "invoiceNumber": "",
  "invoiceDate": "",
  "supplier": "",
  "items": [
    { "baleNumber": "", "description": "", "quantity": "" }
  ]
}
Combine multi-column details clearly into description if needed. Do not include markdown or extra text.`;

    const parts = [{ text: prompt }];
    images.forEach((b64) => {
      parts.push({ inline_data: { mime_type: "image/jpeg", data: b64 } });
    });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`;
    let data = null;
    let lastError = "Gemini API error";

    // Automatically retry up to 3 times if Google's servers are busy (503 / 429)
    for (let attempt = 1; attempt <= 3; attempt++) {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts }] })
      });

      data = await response.json();

      if (response.ok) {
        lastError = null;
        break;
      }

      lastError = data.error?.message || "Gemini API error";

      // If server is busy (503) or rate-limited (429), wait 2 seconds and retry
      if ((response.status === 503 || response.status === 429) && attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        continue;
      }

      return res.status(response.status).json({ error: lastError });
    }

    if (lastError) {
      return res.status(503).json({ error: lastError });
    }

    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const cleaned = rawText.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to extract invoice data." });
  }
};
