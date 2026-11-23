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

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts }] })
      }
    );

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || "Gemini API error" });
    }

    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const cleaned = rawText.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to extract invoice data." });
  }
};
