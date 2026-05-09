const STACK_TILE_QUEUE_LIMIT=7;

const STACK_TILE_ICONS=[
  "🦁","🐻","🐸","🐢",
  "🍎","🍋","🍇","🍔",
  "⭐","💎","🔥","⚡",
  "🎲","🎯","🎁","🧩",
  "🌙","☀️","🌈","❄️"
];

const STACK_TILE_DIFFICULTIES={
  easy:{
    label:"쉬움",
    types:8,
    total:48,
    layers:3,
    shuffle:2,
    store:1,
    multiplier:1,
    templates:["smallDiamond","multiPile"],
    selectableMin:12,
    selectableMax:20
  },
  normal:{
    label:"보통",
    types:10,
    total:60,
    layers:4,
    shuffle:1,
    store:1,
    multiplier:1.2,
    templates:["diamond","multiPile","bridge"],
    selectableMin:9,
    selectableMax:16
  },
  hard:{
    label:"어려움",
    types:12,
    total:84,
    layers:6,
    shuffle:1,
    store:1,
    multiplier:1.5,
    templates:["bridge","compactCore","multiPile"],
    selectableMin:6,
    selectableMax:13
  },
  hell:{
    label:"지옥",
    types:14,
    total:105,
    layers:7,
    shuffle:0,
    store:1,
    multiplier:2,
    templates:["compactCore","bridge","diamondCore"],
    selectableMin:5,
    selectableMax:10
  }
};

const stackTileState={
  difficulty:"normal",
  tiles:[],
  initialTiles:[],
  queue:[],
  history:[],
  startedAt:0,
  endedAt:null,
  timerId:null,
  status:"idle",
  message:"",
  moveCount:0,
  maxQueueLength:0,
  usedItems:{
    undo:0,
    shuffle:0,
    store:0
  },
  itemCounts:{
    shuffle:0,
    store:0
  },
  lastFeedbackTileId:"",
  lastAddedTileId:"",
  lastStoredTileIds:[],
  matchingIds:[],
  isAnimating:false
};

function getStackTileConfig(){
  return STACK_TILE_DIFFICULTIES[stackTileState.difficulty]||STACK_TILE_DIFFICULTIES.normal;
}

function cloneStackTileTiles(tiles=stackTileState.tiles){
  return tiles.map(tile=>({...tile}));
}

function saveStackTileHistory(){
  stackTileState.history.push({
    tiles:cloneStackTileTiles(),
    queue:[...stackTileState.queue],
    moveCount:stackTileState.moveCount,
    maxQueueLength:stackTileState.maxQueueLength,
    usedItems:{...stackTileState.usedItems},
    itemCounts:{...stackTileState.itemCounts},
    status:stackTileState.status,
    message:stackTileState.message,
    endedAt:stackTileState.endedAt
  });

  if(stackTileState.history.length>80){
    stackTileState.history.shift();
  }
}

function restoreStackTileSnapshot(snapshot){
  stackTileState.tiles=snapshot.tiles.map(tile=>({...tile}));
  stackTileState.queue=[...snapshot.queue];
  stackTileState.moveCount=snapshot.moveCount;
  stackTileState.maxQueueLength=snapshot.maxQueueLength;
  stackTileState.usedItems={...snapshot.usedItems};
  stackTileState.itemCounts={...snapshot.itemCounts};
  stackTileState.status=snapshot.status;
  stackTileState.message=snapshot.message;
  stackTileState.endedAt=snapshot.endedAt;
  stackTileState.lastAddedTileId="";
  stackTileState.lastStoredTileIds=[];
  stackTileState.matchingIds=[];
  stackTileState.isAnimating=false;
}

function shuffleArray(arr){
  const copy=[...arr];

  for(let i=copy.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [copy[i],copy[j]]=[copy[j],copy[i]];
  }

  return copy;
}

function randomPick(arr){
  return arr[Math.floor(Math.random()*arr.length)];
}

function generateStackTileTypes(config){
  const groups=Math.floor(config.total/3);
  const types=[];

  for(let i=0;i<groups;i++){
    const icon=STACK_TILE_ICONS[i%config.types];
    types.push(icon,icon,icon);
  }

  return shuffleArray(types);
}

function addAnchor(list,x,y,weight=1){
  if(x<0||y<0||x>18||y>15)return;
  list.push({x,y,weight});
}

function buildStackTileAnchors(template){
  const anchors=[];

  if(template==="smallDiamond"){
    const cx=8;
    const cy=6;
    const radius=3;

    for(let dy=-radius;dy<=radius;dy++){
      for(let dx=-radius;dx<=radius;dx++){
        const dist=Math.abs(dx)+Math.abs(dy);
        if(dist>radius)continue;
        addAnchor(anchors,cx+dx*2,cy+dy*2,Math.max(1,radius-dist+1));
      }
    }
  }

  if(template==="diamond"||template==="diamondCore"){
    const cx=8;
    const cy=6;
    const radius=template==="diamondCore"?5:4;

    for(let dy=-radius;dy<=radius;dy++){
      for(let dx=-radius;dx<=radius;dx++){
        const dist=Math.abs(dx)+Math.abs(dy);
        if(dist>radius)continue;

        const step=dist<=2?1:2;
        addAnchor(anchors,cx+dx*step,cy+dy*step,Math.max(1,radius-dist+1));
      }
    }
  }

  if(template==="multiPile"){
    const centers=[
      {x:5,y:4},
      {x:11,y:4},
      {x:8,y:8},
      {x:4,y:10},
      {x:12,y:10}
    ];

    centers.forEach((center,idx)=>{
      const radius=idx===2?3:2;

      for(let dy=-radius;dy<=radius;dy++){
        for(let dx=-radius;dx<=radius;dx++){
          const dist=Math.abs(dx)+Math.abs(dy);
          if(dist>radius)continue;
          addAnchor(anchors,center.x+dx,center.y+dy,Math.max(1,radius-dist+1));
        }
      }
    });
  }

  if(template==="bridge"){
    const left={x:5,y:6};
    const right={x:12,y:6};

    [left,right].forEach(center=>{
      for(let dy=-3;dy<=3;dy++){
        for(let dx=-3;dx<=3;dx++){
          const dist=Math.abs(dx)+Math.abs(dy);
          if(dist>3)continue;
          addAnchor(anchors,center.x+dx,center.y+dy,Math.max(1,4-dist));
        }
      }
    });

    for(let i=0;i<8;i++){
      addAnchor(anchors,5+i,6+(i%2),3);
    }

    for(let i=0;i<6;i++){
      addAnchor(anchors,6+i,8-(i%2),2);
    }
  }

  if(template==="compactCore"){
    const cx=8;
    const cy=7;

    for(let dy=-5;dy<=5;dy++){
      for(let dx=-5;dx<=5;dx++){
        const dist=Math.abs(dx)+Math.abs(dy);
        if(dist>6)continue;

        const dense=dist<=3;
        addAnchor(
          anchors,
          cx+dx,
          cy+dy,
          dense?6-dist:2
        );
      }
    }
  }

  return shuffleArray(anchors);
}

function getStackTileOffsetPattern(){
  const patterns=[
    [
      {dx:0,dy:0},
      {dx:0,dy:0},
      {dx:1,dy:0},
      {dx:1,dy:1},
      {dx:0,dy:1},
      {dx:0,dy:0},
      {dx:1,dy:1}
    ],
    [
      {dx:0,dy:0},
      {dx:1,dy:0},
      {dx:0,dy:0},
      {dx:0,dy:1},
      {dx:1,dy:1},
      {dx:0,dy:0},
      {dx:1,dy:0}
    ],
    [
      {dx:0,dy:0},
      {dx:0,dy:1},
      {dx:0,dy:0},
      {dx:1,dy:0},
      {dx:1,dy:1},
      {dx:0,dy:1},
      {dx:0,dy:0}
    ],
    [
      {dx:0,dy:0},
      {dx:1,dy:1},
      {dx:0,dy:0},
      {dx:1,dy:0},
      {dx:0,dy:1},
      {dx:1,dy:1},
      {dx:0,dy:0}
    ]
  ];

  return randomPick(patterns);
}

function generateStackTileSlotsByTemplate(config,template){
  const anchors=buildStackTileAnchors(template);
  const weighted=[];

  anchors.forEach((anchor,idx)=>{
    const weight=Math.max(1,Number(anchor.weight||1));
    for(let i=0;i<weight;i++){
      weighted.push(idx);
    }
  });

  const heights=new Map();
  let total=0;

  while(total<config.total&&weighted.length){
    const anchorIdx=randomPick(weighted);
    const current=heights.get(anchorIdx)||0;

    if(current>=config.layers)continue;

    heights.set(anchorIdx,current+1);
    total++;
  }

  let safety=0;

  while(total<config.total&&safety<5000){
    safety++;
    const anchorIdx=Math.floor(Math.random()*anchors.length);
    const current=heights.get(anchorIdx)||0;

    if(current>=config.layers)continue;

    heights.set(anchorIdx,current+1);
    total++;
  }

  const slots=[];

  [...heights.entries()].forEach(([anchorIdx,height])=>{
    const anchor=anchors[anchorIdx];
    const pattern=getStackTileOffsetPattern();

    for(let z=0;z<height;z++){
      const offset=pattern[z%pattern.length];

      slots.push({
        x:anchor.x+offset.dx,
        y:anchor.y+offset.dy,
        z
      });
    }
  });

  return shuffleArray(slots).slice(0,config.total);
}

function isStackTileOverlapping(a,b){
  return !(
    a.x+2<=b.x||
    b.x+2<=a.x||
    a.y+2<=b.y||
    b.y+2<=a.y
  );
}

function getStackTileDrawRank(tile){
  return Number(tile.z||0)*10000 + Number(tile.y||0)*100 + Number(tile.x||0);
}

function isStackTileSelectableFromList(tile,tiles){
  if(!tile||tile.removed)return false;

  if(tile.area==="storage")return true;
  if(tile.area!=="board")return false;

  const tileRank=getStackTileDrawRank(tile);

  return !tiles.some(other=>{
    if(!other||other.removed)return false;
    if(other.area!=="board")return false;
    if(other.id===tile.id)return false;
    if(!isStackTileOverlapping(tile,other))return false;

    const otherRank=getStackTileDrawRank(other);

    return otherRank>tileRank;
  });
}

function isStackTileSelectable(tile){
  return isStackTileSelectableFromList(tile,stackTileState.tiles);
}

function countStackTileSelectable(tiles){
  return tiles.filter(tile=>isStackTileSelectableFromList(tile,tiles)).length;
}

function createStackTileTiles(){
  const config=getStackTileConfig();
  let bestTiles=null;
  let bestScore=Infinity;

  for(let attempt=0;attempt<40;attempt++){
    const template=randomPick(config.templates);
    const slots=generateStackTileSlotsByTemplate(config,template);
    const types=generateStackTileTypes(config);

    const tiles=types.map((type,idx)=>({
      id:`stackTile_${Date.now()}_${attempt}_${idx}`,
      type,
      x:slots[idx]?.x||0,
      y:slots[idx]?.y||0,
      z:slots[idx]?.z||0,
      area:"board",
      removed:false,
      storageIndex:null
    }));

    const selectable=countStackTileSelectable(tiles);
    const inRange=selectable>=config.selectableMin&&selectable<=config.selectableMax;
    const score=inRange?0:Math.min(
      Math.abs(selectable-config.selectableMin),
      Math.abs(selectable-config.selectableMax)
    );

    if(score<bestScore){
      bestScore=score;
      bestTiles=tiles;
    }

    if(inRange)return tiles;
  }

  return bestTiles||[];
}

function resetStackTileRunWithTiles(tiles,message){
  const config=getStackTileConfig();

  stackTileState.tiles=tiles.map(tile=>({
    ...tile,
    area:"board",
    removed:false,
    storageIndex:null
  }));

  stackTileState.queue=[];
  stackTileState.history=[];
  stackTileState.startedAt=Date.now();
  stackTileState.endedAt=null;
  stackTileState.status="playing";
  stackTileState.message=message||"완전히 드러난 타일만 선택할 수 있습니다.";
  stackTileState.moveCount=0;
  stackTileState.maxQueueLength=0;
  stackTileState.usedItems={undo:0,shuffle:0,store:0};
  stackTileState.itemCounts={
    shuffle:config.shuffle,
    store:config.store
  };
  stackTileState.lastFeedbackTileId="";
  stackTileState.lastAddedTileId="";
  stackTileState.lastStoredTileIds=[];
  stackTileState.matchingIds=[];
  stackTileState.isAnimating=false;

  startStackTileTimer();
  renderStackTileGame();
}

function restartStackTileGame(){
  const tiles=createStackTileTiles();

  stackTileState.initialTiles=cloneStackTileTiles(tiles);
  resetStackTileRunWithTiles(tiles,"새 게임을 시작했습니다.");
}

window.restartStackTileGame=restartStackTileGame;

function retryStackTileGame(){
  if(!stackTileState.initialTiles.length){
    restartStackTileGame();
    return;
  }

  resetStackTileRunWithTiles(stackTileState.initialTiles,"같은 배치로 다시 시작했습니다.");
}

window.retryStackTileGame=retryStackTileGame;

function setStackTileDifficulty(level){
  if(!STACK_TILE_DIFFICULTIES[level])return;

  stackTileState.difficulty=level;
  restartStackTileGame();
}

window.setStackTileDifficulty=setStackTileDifficulty;

function startStackTileTimer(){
  if(stackTileState.timerId){
    clearInterval(stackTileState.timerId);
    stackTileState.timerId=null;
  }

  stackTileState.timerId=setInterval(()=>{
    if(stackTileState.status==="playing"){
      renderStackTileGame();
    }
  },1000);
}

function stopStackTileTimer(){
  if(stackTileState.timerId){
    clearInterval(stackTileState.timerId);
    stackTileState.timerId=null;
  }
}

function getStackTileElapsedMs(){
  if(!stackTileState.startedAt)return 0;

  const end=stackTileState.endedAt||Date.now();
  return Math.max(0,end-stackTileState.startedAt);
}

function formatStackTileTime(ms){
  const sec=Math.floor(ms/1000);
  const m=String(Math.floor(sec/60)).padStart(2,"0");
  const s=String(sec%60).padStart(2,"0");

  return `${m}:${s}`;
}

function calculateStackTileScore(){
  if(stackTileState.status!=="clear")return 0;

  const config=getStackTileConfig();
  const base=10000;
  const elapsedSec=Math.floor(getStackTileElapsedMs()/1000);
  const timePenalty=elapsedSec*10;
  const movePenalty=stackTileState.moveCount*5;
  const itemPenalty=
    stackTileState.usedItems.undo*300+
    stackTileState.usedItems.shuffle*500+
    stackTileState.usedItems.store*400;

  let bonus=0;

  if(
    stackTileState.usedItems.undo===0&&
    stackTileState.usedItems.shuffle===0&&
    stackTileState.usedItems.store===0
  ){
    bonus+=1000;
  }

  if(stackTileState.maxQueueLength<=5)bonus+=700;

  return Math.max(0,Math.floor((base-timePenalty-movePenalty-itemPenalty+bonus)*config.multiplier));
}

function getStackTileRemainingCount(){
  return stackTileState.tiles.filter(tile=>!tile.removed).length;
}

function insertStackTileIntoQueue(tile){
  const sameIndexes=[];

  stackTileState.queue.forEach((tileId,index)=>{
    const qTile=stackTileState.tiles.find(v=>v.id===tileId);

    if(qTile&&qTile.type===tile.type){
      sameIndexes.push(index);
    }
  });

  if(sameIndexes.length){
    const insertIndex=Math.max(...sameIndexes)+1;
    stackTileState.queue.splice(insertIndex,0,tile.id);
  }else{
    stackTileState.queue.push(tile.id);
  }
}

function getStackTileTripleIds(type){
  return stackTileState.queue.filter(tileId=>{
    const tile=stackTileState.tiles.find(v=>v.id===tileId);
    return tile&&tile.type===type;
  }).slice(0,3);
}

function removeStackTileIds(ids){
  const removeIds=new Set(ids);

  stackTileState.queue=stackTileState.queue.filter(tileId=>!removeIds.has(tileId));

  stackTileState.tiles.forEach(tile=>{
    if(removeIds.has(tile.id)){
      tile.removed=true;
      tile.area="removed";
    }
  });
}

function finishStackTileMove(removedCount){
  const remaining=getStackTileRemainingCount();

  if(remaining===0){
    stackTileState.status="clear";
    stackTileState.endedAt=Date.now();
    stackTileState.message=`클리어! 점수 ${calculateStackTileScore().toLocaleString()}점`;
    stopStackTileTimer();
    return;
  }

  if(stackTileState.queue.length>=STACK_TILE_QUEUE_LIMIT&&removedCount===0){
    stackTileState.status="fail";
    stackTileState.endedAt=Date.now();
    stackTileState.message="대기열이 가득 찼습니다. 실패!";
    stopStackTileTimer();
    return;
  }

  stackTileState.message=removedCount
    ? "같은 타일 3개가 사라졌습니다."
    : "타일을 대기열에 넣었습니다.";
}

function handleStackTileClick(tileId){
  if(stackTileState.status!=="playing")return;
  if(stackTileState.isAnimating)return;

  const tile=stackTileState.tiles.find(v=>v.id===tileId);

  if(!tile||tile.removed)return;

  if(!isStackTileSelectable(tile)){
    stackTileState.lastFeedbackTileId=tileId;
    renderStackTileGame();

    setTimeout(()=>{
      if(stackTileState.lastFeedbackTileId===tileId){
        stackTileState.lastFeedbackTileId="";
        renderStackTileGame();
      }
    },220);

    return;
  }

  saveStackTileHistory();

  tile.area="queue";
  tile.storageIndex=null;
  stackTileState.moveCount++;
  stackTileState.lastAddedTileId=tile.id;
  stackTileState.lastStoredTileIds=[];

  insertStackTileIntoQueue(tile);
  stackTileState.maxQueueLength=Math.max(stackTileState.maxQueueLength,stackTileState.queue.length);

  const tripleIds=getStackTileTripleIds(tile.type);

  if(tripleIds.length>=3){
    stackTileState.matchingIds=tripleIds;
    stackTileState.isAnimating=true;
    stackTileState.message="같은 타일 3개가 맞춰졌습니다.";
    renderStackTileGame();

    setTimeout(()=>{
      removeStackTileIds(tripleIds);
      stackTileState.matchingIds=[];
      stackTileState.isAnimating=false;
      stackTileState.lastAddedTileId="";
      finishStackTileMove(3);
      renderStackTileGame();
    },260);

    return;
  }

  finishStackTileMove(0);
  renderStackTileGame();

  setTimeout(()=>{
    if(stackTileState.lastAddedTileId===tile.id){
      stackTileState.lastAddedTileId="";
      renderStackTileGame();
    }
  },260);
}

window.handleStackTileClick=handleStackTileClick;

function useStackTileUndo(){
  if(stackTileState.status!=="playing")return;
  if(stackTileState.isAnimating)return;
  if(!stackTileState.history.length)return;

  const snapshot=stackTileState.history.pop();

  stackTileState.usedItems.undo++;

  restoreStackTileSnapshot(snapshot);
  stackTileState.status="playing";
  stackTileState.message="이전 상태로 되돌렸습니다.";

  renderStackTileGame();
}

window.useStackTileUndo=useStackTileUndo;

function useStackTileStore(){
  if(stackTileState.status!=="playing")return;
  if(stackTileState.isAnimating)return;
  if(stackTileState.itemCounts.store<=0)return;

  if(stackTileState.queue.length<3){
    stackTileState.message="대기열에 타일이 3개 이상 있어야 합니다.";
    renderStackTileGame();
    return;
  }

  saveStackTileHistory();

  const targets=stackTileState.queue.slice(0,3);
  stackTileState.queue=stackTileState.queue.slice(3);

  targets.forEach((tileId,idx)=>{
    const tile=stackTileState.tiles.find(v=>v.id===tileId);
    if(!tile)return;

    tile.area="storage";
    tile.storageIndex=idx;
  });

  stackTileState.lastStoredTileIds=[...targets];
  stackTileState.itemCounts.store--;
  stackTileState.usedItems.store++;
  stackTileState.message="대기열 앞 3칸을 보관 영역에 내려놓았습니다.";

  renderStackTileGame();

  setTimeout(()=>{
    stackTileState.lastStoredTileIds=[];
    renderStackTileGame();
  },300);
}

window.useStackTileStore=useStackTileStore;

function useStackTileShuffle(){
  if(stackTileState.status!=="playing")return;
  if(stackTileState.isAnimating)return;
  if(stackTileState.itemCounts.shuffle<=0)return;

  const boardTiles=stackTileState.tiles.filter(tile=>tile.area==="board"&&!tile.removed);

  if(boardTiles.length<2)return;

  saveStackTileHistory();

  const positions=shuffleArray(boardTiles.map(tile=>({
    x:tile.x,
    y:tile.y,
    z:tile.z
  })));

  boardTiles.forEach((tile,idx)=>{
    tile.x=positions[idx].x;
    tile.y=positions[idx].y;
    tile.z=positions[idx].z;
  });

  stackTileState.itemCounts.shuffle--;
  stackTileState.usedItems.shuffle++;
  stackTileState.message="보드에 남은 타일을 재배치했습니다.";

  renderStackTileGame();
}

window.useStackTileShuffle=useStackTileShuffle;

function renderStackTileStats(){
  const config=getStackTileConfig();
  const elapsed=formatStackTileTime(getStackTileElapsedMs());
  const remaining=getStackTileRemainingCount();
  const score=stackTileState.status==="clear"?calculateStackTileScore():0;

  return`
    <div class="stack-tile-stats">
      <span class="stack-tile-stat">난이도 ${config.label}</span>
      <span class="stack-tile-stat">남은 타일 ${remaining}</span>
      <span class="stack-tile-stat">시간 ${elapsed}</span>
      <span class="stack-tile-stat">이동 ${stackTileState.moveCount}</span>
      ${stackTileState.status==="clear"?`<span class="stack-tile-stat">점수 ${score.toLocaleString()}</span>`:""}
    </div>
  `;
}

function renderStackTileDifficultyButtons(){
  return`
    <div class="stack-tile-difficulty-row">
      ${Object.entries(STACK_TILE_DIFFICULTIES).map(([key,cfg])=>`
        <button type="button" class="${stackTileState.difficulty===key?"active":""}" onclick="setStackTileDifficulty('${key}')">
          ${cfg.label}
        </button>
      `).join("")}
    </div>
  `;
}

function renderStackTileBoard(){
  const boardTiles=stackTileState.tiles
    .filter(tile=>tile.area==="board"&&!tile.removed)
    .sort((a,b)=>{
      if(a.z!==b.z)return a.z-b.z;
      return a.y-b.y||a.x-b.x;
    });

  return`
    <div class="stack-tile-board-card">
      <div class="stack-tile-board">
        ${boardTiles.map((tile,idx)=>{
          const selectable=isStackTileSelectable(tile);
          const feedback=stackTileState.lastFeedbackTileId===tile.id?"blocked-feedback":"";
          const cls=selectable?"selectable":"blocked";
          const zIndex=10+tile.z*120+idx;

          return`
            <button
              type="button"
              class="stack-tile ${cls} ${feedback}"
              style="--x:${tile.x};--y:${tile.y};z-index:${zIndex};"
              onclick="handleStackTileClick('${tile.id}')"
              title="${selectable?"선택 가능":"가려져 있어 선택 불가"}"
            >${tile.type}</button>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function renderStackTileQueue(){
  const tiles=stackTileState.queue.map(tileId=>stackTileState.tiles.find(v=>v.id===tileId)).filter(Boolean);
  const slots=[];

  for(let i=0;i<STACK_TILE_QUEUE_LIMIT;i++){
    const tile=tiles[i];

    if(tile){
      const matching=stackTileState.matchingIds.includes(tile.id)?"matching":"";
      const added=stackTileState.lastAddedTileId===tile.id?"added-pop":"";

      slots.push(`<div class="stack-tile-queue-tile ${matching} ${added}">${tile.type}</div>`);
    }else{
      slots.push(`<div class="stack-tile-slot">${i+1}</div>`);
    }
  }

  return`
    <div class="stack-tile-lane-card">
      <div class="stack-tile-lane-title">대기열 ${STACK_TILE_QUEUE_LIMIT}칸</div>
      <div class="stack-tile-queue">${slots.join("")}</div>
    </div>
  `;
}

function renderStackTileStorage(){
  const storageTiles=stackTileState.tiles
    .filter(tile=>tile.area==="storage"&&!tile.removed)
    .sort((a,b)=>(a.storageIndex||0)-(b.storageIndex||0));

  const slots=[];

  for(let i=0;i<3;i++){
    const tile=storageTiles[i];

    if(tile){
      const pop=stackTileState.lastStoredTileIds.includes(tile.id)?"stored-pop":"";

      slots.push(`
        <button type="button" class="stack-tile-storage-tile ${pop}" onclick="handleStackTileClick('${tile.id}')">
          ${tile.type}
        </button>
      `);
    }else{
      slots.push(`<div class="stack-tile-slot">보관</div>`);
    }
  }

  return`
    <div class="stack-tile-lane-card">
      <div class="stack-tile-lane-title">보관 영역</div>
      <div class="stack-tile-storage">${slots.join("")}</div>
    </div>
  `;
}

function renderStackTileItems(){
  return`
    <div class="stack-tile-item-row">
      <button type="button" onclick="useStackTileUndo()" ${!stackTileState.history.length||stackTileState.isAnimating?"disabled":""}>
        실행취소 ∞
      </button>
      <button type="button" onclick="useStackTileShuffle()" ${stackTileState.itemCounts.shuffle<=0||stackTileState.isAnimating?"disabled":""}>
        재배치 ${stackTileState.itemCounts.shuffle}
      </button>
      <button type="button" onclick="useStackTileStore()" ${stackTileState.itemCounts.store<=0||stackTileState.isAnimating?"disabled":""}>
        보관 ${stackTileState.itemCounts.store}
      </button>
      <button type="button" onclick="retryStackTileGame()">
        다시하기
      </button>
      <button type="button" onclick="restartStackTileGame()">
        새 게임
      </button>
    </div>
  `;
}

function renderStackTileGame(){
  const root=document.getElementById("stackTileRoot");
  if(!root)return;

  if(stackTileState.status==="idle"){
    restartStackTileGame();
    return;
  }

  const msgClass=stackTileState.status==="clear"
    ? "clear"
    : stackTileState.status==="fail"
      ? "fail"
      : "";

  root.innerHTML=`
    <div class="stack-tile-wrap">
      <div class="stack-tile-top">
        ${renderStackTileStats()}
        ${renderStackTileDifficultyButtons()}
      </div>

      ${renderStackTileBoard()}

      <div class="stack-tile-bottom">
        ${renderStackTileStorage()}
        ${renderStackTileQueue()}
        ${renderStackTileItems()}
        <div class="stack-tile-message ${msgClass}">
          ${escapeHtml(stackTileState.message||"")}
        </div>
      </div>
    </div>
  `;
}

function renderStackTileScreen(){
  const panel=document.getElementById("stackTilePanel");
  if(!panel)return;

  if(stackTileState.status==="idle"){
    restartStackTileGame();
    return;
  }

  renderStackTileGame();
}

window.renderStackTileScreen=renderStackTileScreen;

(function patchStackTileWebgamePanel(){
  const original=window.updateEscapeLabyrinthHomePanels;

  window.updateEscapeLabyrinthHomePanels=function(){
    if(typeof original==="function")original();

    const panel=document.getElementById("stackTilePanel");
    if(!panel)return;

    const isStackTile=state.escapeLabyrinthTab==="stackTile";

    panel.classList.toggle("hidden",!isStackTile);

    if(isStackTile){
      renderStackTileScreen();
    }
  };
})();
