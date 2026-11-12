// Helper to normalize any date string to YYYY-MM-DD
function normalizeToISODate(dateStr: any): string | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const s = dateStr.trim();
  if (!s || s.toLowerCase() === 'null') return null;

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmyMatch = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // DD/MM/YY or DD-MM-YY
  const dmyShortMatch = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2})$/);
  if (dmyShortMatch) {
    const day = dmyShortMatch[1].padStart(2, '0');
    const month = dmyShortMatch[2].padStart(2, '0');
    const year = '20' + dmyShortMatch[3];
    return `${year}-${month}-${day}`;
  }

  // YYYY/MM/DD
  const ymdSlash = s.match(/^(\d{4})[\/\.](\d{1,2})[\/\.](\d{1,2})$/);
  if (ymdSlash) {
    return `${ymdSlash[1]}-${ymdSlash[2].padStart(2, '0')}-${ymdSlash[3].padStart(2, '0')}`;
  }

  // Fallback to JS Date parser
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return null;
}

// Helper to normalize category to singular standard form and match existing categories
function normalizeCategoryName(rawCat: string, existingList?: string[]): string {
  if (!rawCat || typeof rawCat !== 'string') return 'General';
  let cat = rawCat.trim();
  if (!cat) return 'General';

  const lower = cat.toLowerCase();

  // Handle common plural words by removing trailing 's' / 'es' / 'ies'
  let singular = cat;
  if (lower.endsWith('ies') && lower.length > 4) {
    singular = cat.slice(0, -3) + 'y';
  } else if (lower.endsWith('es') && !['glasses', 'shoes', 'clothes'].includes(lower)) {
    singular = cat.slice(0, -2);
  } else if (lower.endsWith('s') && !['gas', 'glass', 'brass', 'status', 'electronics', 'lens', 'jeans'].includes(lower)) {
    singular = cat.slice(0, -1);
  }

  // Capitalize first letter of each word (Title Case)
  singular = singular
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');

  // Match against existing categories if provided
  if (existingList && Array.isArray(existingList) && existingList.length > 0) {
    const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const targetNorm = clean(singular);
    const rawNorm = clean(cat);

    // 1. Exact match
    const exact = existingList.find(e => clean(e) === targetNorm || clean(e) === rawNorm);
    if (exact) return exact;

    // 2. Singular stem match (e.g. existing "Fragrance" matches "Fragrances")
    const stemMatch = existingList.find(e => {
      const eNorm = clean(e);
      return (eNorm.length >= 4 && targetNorm.includes(eNorm)) || (targetNorm.length >= 4 && eNorm.includes(targetNorm));
    });
    if (stemMatch) return stemMatch;
  }

  return singular;
}

// Robust JSON repair parser for complete or truncated Gemini responses
function repairAndParseGeminiJson(rawText: string): any {
  let text = (rawText || '').trim();
  // Strip markdown code fences if present
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();

  // 1. Direct parse attempt
  try {
    return JSON.parse(text);
  } catch (err1) {
    // Continue with repair attempts
  }

  // 2. If it truncated inside a string value (e.g. `"category": "Personal`), try closing quotes and braces
  const quoteCount = (text.match(/(?<!\\)"/g) || []).length;
  if (quoteCount % 2 !== 0) {
    // Odd number of quotes: close open string and wrap up JSON
    const withClosedQuote = text + '"\n  }\n  ]\n}';
    try {
      return JSON.parse(withClosedQuote);
    } catch {
      // Continue
    }
  }

  // 3. Try wrapping up assuming unclosed objects and arrays
  const closingCombinations = [
    '\n  }\n  ]\n}',
    '\n  ]\n}',
    '\n}',
    '"\n}',
  ];
  for (const ending of closingCombinations) {
    try {
      return JSON.parse(text + ending);
    } catch {
      // Continue
    }
  }

  // 4. Truncate back to the last completely closed object '}' inside items array
  const lastCloseBrace = text.lastIndexOf('}');
  if (lastCloseBrace > 0) {
    let truncated = text.substring(0, lastCloseBrace + 1);
    // Remove any trailing commas
    truncated = truncated.replace(/,\s*$/, '');
    if (!truncated.includes(']')) {
      truncated += '\n  ]\n}';
    } else if (!truncated.endsWith('}')) {
      truncated += '\n}';
    }
    try {
      return JSON.parse(truncated);
    } catch {
      // Continue
    }
  }

  // 5. Fallback: Extract every complete { ... } item block using regex
  const items: any[] = [];
  const objectRegex = /\{[^{}]*"name"\s*:\s*"[^"]+"[^{}]*\}/g;
  let match;
  while ((match = objectRegex.exec(text)) !== null) {
    try {
      const obj = JSON.parse(match[0]);
      if (obj && obj.name) {
        items.push(obj);
      }
    } catch {
      // Ignore individual corrupted objects
    }
  }

  // Extract top-level scalar fields
  const extractString = (field: string) => {
    const reg = new RegExp(`"${field}"\\s*:\\s*"([^"]+)"`);
    const m = text.match(reg);
    return m ? m[1] : null;
  };
  const extractNumber = (field: string) => {
    const reg = new RegExp(`"${field}"\\s*:\\s*([0-9.]+)`);
    const m = text.match(reg);
    return m ? Number(m[1]) : null;
  };

  if (items.length > 0) {
    return {
      items,
      supplierName: extractString('supplierName'),
      supplierPhone: extractString('supplierPhone'),
      supplierEmail: extractString('supplierEmail'),
      supplierAddress: extractString('supplierAddress'),
      supplierContactPerson: extractString('supplierContactPerson'),
      invoiceNumber: extractString('invoiceNumber'),
      invoiceDate: extractString('invoiceDate'),
      totalAmount: extractNumber('totalAmount'),
    };
  }

  throw new Error("Could not parse invoice items from AI response");
}

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
    const { image, mimeType, existingCategories } = body;

    if (!image) {
      return NextResponse.json(
        { error: 'No image provided' },
        { status: 400 }
      );
    }

    // Clean up base64 — remove data URL prefix if present
    const base64Data = image.replace(/^data:[^;]+;base64,/, '');

    const existingCatListStr = Array.isArray(existingCategories) && existingCategories.length > 0
      ? `\nEXISTING CATEGORIES IN STORE (MUST PRIORITIZE MATCHING TO THESE IF RELEVANT):\n${existingCategories.slice(0, 40).join(', ')}\n`
      : '';

    const prompt = `You are an expert invoice/bill parser. Analyze this purchase invoice/bill image and extract ALL product items listed.

For EACH product item found, extract:
- "serialNumber": The row number, serial number (#1, #2, etc., or integer 1, 2...) from the bill. Null if not numbered.
- "name": Product name (as written on the bill)
- "itemCode": Item Code, SKU, Product Code, HSN code, or Part No if printed on the bill (null if not shown)
- "quantity": Number of units purchased (default to 1 if not clear)
- "purchasePrice": Price per unit in INR (if only total is given, divide by quantity)
- "sellingPrice": MRP or retail selling price per unit if visible (null if not shown)
- "category": Accurate category based on product type.

${existingCatListStr}

CRITICAL RULES:
1. CATEGORY NORMALIZATION:
   - Always use standard SINGULAR categories (e.g. use "Fragrance" NEVER "Fragrances", use "Perfume" NEVER "Perfumes", use "Plumbing" NEVER "Plumbings", use "Cosmetic" NEVER "Cosmetics", "Beverage" NEVER "Beverages", "Toy" NEVER "Toys").
   - NEVER add a trailing plural 's' or 'es' to category names.
   - If an existing store category fits, use that EXACT category name!
2. DEDUPLICATION (# SERIAL NUMBER & PRODUCT):
   - Each product line must appear ONLY ONCE in the items list. Check serial numbers (#) and names.
   - Do NOT output duplicate rows for the same product. If a product is listed multiple times, combine its total quantity into a single line item.
3. INVOICE DATE:
   - Extract the exact bill/invoice date printed on the bill.
   - Format it strictly as YYYY-MM-DD (e.g. "2026-11-12"). If year is 2 digits like 26, convert to 2026.
4. OUTPUT PURE JSON:
   - Return valid JSON only, no markdown formatting.

Return JSON in this format:
{
  "items": [
    {
      "serialNumber": 1,
      "name": "Product Name",
      "itemCode": "ITM-001 or SKU or null",
      "quantity": 1,
      "purchasePrice": 100,
      "sellingPrice": 150,
      "category": "Fragrance"
    }
  ],
  "supplierName": "Vendor Name or null",
  "supplierPhone": "9876543210 or null",
  "supplierEmail": "email@example.com or null",
  "supplierAddress": "Full address or null",
  "supplierContactPerson": "Contact name or null",
  "invoiceNumber": "INV-001 or null",
  "invoiceDate": "2026-11-12 or null",
  "totalAmount": 1500
}`;

    // Call Gemini API directly via REST with gemini-2.5-flash
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const geminiBody: any = {
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
        maxOutputTokens: 16384, // 16k tokens allows large invoices with 50+ line items without truncation
        responseMimeType: 'application/json',
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

    let parsed: any;
    try {
      parsed = repairAndParseGeminiJson(responseText);
    } catch (parseErr: any) {
      console.error('Failed to parse Gemini response:', responseText, parseErr);
      return NextResponse.json(
        { error: 'Could not parse invoice data. Please try a clearer image.' },
        { status: 422 }
      );
    }

    // Validate, sanitize and strictly deduplicate items
    const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
    const seenMap = new Map<string, any>();

    for (const raw of rawItems) {
      const name = String(raw.name || 'Product').trim();
      const itemCode = raw.itemCode ? String(raw.itemCode).trim() : (raw.sku ? String(raw.sku).trim() : null);
      const serialNumber = raw.serialNumber !== undefined && raw.serialNumber !== null ? String(raw.serialNumber).trim() : null;
      const quantity = Math.max(1, Number(raw.quantity) || 1);
      const purchasePrice = Math.max(0, Number(raw.purchasePrice) || 0);
      const sellingPrice = raw.sellingPrice ? Math.max(0, Number(raw.sellingPrice)) : null;
      const category = normalizeCategoryName(String(raw.category || 'General'), existingCategories);

      // Deduplication Key: serialNumber if present, else itemCode, else lowercased name
      const dedupKey = serialNumber
        ? `sn_${serialNumber}`
        : itemCode
        ? `code_${itemCode.toLowerCase()}`
        : `name_${name.toLowerCase()}`;

      if (seenMap.has(dedupKey)) {
        // Already seen this product/serial item: merge quantity instead of duplicating!
        const existing = seenMap.get(dedupKey);
        existing.quantity += quantity;
      } else {
        seenMap.set(dedupKey, {
          serialNumber,
          name,
          itemCode,
          quantity,
          purchasePrice,
          sellingPrice,
          category,
        });
      }
    }

    const items = Array.from(seenMap.values());
    const invoiceDate = normalizeToISODate(parsed.invoiceDate);

    return NextResponse.json({
      items,
      supplierName: parsed.supplierName || null,
      supplierPhone: parsed.supplierPhone || null,
      supplierEmail: parsed.supplierEmail || null,
      supplierAddress: parsed.supplierAddress || null,
      supplierContactPerson: parsed.supplierContactPerson || null,
      invoiceNumber: parsed.invoiceNumber || null,
      invoiceDate,
      totalAmount: parsed.totalAmount ? Number(parsed.totalAmount) : null,
    });
  } catch (error: any) {
    console.error('Invoice extraction error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process invoice' },
      { status: 500 }
    );
  }
}
