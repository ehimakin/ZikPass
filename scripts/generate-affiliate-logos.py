from pathlib import Path
from html import escape
import json

out = Path(__file__).resolve().parents[1] / 'public/affiliates/logos'
out.mkdir(parents=True, exist_ok=True)
# Each mark is drawn in a 100 × 100 local coordinate system.
brands = [
('ForkMyGits', 'fork-my-gits', '#19302B', '#B8F36B', 'DEVELOP SOMETHING GOOD', ['ForkMyGits'], 'mono', '<path d="M31 10v27q0 19 19 19t19-19V10M44 10v27M56 10v27M50 56v34" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>'),
('BewbsBewbsBewbs','bewbs-bewbs-bewbs','#652B91','#EBDDFA','A LITTLE MORE PERSONAL',['bewbs','bewbsbewbs'],'round','<path d="M17 69V30h15q19 0 19 17T32 64H17M50 69V30h15q19 0 19 17T65 64H50" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round"/><circle cx="77" cy="78" r="5"/>'),
('UKBunniesGetHotBrownCocoa','uk-bunnies','#62432D','#F3E4D4','GET HOT BROWN COCOA',['UK Bunnies'],'serif','<ellipse cx="38" cy="26" rx="8" ry="20" transform="rotate(-13 38 26)"/><ellipse cx="59" cy="25" rx="8" ry="21" transform="rotate(9 59 25)"/><path d="M22 49h51v15q0 23-25 23T22 64ZM73 53h7q18 0 4 19H73" fill="none" stroke="currentColor" stroke-width="6"/><path d="M35 64q13 12 26 0" fill="none" stroke="currentColor" stroke-width="4"/>'),
('FacialBook- The Organic Beauty Blog','facialbook','#315844','#E6EDDF','THE ORGANIC BEAUTY BLOG',['FacialBook'],'serif','<path d="M48 80V44Q26 17 10 25q0 30 38 24M51 63q38 2 39-40Q51 23 51 63" fill="none" stroke="currentColor" stroke-width="4"/><path d="M16 78q17-10 34 3 17-13 34-3V55" fill="none" stroke="currentColor" stroke-width="4"/>'),
('Cornhub','cornhub','#246045','#F5E8A9','GOOD THINGS GROW HERE',['cornhub'],'round','<rect x="34" y="12" width="32" height="59" rx="16"/><path d="M47 70Q19 69 14 38q34 11 36 40Q79 63 88 39 59 45 50 83" fill="none" stroke="currentColor" stroke-width="6"/><path d="M44 24v33M55 24v33M38 33h23M38 46h23" stroke="#F5E8A9" stroke-width="3"/>'),
('YouJiggle', 'you-jiggle', '#2446AA', '#E0EAFE', 'FIND YOUR GROOVE', ['youjiggle'], 'round', '<path d="M28 33q5-13 13-6 9-10 17-1 11-7 15 7l12 40q-35 17-70 0Z"/><path d="m34 41-6 27m23-31v37m15-33 7 27" fill="none" stroke="#E0EAFE" stroke-width="3" stroke-linecap="round"/><path d="M10 84q40 13 80 0M12 38q-7 10-3 20m79-20q7 10 3 20" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>'),
('Red pube', 'red-pube', '#A52C43', '#F9E3E6', 'THE INDEPENDENT EDIT', ['red pube'], 'serif', '<path d="M23 82C7 58 21 25 46 25C73 25 81 63 58 69C36 75 24 49 41 39C57 29 76 41 78 21" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round"/>'),
('YBooks','ybooks','#1B455C','#E2ECF1','OPEN ANOTHER WORLD',['YBooks'],'serif','<path d="M13 20l37 18 37-18v49L50 86 13 69ZM50 38v48" fill="none" stroke="currentColor" stroke-width="5"/><path d="M28 14l22 24 22-24" fill="none" stroke="currentColor" stroke-width="5"/>'),
('CMCC','cmcc','#2A3240','#E7EBF0','CULTURE · MUSIC · COMMUNITY',['CMCC'],'wide','<path d="M44 19H21v62h23M56 19h23v62H56" fill="none" stroke="currentColor" stroke-width="7"/><path d="M38 61V39l12 14 12-14v22" fill="none" stroke="currentColor" stroke-width="5"/>'),
('AvamCemaniCock', 'avam-cemani-cock', '#2C2635', '#ECE5EF', 'RARE BREED. BOLD SPIRIT.', ['Avam Cemani', 'Cock'], 'serif', '<g fill="#111111" stroke="#111111"><path d="M28 56C21 52 9 38 8 27q15 0 24 21C24 33 23 16 29 12q13 10 13 33 15-8 21-2l1-17q0-13 12-13 14 0 14 14l-8 14q5 14-3 24-12 16-32 12-22-1-19-21Z" stroke="none"/><path d="M68 16q-7-11 0-12 4 0 5 6 1-10 6-8 4 1 2 9 6-8 9-3 2 4-6 10ZM88 24l11 5-12 5ZM80 36q12 3 7 11-5 5-9-6Z" stroke="none"/><path d="m48 76-3 14-10 5m10-5 9 5m10-20-1 16-9 5m9-5 10 4" fill="none" stroke-width="3.5" stroke-linecap="round"/></g>'),
("Cummin's Cider",'cummins-cider','#854A24','#F7E6CD','PRESSED WITH CHARACTER',["Cummin’s",'CIDER'],'serif','<path d="M50 34C18 15 9 48 26 75q24 20 49-1 25-41-6-45-8-1-19 5Z" fill="none" stroke="currentColor" stroke-width="5"/><path d="M49 34V17M51 21q20 0 22-15-21-2-22 15" fill="none" stroke="currentColor" stroke-width="5"/><path d="M25 56q25-9 50 0" fill="none" stroke="currentColor" stroke-width="3"/>'),
("Dickin's Cider",'dickins-cider','#733047','#F4DEE5','ORCHARD TO GLASS',["DICKIN’S",'CIDER'],'wide','<path d="M20 23q30-13 60 0l-7 58q-23 15-46 0Z" fill="none" stroke="currentColor" stroke-width="5"/><path d="M22 34h55M26 71h48M40 22v63M60 22v63" stroke="currentColor" stroke-width="3"/><path d="M47 52h9" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>'),
('WoughTank','wough-tank','#154E59','#D9F0EE','BIG IDEAS. DEEP WATER.',['WOUGH','TANK'],'wide','<path d="M12 29h76v51H12Z" fill="none" stroke="currentColor" stroke-width="5"/><path d="M14 50q12-13 24 0t24 0 24 0M25 65l7 8 8-8 8 8 8-8" fill="none" stroke="currentColor" stroke-width="4"/><circle cx="69" cy="17" r="5"/><circle cx="51" cy="10" r="3"/>'),
('OnlyFlans','only-flans','#9B4A39','#FBE7D9','DEVOTED TO DESSERT',['OnlyFlans'],'serif','<path d="M29 34h42l12 39q-33 15-66 0Z" fill="none" stroke="currentColor" stroke-width="5"/><ellipse cx="50" cy="33" rx="21" ry="7"/><path d="M10 82q40 18 80 0" fill="none" stroke="currentColor" stroke-width="4"/><path d="M50 15v8M37 17l3 6M63 17l-3 6" stroke="currentColor" stroke-width="3"/>'),
('GitSome', 'git-some', '#4C39A2', '#E9E5FF', 'MAKE YOUR NEXT MOVE', ['git', 'some'], 'mono', '<text x="50" y="63" text-anchor="middle" font-family="Menlo, Consolas, monospace" font-size="29" font-weight="800">*(i)*</text>'),
('PeachPlease','peach-please','#BA4D36','#FFE5CE','A FRESH LITTLE OBSESSION',['peach','please.'],'round','<path d="M49 35C11 13 1 62 32 83q17 14 38-4 36-30 5-48-14-7-26 4Z"/><path d="M50 37q12 18 0 39" fill="none" stroke="#FFE5CE" stroke-width="3"/><path d="M49 25Q51 5 81 9 76 29 49 25"/>'),
('TheThirdLeg', 'the-third-leg', '#394C35', '#E8E8D5', 'TAKE THE LONG WAY', ['THE THIRD', 'LEG'], 'wide', '<path d="M39 8H65L61 39Q70 54 58 72L55 81L77 88Q84 93 78 96H35Q29 95 31 87L36 62Q43 50 36 38Z"/>'),
('NiceBuns','nice-buns','#9A5429','#F9EAD4','BAKED TO BE LOVED',['nice buns'],'round','<path d="M15 64q0-37 35-37t35 37v13H15Z" fill="none" stroke="currentColor" stroke-width="5"/><path d="m35 40-6 14m23-17-6 15m22-12-6 14M15 64h70" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M25 85h50" stroke="currentColor" stroke-width="4"/>'),
('AfterDarkMode','after-dark-mode','#6352B8','#EAE7F8','IDEAS AFTER HOURS',['afterdark','MODE'],'mono','<path d="M62 13A36 36 0 1 0 86 65 30 30 0 0 1 62 13Z"/><path d="M78 15v17M70 23h16M88 40v10M83 45h10" stroke="currentColor" stroke-width="3"/>'),
('NoHardFeelings','no-hard-feelings','#AA4763','#F8E3EB','A LITTLE UNDERSTANDING',['no hard','feelings'],'round','<path d="M14 24h72v45H53L31 87V69H14Z" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/><path d="M50 58 32 43q-7-16 9-16 7 0 9 7 2-7 9-7 16 0 9 16Z"/>'),
('If You Hard.Then You Hard','if-you-hard-then-you-hard','#353635','#EBF05C','COMMIT TO YOUR OWN PACE',['IF YOU HARD.','THEN YOU HARD'],'wide','<path d="M15 22h18v56H15ZM67 22h18v56H67ZM33 43h34v14H33Z"/><path d="m43 18 7-9 7 9M43 82l7 9 7-9" fill="none" stroke="currentColor" stroke-width="4"/>'),
('Work Play','work-play','#21579A','#DFEAFE','FIND YOUR BALANCE',['work / play'],'round','<rect x="13" y="22" width="31" height="56" rx="6"/><path d="m59 24 30 23q4 3 0 6L59 76Z"/><path d="M25 36h7M25 46h7M25 56h7" stroke="#DFEAFE" stroke-width="3"/>')
]
fonts={'mono':'ui-monospace, Menlo, Consolas, monospace','round':'Avenir Next, Trebuchet MS, Arial, sans-serif','serif':'Georgia, Times New Roman, serif','wide':'Arial, Helvetica, sans-serif'}

def art(b):
 name,slug,ink,bg,tag,lines,kind,mark=b
 def text(t,x,y,size=34,anchor='start',font=None,weight=800,spacing=0):
  return f'<text x="{x}" y="{y}" text-anchor="{anchor}" font-family="{font or fonts[kind]}" font-size="{size}" font-weight="{weight}" letter-spacing="{spacing}">{escape(t)}</text>'
 def icon(x,y,s=1):return f'<g transform="translate({x} {y}) scale({s})">{mark}</g>'
 def small(x,y,anchor='middle'):return text(tag,x,y,8,anchor,'Arial, sans-serif',600,1.5)
 def line(x1,y1,x2,y2):return f'<path d="M{x1} {y1}H{x2}" transform="translate(0 0)" stroke="currentColor" stroke-width="2"/>'
 def centred(label,size=35):return icon(199,24,.82)+text(label,240,159,size,'middle')+small(240,188)
 layout=''
 if slug=='fork-my-gits':
  layout=icon(35,72,.9)+text('ForkMyGits',148,132,35)+small(150,160,'start')
 elif slug=='bewbs-bewbs-bewbs':
  layout=text('bewbs',80,80,44)+text('bewbs',137,128,44)+text('bewbs',194,176,44)+icon(335,57,.47)+small(82,213,'start')
 elif slug=='uk-bunnies':
  layout=text('UKBunnies',240,93,37,'middle',weight=800)+text('GetHotBrown',240,144,37,'middle',weight=800)+text('Cocoa',240,195,37,'middle',weight=800)
 elif slug=='facialbook':
  layout=text('FacialBook-',240,97,42,'middle',weight=800)+text('The Organic',240,142,42,'middle',weight=800)+text('Beauty Blog',240,187,42,'middle',weight=800)
 elif slug=='cornhub':
  layout=centred('cornhub',42)
 elif slug=='you-jiggle':
  layout=text('youjiggle',47,143,43)+icon(329,84,.8)+small(50,174,'start')
 elif slug=='red-pube':
  layout=text('red',400,101,59,'end',weight=500)+text('pube',400,159,59,'end',weight=500)+icon(72,75,.82)+small(399,192,'end')
 elif slug=='ybooks':
  layout=text('YBooks',240,78,43,'middle',weight=500)+icon(204,102,.72)+small(240,206)
 elif slug=='cmcc':
  layout=icon(184,15,1.12)+text('C M C C',240,176,30,'middle')+small(240,204)
 elif slug=='avam-cemani-cock':
  layout=icon(306,13,.82)+text('Avam Cemani',392,145,35,'end',weight=500)+text('Cock',392,185,38,'end',weight=500)+small(393,215,'end')
 elif slug=='cummins-cider':
  layout=f'<ellipse cx="240" cy="126" rx="173" ry="107" fill="none" stroke="currentColor" stroke-width="2"/>'+icon(213,26,.54)+text('Cummin’s',240,123,41,'middle',weight=500)+text('CIDER',240,161,32,'middle')+small(240,187)
 elif slug=='dickins-cider':
  layout=text('DICKIN’S',67,102,42)+text('CIDER',67,147,42)+icon(323,56,1.12)+small(69,184,'start')
 elif slug=='wough-tank':
  layout=icon(49,35,.77)+text('WOUGH',61,159,38)+text('TANK',61,198,38)+small(258,197,'start')
 elif slug=='only-flans':
  layout=text('OnlyFlans',240,72,43,'middle',weight=500)+icon(197,93,.86)+small(240,216)
 elif slug=='git-some':
  layout=text('git',68,104,57)+text('some',68,168,57)+icon(305,37,1.14)+small(73,204,'start')
 elif slug=='peach-please':
  layout=icon(209,20,.6)+text('peach',240,126,43,'middle')+text('please.',240,169,43,'middle')+small(240,204)
 elif slug=='the-third-leg':
  layout=icon(195,17,.9)+line(125,125,355,125)+text('THE THIRD LEG',240,164,26,'middle')+small(240,194)
 elif slug=='nice-buns':
  layout=f'<rect x="88" y="20" width="304" height="211" rx="105" fill="none" stroke="currentColor" stroke-width="2"/>'+icon(204,28,.72)+text('nice buns',240,151,40,'middle')+small(240,181)
 elif slug=='after-dark-mode':
  layout=icon(320,17,.67)+text('afterdark',385,139,35,'end')+text('MODE_',385,179,35,'end')+small(385,210,'end')
 elif slug=='no-hard-feelings':
  layout=icon(64,26,.63)+text('no hard',77,149,43)+text('feelings',77,193,43)+small(80,222,'start')
 elif slug=='if-you-hard-then-you-hard':
  layout=text('IF YOU HARD.',40,101,40)+text('THEN YOU HARD',40,148,40)+small(43,186,'start')+line(43,209,435,209)
 elif slug=='work-play':
  layout=text('work',216,98,50,'end')+icon(235,54,.54)+text('play',269,176,50,'middle')+small(240,213)
 return f'<g color="{ink}" fill="{ink}">{layout}</g>'

manifest=[]
for b in brands:
 name,slug,ink,bg,tag,*_=b
 (out/f'{slug}.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="480" height="260" viewBox="0 0 480 260" role="img" aria-labelledby="title"><title id="title">{escape(name)} — fictional affiliate logo</title>{art(b)}</svg>')
 (out/f'{slug}-mark.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100" role="img"><title>{escape(name)} mark</title><g color="{ink}" fill="{ink}">{b[-1]}</g></svg>')
 manifest.append({'name':name,'slug':slug,'logo':f'/affiliates/logos/{slug}.svg','mark':f'/affiliates/logos/{slug}-mark.svg','ink':ink,'background':bg,'tagline':tag})
(out/'manifest.json').write_text(json.dumps(manifest,indent=2))
parts=['<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="1650" viewBox="0 0 1536 1650"><rect width="100%" height="100%" fill="#F6F6F1"/>','<text x="32" y="66" font-family="Arial,sans-serif" font-size="36" font-weight="800" fill="#16202F">The affiliate collection / 02</text>','<text x="32" y="101" font-family="Arial,sans-serif" font-size="16" fill="#55606F">22 fictional identities · A little less uniform. A little more character.</text>']
for i,b in enumerate(brands):
 x=32+(i%4)*376;y=140+(i//4)*244
 parts.append(f'<g transform="translate({x} {y})"><rect width="352" height="207" rx="18" fill="{b[3]}"/><g transform="translate(0 8) scale(.7333)">{art(b)}</g><text x="4" y="229" font-family="Arial,sans-serif" font-size="12" fill="#55606F">{i+1:02} / {escape(b[0])}</text></g>')
parts.append('<text x="32" y="1632" font-family="Arial,sans-serif" font-size="12" fill="#55606F">Fictional demo identities. No affiliation or endorsement implied.</text></svg>')
(out/'contact-sheet.svg').write_text(''.join(parts))
print('Updated 22 logos with individual compositions.')
