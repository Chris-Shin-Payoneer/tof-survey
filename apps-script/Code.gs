/**
 * APAC BD — Top-of-Funnel Planning Survey · backend
 * -------------------------------------------------
 * - Receives survey JSON (doPost) and writes each BD's monthly PLAN into a
 *   Google Sheet laid out like Acquisition_ToF_Planning.xlsx.
 * - You fill the ACTUAL columns (L,M,N) over time as leads come in.
 * - Serves a live JSON feed (doGet) that powers dashboard.html.
 *
 * Conversion Rate (=SQL/MQL) and Plan Revenue (=SQL×ARPU) are live formulas,
 * so the workbook recalculates after you download it as .xlsx.
 *
 * SETUP (one time):
 *   1. New Google Sheet → Extensions → Apps Script.
 *   2. Paste this whole file over Code.gs. Save.
 *   3. Run setup() once and authorize.
 *   4. Deploy → New deployment → Web app:
 *        Execute as: Me   |   Who has access: Anyone
 *      Copy the Web app URL into ENDPOINT_URL in BOTH index.html and dashboard.html.
 */

const SHEET_NAME   = "ToF Planning";
const CONTEXT_NAME = "Context";
const BLOCK_ROWS   = 7;            // 1 header + 6 channels
const ORG_ICP_TARGET = 50000;     // the 50K ICP lead goal (shown on the dashboard)

// Keep this order identical to ROSTER in index.html.
const ROSTER = [
  { name:"Jay Gye",        agency:"Growth Automation" },
  { name:"Casa Hoang",     agency:"Telestar" },
  { name:"Kunsuk Kim",     agency:"Growth Automation" },
  { name:"Wayne Nguyen",   agency:"Telestar" },
  { name:"Patrick Simeon", agency:"ScaleMill" },
  { name:"Natalie Fong",   agency:"ScaleMill" },
  { name:"Trang Nguyen",   agency:"Telestar" },
  { name:"Mizuki Toku",    agency:"Growth Automation" },
  { name:"Jaejun Lee",     agency:"Growth Automation" },
  { name:"Son Le",         agency:"Growth Automation" },
];

// Column layout (1-indexed):
// A name | B Lead Channel | C Sub-channel | D MQL?SQL? | E Plan MQL | F Plan SQL
// G Touch | H Conversion(=F/E) | I ARPU($) | J TICP# | K Plan Revenue(=F*I)
// L Actual MQL | M Actual SQL | N Actual TICP   ← you fill L,M,N
const HEADER = ["", "Lead Channel", "Sub-channel", "MQL? SQL?",
                "Expected MQL #", "Expected SQL #", "Touch Level",
                "Conversion Rate", "ARPU ($)", "TICP #", "Plan Revenue ($)",
                "Actual MQL #", "Actual SQL #", "Actual TICP #"];
const NCOL = HEADER.length;

function channelsFor(agency){
  return [
    ["Marketing",        "Score A Leads",  "SQL"],   // designation overwritten by survey
    ["Marketing Agency", agency,           "MQL"],
    ["AnP",              "CSP Leads",      "SQL"],
    ["AnP",              "Other AnP Leads","SQL"],
    ["Sales Outbound",   "SDR",            "SQL"],
    ["Sales Outbound",   "BD Outbound",    "MQL"],
  ];
}

/** Build the full template layout. Safe to re-run (clears the plan sheet). */
function setup(){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  sh.clear();

  ROSTER.forEach((bd, i) => {
    const top = i * BLOCK_ROWS + 1;
    const head = HEADER.slice(); head[0] = bd.name;
    const hr = sh.getRange(top, 1, 1, NCOL).setValues([head])
      .setFontWeight("bold").setFontColor("#ffffff");
    hr.offset(0,0,1,11).setBackground("#11203a");        // A:K plan group
    hr.offset(0,11,1,3).setBackground("#b07400");        // L:N actual group (you fill)
    const chans = channelsFor(bd.agency);
    const body = chans.map(c => ["", c[0], c[1], c[2], "", "", "", "", "", "", "", "", "", ""]);
    sh.getRange(top + 1, 1, body.length, NCOL).setValues(body);
    for (let r = 0; r < chans.length; r++){
      const row = top + 1 + r;
      sh.getRange(row, 8).setFormula(`=IFERROR(F${row}/E${row},"")`).setNumberFormat("0.0%");
      sh.getRange(row,11).setFormula(`=IFERROR(F${row}*I${row},"")`).setNumberFormat("$#,##0");
      sh.getRange(row, 9).setNumberFormat("$#,##0");
    }
  });
  sh.setColumnWidths(1, NCOL, 110);
  sh.setColumnWidth(2, 130); sh.setColumnWidth(3, 140); sh.setColumnWidth(7, 150);

  // context
  let cx = ss.getSheetByName(CONTEXT_NAME) || ss.insertSheet(CONTEXT_NAME);
  cx.clear();
  cx.getRange(1,1,1,6).setValues([[
    "BD","Monthly lead capacity","1:1 touch capacity","Bottlenecks","Ideal scenario","Last updated"
  ]]).setFontWeight("bold").setBackground("#11203a").setFontColor("#ffffff");
  ROSTER.forEach((bd,i)=> cx.getRange(i+2,1).setValue(bd.name));
  cx.setColumnWidth(4,260); cx.setColumnWidth(5,360);
}

/** Find a BD's header row (1-based) or append a new block. */
function blockTopFor(sh, name){
  const last = Math.max(sh.getLastRow(),1);
  const vals = sh.getRange(1,1,last,2).getValues();
  for (let r = 0; r < vals.length; r++){
    if (String(vals[r][0]).trim() === name && String(vals[r][1]).trim() === "Lead Channel") return r + 1;
  }
  const top = last + 2;
  const head = HEADER.slice(); head[0] = name;
  sh.getRange(top,1,1,NCOL).setValues([head]).setFontWeight("bold").setFontColor("#ffffff")
    .setBackground("#11203a");
  return top;
}

function doPost(e){
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try{
    const p = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sh = ss.getSheetByName(SHEET_NAME);
    if (!sh){ setup(); sh = ss.getSheetByName(SHEET_NAME); }

    const top = blockTopFor(sh, p.bd);
    (p.rows || []).forEach((r, i) => {
      const row = top + 1 + i;
      if (r.type)         sh.getRange(row, 4).setValue(r.type);   // D designation (Score A varies)
      if (r.mql   != null) sh.getRange(row, 5).setValue(r.mql);
      if (r.sql   != null) sh.getRange(row, 6).setValue(r.sql);
      if (r.touch)         sh.getRange(row, 7).setValue(r.touch);
      if (r.arpu  != null) sh.getRange(row, 9).setValue(r.arpu);
      if (r.ticp  != null) sh.getRange(row,10).setValue(r.ticp);
      sh.getRange(row, 8).setFormula(`=IFERROR(F${row}/E${row},"")`).setNumberFormat("0.0%");
      sh.getRange(row,11).setFormula(`=IFERROR(F${row}*I${row},"")`).setNumberFormat("$#,##0");
    });

    // context
    let cx = ss.getSheetByName(CONTEXT_NAME) || ss.insertSheet(CONTEXT_NAME);
    const names = cx.getRange(1,1,Math.max(cx.getLastRow(),1),1).getValues().map(x=>String(x[0]).trim());
    let cr = names.indexOf(p.bd);
    cr = cr >= 0 ? cr + 1 : cx.getLastRow() + 1;
    cx.getRange(cr,1,1,6).setValues([[
      p.bd, p.capacityTotal ?? "", p.capacityTouch ?? "", p.bottlenecks || "", p.ideal || "", new Date()
    ]]);

    return json({ status:"ok", bd:p.bd });
  }catch(err){
    return json({ status:"error", message:String(err) });
  }finally{
    lock.releaseLock();
  }
}

/** Live feed for dashboard.html */
function doGet(){
  try{
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(SHEET_NAME);
    if (!sh) return json({ status:"ok", generatedAt:new Date().toISOString(), orgIcpTarget:ORG_ICP_TARGET, managers:[] });

    const last = Math.max(sh.getLastRow(),1);
    const data = sh.getRange(1,1,last,NCOL).getValues();
    const num = v => (v===""||v==null) ? 0 : Number(v) || 0;
    const managers = [];

    for (let r = 0; r < data.length; r++){
      if (String(data[r][1]).trim() === "Lead Channel"){      // header row
        const bd = String(data[r][0]).trim();
        const rows = [];
        for (let k = 1; k <= 6 && (r+k) < data.length; k++){
          const d = data[r+k];
          if (String(d[1]).trim()==="" && String(d[2]).trim()==="") break;
          rows.push({
            leadChannel:String(d[1]).trim(), subChannel:String(d[2]).trim(), type:String(d[3]).trim(),
            planMql:num(d[4]), planSql:num(d[5]), arpu:num(d[8]), ticp:num(d[9]),
            planRevenue:num(d[10]) || (num(d[5])*num(d[8])),
            actMql:num(d[11]), actSql:num(d[12]), actTicp:num(d[13])
          });
        }
        const meta = ROSTER.find(x=>x.name===bd);
        managers.push({ bd, agency: meta?meta.agency:"", rows });
      }
    }
    return json({ status:"ok", generatedAt:new Date().toISOString(), orgIcpTarget:ORG_ICP_TARGET, managers });
  }catch(err){
    return json({ status:"error", message:String(err) });
  }
}

function json(obj){
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
