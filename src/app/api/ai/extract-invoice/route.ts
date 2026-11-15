import { NextResponse } from 'next/server';

const round2 = (n: number) => Number(n.toFixed(2));

const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

// Helper to normalize any date string to YYYY-MM-DD
function normalizeToISODate(dateStr: any): string | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const s = dateStr.trim();
  if (!s || s.toLowerCase() === 'null') return null;

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // DD/Mon/YY or DD-Mon-YYYY (example: 12/Nov/26)
  const dMonY = s.match(/^(\d{1,2})[\s\/\-\.]*([A-Za-z]{3})[a-z]*[\s\/\-\.,]*(\d{2,4})$/);
  if (dMonY && MONTHS[dMonY[2].toLowerCase()]) {
    const year = dMonY[3].length === 2 ? '20' + dMonY[3] : dMonY[3];
    return `${year}-${MONTHS[dMonY[2].toLowerCase()]}-${dMonY[1].padStart(2, '0')}`;
  }

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmyMatch = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmyMatch) {
    return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
  }

  // DD/MM/YY or DD-MM-YY
  const dmyShortMatch = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2})$/);
  if (dmyShortMatch) {
    return `20${dmyShortMatch[3]}-${dmyShortMatch[2].padStart(2, '0')}-${dmyShortMatch[1].padStart(2, '0')}`;
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

  let singular = cat;
  if (lower.endsWith('ies') && lower.length > 4) {
    singular = cat.slice(0, -3) + 'y';
  } else if (lower.endsWith('es') && !['glasses', 'shoes', 'clothes'].includes(lower)) {
    singular = cat.slice(0, -2);
  } else if (lower.endsWith('s') && !['gas', 'glass', 'brass', 'status', 'electronics', 'lens', 'jeans'].includes(lower)) {
    singular = cat.slice(0, -1);
  }

  singular = singular
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');

  if (existingList && Array.isArray(existingList) && existingList.length > 0) {
    const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const targetNorm = clean(singular);
    const rawNorm = clean(cat);

    const exact = existingList.find(e => clean(e) === targetNorm || clean(e) === rawNorm);
    if (exact) return exact;

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
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();

  try {
    return JSON.parse(text);
  } catch (err1) {
    // continue with repair attempts
  }

  const quoteCount = (text.match(/(?<!\\)"/g) || []).length;
  if (quoteCount % 2 !== 0) {
    const withClosedQuote = text + '"\n  }\n  ]\n}';
    try {
      return JSON.parse(withClosedQuote);
    } catch {
      // continue
    }
  }

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
      // continue
    }
  }

  const lastCloseBrace = text.lastIndexOf('}');
  if (lastCloseBrace > 0) {
    let truncated = text.substring(0, lastCloseBrace + 1);
    truncated = truncated.replace(/,\s*$/, '');
    if (!truncated.includes(']')) {
      truncated += '\n  ]\n}';
    } else if (!truncated.endsWith('}')) {
      truncated += '\n}';
    }
    try {
      return JSON.parse(truncated);
    } catch {
      // continue
    }
  }

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
      // ignore corrupted objects
    }
  }

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
      supplierGst: extractString('supplierGst') || extractString('supplierGstin'),
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

    const base64Data = image.replace(/^data:[^;]+;base64,/, '');

    const existingCatListStr = Array.isArray(existingCategories) && existingCategories.length > 0
      ? `\nEXISTING CATEGORIES IN STORE (MUST PRIORITIZE MATCHING TO THESE IF RELEVANT):\n${existingCategories.slice(0, 40).join(', ')}\n`
      : '';

    const prompt = `You are an expert purchase invoice/bill parser. Analyze this purchase invoice/bill image and extract ALL product items listed in the table.

IMPORTANT INVOICE STRUCTURE & EXTRACTION RULES:
1. EVERY ROW IS AN INDEPENDENT PRODUCT:
   - On hardware, plumbing, electrical, retail and grocery invoices, different sizes, dimensions, or variations (e.g. "110 MM", "75 MM", "63MM", "50 MM", "1/2 inch", "1 inch") are COMPLETELY DIFFERENT PRODUCTS.
   - You MUST extract EACH row as its own separate item in the "items" array!
   - NEVER combine or merge items with different names, sizes, or rates into one item!

2. MULTI-LINE / WRAPPED PRODUCT NAMES:
   - In table rows, product descriptions often wrap onto a second or third line (e.g. Line 1: "STAR VENT COWL (H) 110 MM", Line 2: "WITH SS NET").
   - You MUST concatenate the wrapped lines into the full complete product name: "STAR VENT COWL (H) 110 MM WITH SS NET".
   - Do NOT drop the wrapped continuation lines!

3. HSN CODE IS NOT AN ITEM CODE:
   - HSN / SAC Code (e.g. "39174000") is a tax classification number shared by all products in that tax category.
   - Extract it into "hsnCode".
   - Do NOT put HSN code into "itemCode"!
   - "itemCode": ONLY for a specific product SKU / Part No / Catalog No if printed. If there is no specific item code, return null.

4. PRICES & QUANTITY (CRITICAL ACCURACY):
   - "quantity": Number of units purchased (number only, default 1).
   - "mrp": Printed MRP per unit if present in an "MRP" column. Null if not shown.
   - "discountPercent": Line discount percentage if present.
   - "taxableAmount": Line taxable amount (the amount AFTER discount and BEFORE GST).
   - "purchasePrice": Real cost per ONE unit after discount and before GST. Calculate as: taxableAmount / quantity. If no taxable column, use unit rate after discount. NEVER use gross MRP as purchasePrice when a discount or taxable amount is given!
   - "taxRate": GST percentage for the line (e.g. 18, 12, 5, 0; if CGST 9% + SGST 9%, sum to 18).
   - "taxAmount": Total GST amount for the line (CGST + SGST).
   - "category": Accurate single-category name based on product type.

${existingCatListStr}

5. CATEGORY NORMALIZATION:
   - Always use standard SINGULAR categories (e.g. "Plumbing", "Hardware", "Electrical", "Paint", "Grocery").
   - If an existing store category fits, use that EXACT category name!

6. INVOICE DATE:
   - Extract the exact bill date printed on the bill.
   - Format strictly as YYYY-MM-DD (e.g. "12/Nov/26" -> "2026-11-12").

7. SUPPLIER:
   - The supplier is the company that ISSUED the bill (at the top header), NOT the "Bill to" or "Delivery to" customer.
   - Extract supplier name, GSTIN (15 characters), phone, email, and address.

Return valid JSON strictly in this format:
{
  "items": [
    {
      "serialNumber": 1,
      "name": "STAR VENT COWL (H) 110 MM WITH SS NET",
      "hsnCode": "39174000",
      "itemCode": null,
      "quantity": 5,
      "mrp": 168.21,
      "discountPercent": 61.74,
      "taxableAmount": 321.75,
      "purchasePrice": 64.35,
      "taxRate": 18,
      "taxAmount": 57.92,
      "category": "Plumbing"
    }
  ],
  "supplierName": "CRESCENT HARDWARE AND STEELS",
  "supplierGst": "32AFTPA2649M1Z7",
  "supplierPhone": "8594000215",
  "supplierEmail": "crescentchelari@gmail.com",
  "supplierAddress": "10/178B, PANAMBRA, THENHIPPALAM (PO), PANAMBRA 673636",
  "supplierContactPerson": null,
  "invoiceNumber": "PWB5998",
  "invoiceDate": "2026-11-12",
  "totalAmount": 1193.00
}`;

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
        maxOutputTokens: 16384,
        responseMimeType: 'application/json',
      },
    };

    const preferredModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const modelsToTry = Array.from(new Set([
      preferredModel,
      'gemini-1.5-flash',
      'gemini-2.0-flash',
      'gemini-1.5-pro',
    ]));

    let responseText = '';
    let lastError = '';

    for (const model of modelsToTry) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const geminiRes = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(geminiBody),
        });

        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          responseText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          if (responseText) {
            console.log(`[Invoice Extract] Successfully extracted invoice using model: ${model}`);
            break;
          }
        } else {
          const errText = await geminiRes.text();
          console.warn(`[Invoice Extract] Model ${model} returned error (${geminiRes.status}):`, errText);
          lastError = errText;
          if (geminiRes.status === 503 || geminiRes.status === 429 || geminiRes.status === 500) {
            await new Promise(r => setTimeout(r, 500));
            continue;
          }
        }
      } catch (callErr: any) {
        console.warn(`[Invoice Extract] Failed call to ${model}:`, callErr.message);
        lastError = callErr.message;
        continue;
      }
    }

    if (!responseText) {
      console.error('All Gemini fallback models exhausted. Last error:', lastError);
      return NextResponse.json(
        { error: 'AI processing temporarily unavailable due to server demand. Please try again.' },
        { status: 503 }
      );
    }

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
      const hsnCode = raw.hsnCode ? String(raw.hsnCode).trim() : null;
      const serialNumber = raw.serialNumber !== undefined && raw.serialNumber !== null ? String(raw.serialNumber).trim() : null;
      const quantity = Math.max(1, Number(raw.quantity) || 1);
      const category = normalizeCategoryName(String(raw.category || 'General'), existingCategories);

      const mrp = Math.max(0, Number(raw.mrp) || 0);
      const discountPercent = Math.max(0, Number(raw.discountPercent) || 0);
      const taxableAmount = Math.max(0, Number(raw.taxableAmount) || 0);
      let purchasePrice = Math.max(0, Number(raw.purchasePrice) || 0);

      // Cost per piece: taxable amount / qty is the most reliable value on the bill
      if (taxableAmount > 0) {
        purchasePrice = round2(taxableAmount / quantity);
      } else if (mrp > 0 && discountPercent > 0 && (purchasePrice === 0 || purchasePrice === mrp)) {
        // Safety net: AI returned MRP as cost but a discount % exists
        purchasePrice = round2(mrp * (1 - discountPercent / 100));
      }

      const taxRate = raw.taxRate !== undefined && raw.taxRate !== null ? Number(raw.taxRate) || 0 : 0;
      let taxAmount = raw.taxAmount !== undefined && raw.taxAmount !== null ? Number(raw.taxAmount) || 0 : 0;
      if (taxRate > 0 && taxAmount === 0) {
        taxAmount = round2((quantity * purchasePrice * taxRate) / 100);
      }

      const cleanName = (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const cleanCode = itemCode ? itemCode.toLowerCase().trim() : '';

      // Deduplicate only when products are truly the same:
      // Product name (with size/dimension) MUST match. Different sizes (110 MM vs 75 MM) are NEVER merged!
      const dedupKey = cleanCode ? `${cleanName}__${cleanCode}` : (cleanName || `item_${serialNumber || Math.random()}`);
      let matchedObj: any = null;
      if (seenMap.has(dedupKey)) {
        matchedObj = seenMap.get(dedupKey);
      }

      if (matchedObj) {
        matchedObj.quantity += quantity;
        matchedObj.taxAmount = round2((matchedObj.taxAmount || 0) + taxAmount);
        matchedObj.taxableAmount = round2((matchedObj.taxableAmount || 0) + taxableAmount);
        if (matchedObj.taxableAmount > 0 && matchedObj.quantity > 0) {
          matchedObj.purchasePrice = round2(matchedObj.taxableAmount / matchedObj.quantity);
        }
        if (mrp > 0 && (!matchedObj.mrp || mrp > matchedObj.mrp)) {
          matchedObj.mrp = mrp;
        }
        if (!matchedObj.itemCode && itemCode) {
          matchedObj.itemCode = itemCode;
        }
        if (!matchedObj.hsnCode && hsnCode) {
          matchedObj.hsnCode = hsnCode;
        }
      } else {
        const itemObj = {
          serialNumber,
          name,
          itemCode,
          hsnCode,
          quantity,
          purchasePrice,
          taxRate,
          taxAmount,
          mrp,
          taxableAmount,
          discountPercent,
          sellingPrice: null,
          category,
        };
        seenMap.set(dedupKey, itemObj);
      }
    }

    const items = Array.from(new Set(seenMap.values()));
    const invoiceDate = normalizeToISODate(parsed.invoiceDate);

    return NextResponse.json({
      items,
      supplierName: parsed.supplierName || null,
      supplierPhone: parsed.supplierPhone || null,
      supplierGst: parsed.supplierGst || parsed.supplierGstin || null,
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
