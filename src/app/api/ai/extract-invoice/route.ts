import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Gemini API key not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { image, mimeType } = body;

    if (!image) {
      return NextResponse.json(
        { error: 'No image provided' },
        { status: 400 }
      );
    }

    // Clean up base64 — remove data URL prefix if present
    const base64Data = image.replace(/^data:[^;]+;base64,/, '');

    const prompt = `You are an expert invoice/bill parser. Analyze this purchase invoice/bill image and extract ALL product items listed.

For EACH product item found, extract:
- "name": Product name (as written on the bill)
- "quantity": Number of units purchased (default to 1 if not clear)
- "purchasePrice": Price per unit in INR (if only total is given, divide by quantity)
- "category": Best guess category (e.g. "Electronics", "Grocery", "Hardware", "Clothing", "Auto Parts", "Stationery", "Medicine", etc.)

Also extract these invoice-level details if visible:
- "supplierName": Name of the supplier/vendor/shop on the bill
- "invoiceNumber": Invoice/bill number
- "invoiceDate": Date on the invoice (in YYYY-MM-DD format)
- "totalAmount": Grand total amount on the bill

IMPORTANT RULES:
1. Extract ALL line items, even if partially visible
2. Prices should be numbers only (no currency symbols)
3. If a field is not readable, use null
4. For handwritten bills, do your best to read the text
5. Return valid JSON only, no markdown formatting

Return ONLY this JSON structure:
{
  "items": [
    {
      "name": "Product Name",
      "quantity": 1,
      "purchasePrice": 100,
      "category": "Category"
    }
  ],
  "supplierName": "Vendor Name or null",
  "invoiceNumber": "INV-001 or null",
  "invoiceDate": "2026-01-15 or null",
  "totalAmount": 1500
}`;

    // Call Gemini API directly via REST
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const geminiBody = {
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: mimeType || 'image/jpeg',
                data: base64Data,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 4096,
      },
    };

    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini API error:', errText);
      return NextResponse.json(
        { error: 'AI processing failed. Please try again.' },
        { status: 500 }
      );
    }

    const geminiData = await geminiRes.json();

    // Extract text from Gemini response
    const responseText =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Parse JSON from response (handle markdown code blocks)
    let cleanJson = responseText.trim();
    // Remove markdown code fences if present
    cleanJson = cleanJson.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
    cleanJson = cleanJson.trim();

    let parsed;
    try {
      parsed = JSON.parse(cleanJson);
    } catch {
      console.error('Failed to parse Gemini response:', responseText);
      return NextResponse.json(
        { error: 'Could not parse invoice data. Please try a clearer image.' },
        { status: 422 }
      );
    }

    // Validate and sanitize the response
    const items = (parsed.items || []).map((item: any) => ({
      name: String(item.name || 'Unknown Product'),
      quantity: Math.max(1, Number(item.quantity) || 1),
      purchasePrice: Math.max(0, Number(item.purchasePrice) || 0),
      category: String(item.category || 'General'),
    }));

    return NextResponse.json({
      items,
      supplierName: parsed.supplierName || null,
      invoiceNumber: parsed.invoiceNumber || null,
      invoiceDate: parsed.invoiceDate || null,
      totalAmount: parsed.totalAmount || null,
    });
  } catch (error: any) {
    console.error('Invoice extraction error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process invoice' },
      { status: 500 }
    );
  }
}

