import { base } from "./styles.mjs";

/** One synthetic person, used across fixtures so cross-document matching is testable. */
export const SUBJECT = {
  surname: "RIVERS",
  givenNames: "ALEX MORGAN",
  display: "Alex Morgan Rivers",
  dob: "1994-03-12",
  address: "Flat 3, 14 Harbour Lane, Bristol, BS1 4TR",
  passportNumber: "987654321",
};

const WEIGHTS = [7, 3, 1];
/** ICAO 9303 check digit: values 0-9, A=10..Z=35, '<'=0, weighted 7-3-1. */
export function checkDigit(input) {
  let sum = 0;
  for (let i = 0; i < input.length; i += 1) {
    const c = input[i];
    const value = c === "<" ? 0 : /[0-9]/.test(c) ? Number(c) : c.charCodeAt(0) - 55;
    sum += value * WEIGHTS[i % 3];
  }
  return String(sum % 10);
}
const pad = (value, length) => value.padEnd(length, "<").slice(0, length);

export function mrz({ surname, givenNames, passportNumber, nationality = "GBR", dob, sex = "M", expiry }) {
  const line1 = pad(`P<${nationality}${surname}<<${givenNames.replace(/ /g, "<")}`, 44);
  const numberField = pad(passportNumber, 9);
  const numberCheck = checkDigit(numberField);
  const dobCheck = checkDigit(dob);
  const expiryCheck = checkDigit(expiry);
  const personal = pad("", 14);
  const personalCheck = checkDigit(personal);
  const composite = checkDigit(`${numberField}${numberCheck}${dob}${dobCheck}${expiry}${expiryCheck}${personal}${personalCheck}`);
  const line2 = `${numberField}${numberCheck}${nationality}${dob}${dobCheck}${sex}${expiry}${expiryCheck}${personal}${personalCheck}${composite}`;
  return { line1, line2 };
}

/** MRZ filler characters are literal "<", which must not be read as HTML. */
const escapeMrz = (line) => line.replace(/</g, "&lt;");

const page = (body, extra = "") => `<!doctype html><meta charset="utf-8"><style>${base}${extra}</style>${body}`;

export function passport({ surname = SUBJECT.surname, givenNames = SUBJECT.givenNames, dob = "940312", expiry = "300415", dobText = "12 MAR / MAR 94", expiryText = "15 APR / AVR 30", number = SUBJECT.passportNumber, degrade = false } = {}) {
  const { line1, line2 } = mrz({ surname, givenNames, passportNumber: number, dob, expiry });
  return page(`
    <div class="doc${degrade ? " degrade" : ""}">
      <div class="watermark">SPECIMEN</div>
      <div class="head"><span>PASSPORT / PASSEPORT</span><span>UNITED KINGDOM OF GREAT BRITAIN</span></div>
      <div class="body">
        <div class="portrait">PHOTO<br>NOT A REAL<br>PERSON</div>
        <dl>
          <div><dt>Type / Type</dt><dd>P</dd></div>
          <div><dt>Code / Code</dt><dd>GBR</dd></div>
          <div><dt>Passport No. / No. du passeport</dt><dd>${number}</dd></div>
          <div><dt>Surname / Nom</dt><dd>${surname}</dd></div>
          <div><dt>Given names / Prenoms</dt><dd>${givenNames}</dd></div>
          <div><dt>Nationality / Nationalite</dt><dd>BRITISH CITIZEN</dd></div>
          <div><dt>Date of birth / Date de naissance</dt><dd>${dobText}</dd></div>
          <div><dt>Sex / Sexe</dt><dd>M</dd></div>
          <div><dt>Date of expiry / Date d expiration</dt><dd>${expiryText}</dd></div>
          <div><dt>Authority / Autorite</dt><dd>HM PASSPORT OFFICE</dd></div>
        </dl>
      </div>
      <div class="mrz">${escapeMrz(line1)}\n${escapeMrz(line2)}</div>
      <p class="specimen">SYNTHETIC SPECIMEN - GENERATED FOR ZIK VAULT TESTS - NOT A REAL DOCUMENT</p>
    </div>`, `
    .doc { position: relative; width: 1050px; height: 740px; padding: 26px 30px; background: linear-gradient(160deg,#f3f0e8,#e7e3d6); }
    .degrade { filter: blur(1.05px) contrast(0.82) brightness(1.06); }
    .head { display: flex; justify-content: space-between; font-size: 15px; font-weight: 700; letter-spacing: 1px; color: #23324d; }
    .body { display: flex; gap: 26px; margin-top: 18px; }
    .portrait { width: 235px; height: 300px; border: 2px solid #8b8776; display: flex; align-items: center; justify-content: center;
      text-align: center; font-size: 15px; color: #6b6757; background: #ded9c9; letter-spacing: 1px; }
    dl { flex: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 10px 22px; margin: 0; }
    dt { font-size: 11px; color: #4b5563; letter-spacing: .4px; }
    dd { margin: 1px 0 0; font-size: 21px; font-weight: 700; letter-spacing: .6px; }
    .mrz { position: absolute; left: 30px; bottom: 44px; }`);
}

export function drivingLicence({ dob = "12.03.1994", name = SUBJECT.display, expiry = "15.06.2031", address = SUBJECT.address } = {}) {
  const [surname, ...rest] = name.split(" ").reverse();
  return page(`
    <div class="doc">
      <div class="watermark">SPECIMEN</div>
      <h1>DRIVING LICENCE <span>SYNTHETIC SPECIMEN</span></h1>
      <div class="grid">
        <div class="portrait">PHOTO<br>NOT A REAL PERSON</div>
        <ol>
          <li><b>1.</b> ${surname.toUpperCase()}</li>
          <li><b>2.</b> ${rest.reverse().join(" ").toUpperCase()}</li>
          <li><b>3.</b> ${dob} BRISTOL</li>
          <li><b>4a.</b> 15.06.2021</li>
          <li><b>4b.</b> ${expiry}</li>
          <li><b>4c.</b> DVLA</li>
          <li><b>5.</b> RIVER905124AM9AB</li>
          <li><b>8.</b> ${address}</li>
          <li><b>9.</b> AM/A/B1/B/f/k/l/n/p/q</li>
        </ol>
      </div>
      <p class="specimen">SYNTHETIC SPECIMEN - GENERATED FOR ZIK VAULT TESTS - NOT A REAL DOCUMENT</p>
    </div>`, `
    .doc { position: relative; width: 1050px; height: 680px; padding: 28px 34px; background: linear-gradient(135deg,#fdf6e6,#efe3c9); }
    h1 { font-size: 25px; letter-spacing: 3px; color: #7a1f2b; margin: 0 0 18px; }
    h1 span { float: right; font-size: 13px; color: #b00020; letter-spacing: 2px; }
    .grid { display: flex; gap: 30px; }
    .portrait { width: 215px; height: 275px; border: 2px solid #9a8f74; display: flex; align-items: center; justify-content: center;
      text-align: center; font-size: 14px; color: #6b6757; background: #e6dcc3; }
    ol { list-style: none; margin: 0; padding: 0; flex: 1; }
    li { font-size: 21px; margin-bottom: 11px; letter-spacing: .3px; }
    b { display: inline-block; width: 42px; color: #7a1f2b; font-size: 15px; }`);
}

export function statement({ title, issuer, name = SUBJECT.display, address = SUBJECT.address, dateLabel = "Statement date", date, reference, lines = [], note = "" }) {
  return page(`
    <div class="doc">
      <div class="watermark">SPECIMEN</div>
      <header><h1>${issuer}</h1><p>${title}</p></header>
      <div class="to"><p>${name}</p><p>${address.split(", ").join("<br>")}</p></div>
      <table>
        <tr><th>${dateLabel}</th><td>${date}</td></tr>
        <tr><th>Reference</th><td>${reference}</td></tr>
        ${lines.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join("")}
      </table>
      ${note ? `<p class="note">${note}</p>` : ""}
      <p class="specimen">SYNTHETIC SPECIMEN - GENERATED FOR ZIK VAULT TESTS - NOT A REAL DOCUMENT</p>
    </div>`, `
    .doc { position: relative; width: 794px; min-height: 1123px; padding: 60px 64px; }
    header { border-bottom: 3px solid #1f3a5f; padding-bottom: 14px; }
    h1 { margin: 0; font-size: 30px; color: #1f3a5f; letter-spacing: .5px; }
    header p { margin: 6px 0 0; font-size: 17px; color: #444; }
    .to { margin: 40px 0; font-size: 18px; line-height: 1.6; }
    .to p { margin: 0 0 10px; }
    table { width: 100%; border-collapse: collapse; font-size: 17px; }
    th, td { text-align: left; padding: 12px 8px; border-bottom: 1px solid #d5d9e0; }
    th { width: 42%; color: #46506a; font-weight: 600; }
    .note { margin-top: 34px; font-size: 15px; color: #555; line-height: 1.6; }`);
}

export function certificate({ name = SUBJECT.display, award = "Level 4 Diploma in Data Practice", issuer = "Bristol Institute of Technology", date = "6 July 2018" } = {}) {
  return page(`
    <div class="doc">
      <div class="watermark">SPECIMEN</div>
      <p class="kicker">${issuer}</p>
      <h1>Certificate of Award</h1>
      <p class="lead">This is to certify that</p>
      <p class="name">${name}</p>
      <p class="lead">has been awarded the</p>
      <p class="award">${award}</p>
      <p class="date">Awarded ${date}</p>
      <p class="sign">Registrar &middot; ${issuer}</p>
      <p class="specimen">SYNTHETIC SPECIMEN - GENERATED FOR ZIK VAULT TESTS - NOT A REAL DOCUMENT</p>
    </div>`, `
    .doc { position: relative; width: 1123px; height: 794px; padding: 70px; text-align: center; border: 14px double #b08a2e; }
    .kicker { margin: 0; letter-spacing: 6px; font-size: 15px; color: #8a6d21; text-transform: uppercase; }
    h1 { font-size: 52px; margin: 26px 0 40px; font-family: Georgia, serif; color: #2c2c2c; }
    .lead { font-size: 20px; color: #555; margin: 16px 0; }
    .name { font-family: Georgia, serif; font-size: 42px; margin: 12px 0; }
    .award { font-size: 30px; font-weight: 700; margin: 12px 0 34px; }
    .date { font-size: 19px; color: #444; }
    .sign { margin-top: 46px; font-size: 16px; color: #666; }`);
}

export function contract({ partyOne = SUBJECT.display, partyTwo = "Northbank Studios Ltd", companyAddress = "200 Quay Street, Manchester, M3 4JB", date = "4 February 2025" } = {}) {
  return page(`
    <div class="doc">
      <div class="watermark">SPECIMEN</div>
      <h1>Services Agreement</h1>
      <p>This agreement is made on ${date} between:</p>
      <ol>
        <li><b>${partyTwo}</b>, a company registered in England and Wales, whose registered office is at ${companyAddress} ("the Company"); and</li>
        <li><b>${partyOne}</b> ("the Contractor").</li>
      </ol>
      <h2>1. Term</h2><p>The Contractor shall provide the services from 1 March 2025 until terminated under clause 6.</p>
      <h2>2. Fees</h2><p>The Company shall pay the Contractor a fee of GBP 420 per day, invoiced monthly in arrears.</p>
      <h2>3. Confidentiality</h2><p>Each party shall keep confidential all information disclosed under this agreement.</p>
      <div class="signatures"><div>Signed for the Company<br><span>Dana Whitcombe, Director</span></div><div>Signed by the Contractor<br><span>${partyOne}</span></div></div>
      <p class="specimen">SYNTHETIC SPECIMEN - GENERATED FOR ZIK VAULT TESTS - NOT A REAL DOCUMENT</p>
    </div>`, `
    .doc { position: relative; width: 794px; min-height: 1123px; padding: 66px 70px; font-size: 16px; line-height: 1.65; }
    h1 { font-size: 27px; margin: 0 0 26px; letter-spacing: .5px; }
    h2 { font-size: 17px; margin: 26px 0 6px; }
    ol { padding-left: 20px; } li { margin-bottom: 12px; }
    .signatures { display: flex; gap: 40px; margin-top: 54px; font-size: 15px; }
    .signatures div { flex: 1; border-top: 1px solid #999; padding-top: 10px; }
    .signatures span { color: #555; }`);
}

export function unreadable() {
  return page(`<div class="doc"><div class="blob">l&nbsp;&nbsp;ii</div><p class="specimen">SYNTHETIC SPECIMEN - DELIBERATELY UNREADABLE</p></div>`, `
    .doc { position: relative; width: 760px; height: 540px; background: #6d6a63; filter: blur(7px) contrast(0.35); }
    .blob { color: #6a6760; font-size: 92px; padding: 180px 0 0 80px; }`);
}
