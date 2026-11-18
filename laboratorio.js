"use strict";

const t = (name, input, output, x, y) => ({name, input, output, x, y});
const p = (name, x, y) => ({name, x, y});
const models = [
  {
    name: "Disparo ponderado", description: "Mover requiere dos marcas en Origen y produce dos en Destino.",
    places: [p("Origen",90,85),p("Destino",460,85)], initial: [2,0],
    transitions: [t("Mover",{0:2},{1:2},275,85)], final: m => m[1] === 2, size: [550,165]
  },
  {
    name: "Concurrencia y join", description: "A y B pueden ejecutarse en cualquier orden. Unir exige que las dos ramas hayan terminado.",
    places: [p("Inicio A",75,65),p("Inicio B",75,185),p("Fin A",360,65),p("Fin B",360,185),p("Unido",655,125)],
    initial: [1,1,0,0,0],
    transitions: [t("Paso A",{0:1},{2:1},215,65),t("Paso B",{1:1},{3:1},215,185),t("Unir",{2:1,3:1},{4:1},510,125)],
    final: m => m[4] === 1, size:[730,250]
  },
  {
    name: "Conflicto", description: "Las dos alternativas compiten por la única marca. Elegir una deshabilita la otra.",
    places: [p("Recurso",75,125),p("Elegido A",475,65),p("Elegido B",475,185)], initial: [1,0,0],
    transitions: [t("Elegir A",{0:1},{1:1},265,65),t("Elegir B",{0:1},{2:1},265,185)],
    final: m => m[1]+m[2]===1, size: [550,250]
  },
  {
    name: "Mutex de dos procesos", description: "Al adquirir se consume la marca de Libre. Al liberar, se devuelve. Cada proceso pasa una vez por su sección crítica.",
    places: [p("Pre A",80,70),p("SC A",365,70),p("Post A",650,70),p("Libre",365,185),p("Pre B",80,300),p("SC B",365,300),p("Post B",650,300)],
    initial: [1,0,0,1,1,0,0],
    transitions: [t("Adquirir A",{0:1,3:1},{1:1},215,70),t("Liberar A",{1:1},{2:1,3:1},510,70),t("Adquirir B",{4:1,3:1},{5:1},215,300),t("Liberar B",{5:1},{6:1,3:1},510,300)],
    final: m => m[2]+m[6]===2, size:[730,375]
  },
  {
    name: "Productor–consumidor", description: "Búfer de capacidad 2. El marcado se lee en el orden Libres, Ocupados.",
    places: [p("Libres",100,120),p("Ocupados",450,120)], initial: [2,0],
    transitions: [t("Producir",{0:1},{1:1},275,60),t("Consumir",{1:1},{0:1},275,185)],
    size:[550,245]
  },
  {
    name: "Actores y buzón", description: "A emite dos mensajes como máximo en este escenario. B toma uno del buzón cuando está listo y lo termina antes de tomar otro.",
    places: [p("Por emitir A",78,120),p("Buzón",330,120),p("B listo",615,55),p("B ocupado",700,120)],
    initial: [2,0,1,0],
    transitions: [t("Enviar",{0:1},{1:1},205,120),t("Recibir",{1:1,2:1},{3:1},515,120),t("Terminar",{3:1},{2:1},685,213)],
    final: m => m[0]+m[1]+m[3]===0, size:[780,260]
  },
  {
    name: "2PC con caída del coordinador", description: "Una transacción y dos participantes. Preparar envía las solicitudes; recoger los votos y decidir es un disparo de coordinación. Los participantes aplican la decisión de manera independiente. La caída simulada ocurre con ambos preparados, antes de decidir.",
    places: [p("Inicio",65,65),p("Coord. activo",65,205),p("A sin voto",300,50),p("B sin voto",300,365),p("A preparado",525,35),p("A votó no",525,105),p("B preparado",525,330),p("B votó no",525,400),p("Commit",760,70),p("Abort",760,345),p("Caído",350,205),p("A commit",1070,35),p("B commit",1070,110),p("A abort",1070,315),p("B abort",1070,390)],
    initial: [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    transitions: [
      t("Preparar",{0:1},{1:1,2:1,3:1},175,65),
      t("A sí",{2:1},{4:1},410,35),t("A no",{2:1},{5:1},410,105),
      t("B sí",{3:1},{6:1},410,330),t("B no",{3:1},{7:1},410,400),
      t("Decidir commit",{1:1,4:1,6:1},{4:1,6:1,8:1},640,70),
      t("Abort (sí, no)",{1:1,4:1,7:1},{4:1,7:1,9:1},640,230),
      t("Abort (no, sí)",{1:1,5:1,6:1},{5:1,6:1,9:1},640,285),
      t("Abort (no, no)",{1:1,5:1,7:1},{5:1,7:1,9:1},640,400),
      t("Caer",{1:1,4:1,6:1},{4:1,6:1,10:1},235,205),
      t("Aplicar commit A",{4:1,8:1},{8:1,11:1},900,35),t("Aplicar commit B",{6:1,8:1},{8:1,12:1},900,110),
      t("Aplicar abort A (sí)",{4:1,9:1},{9:1,13:1},900,260),t("Aplicar abort A (no)",{5:1,9:1},{9:1,13:1},900,315),
      t("Aplicar abort B (sí)",{6:1,9:1},{9:1,14:1},900,375),t("Aplicar abort B (no)",{7:1,9:1},{9:1,14:1},900,430)
    ],
    final: m => m[11]+m[12]+m[13]+m[14]===2, size:[1150,490], wide:true
  }
];

const enabled = (marking, transition) =>
  Object.entries(transition.input).every(([place, weight]) => marking[place] >= weight);

const fire = (marking, transition) => marking.map((count, index) =>
  count - (transition.input[index] ?? 0) + (transition.output[index] ?? 0));

function explore(model) {
  const states = [{marking: model.initial, trace: []}];
  const seen = new Map([[model.initial.join(","),0]]);
  const edges = [];
  for (let i = 0; i < states.length; i++) {
    const {marking, trace} = states[i];
    edges[i] = [];
    for (const transition of model.transitions.filter(candidate => enabled(marking,candidate))) {
      const next = fire(marking, transition);
      const key = next.join(",");
      if (!seen.has(key)) {
        seen.set(key, states.length);
        states.push({marking:next,trace:[...trace,transition.name]});
      }
      edges[i].push([transition.name,seen.get(key)]);
    }
  }
  return {states,edges};
}

function start() {
  const get = id => document.getElementById(id);
  const select = get("modelo");
  const diagram = get("red");
  const controls = get("disparos");
  let model, marking, steps, buttons;

  function vector(m) {
    return "(" + m.join(", ") + ")";
  }

  function outcome(m) {
    if (model.transitions.some(transition => enabled(m,transition))) return "En ejecución";
    return model.final?.(m) ? "Finalización normal" : "Bloqueo sin disparos";
  }

  function svg(tag, attrs, value) {
    const node = document.createElementNS("http://www.w3.org/2000/svg",tag);
    Object.entries(attrs).forEach(([k,v]) => node.setAttribute(k,v));
    if (value !== undefined) node.textContent = value;
    return node;
  }

  function draw() {
    diagram.setAttribute("viewBox","0 0 "+model.size.join(" "));
    diagram.style.setProperty("--min-red",model.wide ? "1050px" : "450px");
    const defs = svg("defs",{});
    const arrow = svg("marker",{id:"flecha",viewBox:"0 0 10 10",refX:9,refY:5,markerWidth:7,markerHeight:7,orient:"auto"});
    arrow.append(svg("path",{d:"M 0 0 L 10 5 L 0 10 Z",fill:"#496580"}));
    defs.append(arrow);
    diagram.replaceChildren(svg("title",{id:"titulo-red"},"Red y marcado actual: "+model.name),defs);

    function arc(from,to,weight,fromRadius,toRadius,curve) {
      const dist = Math.hypot(to.x-from.x,to.y-from.y);
      const dx = (to.x-from.x)/dist, dy = (to.y-from.y)/dist;
      const a = [from.x+dx*fromRadius,from.y+dy*fromRadius];
      const b = [to.x-dx*toRadius,to.y-dy*toRadius];
      const mid = [(a[0]+b[0])/2-dy*curve,(a[1]+b[1])/2+dx*curve];
      diagram.append(svg("path",{d:"M "+a.join(" ")+" Q "+mid.join(" ")+" "+b.join(" "),fill:"none",stroke:"#496580","stroke-width":1.45,"marker-end":"url(#flecha)"}));
      if (weight!==1) diagram.append(svg("text",{x:mid[0]+7,y:mid[1]-9,fill:"#122640","font-size":15},weight));
    }

    for (const transition of model.transitions) {
      for (const [index,weight] of Object.entries(transition.input)) arc(model.places[index],transition,weight,25,15,transition.output[index] ? 25 : 0);
      for (const [index,weight] of Object.entries(transition.output)) arc(transition,model.places[index],weight,15,25,transition.input[index] ? 25 : 0);
    }
    const label = (x,y,value,size) => svg("text",{x,y,"text-anchor":"middle","font-size":size,"font-weight":700,fill:"#122640",stroke:"#f2f8fd","stroke-width":3,"paint-order":"stroke"},value);
    model.places.forEach(({name,x,y},i) => {
      diagram.append(svg("circle",{cx:x,cy:y,r:24,fill:marking[i] ? "#b5f5d6" : "#fff",stroke:"#284663","stroke-width":2}));
      diagram.append(label(x,y+5,marking[i],16),label(x,y+43,name,model.wide ? 12 : 15));
    });
    for (const transition of model.transitions) {
      const {name,x,y} = transition;
      diagram.append(svg("rect",{x:x-12,y:y-15,width:24,height:30,rx:3,fill:enabled(marking,transition) ? "#006b63" : "#647b94"}),label(x,y+31,name,model.wide ? 11 : 14));
    }
  }

  function render() {
    draw();
    get("nombre").textContent=model.name;
    get("descripcion").textContent=model.description;
    get("marcado").textContent=model.places.map(({name},index)=>name+" = "+marking[index]).join(" · ");
    get("estado").textContent=outcome(marking);
    get("traza").textContent=steps.length ? "Traza: "+steps.map(step=>step.name).join(" → ") : "Marcado inicial";
    get("atras").disabled = steps.length===0;
    buttons.forEach((button,i)=>button.setAttribute("aria-disabled",String(!enabled(marking,model.transitions[i]))));
  }

  function reset() {
    marking=model.initial;
    steps=[];
    render();
  }

  function choose() {
    model=models[Number(select.value)];
    buttons=model.transitions.map(transition=>{
      const button=document.createElement("button");
      button.type="button";
      button.textContent=transition.name;
      const describe = arcs => Object.entries(arcs).map(([i,n])=>n+" × "+model.places[i].name).join(" + ") || "∅";
      button.title=describe(transition.input)+" → "+describe(transition.output);
      button.onclick=()=>{
        if (!enabled(marking,transition)) return;
        steps.push({name:transition.name,before:marking});
        marking=fire(marking,transition);
        render();
      };
      return button;
    });
    controls.replaceChildren(...buttons);
    get("alcanzables").replaceChildren();
    reset();
  }

  models.forEach((candidate,index)=>select.add(new Option(candidate.name,index)));
  select.onchange=choose;
  get("reiniciar").onclick=reset;
  get("atras").onclick=()=>{
    if (!steps.length) return;
    marking=steps.pop().before;
    render();
    if (!steps.length) get("reiniciar").focus();
  };
  get("explorar").onclick=()=>{
    const {states,edges}=explore(model);
    const holder=get("alcanzables");
    const wrap=document.createElement("div");
    wrap.className="tabla";
    const table=document.createElement("table");
    const caption=table.createCaption();
    caption.textContent=states.length+" marcados. Orden de lugares: "+model.places.map(place=>place.name).join(", ");
    const header=table.createTHead().insertRow();
    for (const label of ["Estado","Marcado","Traza mínima","Sucesores","Clasificación"]) {
      const cell=document.createElement("th");
      cell.scope="col";
      cell.textContent=label;
      header.append(cell);
    }
    const body=table.createTBody();
    states.forEach(({marking:m,trace},i)=>{
      const row=body.insertRow();
      for (const value of ["M"+i,vector(m),trace.join(" → ")||"ε",edges[i].map(([name,j])=>name+" → M"+j).join(" · ")||"∅",outcome(m)]) {
        row.insertCell().textContent=value;
      }
    });
    wrap.append(table);
    holder.replaceChildren(wrap);
    get("estado").textContent=outcome(marking)+" · "+states.length+" marcados alcanzables desde el inicial.";
  };
  choose();
}
if (typeof document !== "undefined") start();