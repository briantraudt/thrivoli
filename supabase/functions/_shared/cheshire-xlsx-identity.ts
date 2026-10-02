// Resolve source identity before extracting values. Unsupported or ambiguous packages fail closed.
const SHEET_NS='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const OFFICE_REL='http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
const PACKAGE_REL='http://schemas.openxmlformats.org/package/2006/relationships';
const TYPES_NS='http://schemas.openxmlformats.org/package/2006/content-types';
const SHEET_TYPE='application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml';
const WORKBOOK_TYPE='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml';
const STRINGS_TYPE='application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml';
export type XlsxXmlBudget={nodes:number;attributes:number;nameChars:number};
export const createXlsxXmlBudget=():XlsxXmlBudget=>({nodes:25000,attributes:50000,nameChars:4*1024*1024});
type Element={name:string;path:string[];attrs:Map<string,string>;text:string;children:Element[]};
function fail():never {throw new Error('Workbook worksheet identity is ambiguous or unsupported. Export one visible monthly aggregate sheet for review.');}
function decode(value:string){
 if(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-fA-F]+;)/.test(value))fail();
 return value.replace(/&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/g,(_,entity:string)=>{
  const named:Record<string,string>={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"};if(entity[0]!=='#')return named[entity];
  const n=entity[1]==='x'?parseInt(entity.slice(2),16):Number(entity.slice(1));if(!(n===9||n===10||n===13||n>=32&&n<=0x10ffff&&!(n>=0xd800&&n<=0xdfff)))fail();return String.fromCodePoint(n);
 });
}
/** Bounded, namespace-aware XML tree for package identity and cell content; no DTDs or entities. */
function elements(xml:string,maxElements=20000,budget=createXlsxXmlBudget()):Element[]{
 if(/<!DOCTYPE|<!ENTITY|<!\[CDATA\[/i.test(xml))fail();
 for(const char of xml)if(char.charCodeAt(0)<32&&!['\t','\n','\r'].includes(char))fail();
 const result:Element[]=[];const stack:{qname:string;name:string;ns:Map<string,string>;node:Element}[]=[];let offset=xml.charCodeAt(0)===0xfeff?1:0;let roots=0;
 while(offset<xml.length){
  if(xml.startsWith('<!--',offset)){const end=xml.indexOf('-->',offset+4);if(end<0||xml.slice(offset+4,end).includes('--'))fail();offset=end+3;continue;}
  if(xml.startsWith('<?xml ',offset)&&!result.length&&!stack.length){const end=xml.indexOf('?>',offset+6);if(end<0)fail();offset=end+2;continue;}
  if(xml[offset]!=='<'){const next=xml.indexOf('<',offset);const end=next<0?xml.length:next;if(end-offset>20000)fail();const text=decode(xml.slice(offset,end));if(text.includes(']]>'))fail();if(!stack.length&&text.trim())fail();if(stack.length){const node=stack.at(-1)!.node;node.text+=text;if(node.text.length>20000)fail();}offset=end;continue;}
  const close=xml.slice(offset).match(/^<\/([A-Za-z_][\w.:-]*)\s*>/);if(close){if(stack.pop()?.qname!==close[1])fail();offset+=close[0].length;continue;}
  const start=xml.slice(offset).match(/^<([A-Za-z_][\w.:-]*)/);if(!start||start[1].length>128)fail();offset+=start[0].length;
  const attributes=new Map<string,string>();let empty=false;
  while(true){const rest=xml.slice(offset);const end=rest.match(/^\s*(\/?)>/);if(end){empty=end[1]==='/';offset+=end[0].length;break;}
   const attr=rest.match(/^\s+([A-Za-z_][\w.:-]*)\s*=\s*(?:"([^"<]*)"|'([^'<]*)')/);if(!attr||attr[1].length>128||attributes.has(attr[1])||attributes.size>=64||attr[0].length>20000||--budget.attributes<0)fail();attributes.set(attr[1],decode(attr[2]??attr[3]));offset+=attr[0].length;
  }
  let ns=stack.at(-1)?.ns??new Map([['xml','http://www.w3.org/XML/1998/namespace']]);if([...attributes.keys()].some(key=>key==='xmlns'||key.startsWith('xmlns:')))ns=new Map(ns);for(const [key,value]of attributes){if(key==='xmlns'||key.startsWith('xmlns:')){if(value.length>256)fail();ns.set(key==='xmlns'?'':key.slice(6),value);}}
  if(ns.size>64)fail();
  const expand=(name:string,attribute=false)=>{const parts=name.split(':');if(parts.length>2)fail();const prefix=parts.length===2?parts[0]:'';const uri=attribute&&!prefix?'':ns.get(prefix)??'';if(prefix&&!uri)fail();const expanded=`{${uri}}${parts.at(-1)}`;budget.nameChars-=expanded.length;if(budget.nameChars<0)fail();return expanded;};
  const name=expand(start[1]);const attrs=new Map<string,string>();for(const [key,value]of attributes){if(key==='xmlns'||key.startsWith('xmlns:'))continue;const expanded=expand(key,true);if(attrs.has(expanded))fail();attrs.set(expanded,value);}
  if(!stack.length&&++roots!==1)fail();if(stack.length>30||result.length>=maxElements||--budget.nodes<0)throw new Error('Workbook XML exceeds the supported review complexity. Export one smaller aggregate sheet or CSV for review.');const node:Element={name,path:[...stack.map(item=>item.name),name],attrs,text:'',children:[]};stack.at(-1)?.node.children.push(node);result.push(node);if(!empty)stack.push({qname:start[1],name,ns,node});
 }
 if(stack.length||roots!==1)fail();return result;
}
const field=(node:Element,key:string)=>node.attrs.get(`{}${key}`)??'';
function part(target:string,source:string){
 // Fail closed on URI encodings, queries, fragments, schemes, empty segments and backslashes.
 if(!target||/[\\%?#:\s]/.test(target))fail();const segments=target.startsWith('/')?[]:source.split('/').slice(0,-1);
 for(const segment of target.replace(/^\//,'').split('/')){if(!segment)fail();if(segment==='.')continue;if(segment==='..'){if(!segments.length)fail();segments.pop();}else segments.push(segment);}
 if(!segments.length)fail();return segments.join('/');
}
function relationships(xml:string,source:string,budget:XlsxXmlBudget){
 const nodes=elements(xml,20000,budget),root=`{${PACKAGE_REL}}Relationships`;if(nodes[0].name!==root)fail();const found=new Map<string,{type:string;target:string}>();
 for(const node of nodes.slice(1)){if(node.name!==`{${PACKAGE_REL}}Relationship`||node.path.length!==2)fail();const id=field(node,'Id'),type=field(node,'Type'),mode=field(node,'TargetMode');if(!id||!type||found.has(id)||mode&&mode!=='Internal')fail();found.set(id,{type,target:part(field(node,'Target'),source)});}
 return found;
}
export function resolveXlsxIdentity(names:string[],read:(name:string)=>string,budget=createXlsxXmlBudget()){
 const known=new Set(names);const required=(name:string)=>{if(!known.has(name))fail();return read(name);};
 const roots=relationships(required('_rels/.rels'),'',budget);const offices=[...roots.values()].filter(rel=>rel.type===OFFICE_REL+'officeDocument');if(offices.length!==1)fail();const workbook=offices[0].target;
 const typeNodes=elements(required('[Content_Types].xml'),20000,budget),typeRoot=`{${TYPES_NS}}Types`;if(typeNodes[0].name!==typeRoot)fail();const overrides=new Map<string,string>(),defaults=new Map<string,string>();
 for(const node of typeNodes.slice(1)){if(node.path.length!==2)fail();if(node.name===`{${TYPES_NS}}Override`){const raw=field(node,'PartName');if(!raw.startsWith('/'))fail();const name=part(raw,'');if(overrides.has(name))fail();overrides.set(name,field(node,'ContentType'));}else if(node.name===`{${TYPES_NS}}Default`){const ext=field(node,'Extension');if(!ext||defaults.has(ext))fail();defaults.set(ext,field(node,'ContentType'));}else fail();}
 const type=(name:string)=>overrides.get(name)??defaults.get(name.split('.').at(-1)??'');if(type(workbook)!==WORKBOOK_TYPE)fail();
 const nodes=elements(required(workbook),20000,budget),root=`{${SHEET_NS}}workbook`,sheets=`{${SHEET_NS}}sheets`,sheet=`{${SHEET_NS}}sheet`;if(nodes[0].name!==root||nodes.filter(node=>node.name===sheets).length!==1)fail();
 const slash=workbook.lastIndexOf('/'),relsName=workbook.slice(0,slash+1)+'_rels/'+workbook.slice(slash+1)+'.rels';const rels=relationships(required(relsName),workbook,budget);
 // Inspect every relationship file, including worksheet relationships; never follow external content.
 for(const name of names.filter(name=>name.endsWith('.rels')&&name!==relsName&&name!=='_rels/.rels')){const source=name.replace(/(^|\/)_rels\//,'$1').slice(0,-5);relationships(required(name),source,budget);}
 const targets:string[]=[],ids=new Set<string>(),sheetIds=new Set<string>(),sheetNames=new Set<string>();
 for(const node of nodes.filter(node=>node.name===sheet||node.path.includes(sheets)&&node.name!==sheets)){
  if(node.name!==sheet||node.path.join('/')!==[root,sheets,sheet].join('/'))fail();const id=node.attrs.get(`{${OFFICE_REL.slice(0,-1)}}id`)??'',sheetId=field(node,'sheetId'),name=field(node,'name'),state=field(node,'state');const rel=rels.get(id);
  if(!id||ids.has(id)||!/^[1-9]\d*$/.test(sheetId)||sheetIds.has(sheetId)||!name||sheetNames.has(name)||state&&state!=='visible'||!rel||rel.type!==OFFICE_REL+'worksheet'||targets.includes(rel.target)||type(rel.target)!==SHEET_TYPE)fail();required(rel.target);ids.add(id);sheetIds.add(sheetId);sheetNames.add(name);targets.push(rel.target);
 }
 if(!targets.length)fail();for(const [id,rel]of rels){if(rel.type===OFFICE_REL+'worksheet'&&!ids.has(id))fail();}
 // Orphan worksheet parts must not be silently accepted or discarded, even with unusual filenames.
 for(const name of new Set([...names,...overrides.keys()]))if((type(name)===SHEET_TYPE||/^xl\/worksheets\/.*\.xml$/.test(name))&&!targets.includes(name))fail();
 const strings=[...rels.values()].filter(rel=>rel.type===OFFICE_REL+'sharedStrings');if(strings.length>1)fail();const sharedStrings=strings[0]?.target??null;if(sharedStrings&&(type(sharedStrings)!==STRINGS_TYPE||!known.has(sharedStrings)))fail();
 for(const name of names)if((type(name)===STRINGS_TYPE||name==='xl/sharedStrings.xml')&&name!==sharedStrings)fail();
 return {worksheets:targets,sharedStrings};
}

const tag=(name:string)=>`{${SHEET_NS}}${name}`;
function stringValue(node:Element){
 if(node.text.trim())fail();let value='';if(node.children.some(child=>child.name===tag('t'))&&(node.children.length!==1||node.children[0].name!==tag('t')))fail();
 for(const child of node.children){
  if(child.name===tag('t')){if(child.children.length)fail();value+=child.text;}
  else if(child.name===tag('r')){if(child.text.trim())fail();let texts=0,formats=0;for(const rich of child.children){if(rich.name===tag('t')){if(rich.children.length||++texts>1)fail();value+=rich.text;}else if(rich.name!==tag('rPr')||++formats>1||texts)fail();}if(texts!==1)fail();}
  else fail();
 }
 return value;
}
export function readXlsxStrings(xml:string,budget=createXlsxXmlBudget()){
 const nodes=elements(xml,25000,budget);if(nodes[0].name!==tag('sst')||nodes[0].text.trim())fail();
 return nodes[0].children.map(node=>{if(node.name!==tag('si'))fail();return stringValue(node);});
}
export function readXlsxCells(xml:string,budget=createXlsxXmlBudget()){
 const nodes=elements(xml,25000,budget),root=nodes[0];if(root.name!==tag('worksheet')||root.text.trim())fail();
 const sheetData=root.children.filter(node=>node.name===tag('sheetData'));if(sheetData.length!==1)fail();
 // No cell-bearing nodes may hide in extensions, comments or otherwise ignored structures.
 const dataNames=new Set(['sheetData','row','c','v','f','is','t'].map(tag));
 const consumed=new Set<Element>([sheetData[0]]);const cells:{coordinate:string;type:string;value:string|null;formula:boolean}[]=[];const coordinates=new Set<string>();const rowIds=new Set<number>();
 if(sheetData[0].text.trim())fail();
 for(const row of sheetData[0].children){
  if(row.name!==tag('row')||row.text.trim())fail();consumed.add(row);const rowId=Number(field(row,'r'));if(!Number.isInteger(rowId)||rowId<1||rowIds.has(rowId))fail();rowIds.add(rowId);
  if(['1','true'].includes(field(row,'hidden')))fail();
  for(const cell of row.children){
   if(cell.name!==tag('c')||cell.text.trim())fail();consumed.add(cell);const coordinate=field(cell,'r'),type=field(cell,'t');if(!/^[A-Z]+[1-9]\d*$/.test(coordinate)||Number(coordinate.match(/\d+$/)![0])!==rowId||coordinates.has(coordinate))fail();coordinates.add(coordinate);
   let value:string|null=null,formula=false,values=0,inline=false;
   for(const child of cell.children){consumed.add(child);if(child.name===tag('v')){if(child.children.length||++values>1)fail();value=child.text;}else if(child.name===tag('f')){if(child.children.length||formula)fail();formula=true;}else if(child.name===tag('is')){if(inline)fail();inline=true;value=stringValue(child);const mark=(node:Element)=>{consumed.add(node);node.children.forEach(mark);};child.children.forEach(mark);}else fail();}
   if(inline&&(type!=='inlineStr'||values)||type==='inlineStr'&&!inline)fail();cells.push({coordinate,type,value,formula});
  }
 }
 for(const node of nodes)if(dataNames.has(node.name)&&!consumed.has(node))fail();
 return cells;
}

