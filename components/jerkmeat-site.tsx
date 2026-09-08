"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./jerkmeat.module.css";

type Dish = { name: string; handle: string; kind: string; heat: string; time: string; place: string; note: string };
const dishes: Dish[] = [
  { name: "The original hot leg", handle: "KingstonKitchen", kind: "Chicken", heat: "Hot", time: "45 min", place: "Kingston", note: "Chicken legs, allspice, thyme and scotch bonnet. Charred edges. Absolutely no restraint on the lime." },
  { name: "Sticky situation", handle: "RibbedForFlavour", kind: "Pork", heat: "Medium", time: "3 hours", place: "Montego Bay", note: "Slow-cooked pork ribs with a sticky jerk glaze. Finish over high heat until the edges caramelise." },
  { name: "A very good strip", handle: "SirLoinALot", kind: "Beef", heat: "Hot", time: "25 min", place: "Brixton", note: "Jerk-rubbed steak, sliced against the grain. Rest before slicing and serve with charred peppers." },
  { name: "Wing it tonight", handle: "WingThings", kind: "Chicken", heat: "Extra hot", time: "40 min", place: "Port Antonio", note: "Chicken wings with a punchy scotch bonnet marinade, spring onions and a squeeze of fresh lime." },
  { name: "Low & slow, baby", handle: "BellyGood", kind: "Pork", heat: "Medium", time: "3 hours", place: "Bristol", note: "Pork belly with crisp edges and a rich jerk crust. Slow roasting does the heavy lifting." },
  { name: "Stick around", handle: "SkewerMe", kind: "Chicken", heat: "Hot", time: "30 min", place: "London", note: "Jerk chicken skewers, sweet peppers and red onion. Turn often over the grill for an even char." },
  { name: "Spread the flavour", handle: "TheWholeBird", kind: "Chicken", heat: "Extra hot", time: "60 min", place: "Ocho Rios", note: "A whole spatchcock chicken, generously seasoned and grilled over indirect heat. Made for sharing." },
  { name: "Pulled it off", handle: "BunIntended", kind: "Pork", heat: "Mild", time: "4 hours", place: "Manchester", note: "Tender pulled jerk pork in a toasted bun. Add crunchy slaw and a little extra sauce." },
  { name: "Chop to it", handle: "LambAfterDark", kind: "Lamb", heat: "Hot", time: "25 min", place: "Nottingham", note: "Lamb chops rubbed with jerk spices, grilled until beautifully browned. Finish with fresh thyme." }
];
const categories = ["All meat", "Chicken", "Pork", "Beef", "Lamb", "Saved"];

export function JerkMeatBrand() {
  return <span className={styles.brand}><span className={styles.brandMark} aria-hidden="true">♨</span><span>jerk<span className={styles.brandAccent}>meat</span></span></span>;
}

export function JerkMeatSite({ gate, unlocked = false }: { gate?: ReactNode; unlocked?: boolean }) {
  const [category, setCategory] = useState("All meat");
  const [query, setQuery] = useState("");
  const [saved, setSaved] = useState<string[]>([]);
  const [selected, setSelected] = useState<Dish | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    try { const entries: unknown = JSON.parse(localStorage.getItem("jerkmeat-saved") ?? "[]"); if (Array.isArray(entries)) setSaved(entries.filter((entry): entry is string => typeof entry === "string")); } catch { /* optional favourites */ }
  }, []);
  useEffect(() => { if (selected) dialog.current?.showModal(); }, [selected]);
  function toggleSaved(name: string) {
    const next = saved.includes(name) ? saved.filter((item) => item !== name) : [...saved, name];
    setSaved(next);
    try { localStorage.setItem("jerkmeat-saved", JSON.stringify(next)); } catch { /* optional */ }
  }
  function openDish(dish: Dish) {
    if (unlocked) setSelected(dish);
    else { document.getElementById("jerkmeat-age-gate")?.scrollIntoView({ behavior: "smooth", block: "center" }); document.getElementById("jerkmeat-age-gate")?.focus({ preventScroll: true }); }
  }
  const visible = dishes.filter((dish) => (category === "All meat" || (category === "Saved" ? saved.includes(dish.name) : dish.kind === category)) && `${dish.name} ${dish.handle} ${dish.kind} ${dish.heat} ${dish.note}`.toLowerCase().includes(query.toLowerCase()));
  return <div className={styles.site}>
    <header className={styles.header}>
      <a href="/affiliate-demo" aria-label="JerkMeat home"><JerkMeatBrand /></a>
      <label className={styles.search}><span aria-hidden="true">⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find your perfect piece of meat…" aria-label="Search dishes" /></label>
      <a className={styles.login} href={unlocked ? "/affiliate-demo" : "#jerkmeat-age-gate"}>{unlocked ? "✓ Zik verified" : "Log in"}</a>
      <button className={styles.pinkButton} onClick={() => openDish(dishes[Math.floor(Math.random() * dishes.length)])}>Meat your match</button>
    </header>
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <p className={styles.eyebrow}>Find your flavour</p>
        <nav aria-label="Meat categories">{categories.map((item, i) => <button key={item} aria-pressed={category === item} className={category === item ? styles.activeCategory : ""} onClick={() => setCategory(item)}><span aria-hidden="true">{["♨", "✦", "◇", "◈", "✧", "♡"][i]}</span>{item}<small>{item === "Saved" ? saved.length : item === "All meat" ? 9 : dishes.filter(d => d.kind === item).length}</small></button>)}</nav>
        <div className={styles.sidebarNote}><span aria-hidden="true">🌶</span><strong>Only the food<br />is spicy.</strong><p>Good meat. Bad puns.<br />Zero adult content.</p></div>
        <a className={styles.backToZik} href="/home">← Back to Zik Pass</a>
      </aside>
      <main className={styles.main}>
        <div className={styles.notice}><span>FOOD-ONLY PARODY</span><span>Zik Pass affiliate demonstration</span></div>
        <section className={styles.hero}>
          <div><p className={styles.eyebrow}>100% jerk. 0% awkward.</p><h1>Hot meat.<br /><em>No small talk.</em></h1><p>Find your perfect match. Well-seasoned,<br className={styles.desktopBreak} /> a little smoky, and very easy on the eyes.</p><a href="#meat-gallery" className={styles.heroLink}>See what’s sizzling <span>↘</span></a></div>
          <div className={styles.heroPhoto} role="img" aria-label="Chargrilled jerk chicken with lime"><div className={styles.heroPhotoLabel}><span>CHEF’S PICK</span><strong>The original hot leg</strong><small>KingstonKitchen · Chicken · Hot</small></div></div>
          <span className={styles.heroStamp}>WELL<br />SEASONED</span>
        </section>
        {gate && <section id="jerkmeat-age-gate" tabIndex={-1} className={styles.gate}>{gate}</section>}
        {unlocked && <div className={styles.unlocked}><span>✓ Age verified with Zik</span><p>Welcome to the kitchen. Pick a photo for the delicious details.</p></div>}
        <section id="meat-gallery" className={styles.gallerySection}>
          <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>Recommended for your appetite</p><h2>{category === "Saved" ? "Your saved meat" : "Fresh off the grill"}<span>{visible.length}</span></h2></div><span className={styles.photoLabel}>PHOTOS, NOT CAMS</span></div>
          <div className={styles.tabs}>{categories.map(item => <button key={item} aria-pressed={category === item} className={category === item ? styles.activeTab : ""} onClick={() => setCategory(item)}>{item}</button>)}</div>
          <div className={styles.grid}>{visible.map(dish => <article key={dish.name} className={styles.card}>
            <button className={styles.photoButton} onClick={() => openDish(dish)} aria-label={`View ${dish.name}`}><FoodPhoto index={dishes.indexOf(dish)} label={dish.name} /><span className={styles.heat}>♨ {dish.heat}</span><span className={styles.duration}>{dish.time}</span><span className={styles.photoHover}>{unlocked ? "Get a closer look ↗" : "Verify with Zik to enter ↗"}</span></button>
            <div className={styles.cardHeading}><button onClick={() => openDish(dish)}>{dish.name}</button><button className={saved.includes(dish.name) ? styles.saved : styles.save} aria-label={`${saved.includes(dish.name) ? "Unsave" : "Save"} ${dish.name}`} aria-pressed={saved.includes(dish.name)} onClick={() => toggleSaved(dish.name)}>{saved.includes(dish.name) ? "♥" : "♡"}</button></div><p className={styles.creator}><span />{dish.handle}<span className={styles.location}>{dish.place}</span></p>
          </article>)}</div>
          {!visible.length && <p className={styles.empty}>Nothing on the grill here yet. Try another category or search.</p>}
        </section>
        <footer className={styles.footer}><JerkMeatBrand /><p>All sizzle. No scandal.</p><small>Independent food parody. Not affiliated with JerkMate. AI-generated food photography.<br />The age check demonstrates Zik Pass; these food photos do not require age verification.</small></footer>
      </main>
    </div>
    <dialog ref={dialog} aria-labelledby="jerkmeat-dish-title" className={styles.dialog} onClose={() => setSelected(null)} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      {selected && <><button className={styles.close} aria-label="Close dish" onClick={() => dialog.current?.close()}>×</button><FoodPhoto index={dishes.indexOf(selected)} label={selected.name} /><div className={styles.dialogCopy}><p className={styles.eyebrow}>{selected.kind} · {selected.heat} · {selected.time}</p><h2 id="jerkmeat-dish-title">{selected.name}</h2><p>{selected.note}</p><small>Serving inspiration from the JerkMeat photo kitchen.</small></div></>}
    </dialog>
  </div>;
}
function FoodPhoto({ index, label }: { index: number; label: string }) {
  return <div role="img" aria-label={label} className={styles.foodPhoto} style={{ backgroundPosition: `${(index % 3) * 50}% ${Math.floor(index / 3) * 50}%` }} />;
}
