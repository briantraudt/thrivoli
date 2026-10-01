import {zipSync,strToU8} from 'fflate';
export const NS='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
export const REL='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
export const PKG='http://schemas.openxmlformats.org/package/2006/relationships';
export const CT='http://schemas.openxmlformats.org/package/2006/content-types';
export const sheetType='application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml';
export const stringsType='application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml';
export function xlsxParts(worksheet,extra={}){
 const sheets={'xl/worksheets/sheet1.xml':worksheet,...Object.fromEntries(Object.entries(extra).filter(([name])=>/^xl\/worksheets\/.+\.xml$/.test(name)))};
 const strings=Object.hasOwn(extra,'xl/sharedStrings.xml');
 const parts={
  '[Content_Types].xml':`<Types xmlns="${CT}"><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${Object.keys(sheets).map(name=>`<Override PartName="/${name}" ContentType="${sheetType}"/>`).join('')}${strings?`<Override PartName="/xl/sharedStrings.xml" ContentType="${stringsType}"/>`:''}</Types>`,
  '_rels/.rels':`<Relationships xmlns="${PKG}"><Relationship Id="office" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
  'xl/workbook.xml':`<workbook xmlns="${NS}" xmlns:r="${REL}"><sheets>${Object.keys(sheets).map((name,i)=>`<sheet name="Synthetic ${i+1}" sheetId="${i+1}" r:id="sheet${i+1}"/>`).join('')}</sheets></workbook>`,
  'xl/_rels/workbook.xml.rels':`<Relationships xmlns="${PKG}">${Object.keys(sheets).map((name,i)=>`<Relationship Id="sheet${i+1}" Type="${REL}/worksheet" Target="${name.slice(3)}"/>`).join('')}${strings?`<Relationship Id="strings" Type="${REL}/sharedStrings" Target="sharedStrings.xml"/>`:''}</Relationships>`,
  ...sheets,...extra
 };
 return Object.fromEntries(Object.entries(parts).map(([name,value])=>[name,typeof value==='string'?strToU8(value.replace('<worksheet>',`<worksheet xmlns="${NS}">`)):value]));
}
export const xlsx=(worksheet,extra={})=>zipSync(xlsxParts(worksheet,extra));
