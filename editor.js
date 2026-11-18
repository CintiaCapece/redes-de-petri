"use strict";

const WIDTH = 800;
const HEIGHT = 420;
const SEARCH_LIMIT = 500;
const MAX_MARK = Number.MAX_SAFE_INTEGER;

function compile({nodes, arcs}) {
  const places = nodes.filter(node => node.kind === "place");
  const transitions = nodes.filter(node => node.kind === "transition");
  const placeIndex = new Map(places.map((node, i) => [node.id, i]));
  const transitionIndex = new Map(transitions.map((node, i) => [node.id, i]));
  const pre = transitions.map(() => places.map(() => 0));
  const post = transitions.map(() => places.map(() => 0));
  for (const {from, to, weight} of arcs) {
    if (placeIndex.has(from)) pre[transitionIndex.get(to)][placeIndex.get(from)] = weight;
    else post[transitionIndex.get(from)][placeIndex.get(to)] = weight;
  }
  return {places, transitions, pre, post, initial: places.map(node => node.tokens)};
}

function enabled(model, marking, i) {
  return model.pre[i].every((weight, j) => marking[j] >= weight);
}

function fire(model, marking, i) {
  if (!enabled(model, marking, i)) return null;
  const next = marking.map((value, j) => value - model.pre[i][j] + model.post[i][j]);
  if (next.some(value => !Number.isSafeInteger(value))) throw new RangeError("Se superó el límite numérico de marcas.");
  return next;
}

function explore(model, limit = SEARCH_LIMIT) {
  const states = [{marking: model.initial, parent: null}];
  const seen = new Map([[model.initial.join(), 0]]);
  let truncated = false;
  for (let index = 0; index < states.length; index++) {
    const state = states[index];
    state.edges = [];
    for (let i = 0; i < model.transitions.length; i++) {
      const next = fire(model, state.marking, i);
      if (next === null) continue;
      const key = next.join();
      if (!seen.has(key)) {
        if (states.length === limit) {
          truncated = true;
          state.edges.push([i, null]);
          continue;
        }
        seen.set(key, states.length);
        states.push({marking: next, parent: [index, i]});
      }
      state.edges.push([i, seen.get(key)]);
    }
  }
  return {states, truncated};
}

function rustString(value) {
  return '"' + Array.from(value, character => {
    if (character === '"' || character === "\\") return "\\" + character;
    const code = character.codePointAt(0);
    return code < 32 || code > 126 ? "\\u{" + code.toString(16) + "}" : character;
  }).join("") + '"';
}

function rust(model) {
  const names = nodes => nodes.map(node => rustString(node.name)).join(", ");
  const rows = matrix => matrix.map(row => "    &[" + row.join(", ") + "],").join("\n");
  return [
    "// Red de Petri generada por el editor del Módulo 11.",
    "// Pre y Post se indexan por [transición][lugar].",
    "use std::collections::HashMap;",
    "const MAX_MARK: u64 = " + MAX_MARK + ";",
    "const LIMIT: usize = " + SEARCH_LIMIT + ";",
    "const PLACES: &[&str] = &[" + names(model.places) + "];",
    "const TRANSITIONS: &[&str] = &[" + names(model.transitions) + "];",
    "const INITIAL: &[u64] = &[" + model.initial.join(", ") + "];",
    "const PRE: &[&[u64]] = &[\n" + rows(model.pre) + "\n];",
    "const POST: &[&[u64]] = &[\n" + rows(model.post) + "\n];",
    "",
    "fn enabled(marking: &[u64], t: usize) -> bool {",
    "    PRE[t].iter().zip(marking).all(|(&w, &m)| m >= w)",
    "}",
    "",
    "fn fire(marking: &[u64], t: usize) -> Result<Option<Vec<u64>>, String> {",
    "    if !enabled(marking, t) { return Ok(None); }",
    "    let result = marking.iter().enumerate().map(|(p, &m)| {",
    "        (m - PRE[t][p]).checked_add(POST[t][p])",
    "            .filter(|&n| n <= MAX_MARK)",
    '            .ok_or_else(|| "Se superó el límite numérico de marcas.".to_owned())',
    "    }).collect::<Result<Vec<_>, _>>()?;",
    "    Ok(Some(result))",
    "}",
    "",
    "fn explore() -> Result<(), String> {",
    "    let mut states = vec![INITIAL.to_vec()];",
    "    let mut seen = HashMap::from([(INITIAL.to_vec(), 0)]);",
    "    let mut truncated = false;",
    "    let mut cursor = 0;",
    "    while cursor < states.len() {",
    '        println!("M{cursor} = {:?}", states[cursor]);',
    "        for (t, name) in TRANSITIONS.iter().enumerate() {",
    "            let Some(next) = fire(&states[cursor], t)? else { continue };",
    "            let index = if let Some(&index) = seen.get(&next) {",
    "                index",
    "            } else if states.len() == LIMIT {",
    "                truncated = true;",
    '                println!("  {name} → fuera del límite");',
    "                continue;",
    "            } else {",
    "                let index = states.len();",
    "                seen.insert(next.clone(), index);",
    "                states.push(next);",
    "                index",
    "            };",
    '            println!("  {name} → M{index}");',
    "        }",
    "        cursor += 1;",
    "    }",
    '    println!("{} marcados. Exploración {}.", states.len(), if truncated { "parcial" } else { "completa" });',
    "    Ok(())",
    "}",
    "",
    "fn run() -> Result<(), String> {",
    "    let args: Vec<_> = std::env::args().skip(1).collect();",
    '    println!("Orden de lugares: {:?}", PLACES);',
    '    println!("Transiciones por índice: {:?}", TRANSITIONS);',
    '    if args.len() == 1 && args[0] == "--explorar" { return explore(); }',
    "    let mut marking = INITIAL.to_vec();",
    '    println!("M0 = {marking:?}");',
    "    for arg in args {",
    "        let t = arg.parse::<usize>().ok().filter(|&t| t < TRANSITIONS.len())",
    '            .ok_or_else(|| format!("Índice de transición inválido: {arg}"))?;',
    "        marking = fire(&marking, t)?",
    '            .ok_or_else(|| format!("{} no está habilitada", TRANSITIONS[t]))?;',
    '        println!("{} → {marking:?}", TRANSITIONS[t]);',
    "    }",
    "    Ok(())",
    "}",
    "",
    "fn main() {",
    "    if let Err(error) = run() {",
    '        eprintln!("{error}");',
    "        std::process::exit(1);",
    "    }",
    "}",
    ""
  ].join("\n");
}

function sample() {
  return {
    nodes: [
      {id:1, kind:"place", name:"Libres", x:165, y:208, tokens:2},
      {id:2, kind:"place", name:"Ocupados", x:635, y:208, tokens:0},
      {id:3, kind:"transition", name:"Producir", x:400, y:100},
      {id:4, kind:"transition", name:"Consumir", x:400, y:316}
    ],
    arcs: [
      {from:1,to:3,weight:1}, {from:3,to:2,weight:1},
      {from:2,to:4,weight:1}, {from:4,to:1,weight:1}
    ]
  };
}

function start() {
  const get = id => document.getElementById(id);
  const canvas = get("plano");
  let network = sample();
  let model, marking, history;
  let nextId = 5, selected = 1, mode = "select", origin = null;
  let dragging;
  const setStatus = message => { get("aviso").textContent = message; };
  const nodeAt = id => network.nodes.find(node => node.id === id);
  const button = (name, action) => {
    const item = document.createElement("button");
    item.type = "button";
    item.textContent = name;
    item.onclick = action;
    return item;
  };
  function svg(tag, attributes, label) {
    const item = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [key, value] of Object.entries(attributes)) item.setAttribute(key, value);
    if (label !== undefined) item.textContent = label;
    return item;
  }
  function point(event) {
    const p = canvas.createSVGPoint();
    p.x = event.clientX;
    p.y = event.clientY;
    const local = p.matrixTransform(canvas.getScreenCTM().inverse());
    return {x: Math.max(46, Math.min(WIDTH - 46, local.x)), y: Math.max(40, Math.min(HEIGHT - 50, local.y))};
  }

  function draw() {
    const defs = svg("defs", {});
    const arrow = svg("marker", {id:"punta", viewBox:"0 0 10 10", refX:9, refY:5, markerWidth:8, markerHeight:8, orient:"auto"});
    arrow.append(svg("path", {d:"M 0 0 L 10 5 L 0 10 Z", fill:"#496580"}));
    defs.append(arrow);
    canvas.replaceChildren(defs);
    for (const {from, to, weight} of network.arcs) {
      const a = nodeAt(from), b = nodeAt(to);
      const distance = Math.hypot(b.x - a.x, b.y - a.y);
      const angle = distance ? Math.atan2(b.y - a.y, b.x - a.x) : (from < to ? 0 : Math.PI);
      const curved = distance < 72 || network.arcs.some(arc => arc.from === to && arc.to === from);
      const bend = curved ? Math.min(distance / 3 + 10, 55) : 0;
      const dx = Math.cos(angle), dy = Math.sin(angle);
      const middle = {x:(a.x+b.x)/2-dy*bend, y:(a.y+b.y)/2+dx*bend};
      function edge(node, target) {
        const x = target.x-node.x, y = target.y-node.y;
        const length = Math.hypot(x,y) || 1;
        const factor = node.kind === "place" ? 26/length : Math.min(14/Math.abs(x),21/Math.abs(y));
        return [node.x+x*factor,node.y+y*factor].join(" ");
      }
      const start = edge(a,middle), end = edge(b,middle);
      canvas.append(svg("path",{d:"M "+start+" Q "+middle.x+" "+middle.y+" "+end,fill:"none",stroke:"#496580","stroke-width":2,"marker-end":"url(#punta)"}));
      if (weight !== 1) {
        const labelX = (a.x + 2*middle.x + b.x)/4;
        const labelY = (a.y + 2*middle.y + b.y)/4 - 8;
        canvas.append(svg("text",{x:labelX,y:labelY,fill:"#122640","text-anchor":"middle","font-weight":750,stroke:"#eef5fb","stroke-width":4,"paint-order":"stroke"},weight));
      }
    }
    for (const node of network.nodes) {
      const {x,y,id,name,kind} = node;
      const place = kind === "place";
      const value = place ? marking[model.places.indexOf(node)] : null;
      const active = !place && enabled(model, marking, model.transitions.indexOf(node));
      const group = svg("g",{"data-id":id,tabindex:0,role:"button","aria-label": name + (place ? ", marcas: "+value : ", transición")});
      const outline = {"class":"nodo",stroke: id === selected || id === origin ? "#b94d06" : "#284663","stroke-width":id === selected || id === origin ? 4 : 2};
      if (place) {
        group.append(svg("circle",{...outline,cx:x,cy:y,r:25,fill:value ? "#b5f5d6":"white"}));
        group.append(svg("text",{x,y:y+5,"text-anchor":"middle","font-weight":750,"font-size":value > 999 ? 11 : 16},value > 999999 ? "…" : value));
      } else {
        group.append(svg("rect",{...outline,x:x-13,y:y-20,width:26,height:40,rx:3,fill:active ? "#006b63" : "#647b94"}));
      }
      const label = name.length > 20 ? name.slice(0,19)+"…" : name;
      group.append(svg("text",{x,y:y+43,"text-anchor":"middle","font-size":15,"font-weight":700,fill:"#122640",stroke:"#eef5fb","stroke-width":4,"paint-order":"stroke"},label));
      group.append(svg("title",{},name));
      canvas.append(group);
    }
  }

  function syncInspector() {
    const node = nodeAt(selected);
    get("elemento").value = node ? String(node.id) : "";
    get("nodo-datos").disabled = !node;
    get("nombre-nodo").value = node?.name ?? "";
    get("marcas-campo").hidden = node?.kind !== "place";
    get("marcas").disabled = node?.kind !== "place";
    get("marcas").value = node?.tokens ?? 0;
  }

  function fillSelect(element, placeholder) {
    const previous = element.value;
    element.replaceChildren(new Option(placeholder,""), ...network.nodes.map(node =>
      new Option(node.name + (node.kind === "place" ? " (lugar)" : " (transición)"),node.id)));
    element.value = [...element.options].some(option => option.value === previous) ? previous : "";
  }

  function inspector() {
    fillSelect(get("elemento"),"Elegí un nodo");
    fillSelect(get("origen"),"Elegí origen");
    fillSelect(get("destino"),"Elegí destino");
    syncInspector();
    get("arcos").replaceChildren(...network.arcs.map(arc => {
      const item = document.createElement("li");
      const label = document.createElement("span");
      label.textContent = nodeAt(arc.from).name + " → " + nodeAt(arc.to).name + " (" + arc.weight + ")";
      const actions = document.createElement("div");
      actions.className = "acciones";
      const edit = button("Editar", () => {
        get("origen").value = arc.from;
        get("destino").value = arc.to;
        get("peso").value = arc.weight;
        get("peso").focus();
      });
      const remove = button("Quitar", () => {
        network.arcs = network.arcs.filter(candidate => candidate !== arc);
        changed("Arco eliminado.");
        get("origen").focus();
      });
      edit.setAttribute("aria-label","Editar arco "+label.textContent);
      remove.setAttribute("aria-label","Quitar arco "+label.textContent);
      edit.className = remove.className = "claro";
      actions.append(edit,remove);
      item.append(label,actions);
      return item;
    }));
  }

  function simulation(createButtons = false) {
    draw();
    get("vector").textContent = model.places.length ? model.places.map((node,i)=>node.name+" = "+marking[i]).join(" · ") : "Agregá un lugar para definir el marcado.";
    const container = get("disparar");
    if (createButtons) container.replaceChildren(...model.transitions.map((node,i)=>button(node.name,()=>{
      try {
        const next = fire(model,marking,i);
        if (next === null) return;
        history.push({marking, name: node.name});
        marking = next;
        simulation();
        setStatus("Se disparó "+node.name+".");
      } catch (error) {
        setStatus(error.message);
      }
    })));
    const active = model.transitions.map((_,i)=>enabled(model,marking,i));
    [...container.children].forEach((item,i)=>item.setAttribute("aria-disabled",String(!active[i])));
    const trace = history.length ? "Traza: "+history.map(step=>step.name).join(" → ") : "Marcado inicial.";
    get("historial").textContent = trace + (active.some(Boolean) ? "" : " Sin transiciones habilitadas.");
    get("deshacer").disabled = !history.length;
  }

  function changed(message = "") {
    model = compile(network);
    marking = model.initial;
    history = [];
    get("resultados").replaceChildren();
    get("fuente").textContent = rust(model);
    inspector();
    simulation(true);
    setStatus(message);
  }

  function addNode(kind, {x,y}) {
    if (network.nodes.length >= 40) {
      setStatus("El editor admite hasta 40 nodos.");
      return;
    }
    const id = nextId++;
    network.nodes.push({id,kind,x,y,name:(kind === "place" ? "P" : "T")+id,tokens:0});
    selected = id;
    changed("Nodo agregado.");
  }

  function addArc(from,to,weight) {
    const a = nodeAt(from), b = nodeAt(to);
    if (!a || !b || a.kind === b.kind) {
      setStatus("Elegí un lugar y una transición. El orden determina la dirección del arco.");
      return false;
    }
    if (!Number.isInteger(weight) || weight < 1 || weight > 9999) {
      setStatus("El peso debe ser un entero entre 1 y 9999.");
      return false;
    }
    const existing = network.arcs.find(arc => arc.from === from && arc.to === to);
    if (existing) existing.weight = weight;
    else network.arcs.push({from,to,weight});
    changed(existing ? "Peso actualizado. Marcado restablecido." : "Arco agregado. Marcado restablecido.");
    return true;
  }

  function selectNode(id, restoreFocus = false) {
    if (mode === "arc") {
      if (origin === null) {
        origin = id;
        setStatus("Origen: "+nodeAt(id).name+". Elegí el destino.");
      } else if (addArc(origin,id,Number(get("peso").value))) {
        origin = null;
      }
    } else {
      selected = id;
      syncInspector();
    }
    draw();
    if (restoreFocus) canvas.querySelector('[data-id="'+id+'"]')?.focus();
  }

  function setMode(value) {
    mode = value;
    origin = null;
    for (const control of document.querySelectorAll("[data-mode]")) {
      control.setAttribute("aria-pressed",String(control.dataset.mode === mode));
    }
    get("ayuda").textContent = {
      select:"Seleccioná un nodo para editarlo. Arrastralo para moverlo.",
      place:"Hacé clic en una zona libre para crear un lugar.",
      transition:"Hacé clic en una zona libre para crear una transición.",
      arc:"Elegí origen y destino en el diagrama. El peso se toma del panel Modelo."
    }[mode];
    if (model) draw();
  }

  canvas.addEventListener("pointerdown",event=>{
    const group = event.target.closest("[data-id]");
    if (!group || mode !== "select" || event.button !== 0) return;
    const node = nodeAt(Number(group.dataset.id));
    const initial = point(event);
    dragging = {node,initial,x:node.x,y:node.y,id:event.pointerId,moved:false};
    selected = node.id;
    syncInspector();
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointermove",event=>{
    if (!dragging || dragging.id !== event.pointerId) return;
    const p = point(event);
    const {node,initial,x,y} = dragging;
    if (Math.hypot(p.x-initial.x,p.y-initial.y) > 3) dragging.moved = true;
    if (!dragging.moved) return;
    node.x = Math.max(46,Math.min(WIDTH-46,x+p.x-initial.x));
    node.y = Math.max(40,Math.min(HEIGHT-50,y+p.y-initial.y));
    draw();
  });
  for (const type of ["pointerup","pointercancel","lostpointercapture"]) {
    canvas.addEventListener(type,event=>{
      if (dragging?.id !== event.pointerId) return;
      dragging = undefined;
      draw();
    });
  }
  canvas.addEventListener("click",event=>{
    const group = event.target.closest("[data-id]");
    if (group) selectNode(Number(group.dataset.id));
    else if (mode === "place" || mode === "transition") addNode(mode,point(event));
  });
  canvas.addEventListener("keydown",event=>{
    const group = event.target.closest("[data-id]");
    if (!group || !["Enter"," "].includes(event.key)) return;
    event.preventDefault();
    selectNode(Number(group.dataset.id),true);
  });

  for (const control of document.querySelectorAll("[data-mode]")) control.onclick = () => setMode(control.dataset.mode);
  get("elemento").onchange = event => {
    selected = Number(event.target.value);
    syncInspector();
    draw();
  };
  function addFromPanel(kind) {
    setMode("select");
    const used = network.nodes.length;
    addNode(kind,{x:70+(used%8)*94,y:65+Math.floor(used/8)*75});
    if (nodeAt(selected)) get("nombre-nodo").focus();
  }
  get("agregar-lugar").onclick = () => addFromPanel("place");
  get("agregar-transicion").onclick = () => addFromPanel("transition");
  get("nodo-form").onsubmit = event => {
    event.preventDefault();
    const node = nodeAt(selected);
    if (!node) return;
    const name = get("nombre-nodo").value.trim();
    const tokens = Number(get("marcas").value);
    if (!name || Array.from(name).some(character => character.codePointAt(0) >= 0xd800 && character.codePointAt(0) <= 0xdfff)) {
      setStatus("Ingresá un nombre válido.");
      return;
    }
    if (node.kind === "place" && (!Number.isInteger(tokens) || tokens < 0 || tokens > 9999)) {
      setStatus("El marcado inicial debe ser un entero entre 0 y 9999.");
      return;
    }
    const markingChanged = node.kind === "place" && node.tokens !== tokens;
    node.name = name;
    if (node.kind === "place") node.tokens = tokens;
    if (markingChanged) changed("Marcado inicial actualizado.");
    else {
      get("resultados").replaceChildren();
      get("fuente").textContent = rust(model);
      inspector();
      simulation(true);
      setStatus("Nombre actualizado.");
    }
  };
  get("quitar-nodo").onclick = () => {
    network.nodes = network.nodes.filter(node => node.id !== selected);
    network.arcs = network.arcs.filter(arc => arc.from !== selected && arc.to !== selected);
    if (origin === selected) origin = null;
    selected = null;
    changed("Nodo y arcos incidentes eliminados.");
    get("elemento").focus();
  };
  get("arco-form").onsubmit = event => {
    event.preventDefault();
    addArc(Number(get("origen").value),Number(get("destino").value),Number(get("peso").value));
  };
  function loadNetwork(next, message) {
    network = next;
    selected = next.nodes[0]?.id ?? null;
    nextId = Math.max(0,...next.nodes.map(node=>node.id))+1;
    mode = "select";
    model = undefined;
    setMode(mode);
    changed(message);
  }
  get("ejemplo").onclick = () => loadNetwork(sample(),"Ejemplo de productor–consumidor cargado.");
  get("nueva").onclick = () => loadNetwork({nodes:[],arcs:[]},"Red vacía. Agregá un lugar o una transición.");
  get("deshacer").onclick = () => {
    if (!history.length) return;
    marking = history.pop().marking;
    simulation();
    if (!history.length) get("reiniciar").focus();
    setStatus("Se deshizo el último disparo.");
  };
  get("reiniciar").onclick = () => {
    marking = model.initial;
    history = [];
    simulation();
    setStatus("Se restauró el marcado inicial.");
  };
  get("explorar").onclick = () => {
    try {
      const {states,truncated} = explore(model);
      const wrap = document.createElement("div");
      wrap.className = "tabla";
      const table = document.createElement("table");
      table.createCaption().textContent = states.length+" marcados. "+(truncated ? "Exploración parcial por el límite de "+SEARCH_LIMIT+" estados." : "Exploración completa.")+" Orden: "+(model.places.map(node=>node.name).join(", ") || "sin lugares")+".";
      const header = table.createTHead().insertRow();
      for (const label of ["Estado","Marcado","Predecesor BFS","Disparos"]) {
        const cell = document.createElement("th");
        cell.scope = "col";
        cell.textContent = label;
        header.append(cell);
      }
      const body = table.createTBody();
      states.forEach(({marking:m, parent, edges},i)=>{
        const row = body.insertRow();
        const previous = parent ? "M"+parent[0]+" → "+model.transitions[parent[1]].name : "Inicial";
        const successors = edges.map(([t,index])=>model.transitions[t].name+" → "+(index === null ? "fuera del límite" : "M"+index));
        for (const value of ["M"+i,"("+m.join(", ")+")",previous,successors.join(" · ") || "Sin disparos"]) {
          row.insertCell().textContent = value;
        }
      });
      wrap.append(table);
      get("resultados").replaceChildren(wrap);
      setStatus(truncated ? "Exploración parcial." : "Exploración completa.");
    } catch (error) {
      get("resultados").replaceChildren();
      setStatus(error.message);
    }
  };
  get("descargar").onclick = () => {
    const url = URL.createObjectURL(new Blob([rust(model)],{type:"text/plain;charset=utf-8"}));
    const link = document.createElement("a");
    link.href = url;
    link.download = "red_petri.rs";
    link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  };

  loadNetwork(network,"");
}
if (typeof document !== "undefined") start();