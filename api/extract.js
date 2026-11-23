module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GROQ_API_KEY is not set in Vercel Environment Variables." });
  }

  try {
    const { images } = req.body;
    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ error: "No invoice images provided." });
    }

    // Groq vision supports up to 3 images per request
    const selectedImages = images.slice(0, 3);

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

    const content = [
      { type: "text", text: prompt },
      ...selectedImages.map((b64) => ({
        type: "image_url",
        image_url: {
          url: `data:image/jpeg;base64,${b64}`
        }
      }))
    ];

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "qwen/qwen3.8-27b",
        response_format: { type: "json_object" },
        messages: [{ role: "user", content }]
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || "Groq API error" });
    }

    const rawText = data.choices?.[0]?.message?.content || "{}";
    const cleaned = rawText.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to extract invoice data." });
  }
};
