module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "MISTRAL_API_KEY is not set in Vercel Environment Variables." });
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

    const content = [
      { type: "text", text: prompt },
      ...images.map((b64) => ({
        type: "image_url",
        image_url: `data:image/jpeg;base64,${b64}`
      }))
    ];

    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "mistral-small-latest",
        response_format: { type: "json_object" },
        messages: [{ role: "user", content }]
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data.message || data.error?.message || "Mistral API error" });
    }

    const rawText = data.choices?.[0]?.message?.content || "{}";
    const cleaned = rawText.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to extract invoice data." });
  }
};
