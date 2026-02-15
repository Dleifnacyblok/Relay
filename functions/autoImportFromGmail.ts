import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import * as XLSX from 'npm:xlsx@0.18.5';

const parseDate = (value) => {
  if (value == null || value === "") return null;
  if (value instanceof Date && !isNaN(value.getTime())) return value;
  if (typeof value === "number") {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const ms = value * 86400000;
    const d = new Date(excelEpoch.getTime() + ms);
    return isNaN(d.getTime()) ? null : d;
  }
  const s = value.toString().trim();
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};

const daysDiff = (from, to) => {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  return Math.round((b - a) / 86400000);
};

const makeImportKey = (setId, etchId, accountName, loanedDate) => {
  const loanedISO = loanedDate.toISOString().slice(0, 10);
  const safeAccount = accountName.replace(/\s+/g, " ").trim();
  return `${setId}__${etchId}__${safeAccount}__${loanedISO}`.toLowerCase();
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Get Gmail access token
    const accessToken = await base44.asServiceRole.connectors.getAccessToken("gmail");
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    
    // Search for recent emails with attachments (last 24 hours)
    const searchResponse = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?q=has:attachment newer_than:1d',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!searchResponse.ok) {
      return Response.json({ success: false, error: `Gmail search failed: ${searchResponse.statusText}` }, { status: searchResponse.status });
    }
    
    const searchData = await searchResponse.json();
    
    if (!searchData.messages || searchData.messages.length === 0) {
      return Response.json({ success: true, message: 'No new emails with attachments found' });
    }
    
    // Get the most recent message
    const messageId = searchData.messages[0].id;
    await sleep(500);
    
    const messageResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!messageResponse.ok) {
      return Response.json({ success: false, error: `Gmail fetch failed: ${messageResponse.statusText}` }, { status: messageResponse.status });
    }
    
    const messageData = await messageResponse.json();
    
    // Find Excel attachment
    let attachmentData = null;
    for (const part of messageData.payload.parts || []) {
      if (part.filename && (part.filename.endsWith('.xlsx') || part.filename.endsWith('.xls'))) {
        const attachmentId = part.body.attachmentId;
        await sleep(500);
        
        const attachmentResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        if (!attachmentResponse.ok) {
          return Response.json({ success: false, error: `Attachment fetch failed: ${attachmentResponse.statusText}` }, { status: attachmentResponse.status });
        }
        
        const attachment = await attachmentResponse.json();
        
        // Decode base64url
        const base64 = attachment.data.replace(/-/g, '+').replace(/_/g, '/');
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        attachmentData = bytes;
        break;
      }
    }
    
    if (!attachmentData) {
      return Response.json({ success: false, message: 'No Excel attachment found' });
    }
    
    // Process the Excel file
    const workbook = XLSX.read(attachmentData, { type: "array", cellDates: true });
    
    // Only import from "All Pending Return" sheet
    const targetSheet = workbook.SheetNames.find(name => 
      name.toLowerCase().includes('all pending') || 
      name.toLowerCase().includes('pending return')
    );
    
    if (!targetSheet) {
      throw new Error('Could not find "All Pending Return" sheet in workbook');
    }

    const worksheet = workbook.Sheets[targetSheet];
    const allRows = XLSX.utils.sheet_to_json(worksheet, { defval: "", raw: false });

    if (!allRows.length) throw new Error("No data found in 'All Pending Return' sheet");

    const normalizedRows = allRows.map((r) => {
      const out = {};
      for (const k of Object.keys(r)) {
        out[k.toString().trim().toLowerCase().replace(/\s+/g, " ")] = r[k];
      }
      return out;
    });

    const requiredHeaders = ["set id", "set name", "current field sales name", "associate sales rep name", "account name", "etch id", "loaned date", "expected return date"];
    const keyUnion = new Set();
    for (const r of normalizedRows.slice(0, 5)) {
      for (const k of Object.keys(r)) keyUnion.add(k);
    }
    const missingHeaders = requiredHeaders.filter((h) => !keyUnion.has(h));
    if (missingHeaders.length) {
      throw new Error(`Missing columns: ${missingHeaders.join(", ")}`);
    }

    const now = new Date();
    const payload = [];

    normalizedRows.forEach((r, idx) => {
      const setId = (r["set id"] || "").toString().trim();
      const setName = (r["set name"] || "").toString().trim();
      const fieldSalesRep = (r["current field sales name"] || "").toString().trim();
      const assocRaw = (r["associate sales rep name"] || "").toString().trim();
      const accountName = (r["account name"] || "").toString().trim();
      
      let repName = assocRaw || "None";
      const lowerAccount = accountName.toLowerCase();
      if (!assocRaw) {
        if (lowerAccount.includes("mymichigan medical center") || lowerAccount.includes("mclaren bay region")) {
          repName = "John DeLeon";
        } else if (lowerAccount.includes("university of michigan") || lowerAccount.includes("va - ann arbor")) {
          repName = "Reid Butcher";
        } else if (lowerAccount.includes("trinity health") || lowerAccount.includes("chelsea community")) {
          repName = "Graham Brown";
        } else if (lowerAccount.includes("henry ford macomb")) {
          repName = "Joshua Raptis";
        } else if (lowerAccount.includes("corewell wm beaumont")) {
          repName = "Kristine Binge";
        } else if (lowerAccount.includes("children's hospital of michigan")) {
          repName = "Graham Brown";
        }
      }
      const etchId = (r["etch id"] || "").toString().trim();
      const loanedDate = parseDate(r["loaned date"]);
      const expectedReturnDate = parseDate(r["expected return date"]);

      if (!setId || !setName || !accountName || !etchId || !loanedDate || !expectedReturnDate || !fieldSalesRep) {
        return;
      }

      const daysUntilDue = daysDiff(now, expectedReturnDate);
      const isOverdue = daysUntilDue < 0;
      const daysOverdue = isOverdue ? Math.abs(daysUntilDue) : 0;
      const fineAmount = daysOverdue * 50;
      const importKey = makeImportKey(setId, etchId, accountName, loanedDate);

      payload.push({
        importKey,
        setName,
        etchId,
        accountName,
        repName,
        expectedReturnDate: expectedReturnDate.toISOString().slice(0, 10),
        fineAmount,
        isOverdue,
        setId,
        fieldSalesRep,
        loanedDate: loanedDate.toISOString().slice(0, 10),
        daysUntilDue,
        daysOverdue,
        finePerDay: 50,
        lastImportedAt: now.toISOString(),
      });
    });

    // Fetch existing records and build lookup maps
    const allExisting = await base44.asServiceRole.entities.Loaners.list();
    const existingMap = new Map();
    const existingBySetAccount = new Map();
    
    allExisting.forEach(e => {
      if (e?.importKey && e?.id) {
        existingMap.set(e.importKey, e.id);
      }
      if (e?.setId && e?.accountName && e?.id) {
        const key = `${e.setId}__${e.accountName}`.toLowerCase();
        existingBySetAccount.set(key, e.id);
      }
    });

    let created = 0;
    let updated = 0;

    const BATCH_SIZE = 10;
    for (let i = 0; i < payload.length; i += BATCH_SIZE) {
      const batch = payload.slice(i, i + BATCH_SIZE);
      
      for (const rec of batch) {
        let existingId = existingMap.get(rec.importKey);
        
        if (!existingId) {
          const fallbackKey = `${rec.setId}__${rec.accountName}`.toLowerCase();
          existingId = existingBySetAccount.get(fallbackKey);
        }
        
        if (existingId) {
          await base44.asServiceRole.entities.Loaners.update(existingId, rec);
          updated++;
        } else {
          const newRecord = await base44.asServiceRole.entities.Loaners.create(rec);
          created++;
          existingMap.set(rec.importKey, newRecord.id);
          const fallbackKey = `${rec.setId}__${rec.accountName}`.toLowerCase();
          existingBySetAccount.set(fallbackKey, newRecord.id);
        }
        
        await sleep(100);
      }
      
      if (i + BATCH_SIZE < payload.length) {
        await sleep(1000);
      }
    }

    // Update AppSetting with import timestamp
    const appSettings = await base44.asServiceRole.entities.AppSetting.filter({ key: 'import_metadata' });
    if (appSettings.length > 0) {
      await base44.asServiceRole.entities.AppSetting.update(appSettings[0].id, {
        last_imported_at: new Date().toISOString()
      });
    } else {
      await base44.asServiceRole.entities.AppSetting.create({
        key: 'import_metadata',
        last_imported_at: new Date().toISOString()
      });
    }

    return Response.json({ 
      success: true, 
      created, 
      updated, 
      total: created + updated,
      message: `Imported ${created + updated} records (${created} created, ${updated} updated)`
    });

  } catch (error) {
    console.error('Auto import error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});